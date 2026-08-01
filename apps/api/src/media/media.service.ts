import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { MediaStatus } from '../../generated/prisma/enums';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import { derivativeKey, originalKey } from './media-keys';
import {
  DERIVATIVE_VARIANTS,
  DerivativeVariant,
  MAX_PHOTOS_PER_LISTING,
} from './media-limits';
import { MediaStorageService } from './media-storage.service';
import { MEDIA_QUEUE, type MediaJobData } from './media.jobs';
import type {
  CompleteUploadDto,
  CreateUploadDto,
  MediaAssetDto,
  MediaListDto,
  UploadIntentDto,
} from './media.schema';

const ASSET_SELECT = {
  id: true,
  propertyId: true,
  roomId: true,
  storageKey: true,
  status: true,
  blurhash: true,
  width: true,
  height: true,
  sortOrder: true,
  isCover: true,
} satisfies Prisma.MediaAssetSelect;

type AssetRow = Prisma.MediaAssetGetPayload<{ select: typeof ASSET_SELECT }>;

/**
 * Whose photos these are. A room's gallery and the property's own are separate
 * listings — separate order, separate cover — so every read and write names one.
 */
export interface MediaOwner {
  propertyId: string;
  roomId: string | null;
}

/** What a room's photos amount to for anything that is not the photo grid. */
export interface RoomGallery {
  photoCount: number;
  coverUrl: string | null;
}

/**
 * A photo the host can see. `PENDING` rows are a presigned URL that may never be
 * used, so they are invisible everywhere except the sweep.
 */
