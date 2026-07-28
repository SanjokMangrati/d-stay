import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().int().nonnegative(),
});

export class HealthDto extends createZodDto(healthSchema) {}
