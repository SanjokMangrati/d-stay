import { daysBetween } from '@d-stay/domain/datetime';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MealPlan } from '../../generated/prisma/enums';

/**
 * ₹10,00,000 a night. Not a business rule — a typo guard, so a host who means
 * ₹2,500 and types the paise finds out from the form.
 */
const MAX_RATE_PAISE = 100_000_000;

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
 * Everything the quote function needs for this property, in one response. It is
 * one screen's worth of data and the web app computes live previews from it, so
 * splitting rates and overrides into separate endpoints would only mean two
 * requests that can disagree.
 */
export const pricingSchema = z.object({
  mealPlan: z.enum(MealPlan).nullable(),
  mealChargePerPerson: z.number().int(),
  gstEnabled: z.boolean(),
  rooms: z.array(roomRatesSchema),
  overrides: z.array(rateOverrideSchema),
});

export class PricingDto extends createZodDto(pricingSchema) {}

export const updateMealChargeSchema = z.object({
  mealChargePerPerson: paise,
});

export class UpdateMealChargeDto extends createZodDto(updateMealChargeSchema) {}

export const updateRoomRatesSchema = z.object({
  baseRate: paise.nullable(),
  weekendRate: paise.nullable(),
  extraGuestCharge: paise,
});

export class UpdateRoomRatesDto extends createZodDto(updateRoomRatesSchema) {}

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
