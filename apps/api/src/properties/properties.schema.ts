import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PropertyRole } from '../../generated/prisma/enums';

/**
 * What the app shell needs to render the property switcher. The full property —
 * geo, amenities, rates, GST, review status — arrives with the setup flow.
 */
export const propertySummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The signed-in user's role on this property, absent for a platform admin. */
  membershipRole: z.enum(PropertyRole).nullable(),
});

export class PropertySummaryDto extends createZodDto(propertySummarySchema) {}

export const propertyListSchema = z.object({
  properties: z.array(propertySummarySchema),
});

export class PropertyListDto extends createZodDto(propertyListSchema) {}
