import { daysBetween } from '@d-stay/domain/datetime';
import { MAX_RATE_PAISE } from '@d-stay/domain/money';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MealPlan } from '../../generated/prisma/enums';

/** Every amount that crosses this boundary is an integer count of paise. */
const paise = z.number().int().min(0).max(MAX_RATE_PAISE);

const stayDate = z.iso.date();

/** A festival week is long; a season a host prices in one go is not a year. */
export const MAX_OVERRIDE_NIGHTS = 366;

export const roomRatesSchema = z.object({
  roomId: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
  standardOccupancy: z.number().int(),
  /** The hard cap, so a booking form can stop a host over-filling the room. */
  maxOccupancy: z.number().int(),
  /** Null until the host prices the room; such a room cannot be quoted. */
  baseRate: z.number().int().nullable(),
  weekendRate: z.number().int().nullable(),
  extraGuestCharge: z.number().int(),
});

export const rateOverrideSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  /** Both dates are nights the override covers, first and last inclusive. */
  startDate: stayDate,
  endDate: stayDate,
  nightlyRate: z.number().int(),
  minStayNights: z.number().int().nullable(),
});

/**
 * Everything the quote function needs for this property, in one response — the
 * read model the calendar resolves every cell from. Rooms and seasons arrive
 * together because a grid that fetched them separately could draw a night at a
 * price that never existed.
 *
 * Read-only: each of these fields is written through the module that owns it.
 */
export const pricingSchema = z.object({
  mealPlan: z.enum(MealPlan).nullable(),
  mealChargePerPerson: z.number().int(),
  gstEnabled: z.boolean(),
  rooms: z.array(roomRatesSchema),
  overrides: z.array(rateOverrideSchema),
});

export class PricingDto extends createZodDto(pricingSchema) {}

/**
 * One action, many rooms: a host raising rates for Diwali means all of them, and
 * making that twelve separate edits is how a season gets priced wrong.
 */
export const createRateOverrideSchema = z
  .object({
    roomIds: z.array(z.uuid()).min(1),
    startDate: stayDate,
    endDate: stayDate,
    nightlyRate: paise,
    minStayNights: z.number().int().min(1).max(30).nullable(),
  })
  .refine((override) => override.endDate >= override.startDate, {
    path: ['endDate'],
    error: 'The last night cannot fall before the first.',
  })
  .refine(
    (override) =>
      daysBetween(override.startDate, override.endDate) < MAX_OVERRIDE_NIGHTS,
    {
      path: ['endDate'],
      error: 'A single override cannot cover more than a year of nights.',
    },
  );

export class CreateRateOverrideDto extends createZodDto(
  createRateOverrideSchema,
) {}
