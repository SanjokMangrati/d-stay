import { canTransition, occupiesRooms } from '@d-stay/domain/booking';
import {
  formatStayDate,
  parseStayDate,
  toStayDate,
} from '@d-stay/domain/datetime';
import { GST_SLAB_VERSION, quote, type Quote } from '@d-stay/domain/pricing';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BookingStatus,
  RateSource,
  StayKind,
} from '../../generated/prisma/enums';
import {
  AvailabilityService,
  isStayOverlapViolation,
} from '../availability/availability.service';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BookingDto,
  BookingListDto,
  BookingQueryDto,
  CreateBookingDto,
  UpdateBookingNoteDto,
  UpdateBookingStatusDto,
} from './bookings.schema';

const BOOKING_SELECT = {
  id: true,
  status: true,
  source: true,
  checkIn: true,
  checkOut: true,
  isWholeProperty: true,
  guestName: true,
  guestPhone: true,
  guestEmail: true,
  adults: true,
  children: true,
  roomTotal: true,
  extraGuestTotal: true,
  mealTotal: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  overrideTotal: true,
  overrideReason: true,
  expiresAt: true,
  stays: {
    orderBy: { room: { sortOrder: 'asc' } },
    select: { roomId: true, room: { select: { name: true } } },
  },
} satisfies Prisma.BookingSelect;

const BOOKING_DETAIL_SELECT = {
  ...BOOKING_SELECT,
  note: true,
  cancellationReason: true,
  gstSlabVersion: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  lineItems: {
    orderBy: [{ date: 'asc' }, { roomId: 'asc' }],
    select: {
      roomId: true,
      date: true,
      source: true,
      roomCharge: true,
      extraGuests: true,
      extraGuestCharge: true,
      mealCharge: true,
      tariff: true,
      gstBasisPoints: true,
      taxAmount: true,
    },
  },
} satisfies Prisma.BookingSelect;

const MILLISECONDS_PER_HOUR = 3_600_000;

