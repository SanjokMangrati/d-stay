import { daysBetween } from '@d-stay/domain/datetime';
import { MAX_RATE_PAISE } from '@d-stay/domain/money';
import { PHONE_PATTERN } from '@d-stay/domain/phone';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  BookingSource,
  BookingStatus,
  RateSource,
} from '../../generated/prisma/enums';

/** A stay longer than this is a data-entry slip, not a holiday. */
export const MAX_STAY_NIGHTS = 90;

/** What a host can write on a booking and still read three weeks later. */
export const MAX_NOTE_LENGTH = 500;
export const MAX_REASON_LENGTH = 200;

const stayDate = z.iso.date();

/**
 * A whole stay, not one night: the per-night typo guard would refuse a real
 * fortnight across four rooms. Still a typo guard — ₹10,00,000 a night for the
 * longest stay this API accepts is far past anything a homestay charges.
 */
const totalPaise = z
  .number()
  .int()
  .min(0)
  .max(MAX_RATE_PAISE * MAX_STAY_NIGHTS);

/**
 * The guest as the host took them down on the phone: a name, a number that
 * works, and an email only if they offered one. Anything more would be a form
 * the host abandons halfway through a call.
 */
const guestSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestPhone: z
    .string()
    .regex(
      PHONE_PATTERN,
      'Enter an Indian mobile number, for example +919876543210.',
    ),
  guestEmail: z.email().nullable(),
  /** The party, totalled across the rooms. Who sleeps where is on the stays. */
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50),
});

/**
 * Heads per room, not for the booking as a whole: the extra-guest charge is a
 * per-room rule, and a family of four in two doubles pays nothing extra while
 * the same four in one room does. A booking-level count could not tell them
 * apart.
 */
const bookedRoomInputSchema = z.object({
  roomId: z.uuid(),
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
});

/**
 * One room-night exactly as it was priced. These are written once and never
 * updated — a booking explains itself from these long after the season that set
 * the rate was deleted.
 */
export const bookingLineItemSchema = z.object({
  roomId: z.uuid(),
  date: stayDate,
  source: z.enum(RateSource),
  roomCharge: z.number().int(),
  extraGuests: z.number().int(),
  extraGuestCharge: z.number().int(),
  mealCharge: z.number().int(),
  /** What the GST slab was read from: room, extra guests and meals together. */
  tariff: z.number().int(),
  gstBasisPoints: z.number().int(),
  taxAmount: z.number().int(),
});

/** The rooms a booking holds, named — a list of ids is not a booking a host can read. */
export const bookedRoomSchema = z.object({
  roomId: z.uuid(),
  name: z.string(),
});

const totalsSchema = z.object({
  roomTotal: z.number().int(),
  extraGuestTotal: z.number().int(),
  mealTotal: z.number().int(),
  subtotal: z.number().int(),
  taxTotal: z.number().int(),
  /** What the rates came to. `overrideTotal` is what the guest actually pays. */
  total: z.number().int(),
  overrideTotal: z.number().int().nullable(),
  overrideReason: z.string().nullable(),
});

/**
 * A booking in a list: enough to find the one you mean and call the guest, and
 * nothing that needs a second query per row.
 */
export const bookingSummarySchema = z
  .object({
    id: z.uuid(),
    status: z.enum(BookingStatus),
    source: z.enum(BookingSource),
    checkIn: stayDate,
    /** Exclusive. The morning the rooms are free again. */
    checkOut: stayDate,
    isWholeProperty: z.boolean(),
    rooms: z.array(bookedRoomSchema),
    expiresAt: z.iso.datetime().nullable(),
  })
  .extend(guestSchema.shape)
  .extend(totalsSchema.shape);

export const bookingListSchema = z.object({
  bookings: z.array(bookingSummarySchema),
});

export class BookingListDto extends createZodDto(bookingListSchema) {}

/**
 * The whole booking, including the per-night breakdown a host needs when a guest
 * asks why it costs what it costs.
 */
