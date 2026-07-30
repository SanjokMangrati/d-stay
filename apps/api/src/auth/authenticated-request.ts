import type { Request } from 'express';
import type { UserRole } from '../../generated/prisma/enums';

/**
 * What Better Auth's guard attaches to every request it has seen. The library
 * types `user.role` as a loose `string | string[]`; narrowing it to the Prisma
 * enum here is what lets guards compare roles without a cast.
 */
export interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole } | null;
}
