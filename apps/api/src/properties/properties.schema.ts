import { MAX_RATE_PAISE } from '@d-stay/domain/money';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  MealPlan,
  PropertyAmenity,
  PropertyRole,
  PropertyStatus,
} from '../../generated/prisma/enums';
import { REQUIRED_PROPERTY_FIELDS } from './property-completeness';

/** 24-hour local time. Matches the CHECK constraint on the column. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/**
 * Kept here rather than in `@d-stay/domain` because nothing outside this
 * endpoint validates a GSTIN — the web form gets it through the generated zod
 * schema.
 */
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const time = z
  .string()
  .regex(TIME_PATTERN, 'Enter a 24-hour time, for example 12:00.');

/**
 * What the app shell needs to render the property switcher: enough to name the
 * property and show where it stands, nothing more.
 */
export const propertySummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(PropertyStatus),
  /** The signed-in user's role on this property, absent for a platform admin. */
  membershipRole: z.enum(PropertyRole).nullable(),
});

export class PropertySummaryDto extends createZodDto(propertySummarySchema) {}

export const propertyListSchema = z.object({
  properties: z.array(propertySummarySchema),
});

export class PropertyListDto extends createZodDto(propertyListSchema) {}

export const propertyDetailSchema = propertySummarySchema.extend({
  description: z.string().nullable(),
  /** Present only while the property is REJECTED. */
  rejectionReason: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  landmark: z.string().nullable(),
  directions: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  state: z.string().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  houseRules: z.string().nullable(),
  amenities: z.array(z.enum(PropertyAmenity)),
  mealPlan: z.enum(MealPlan).nullable(),
  /**
   * Paise per person per night, charged on every plan but room-only. It sits
   * beside the meal plan because one kitchen cooks for the whole house — it is
   * a fact about the property, not about any one room.
   */
  mealChargePerPerson: z.number().int(),
  gstEnabled: z.boolean(),
  gstin: z.string().nullable(),
  homestayRegistrationNumber: z.string().nullable(),
  /**
   * What still blocks submission for review. The server owns this so the host
   * and the review queue can never disagree about whether a property is ready.
   */
  missingFields: z.array(z.enum(REQUIRED_PROPERTY_FIELDS)),
});

export class PropertyDetailDto extends createZodDto(propertyDetailSchema) {}

/**
 * A property starts as a name and nothing else — the host is standing in their
 * own kitchen, and everything else can be filled in over the following days.
 */
export const createPropertySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export class CreatePropertyDto extends createZodDto(createPropertySchema) {}

/**
 * Every field optional because this is also the per-step draft save: a step
 * submits the fields it owns and nothing else. `null` clears a field the host
 * has emptied; omitting it leaves it alone.
 */
export const updatePropertySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    landmark: z.string().trim().max(200).nullable(),
    directions: z.string().trim().max(2000).nullable(),
    city: z.string().trim().max(120).nullable(),
    district: z.string().trim().max(120).nullable(),
    state: z.string().trim().max(120).nullable(),
    checkInTime: time.nullable(),
    checkOutTime: time.nullable(),
    houseRules: z.string().trim().max(4000).nullable(),
    amenities: z.array(z.enum(PropertyAmenity)),
    mealPlan: z.enum(MealPlan).nullable(),
    mealChargePerPerson: z.number().int().min(0).max(MAX_RATE_PAISE),
    gstEnabled: z.boolean(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN_PATTERN, 'Enter a GSTIN in the form 27AAPFU0939F1ZV.')
      .nullable(),
    homestayRegistrationNumber: z.string().trim().max(60).nullable(),
  })
  .partial()
  // The pin is one control in the UI and one constraint in the database, so a
  // request that moves only half of it is rejected before it reaches either.
  .refine(
    (changes) =>
      'latitude' in changes === 'longitude' in changes &&
      (changes.latitude === null) === (changes.longitude === null),
    {
      path: ['latitude'],
      error: 'Latitude and longitude must be set or cleared together.',
    },
  );

export class UpdatePropertyDto extends createZodDto(updatePropertySchema) {}