/** The domain quote's rate source, in the form the snapshot column stores. */
const RATE_SOURCE: Record<Quote['nights'][number]['source'], RateSource> = {
  override: RateSource.OVERRIDE,
  weekend: RateSource.WEEKEND,
  base: RateSource.BASE,
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * The bookings whose *stay* touches the window, not the ones written during
   * it: a host looking at March means guests sleeping in March.
   */
  async list(
    propertyId: string,
    query: BookingQueryDto,
  ): Promise<BookingListDto> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId,
        status: query.status,
        checkIn: query.to ? { lt: parseStayDate(query.to) } : undefined,
        checkOut: query.from ? { gt: parseStayDate(query.from) } : undefined,
        ...searchFilter(query.search),
      },
      orderBy: [{ checkIn: 'desc' }, { createdAt: 'desc' }],
      select: BOOKING_SELECT,
    });

    return { bookings: bookings.map(toSummaryDto) };
  }

  async find(propertyId: string, bookingId: string): Promise<BookingDto> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, propertyId },
      select: BOOKING_DETAIL_SELECT,
    });
    if (!booking) {
      throw new DomainError('NOT_FOUND', 'This booking was not found.');
    }

    return toDetailDto(booking);
  }

  /**
   * A booking, its price snapshot and the rooms it holds, written as one
   * transaction. Anything less would leave a stay with no booking to explain it,
   * or a booking holding nothing — both of which a host discovers from a guest.
   *
   * The price is computed here from the property's own rates. What the client
   * quoted is never trusted: the browser's number exists to be responsive, and
   * this one is the record.
   */
  async create(
    propertyId: string,
    booking: CreateBookingDto,
    userId: string,
  ): Promise<BookingDto> {
    const [property, rooms, overrides] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: {
          mealPlan: true,
          mealChargePerPerson: true,
          gstEnabled: true,
          holdExpiryHours: true,
        },
      }),
      this.prisma.room.findMany({
        where: { propertyId, id: { in: booking.rooms.map((r) => r.roomId) } },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          isActive: true,
          standardOccupancy: true,
          maxOccupancy: true,
          baseRate: true,
          weekendRate: true,
          extraGuestCharge: true,
        },
      }),
      this.prisma.rateOverride.findMany({
        where: { propertyId },
        select: {
          roomId: true,
          startDate: true,
          endDate: true,
          nightlyRate: true,
          minStayNights: true,
        },
      }),
    ]);

    if (rooms.length !== booking.rooms.length) {
      throw new DomainError('NOT_FOUND', 'One of these rooms was not found.');
    }

    const outOfService = rooms.filter((room) => !room.isActive);
    if (outOfService.length > 0) {
      throw new DomainError(
        'VALIDATION_FAILED',
        `These rooms are out of service: ${outOfService.map((room) => room.name).join(', ')}.`,
      );
    }

    if (booking.isWholeProperty) {
      const active = await this.prisma.room.count({
        where: { propertyId, isActive: true },
      });
      if (active !== rooms.length) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'A whole-property booking has to name every room in service.',
        );
      }
    }

    const overCapacity = rooms.filter((room) => {
      const party = guestsFor(booking, room.id);
      return party.adults + party.children > room.maxOccupancy;
    });
    if (overCapacity.length > 0) {
      throw new DomainError(
        'VALIDATION_FAILED',
        `More guests than these rooms sleep: ${overCapacity.map((room) => room.name).join(', ')}.`,
      );
    }

    const priced = quote({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      rooms: rooms.map((room) => ({
        roomId: room.id,
        ...guestsFor(booking, room.id),
      })),
      rates: rooms.map((room) => ({
        roomId: room.id,
        standardOccupancy: room.standardOccupancy,
        baseRate: room.baseRate,
        weekendRate: room.weekendRate,
        extraGuestCharge: room.extraGuestCharge,
      })),
      overrides: overrides.map((override) => ({
        ...override,
        startDate: toStayDate(override.startDate),
        endDate: toStayDate(override.endDate),
      })),
      mealPlan: property.mealPlan ?? 'ROOM_ONLY',
      mealChargePerPerson: property.mealChargePerPerson,
      gstEnabled: property.gstEnabled,
    });

    if (priced.unpricedRoomIds.length > 0) {
      const names = rooms
        .filter((room) => priced.unpricedRoomIds.includes(room.id))
        .map((room) => room.name);
      throw new DomainError(
        'ROOM_NOT_PRICED',
        `These rooms have no rate for those nights: ${names.join(', ')}. Set one before booking them.`,
      );
    }

    if (priced.minStayShortfalls.length > 0) {
      const required = Math.max(
        ...priced.minStayShortfalls.map(
          (shortfall) => shortfall.requiredNights,
        ),
      );
      throw new DomainError(
        'MIN_STAY_VIOLATION',
        `These nights carry a minimum stay of ${required} nights.`,
      );
    }

    const roomIds = rooms.map((room) => room.id);
    const range = { checkIn: booking.checkIn, checkOut: booking.checkOut };
    await this.availability.assertRoomsAreFree(propertyId, roomIds, range);

    const checkIn = parseStayDate(booking.checkIn);
    const checkOut = parseStayDate(booking.checkOut);

    try {
      const created = await this.prisma.booking.create({
        data: {
          propertyId,
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          guestEmail: booking.guestEmail,
          adults: booking.adults,
          children: booking.children,
          source: booking.source,
          status: booking.status,
          checkIn,
          checkOut,
          isWholeProperty: booking.isWholeProperty,
          roomTotal: priced.roomTotal,
          extraGuestTotal: priced.extraGuestTotal,
          mealTotal: priced.mealTotal,
          subtotal: priced.subtotal,
          taxTotal: priced.taxTotal,
          total: priced.total,
          overrideTotal: booking.overrideTotal,
          overrideReason: booking.overrideReason,
          gstSlabVersion: GST_SLAB_VERSION,
          note: booking.note,
          expiresAt:
            booking.status === BookingStatus.PENDING
              ? new Date(
                  Date.now() + property.holdExpiryHours * MILLISECONDS_PER_HOUR,
                )
              : null,
          createdById: userId,
          updatedById: userId,
          stays: {
            create: roomIds.map((roomId) => ({
              propertyId,
              roomId,
              kind: StayKind.BOOKING,
              checkIn,
              checkOut,
            })),
          },
          lineItems: {
            create: priced.nights.map((night) => ({
              roomId: night.roomId,
              date: parseStayDate(night.date),
              source: RATE_SOURCE[night.source],
              roomCharge: night.roomCharge,
              extraGuests: night.extraGuests,
              extraGuestCharge: night.extraGuestCharge,
              mealCharge: night.mealCharge,
              tariff: night.tariff,
              gstBasisPoints: night.gstBasisPoints,
              taxAmount: night.taxAmount,
            })),
          },
        },
        select: BOOKING_DETAIL_SELECT,
      });

      return toDetailDto(created);
    } catch (error) {
      if (isStayOverlapViolation(error)) {
        // Something took these rooms between the check above and this write.
        // Asking again is what names it; if it has since gone, the host is told
        // plainly rather than being handed a database constraint's name.
        await this.availability.assertRoomsAreFree(propertyId, roomIds, range);
        throw new DomainError(
          'BOOKING_CONFLICT',
          `Something took these rooms for ${formatStayDate(booking.checkIn)} to ${formatStayDate(booking.checkOut)} while this was being saved.`,
        );
      }
      throw error;
    }
  }

  /**
   * The only way a booking's status changes. Occupancy follows it in the same
   * transaction: a cancelled booking keeps its record and gives the nights back,
   * and a re-confirmation would have to win the exclusion constraint again.
   */
  async changeStatus(
    propertyId: string,
    bookingId: string,
    change: UpdateBookingStatusDto,
    userId: string,
  ): Promise<BookingDto> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, propertyId },
      select: { id: true, status: true },
    });
    if (!booking) {
      throw new DomainError('NOT_FOUND', 'This booking was not found.');
    }

    if (!canTransition(booking.status, change.status)) {
      throw new DomainError(
        'INVALID_STATUS_TRANSITION',
        `A ${booking.status.toLowerCase()} booking cannot become ${change.status.toLowerCase()}.`,
      );
    }

    const occupies = occupiesRooms(change.status);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: change.status,
        // Only a hold expires. Confirming one is what makes it permanent.
        expiresAt: change.status === BookingStatus.PENDING ? undefined : null,
        cancellationReason:
          change.status === BookingStatus.CANCELLED ||
          change.status === BookingStatus.NO_SHOW
            ? change.reason
            : undefined,
        updatedById: userId,
        stays: { updateMany: { where: {}, data: { occupies } } },
      },
      select: BOOKING_DETAIL_SELECT,
    });

    return toDetailDto(updated);
  }

  /**
   * The sweep behind the expiry a hold is given when it is taken. Each booking
   * is released on its own guarded write, so a hold confirmed a second before
   * this ran keeps its rooms, and a run that fails halfway has still released
   * everything it got to.
   *
   * A released hold is cancelled rather than deleted: the host asked for those
   * nights once, and that is worth being able to read.
   */
  async releaseExpiredHolds(): Promise<number> {
    const expired = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING, expiresAt: { lte: new Date() } },
      select: { id: true },
    });

    let released = 0;
    for (const { id } of expired) {
      released += await this.prisma.$transaction(async (tx) => {
        const cancelled = await tx.booking.updateMany({
          // Still pending: a host who confirmed it while this ran wins, and
          // their guest keeps the rooms.
          where: { id, status: BookingStatus.PENDING },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: 'This hold expired.',
            expiresAt: null,
          },
        });
        if (cancelled.count === 0) {
          return 0;
        }

        await tx.roomStay.updateMany({
          where: { bookingId: id },
          data: { occupies: false },
        });

        return cancelled.count;
      });
    }

    return released;
  }

  async updateNote(
    propertyId: string,
    bookingId: string,
    { note }: UpdateBookingNoteDto,
    userId: string,
  ): Promise<BookingDto> {
    const updated = await this.prisma.booking.updateManyAndReturn({
      where: { id: bookingId, propertyId },
      data: { note, updatedById: userId },
      select: { id: true },
    });
    if (updated.length === 0) {
      throw new DomainError('NOT_FOUND', 'This booking was not found.');
    }

    return this.find(propertyId, bookingId);
  }
}

