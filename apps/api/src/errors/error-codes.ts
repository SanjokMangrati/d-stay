import { HttpStatus } from '@nestjs/common';

/**
 * The complete vocabulary of machine-readable failures this API can return.
 * Clients branch on these; they are part of the contract and reach the frontend
 * through the OpenAPI document, so renaming one is a breaking change.
 *
 * Domain-specific codes (`BOOKING_CONFLICT`, `MIN_STAY_VIOLATION`, …) are added
 * here as their modules are built — never declared locally inside a module.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'PROPERTY_INCOMPLETE',
  'INVALID_STATUS_TRANSITION',
  'MEDIA_LIMIT_REACHED',
  'ROOM_LIMIT_REACHED',
  'RATE_OVERRIDE_CONFLICT',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * One code maps to exactly one status. Keeping the mapping here rather than at
 * each throw site is what stops the same failure returning 409 from one endpoint
 * and 400 from another.
 */
export const ERROR_CODE_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  PROPERTY_INCOMPLETE: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
  MEDIA_LIMIT_REACHED: HttpStatus.CONFLICT,
  ROOM_LIMIT_REACHED: HttpStatus.CONFLICT,
  RATE_OVERRIDE_CONFLICT: HttpStatus.CONFLICT,
};

const STATUS_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Used only to translate framework-thrown `HttpException`s into the envelope. */
export function errorCodeForStatus(status: number): ErrorCode {
  return STATUS_CODE[status] ?? 'INTERNAL_ERROR';
}
