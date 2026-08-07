import { daysBetween } from '@d-stay/domain/datetime';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BookingStatus, StayKind } from '../../generated/prisma/enums';

/**
 * How much of the calendar one request may pull. A host scrolling a year ahead
 * is a month at a time; a single request asking for a decade is a mistake or a
 * scrape, and either way the answer is no.
 */
export const MAX_WINDOW_NIGHTS = 366;

/** A season a host closes for. Longer than a year is a typo, not a monsoon. */
export const MAX_BLOCK_NIGHTS = 366;

/** What a host can write on a block and still read three weeks later. */
export const MAX_BLOCK_REASON_LENGTH = 120;

const stayDate = z.iso.date();

/**
 * One row of the occupancy table as the apps consume it. A booking and a block
 * are the same shape deliberately — the calendar draws them from one list, and
 * a client that had to merge two lists is a client that can disagree with the
 * database about whether a room is free.
 */
export const roomStaySchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  kind: z.enum(StayKind),
  checkIn: stayDate,
  /** Exclusive. The first morning the room is free again. */
  checkOut: stayDate,
  /** What the host wrote on a block. Null on a booking. */
  reason: z.string().nullable(),
  /** The booking this row holds the room for. Null on a block. */
  bookingId: z.uuid().nullable(),
  /**
   * How far through their stay the guest is, so the calendar can tell a
   * pencilled-in enquiry from a guest already in the house. Null on a block.
   */
  bookingStatus: z.enum(BookingStatus).nullable(),
  /** Who the booked cell belongs to, so the bar can carry a name. Null on a block. */
  guestName: z.string().nullable(),
});

/**
 * The stays overlapping the window asked for, not a cell per room-night: a month
 * of six rooms is a handful of ranges against 180 cells, and the client expands
 * them. On a rural connection that difference is the screen appearing or not.
 *
 * Only occupancy-consuming rows are here — a cancelled booking keeps its record
 * but does not paint the calendar.
 */
export const stayListSchema = z.object({
  stays: z.array(roomStaySchema),
});

export class StayListDto extends createZodDto(stayListSchema) {}

export const availabilityQuerySchema = z
  .object({
    from: stayDate,
    /** Exclusive, like every stay range in this system. */
    to: stayDate,
  })
  .refine((window) => window.to > window.from, {
    path: ['to'],
    error: 'The window must end after it starts.',
  })
  .refine(
    (window) => daysBetween(window.from, window.to) <= MAX_WINDOW_NIGHTS,
    {
      path: ['to'],
      error: `A window cannot span more than ${MAX_WINDOW_NIGHTS} nights.`,
    },
  );

export class AvailabilityQueryDto extends createZodDto(
  availabilityQuerySchema,
) {}

export const freeRoomsQuerySchema = z
  .object({
    checkIn: stayDate,
    checkOut: stayDate,
  })
  .refine((stay) => stay.checkOut > stay.checkIn, {
    path: ['checkOut'],
    error: 'A stay must cover at least one night.',
  })
  .refine(
    (stay) => daysBetween(stay.checkIn, stay.checkOut) <= MAX_WINDOW_NIGHTS,
    {
      path: ['checkOut'],
      error: `A stay cannot span more than ${MAX_WINDOW_NIGHTS} nights.`,
    },
  );

export class FreeRoomsQueryDto extends createZodDto(freeRoomsQuerySchema) {}

/**
 * The answer to "do you have a room for the 14th to the 16th?", which a host is
 * asked on the phone and has seconds to answer. Only rooms in service are
 * candidates — a room out for repairs is not free, it is not on the market.
 */
export const freeRoomsSchema = z.object({
  checkIn: stayDate,
  checkOut: stayDate,
  roomIds: z.array(z.uuid()),
});

export class FreeRoomsDto extends createZodDto(freeRoomsSchema) {}

/**
 * Many rooms in one action, because closing the house for the monsoon is one
 * decision and making it a per-room chore is how a host ends up with five of six
 * rooms blocked. Blocking the whole property is this with every active room.
 */
export const createBlockSchema = z
  .object({
    roomIds: z.array(z.uuid()).min(1),
    checkIn: stayDate,
    /** Exclusive: blocking the 14th to the 16th holds two nights, not three. */
    checkOut: stayDate,
    reason: z.string().trim().min(1).max(MAX_BLOCK_REASON_LENGTH).nullable(),
  })
  .refine((block) => block.checkOut > block.checkIn, {
    path: ['checkOut'],
    error: 'A block must cover at least one night.',
  })
  .refine(
    (block) => daysBetween(block.checkIn, block.checkOut) <= MAX_BLOCK_NIGHTS,
    {
      path: ['checkOut'],
      error: `A block cannot cover more than ${MAX_BLOCK_NIGHTS} nights.`,
    },
  );

export class CreateBlockDto extends createZodDto(createBlockSchema) {}
