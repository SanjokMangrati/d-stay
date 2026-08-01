import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RoomAmenity } from '../../generated/prisma/enums';

/** A homestay has rooms, not room types — there is no pool to size. */
export const MAX_ROOMS_PER_PROPERTY = 30;

/**
 * Beds are counted so that "sleeps four" is something the app can check rather
 * than something the host asserts. The cap is per bed kind and generous; a
 * homestay room with nine doubles is a typo.
 */
const bedCount = z.number().int().min(0).max(8);
const occupancy = z.number().int().min(1).max(20);

export const roomSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  doubleBeds: z.number().int(),
  singleBeds: z.number().int(),
  extraMattresses: z.number().int(),
  standardOccupancy: z.number().int(),
  maxOccupancy: z.number().int(),
  amenities: z.array(z.enum(RoomAmenity)),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  /**
   * Enough of the room's gallery to show it without asking for it: a host who
   * uploaded photos needs to see that from the list, not by opening the room.
   */
  photoCount: z.number().int(),
  coverThumbnailUrl: z.url().nullable(),
});

export class RoomDto extends createZodDto(roomSchema) {}

export const roomListSchema = z.object({
  rooms: z.array(roomSchema),
});

export class RoomListDto extends createZodDto(roomListSchema) {}

/**
 * The same fields on create and update, because a room is small enough that a
 * host fills it in one screen — there is no half-made room worth persisting the
 * way a half-made property is.
 */
const roomFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
  doubleBeds: bedCount,
  singleBeds: bedCount,
  extraMattresses: bedCount,
  standardOccupancy: occupancy,
  maxOccupancy: occupancy,
  amenities: z.array(z.enum(RoomAmenity)),
};

/**
 * Restated from the CHECK constraint that actually enforces it, so the host is
 * told by the form rather than by a rejected write.
 */
const occupancyOrder = {
  check: (room: { standardOccupancy: number; maxOccupancy: number }) =>
    room.maxOccupancy >= room.standardOccupancy,
  options: {
    path: ['maxOccupancy'],
    error: 'Maximum occupancy cannot be below standard occupancy.',
  },
};

export const createRoomSchema = z
  .object(roomFields)
  .refine(occupancyOrder.check, occupancyOrder.options);

export class CreateRoomDto extends createZodDto(createRoomSchema) {}

/**
 * `isActive` rides along rather than having its own endpoint: taking a room out
 * of service is a property of the room, and the form that edits a room is where
 * a host expects to find it.
 */
export const updateRoomSchema = z
  .object({ ...roomFields, isActive: z.boolean() })
  .refine(occupancyOrder.check, occupancyOrder.options);

export class UpdateRoomDto extends createZodDto(updateRoomSchema) {}

/** The complete new order, for the same reason photos send theirs. */
export const reorderRoomsSchema = z.object({
  roomIds: z.array(z.uuid()).min(1).max(MAX_ROOMS_PER_PROPERTY),
});

export class ReorderRoomsDto extends createZodDto(reorderRoomsSchema) {}
