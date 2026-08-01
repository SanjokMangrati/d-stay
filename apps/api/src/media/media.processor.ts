import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { PinoLogger } from 'nestjs-pino';
import { encode as encodeBlurhash } from 'blurhash';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { MediaStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { derivativeKey } from './media-keys';
import {
  ABANDONED_UPLOAD_AGE_MS,
  DERIVATIVE_VARIANTS,
  DerivativeVariant,
} from './media-limits';
import { MediaStorageService } from './media-storage.service';
import { MEDIA_QUEUE, type MediaJobData } from './media.jobs';
import { MediaService } from './media.service';

/** Enough detail for a placeholder, small enough that the encode is free. */
const BLURHASH_SAMPLE_SIZE = 32;
const BLURHASH_COMPONENTS = { x: 4, y: 3 };

/**
 * Everything that happens to an image after the browser has put it in the
 * bucket. It runs out of band because a host on a rural connection should be
 * looking at their photo, not waiting on three resizes of it.
 */
@Processor(MEDIA_QUEUE)
export class MediaProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly media: MediaService,
    private readonly logger: PinoLogger,
  ) {
    super();
    logger.setContext(MediaProcessor.name);
  }

  async process(job: Job<MediaJobData>): Promise<void> {
    switch (job.data.kind) {
      case 'derivatives':
        await this.generateDerivatives(job.data.mediaId);
        return;
      case 'purge':
        await this.storage.deleteObjects(job.data.keys);
        return;
      case 'sweep':
        await this.sweepAbandonedUploads();
        return;
    }
  }

  /**
   * The original stays as the host uploaded it; the app only ever reads the
   * derivatives. Rotation is applied rather than left to EXIF, because a phone
   * photo that arrives sideways would otherwise be sideways in every consumer.
   */
  private async generateDerivatives(mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: { id: true, propertyId: true, storageKey: true },
    });
    // Deleted while the job sat in the queue. The purge job owns its objects.
    if (!asset) {
      return;
    }

    const original = await this.storage.getObject(asset.storageKey);
    const upright = await sharp(original).rotate().toBuffer();
    const { width, height } = await sharp(upright).metadata();

    for (const [name, spec] of Object.entries(DERIVATIVE_VARIANTS)) {
      const body = await sharp(upright)
        .resize({ width: spec.width, withoutEnlargement: true })
        .webp({ quality: spec.quality })
        .toBuffer();
      await this.storage.putObject(
        derivativeKey(asset.propertyId, asset.id, name as DerivativeVariant),
        body,
        'image/webp',
      );
    }

    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: MediaStatus.READY,
        blurhash: await blurhashOf(upright),
        // The browser's numbers were taken before rotation was applied.
        width,
        height,
      },
    });
  }

  /**
   * A presigned URL the host never used, or an upload their connection dropped.
   * Both leave a `PENDING` row, and possibly an object nothing will ever read.
   */
  private async sweepAbandonedUploads(): Promise<void> {
    const abandoned = await this.prisma.mediaAsset.findMany({
      where: {
        status: MediaStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - ABANDONED_UPLOAD_AGE_MS) },
      },
      select: { id: true, propertyId: true },
    });
    if (abandoned.length === 0) {
      return;
    }

    await this.prisma.mediaAsset.deleteMany({
      where: { id: { in: abandoned.map((asset) => asset.id) } },
    });
    await this.storage.deleteObjects(
      abandoned.flatMap((asset) =>
        this.media.allKeys(asset.propertyId, asset.id),
      ),
    );

    this.logger.info(
      { count: abandoned.length },
      'Swept abandoned media uploads.',
    );
  }

  /**
   * Only once the retries are spent: a photo whose derivatives failed is still
   * shown at its original size, and the status is what tells an operator that the
   * bucket and the database disagree about this row.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<MediaJobData>, error: Error): Promise<void> {
    this.logger.error(
      { jobId: job.id, kind: job.data.kind, err: error },
      'Media job failed.',
    );

    const attempts = job.opts.attempts ?? 1;
    if (job.data.kind !== 'derivatives' || job.attemptsMade < attempts) {
      return;
    }
    await this.prisma.mediaAsset.updateMany({
      where: { id: job.data.mediaId, status: MediaStatus.PROCESSING },
      data: { status: MediaStatus.FAILED },
    });
  }
}

async function blurhashOf(image: Buffer): Promise<string> {
  const { data, info } = await sharp(image)
    .resize(BLURHASH_SAMPLE_SIZE, BLURHASH_SAMPLE_SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encodeBlurhash(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    BLURHASH_COMPONENTS.x,
    BLURHASH_COMPONENTS.y,
  );
}
