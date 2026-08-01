import { HttpException } from '@nestjs/common';
import type { ApiError } from './api-error.schema';
import { ERROR_CODE_STATUS, ErrorCode } from './error-codes';

/**
 * The only way application code signals a expected failure. Services throw this
 * and never construct HTTP responses themselves; the status follows from the
 * code, so a caller cannot pick a status that contradicts the code.
 *
 * `fieldErrors` carries the same shape zod validation produces, so a domain
 * failure that is really about specific inputs — a property missing the fields
 * review requires — lands on the right form fields instead of a banner the host
 * has to interpret.
 */
export class DomainError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: ApiError['error']['fieldErrors'],
  ) {
    super(message, ERROR_CODE_STATUS[code]);
    this.name = 'DomainError';
  }
}
