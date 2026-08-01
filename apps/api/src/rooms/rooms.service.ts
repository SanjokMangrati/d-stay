import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DomainError } from '../errors/domain.error';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRoomDto,
  RoomDto,
  RoomListDto,
  UpdateRoomDto,
} from './rooms.schema';
import { MAX_ROOMS_PER_PROPERTY } from './rooms.schema';

const ROOM_SELECT = {
  id: true,
  name: true,
  description: true,
  doubleBeds: true,
  singleBeds: true,
  extraMattresses: true,
  standardOccupancy: true,
  maxOccupancy: true,
  amenities: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.RoomSelect;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Inactive rooms included: this is the host's own list, and a room out of
   * service still has to be findable to be brought back. The calendar and the
   * availability engine ask for active rooms specifically.
   */
  async listForProperty(propertyId: string): Promise<RoomListDto> {
    const rooms = await this.prisma.room.findMany({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
      select: ROOM_SELECT,
    });

    // One lookup for every room's gallery rather than one per room.
    const galleries = await this.media.galleriesForRooms(
      propertyId,
      rooms.map((room) => room.id),
    );

    return {
      rooms: rooms.map((room) => ({
        ...room,
        photoCount: galleries.get(room.id)?.photoCount ?? 0,
        coverThumbnailUrl: galleries.get(room.id)?.coverUrl ?? null,
      })),
    };
  }

  async create(propertyId: string, room: CreateRoomDto): Promise<RoomDto> {
    const existing = await this.prisma.room.count({ where: { propertyId } });
    if (existing >= MAX_ROOMS_PER_PROPERTY) {
      throw new DomainError(
        'ROOM_LIMIT_REACHED',
        `A property can have at most ${MAX_ROOMS_PER_PROPERTY} rooms.`,
      );
    }

    const last = await this.prisma.room.findFirst({
      where: { propertyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await this.prisma.room.create({
      data: { ...room, propertyId, sortOrder: (last?.sortOrder ?? -1) + 1 },
      select: ROOM_SELECT,
    });

    // A room cannot have photos before it exists.
    return { ...created, photoCount: 0, coverThumbnailUrl: null };
  }

  async update(
    propertyId: string,
    roomId: string,
    changes: UpdateRoomDto,
  ): Promise<RoomDto> {
    await this.findOwned(propertyId, roomId);

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: changes,
      select: ROOM_SELECT,
    });
    const gallery = (
      await this.media.galleriesForRooms(propertyId, [roomId])
    ).get(roomId);

    return {
      ...updated,
      photoCount: gallery?.photoCount ?? 0,
      coverThumbnailUrl: gallery?.coverUrl ?? null,
    };
  }

  async reorder(propertyId: string, roomIds: string[]): Promise<RoomListDto> {
    const rooms = await this.prisma.room.findMany({
      where: { propertyId },
      select: { id: true },
    });

    const known = new Set(rooms.map((room) => room.id));
    const requested = new Set(roomIds);
    if (
      requested.size !== roomIds.length ||
      known.size !== requested.size ||
      roomIds.some((id) => !known.has(id))
    ) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Reordering must list every room of this property exactly once.',
      );
    }

    await this.prisma.$transaction(
      roomIds.map((id, sortOrder) =>
        this.prisma.room.update({ where: { id }, data: { sortOrder } }),
      ),
    );

    return this.listForProperty(propertyId);
  }

  /**
   * Deleting is for a room that should never have existed. A room that has ever
   * been slept in is deactivated instead, and once `RoomStay` exists this refuses
   * to delete a room holding any — until then there is nothing to hold.
   */
  async remove(propertyId: string, roomId: string): Promise<RoomListDto> {
    await this.findOwned(propertyId, roomId);
    await this.prisma.room.delete({ where: { id: roomId } });

    return this.listForProperty(propertyId);
  }

  /**
   * The property guard proves the caller may touch the property; this proves the
   * room is that property's. Without it, a room id from another homestay would be
   * editable by anyone holding any membership.
   */
  private async findOwned(propertyId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId },
      select: { id: true },
    });
    if (!room) {
      throw new DomainError('NOT_FOUND', 'This room was not found.');
    }
  }
}