/**
 * Who is sleeping in one room. The DTO's own validation has already made the
 * per-room counts add up to the booking's, so a room named in the booking always
 * has an entry here.
 */
function guestsFor(
  booking: CreateBookingDto,
  roomId: string,
): { adults: number; children: number } {
  const room = booking.rooms.find((candidate) => candidate.roomId === roomId);
  if (!room) {
    throw new Error(`Room ${roomId} is priced but not part of this booking.`);
  }

  return { adults: room.adults, children: room.children };
}

/**
 * Name or phone, whichever the host has to hand. The phone is matched on digits
 * as stored, so a search for `98765` finds `+919876543210`.
 */
function searchFilter(search: string | undefined): Prisma.BookingWhereInput {
  if (!search) {
    return {};
  }

  const digits = search.replace(/[^\d]/g, '');

  return {
    OR: [
      { guestName: { contains: search, mode: 'insensitive' } },
      // Only when the host typed digits: an empty string is `contains`
      // everything, which would make a name search return the whole property.
      ...(digits ? [{ guestPhone: { contains: digits } }] : []),
    ],
  };
}

type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;
type BookingDetailRow = Prisma.BookingGetPayload<{
  select: typeof BOOKING_DETAIL_SELECT;
}>;

function toSummaryDto(booking: BookingRow): BookingListDto['bookings'][number] {
  const { stays, checkIn, checkOut, expiresAt, ...rest } = booking;

  return {
    ...rest,
    checkIn: toStayDate(checkIn),
    checkOut: toStayDate(checkOut),
    expiresAt: expiresAt?.toISOString() ?? null,
    rooms: stays.map((stay) => ({ roomId: stay.roomId, name: stay.room.name })),
  };
}

function toDetailDto(booking: BookingDetailRow): BookingDto {
  const { lineItems, createdBy, updatedBy, createdAt, updatedAt, ...summary } =
    booking;

  return {
    ...toSummaryDto(summary),
    note: booking.note,
    cancellationReason: booking.cancellationReason,
    gstSlabVersion: booking.gstSlabVersion,
    createdBy: createdBy.name,
    updatedBy: updatedBy.name,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    lineItems: lineItems.map((item) => ({
      ...item,
      date: toStayDate(item.date),
    })),
  };
}