export const bookingSchema = bookingSummarySchema.extend({
  note: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  gstSlabVersion: z.string(),
  lineItems: z.array(bookingLineItemSchema),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export class BookingDto extends createZodDto(bookingSchema) {}

/**
 * Rooms are named individually even for a buyout: the booking records which
 * rooms were actually held, and a room added next month was not part of it.
 * `isWholeProperty` marks the intent — the service checks it against the rooms
 * in service rather than inferring a buyout from the count.
 *
 * The booking's own `adults` and `children` are what the host wrote down for the
 * party; the per-room counts are what it is priced from. The service refuses the
 * two disagreeing rather than silently believing one of them.
 */
export const createBookingSchema = guestSchema
  .extend({
    rooms: z.array(bookedRoomInputSchema).min(1),
    isWholeProperty: z.boolean(),
    checkIn: stayDate,
    /** Exclusive: the 14th to the 16th is two nights. */
    checkOut: stayDate,
    source: z.enum(BookingSource),
    /** A pencilled-in enquiry holds the rooms; a confirmed booking is committed. */
    status: z.enum([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
    note: z.string().trim().max(MAX_NOTE_LENGTH).nullable(),
    /** A negotiated price. Recorded beside what the rates said, never instead of it. */
    overrideTotal: totalPaise.nullable(),
    overrideReason: z.string().trim().min(1).max(MAX_REASON_LENGTH).nullable(),
  })
  .refine((booking) => booking.checkOut > booking.checkIn, {
    path: ['checkOut'],
    error: 'A stay must cover at least one night.',
  })
  .refine(
    (booking) =>
      daysBetween(booking.checkIn, booking.checkOut) <= MAX_STAY_NIGHTS,
    {
      path: ['checkOut'],
      error: `A stay cannot run longer than ${MAX_STAY_NIGHTS} nights.`,
    },
  )
  .refine(
    (booking) =>
      new Set(booking.rooms.map((room) => room.roomId)).size ===
      booking.rooms.length,
    { path: ['rooms'], error: 'A room can only be booked once.' },
  )
  .refine(
    (booking) =>
      sum(booking.rooms, (room) => room.adults) === booking.adults &&
      sum(booking.rooms, (room) => room.children) === booking.children,
    {
      path: ['rooms'],
      error:
        'The guests in the rooms must add up to the guests on the booking.',
    },
  )
  .refine(
    (booking) =>
      (booking.overrideTotal === null) === (booking.overrideReason === null),
    {
      path: ['overrideReason'],
      error: 'Say why the price was changed.',
    },
  );

export class CreateBookingDto extends createZodDto(createBookingSchema) {}

function sum<T>(items: T[], of: (item: T) => number): number {
  return items.reduce((total, item) => total + of(item), 0);
}

/**
 * A move through the status graph, never an assignment: the legal transitions
 * live in the domain package and the service refuses anything else. A reason is
 * what makes a cancellation readable in three months.
 */
export const updateBookingStatusSchema = z.object({
  status: z.enum(BookingStatus),
  reason: z.string().trim().min(1).max(MAX_REASON_LENGTH).nullable(),
});

export class UpdateBookingStatusDto extends createZodDto(
  updateBookingStatusSchema,
) {}

export const updateBookingNoteSchema = z.object({
  note: z.string().trim().max(MAX_NOTE_LENGTH).nullable(),
});

export class UpdateBookingNoteDto extends createZodDto(
  updateBookingNoteSchema,
) {}

/**
 * How the host finds a booking again. Dates bound the search by the stays that
 * touch the window, not by when the booking was written — a host looking at
 * March means guests sleeping in March.
 */
export const bookingQuerySchema = z
  .object({
    /**
     * One status, not a set: a host filtering this list is asking "what is
     * pending?" or "what did I cancel?", and a repeated query parameter is a
     * shape the client and the URL would both have to carry for no gain.
     */
    status: z.enum(BookingStatus).optional(),
    from: stayDate.optional(),
    to: stayDate.optional(),
    /** Guest name or phone. A returning guest is found by whichever the host has. */
    search: z.string().trim().min(1).max(120).optional(),
  })
  .refine((query) => !query.from || !query.to || query.to > query.from, {
    path: ['to'],
    error: 'The window must end after it starts.',
  });

export class BookingQueryDto extends createZodDto(bookingQuerySchema) {}