const VISIBLE: Prisma.MediaAssetWhereInput = {
  status: { not: MediaStatus.PENDING },
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue<MediaJobData>,
  ) {}

  async listFor(owner: MediaOwner): Promise<MediaListDto> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { ...owner, ...VISIBLE },
      orderBy: { sortOrder: 'asc' },
      select: ASSET_SELECT,
    });

    return { media: assets.map((asset) => this.toDto(asset)) };
  }

  /**
   * Reserves the row and signs the URL in one call. The row exists before any
   * bytes do, which is what lets the sweep find an upload the host abandoned —
   * the alternative is listing the bucket looking for objects nothing references.
   */
  async createUploadIntent(
    propertyId: string,
    { roomId, contentType, byteSize }: CreateUploadDto,
  ): Promise<UploadIntentDto> {
    const owner = { propertyId, roomId };
    const existing = await this.prisma.mediaAsset.count({
      where: { ...owner, ...VISIBLE },
    });
    if (existing >= MAX_PHOTOS_PER_LISTING) {
      throw new DomainError(
        'MEDIA_LIMIT_REACHED',
        `This can have at most ${MAX_PHOTOS_PER_LISTING} photos. Delete one to add another.`,
      );
    }

    // The storage key is derived from the id, so the id has to exist before the
    // insert rather than being handed back by it.
    const mediaId = randomUUID();
    const last = await this.prisma.mediaAsset.findFirst({
      where: owner,
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    try {
      await this.prisma.mediaAsset.create({
        data: {
          ...owner,
          id: mediaId,
          storageKey: originalKey(propertyId, mediaId),
          contentType,
          byteSize,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      // The room's foreign key carries the property too, so a room belonging to
      // someone else's property fails here rather than being checked for.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new DomainError('NOT_FOUND', 'This room was not found.');
      }
      throw error;
    }

    return {
      mediaId,
      uploadUrl: await this.storage.presignUpload(
        originalKey(propertyId, mediaId),
        contentType,
      ),
    };
  }

  /**
   * The browser reports what it uploaded. The photo becomes visible immediately
   * at its original size — a host on a slow connection should not watch a spinner
   * while a worker catches up — and the derivatives replace it when they land.
   */
  async completeUpload(
    propertyId: string,
    mediaId: string,
    { width, height }: CompleteUploadDto,
  ): Promise<MediaAssetDto> {
    const pending = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, propertyId, status: MediaStatus.PENDING },
      select: { id: true, roomId: true },
    });
    if (!pending) {
      throw new DomainError('NOT_FOUND', 'This upload was not found.');
    }

    const asset = await this.markUploaded(
      { propertyId, roomId: pending.roomId },
      mediaId,
      width,
      height,
    );
    await this.queue.add('derivatives', { kind: 'derivatives', mediaId });

    return this.toDto(asset);
  }

  /**
   * The order the host sees is the order they sent, so the whole list is assigned
   * in one transaction rather than nudged one position at a time.
   */
  async reorder(owner: MediaOwner, mediaIds: string[]): Promise<MediaListDto> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { ...owner, ...VISIBLE },
      select: { id: true },
    });

    const known = new Set(assets.map((asset) => asset.id));
    const requested = new Set(mediaIds);
    if (
      requested.size !== mediaIds.length ||
      known.size !== requested.size ||
      mediaIds.some((id) => !known.has(id))
    ) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Reordering must list every photo of this listing exactly once.',
      );
    }

    await this.prisma.$transaction(
      mediaIds.map((id, sortOrder) =>
        this.prisma.mediaAsset.update({ where: { id }, data: { sortOrder } }),
      ),
    );

    return this.listFor(owner);
  }

  /**
   * Clearing before setting is required, not tidiness: a partial unique index
   * enforces one cover per listing, so the two writes are one transaction.
   */
  async setCover(propertyId: string, mediaId: string): Promise<MediaListDto> {
    const asset = await this.findVisible(propertyId, mediaId);
    const owner = { propertyId, roomId: asset.roomId };

    await this.prisma.$transaction([
      this.prisma.mediaAsset.updateMany({
        where: { ...owner, isCover: true },
        data: { isCover: false },
      }),
      this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: { isCover: true },
      }),
    ]);

    return this.listFor(owner);
  }

  /**
   * The row goes now and the objects go on the queue: the host's grid must not
   * wait on the bucket, and a delete that fails in storage is retried rather than
   * leaving a photo the host thought they removed.
   */
  async remove(propertyId: string, mediaId: string): Promise<MediaListDto> {
    const asset = await this.findVisible(propertyId, mediaId);
    const owner = { propertyId, roomId: asset.roomId };

    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    await this.queue.add('purge', {
      kind: 'purge',
      keys: this.allKeys(propertyId, mediaId),
    });

    // A listing without a cover is a listing whose first photo is the cover, so
    // the position the host already ordered decides the replacement.
    if (asset.isCover) {
      const next = await this.prisma.mediaAsset.findFirst({
        where: { ...owner, ...VISIBLE },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });
      if (next) {
        await this.prisma.mediaAsset.update({
          where: { id: next.id },
          data: { isCover: true },
        });
      }
    }

    return this.listFor(owner);
  }

  /**
   * What each room's gallery looks like from the outside: how many photos, and
   * the cover to show for it. The rooms list asks for every room at once, because
   * a card per room asking for its own photos is a request per room on a
   * connection that cannot afford one.
   */
  async galleriesForRooms(
    propertyId: string,
    roomIds: string[],
  ): Promise<Map<string, RoomGallery>> {
    const galleries = new Map<string, RoomGallery>(
      roomIds.map((roomId) => [roomId, { photoCount: 0, coverUrl: null }]),
    );
    if (roomIds.length === 0) {
      return galleries;
    }

    const where = { propertyId, roomId: { in: roomIds }, ...VISIBLE };
    const [counts, covers] = await Promise.all([
      this.prisma.mediaAsset.groupBy({
        by: ['roomId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { ...where, isCover: true },
        select: ASSET_SELECT,
      }),
    ]);

    for (const row of counts) {
      const gallery = row.roomId && galleries.get(row.roomId);
      if (gallery) {
        gallery.photoCount = row._count._all;
      }
    }
    for (const cover of covers) {
      const gallery = cover.roomId && galleries.get(cover.roomId);
      if (gallery) {
        gallery.coverUrl = this.toDto(cover).thumbnailUrl;
      }
    }

    return galleries;
  }

  allKeys(propertyId: string, mediaId: string): string[] {
    return [
      originalKey(propertyId, mediaId),
      ...Object.keys(DERIVATIVE_VARIANTS).map((variant) =>
        derivativeKey(propertyId, mediaId, variant as DerivativeVariant),
      ),
    ];
  }

  /**
   * The property guard proves the caller may touch the property; this proves the
   * photo is that property's, and reads back which listing it belongs to.
   */
  private async findVisible(
    propertyId: string,
    mediaId: string,
  ): Promise<{ roomId: string | null; isCover: boolean }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, propertyId, ...VISIBLE },
      select: { roomId: true, isCover: true },
    });
    if (!asset) {
      throw new DomainError('NOT_FOUND', 'This photo was not found.');
    }
    return asset;
  }

  /**
   * The first photo of a listing is its cover. Two uploads confirming at once
   * both see an empty listing, and the index rejects the loser — which is the
   * right outcome, so it is caught here rather than surfacing as a failure the
   * host has to retry.
   */
  private async markUploaded(
    owner: MediaOwner,
    mediaId: string,
    width: number,
    height: number,
  ): Promise<AssetRow> {
    const data = { status: MediaStatus.PROCESSING, width, height };
    const hasCover = await this.prisma.mediaAsset.count({
      where: { ...owner, isCover: true },
    });

    if (hasCover > 0) {
      return this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data,
        select: ASSET_SELECT,
      });
    }

    try {
      return await this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: { ...data, isCover: true },
        select: ASSET_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.mediaAsset.update({
          where: { id: mediaId },
          data,
          select: ASSET_SELECT,
        });
      }
      throw error;
    }
  }

  /**
   * Until the worker has written derivatives, all three URLs are the original:
   * the host sees their photo at once, and the only cost is one oversized image
   * on the device that just produced it.
   */
  private toDto(asset: AssetRow): MediaAssetDto {
    const url = (variant: DerivativeVariant) =>
      this.storage.publicUrl(
        asset.status === MediaStatus.READY
          ? derivativeKey(asset.propertyId, asset.id, variant)
          : asset.storageKey,
      );

    return {
      id: asset.id,
      roomId: asset.roomId,
      status: asset.status,
      thumbnailUrl: url('thumb'),
      cardUrl: url('card'),
      fullUrl: url('full'),
      blurhash: asset.blurhash,
      width: asset.width,
      height: asset.height,
      sortOrder: asset.sortOrder,
      isCover: asset.isCover,
    };
  }
}
