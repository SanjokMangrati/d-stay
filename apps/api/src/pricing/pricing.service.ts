import { parseStayDate, type StayDate } from '@d-stay/domain/datetime';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRateOverrideDto,
  PricingDto,
  UpdateMealChargeDto,
  UpdateRoomRatesDto,
} from './pricing.schema';

const OVERRIDE_SELECT = {
  id: true,
  roomId: true,
  startDate: true,
  endDate: true,
  nightlyRate: true,
  minStayNights: true,
} satisfies Prisma.RateOverrideSelect;

/** The exclusion constraint that makes rate resolution a total function. */
const NO_OVERLAP_CONSTRAINT = 'rate_overrides_no_overlap';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rates for every room including the ones out of service: a host takes a room
   * off the market for the monsoon and expects to find its price where they left
   * it when they switch it back on.
   */
  async forProperty(propertyId: string): Promise<PricingDto> {
    const [property, rooms, overrides] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: { mealPlan: true, mealChargePerPerson: true, gstEnabled: true },
      }),
      this.prisma.room.findMany({
        where: { propertyId },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          isActive: true,
          standardOccupancy: true,
          baseRate: true,
          weekendRate: true,
          extraGuestCharge: true,
        },
      }),
      this.prisma.rateOverride.findMany({
        where: { propertyId },
        orderBy: [{ startDate: 'asc' }, { roomId: 'asc' }],
        select: OVERRIDE_SELECT,
      }),
    ]);

    return {
      ...property,
      rooms: rooms.map(({ id, ...room }) => ({ roomId: id, ...room })),
      overrides: overrides.map((override) => ({
        ...override,
        startDate: toStayDate(override.startDate),
        endDate: toStayDate(override.endDate),
      })),
    };
  }

  async updateMealCharge(
    propertyId: string,
    { mealChargePerPerson }: UpdateMealChargeDto,
  ): Promise<PricingDto> {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { mealChargePerPerson },
    });

    return this.forProperty(propertyId);
  }

  async updateRoomRates(
    propertyId: string,
    roomId: string,
    rates: UpdateRoomRatesDto,
  ): Promise<PricingDto> {
    const updated = await this.prisma.room.updateMany({
      where: { id: roomId, propertyId },
      data: rates,
    });
    if (updated.count === 0) {
      throw new DomainError('NOT_FOUND', 'This room was not found.');
    }

    return this.forProperty(propertyId);
  }

  /**
   * One override row per room, written together: a season priced for four rooms
   * and refused for the fifth would leave the host to work out which half of
   * their intention survived.
   */
  async createOverride(
    propertyId: string,
    override: CreateRateOverrideDto,
  ): Promise<PricingDto> {
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: override.roomIds }, propertyId },
      select: { id: true },
    });
    if (rooms.length !== new Set(override.roomIds).size) {
      throw new DomainError('NOT_FOUND', 'One of these rooms was not found.');
    }

    const startDate = parseStayDate(override.startDate);
    const endDate = parseStayDate(override.endDate);

    await this.assertNoOverlap(propertyId, override.roomIds, override);

    try {
      await this.prisma.rateOverride.createMany({
        data: override.roomIds.map((roomId) => ({
          propertyId,
          roomId,
          startDate,
          endDate,
          nightlyRate: override.nightlyRate,
          minStayNights: override.minStayNights,
        })),
      });
    } catch (error) {
      // The check above is for the host's benefit; this is what actually holds
      // when two devices submit overlapping seasons at once.
      if (
        error instanceof Error &&
        error.message.includes(NO_OVERLAP_CONSTRAINT)
      ) {
        throw overlapError();
      }
      throw error;
    }

    return this.forProperty(propertyId);
  }

  async removeOverride(
    propertyId: string,
    overrideId: string,
  ): Promise<PricingDto> {
    const deleted = await this.prisma.rateOverride.deleteMany({
      where: { id: overrideId, propertyId },
    });
    if (deleted.count === 0) {
      throw new DomainError('NOT_FOUND', 'This rate override was not found.');
    }

    return this.forProperty(propertyId);
  }

  /**
   * Names the rooms whose existing seasons are in the way, because "one of your
   * rooms already has a rate then" is not something a host can act on.
   */
  private async assertNoOverlap(
    propertyId: string,
    roomIds: string[],
    nights: { startDate: StayDate; endDate: StayDate },
  ): Promise<void> {
    const clashing = await this.prisma.rateOverride.findMany({
      where: {
        propertyId,
        roomId: { in: roomIds },
        startDate: { lte: parseStayDate(nights.endDate) },
        endDate: { gte: parseStayDate(nights.startDate) },
      },
      select: { room: { select: { name: true } } },
      distinct: ['roomId'],
    });

    if (clashing.length > 0) {
      throw overlapError(clashing.map((row) => row.room.name));
    }
  }
}

function overlapError(roomNames: string[] = []): DomainError {
  const rooms = roomNames.length > 0 ? ` for ${roomNames.join(', ')}` : '';
  return new DomainError(
    'RATE_OVERRIDE_CONFLICT',
    `These nights already have a rate override${rooms}. Remove it before setting another.`,
  );
}

/** A `DATE` column arrives as UTC midnight; the calendar day is all it carries. */
function toStayDate(date: Date): StayDate {
  return date.toISOString().slice(0, 10);
}
