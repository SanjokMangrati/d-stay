import { HttpException } from '@nestjs/common';
import { ERROR_CODE_STATUS, ErrorCode } from './error-codes';

/**
 * The only way application code signals a expected failure. Services throw this
 * and never construct HTTP responses themselves; the status follows from the
 * code, so a caller cannot pick a status that contradicts the code.
 */
export class DomainError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message, ERROR_CODE_STATUS[code]);
    this.name = 'DomainError';
  }
}
