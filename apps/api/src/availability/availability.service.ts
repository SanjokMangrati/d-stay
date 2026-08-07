import {
  formatStayDate,
  parseStayDate,
  toStayDate,
  type StayDate,
} from '@d-stay/domain/datetime';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { StayKind } from '../../generated/prisma/enums';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateBlockDto,
  FreeRoomsDto,
  FreeRoomsQueryDto,
  AvailabilityQueryDto,
  StayListDto,
} from './availability.schema';

const STAY_SELECT = {
  id: true,
  roomId: true,
  kind: true,
  checkIn: true,
  checkOut: true,
  reason: true,
} satisfies Prisma.RoomStaySelect;

/**
 * The exclusion constraint on `room_stays`. Catching it by name is what turns a
 * database refusal into something a host can read, and it is the only thing in
 * this system that actually prevents a double booking.
 */
const NO_OVERLAP_CONSTRAINT = 'room_stays_no_overlap';

/** A half-open stay range, in the form Prisma wants for a `DATE` column. */
interface StayRange {
  checkIn: StayDate;
  checkOut: StayDate;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every stay touching the window, bookings and blocks alike. The client draws
   * cells from these ranges rather than being sent one per room-night, which is
   * the difference between a month arriving on a village connection and not.
   */
  async window(
    propertyId: string,
    { from, to }: AvailabilityQueryDto,
  ): Promise<StayListDto> {
    const stays = await this.prisma.roomStay.findMany({
      where: { propertyId, ...overlapping({ checkIn: from, checkOut: to }) },
      orderBy: [{ checkIn: 'asc' }, { roomId: 'asc' }],
      select: STAY_SELECT,
    });

    return { stays: stays.map(toStayDto) };
  }

  /**
   * Which rooms a caller could be quoted for. Rooms out of service are not
   * candidates: a room being repaired is not free, it is off the market, and a
   * host reading this list is about to promise one of them to someone.
   */
  async freeRooms(
    propertyId: string,
    { checkIn, checkOut }: FreeRoomsQueryDto,
  ): Promise<FreeRoomsDto> {
    const [rooms, taken] = await Promise.all([
      this.prisma.room.findMany({
        where: { propertyId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      }),
      this.prisma.roomStay.findMany({
        where: { propertyId, ...overlapping({ checkIn, checkOut }) },
        select: { roomId: true },
        distinct: ['roomId'],
      }),
    ]);

    const occupied = new Set(taken.map((stay) => stay.roomId));

    return {
      checkIn,
      checkOut,
      roomIds: rooms.map((room) => room.id).filter((id) => !occupied.has(id)),
    };
  }

  /**
   * Dates the host is holding back — repairs, family, a booking that came in on
   * Airbnb. One row per room, written together: a monsoon closure that took on
   * five rooms of six would leave the sixth quietly bookable.
   */
  async createBlocks(
    propertyId: string,
    block: CreateBlockDto,
  ): Promise<StayListDto> {
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: block.roomIds }, propertyId },
      select: { id: true },
    });
    if (rooms.length !== new Set(block.roomIds).size) {
      throw new DomainError('NOT_FOUND', 'One of these rooms was not found.');
    }

    await this.assertRoomsAreFree(propertyId, block.roomIds, block);

    const checkIn = parseStayDate(block.checkIn);
    const checkOut = parseStayDate(block.checkOut);

    try {
      // Created row by row inside one transaction rather than with `createMany`,
      // because the client needs the ids back to remove a block it just made —
      // and because either the whole closure lands or none of it does.
      const created = await this.prisma.$transaction(
        block.roomIds.map((roomId) =>
          this.prisma.roomStay.create({
            data: {
              propertyId,
              roomId,
              kind: StayKind.BLOCK,
              checkIn,
              checkOut,
              reason: block.reason,
            },
            select: STAY_SELECT,
          }),
        ),
      );

      return { stays: created.map(toStayDto) };
    } catch (error) {
      // The check above exists to name the room in the way; this is what holds
      // when two devices block the same nights at the same moment.
      if (
        error instanceof Error &&
        error.message.includes(NO_OVERLAP_CONSTRAINT)
      ) {
        throw conflictError(block);
      }
      throw error;
    }
  }

  /**
   * Only a block. A booking's dates are freed by cancelling the booking, which
   * is a different decision with a different record — deleting its occupancy row
   * from here would leave a confirmed booking holding nothing.
   */
  async removeBlock(propertyId: string, stayId: string): Promise<void> {
    const deleted = await this.prisma.roomStay.deleteMany({
      where: { id: stayId, propertyId, kind: StayKind.BLOCK },
    });
    if (deleted.count === 0) {
      throw new DomainError('NOT_FOUND', 'This block was not found.');
    }
  }

  /**
   * Names the rooms that are in the way and the dates they are taken for.
   * "Those dates are not available" is not something a host can act on while a
   * guest is waiting on the phone.
   */
  private async assertRoomsAreFree(
    propertyId: string,
    roomIds: string[],
    range: StayRange,
  ): Promise<void> {
    const clashing = await this.prisma.roomStay.findMany({
      where: { propertyId, roomId: { in: roomIds }, ...overlapping(range) },
      orderBy: { checkIn: 'asc' },
      select: {
        checkIn: true,
        checkOut: true,
        room: { select: { name: true } },
      },
    });

    if (clashing.length > 0) {
      throw conflictError(
        range,
        clashing.map((stay) => ({
          name: stay.room.name,
          checkIn: toStayDate(stay.checkIn),
          checkOut: toStayDate(stay.checkOut),
        })),
      );
    }
  }
}

/**
 * Half-open overlap: two ranges collide when each starts before the other ends.
 * A stay ending the morning another begins does not, which is what makes
 * same-day turnover work without a special case.
 *
 * Only occupancy-consuming rows count — the same predicate the database's
 * exclusion constraint uses, so the pre-check and the guarantee agree.
 */
function overlapping({
  checkIn,
  checkOut,
}: StayRange): Prisma.RoomStayWhereInput {
  return {
    occupies: true,
    checkIn: { lt: parseStayDate(checkOut) },
    checkOut: { gt: parseStayDate(checkIn) },
  };
}

function conflictError(
  range: StayRange,
  clashing: { name: string; checkIn: StayDate; checkOut: StayDate }[] = [],
): DomainError {
  const taken = clashing
    .map(
      (stay) =>
        `${stay.name} (${formatStayDate(stay.checkIn)} to ${formatStayDate(stay.checkOut)})`,
    )
    .join(', ');

  return new DomainError(
    'BOOKING_CONFLICT',
    taken.length > 0
      ? `These rooms are already taken: ${taken}.`
      : `Something already occupies ${formatStayDate(range.checkIn)} to ${formatStayDate(range.checkOut)}.`,
  );
}

/** A `DATE` column arrives as UTC midnight; the calendar day is all it carries. */
function toStayDto(stay: {
  id: string;
  roomId: string;
  kind: StayKind;
  checkIn: Date;
  checkOut: Date;
  reason: string | null;
}): StayListDto['stays'][number] {
  return {
    ...stay,
    checkIn: toStayDate(stay.checkIn),
    checkOut: toStayDate(stay.checkOut),
  };
}
