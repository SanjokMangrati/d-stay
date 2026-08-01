import { MealPlan, PropertyStatus } from '../../generated/prisma/enums';

/**
 * What a property must have before an operator can review it. Deliberately
 * narrower than "every field": landmark, directions, house rules, amenities and
 * the registration number are all real, all optional, and none of them make the
 * listing wrong by being absent.
 *
 * `location` stands for the latitude/longitude pair, because the host sets one
 * map pin and a checklist that says two things are missing would be a lie.
 */
export const REQUIRED_PROPERTY_FIELDS = [
  'description',
  'photos',
  'rooms',
  'location',
  'city',
  'district',
  'state',
  'checkInTime',
  'checkOutTime',
  'mealPlan',
  'gstin',
] as const;

export type RequiredPropertyField = (typeof REQUIRED_PROPERTY_FIELDS)[number];

/** Only the fields the check reads, so it stays a pure function over a plain shape. */
export interface PropertyCompletenessInput {
  description: string | null;
  /** Photos that exist as far as the host is concerned: uploaded, not abandoned. */
  photoCount: number;
  /** Only rooms a guest could be put in — a deactivated room is not inventory. */
  activeRoomCount: number;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  state: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  mealPlan: MealPlan | null;
  gstEnabled: boolean;
  gstin: string | null;
}

export function missingRequiredFields(
  property: PropertyCompletenessInput,
): RequiredPropertyField[] {
  const missing: RequiredPropertyField[] = [];

  if (!property.description) missing.push('description');
  // One photo is the floor, not the ambition: a listing with none cannot be
  // reviewed at all, and a host adds the rest as they take them.
  if (property.photoCount < 1) missing.push('photos');
  // Nothing can be sold without one, so this is the entry that most often keeps
  // a property out of the queue.
  if (property.activeRoomCount < 1) missing.push('rooms');
  if (property.latitude === null || property.longitude === null) {
    missing.push('location');
  }
  if (!property.city) missing.push('city');
  if (!property.district) missing.push('district');
  if (!property.state) missing.push('state');
  if (!property.checkInTime) missing.push('checkInTime');
  if (!property.checkOutTime) missing.push('checkOutTime');
  if (property.mealPlan === null) missing.push('mealPlan');
  // A GSTIN is only required of a host who says they charge GST.
  if (property.gstEnabled && !property.gstin) missing.push('gstin');

  return missing;
}

/**
 * A draft can be submitted, and so can a rejected property once the host has
 * fixed what the operator flagged. Everything else is already in, or past, the
 * queue.
 */
export const SUBMITTABLE_STATUSES: PropertyStatus[] = [
  PropertyStatus.DRAFT,
  PropertyStatus.REJECTED,
];
