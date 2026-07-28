import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ApiError } from './api-error.schema';
import { DomainError } from './domain.error';
import {
  ERROR_CODE_STATUS,
  ErrorCode,
  errorCodeForStatus,
} from './error-codes';

/** Widened so status comparisons stay plain numeric rather than enum-to-number. */
const SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

interface Failure {
  status: number;
  code: ErrorCode;
  message: string;
  fieldErrors?: ApiError['error']['fieldErrors'];
}

/**
 * The single place an exception becomes an HTTP response. Nothing else in the API
 * writes an error body, which is what makes the envelope reliable enough for the
 * web app to branch on `code`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(ApiExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const failure = this.classify(exception);

    if (failure.status >= SERVER_ERROR_STATUS) {
      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        failure.message,
      );
    }

    const body: ApiError = {
      error: {
        code: failure.code,
        message: failure.message,
        requestId: requestIdOf(request),
        ...(failure.fieldErrors ? { fieldErrors: failure.fieldErrors } : {}),
      },
    };

    response.status(failure.status).json(body);
  }

  private classify(exception: unknown): Failure {
    if (exception instanceof ZodValidationException) {
      return {
        status: ERROR_CODE_STATUS.VALIDATION_FAILED,
        code: 'VALIDATION_FAILED',
        message: 'The submitted data is not valid.',
        fieldErrors: toFieldErrors(exception.getZodError()),
      };
    }

    // A response that does not match its own declared schema is a server bug, and
    // must never be sent to a client that trusts the generated types.
    if (exception instanceof ZodSerializationException) {
      return {
        status: ERROR_CODE_STATUS.INTERNAL_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'The server produced a response that failed its own schema.',
      };
    }

    if (exception instanceof DomainError) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: errorCodeForStatus(status),
        message:
          status >= SERVER_ERROR_STATUS
            ? 'Something went wrong on our side.'
            : exception.message,
      };
    }

    return {
      status: ERROR_CODE_STATUS.INTERNAL_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side.',
    };
  }
}

/**
 * `pino-http` types the request id as `string | number | object`; the configured
 * `genReqId` only ever produces a string, and the other branches exist so this
 * stays a total function rather than a cast.
 */
function requestIdOf(request: Request): string {
  const { id } = request;
  if (typeof id === 'string') {
    return id;
  }
  return typeof id === 'number' ? id.toString() : 'unknown';
}

function toFieldErrors(error: unknown): ApiError['error']['fieldErrors'] {
  if (!(error instanceof ZodError)) {
    return undefined;
  }
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
