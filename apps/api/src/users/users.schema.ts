import { PHONE_PATTERN } from '@d-stay/domain/phone';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '../../generated/prisma/enums';

const phone = z
  .string()
  .regex(
    PHONE_PATTERN,
    'Enter an Indian mobile number, for example +919876543210.',
  );

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  role: z.enum(UserRole),
  phone: phone.nullable(),
  /** Always false in phase 1 — SMS OTP is blocked on DLT registration. */
  phoneVerified: z.boolean(),
  avatarUrl: z.url().nullable(),
  locale: z.string(),
});

export class UserProfileDto extends createZodDto(userProfileSchema) {}

/**
 * Email is absent deliberately: changing it re-runs verification and is Better
 * Auth's `change-email` flow, not a profile edit. Role is absent because a host
 * cannot promote themselves.
 */
export const updateUserProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: phone.nullable(),
    avatarUrl: z.url().nullable(),
    locale: z.string().min(2).max(10),
  })
  .partial();

export class UpdateUserProfileDto extends createZodDto(
  updateUserProfileSchema,
) {}
