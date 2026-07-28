import type { ApiErrorDto } from "./generated/models";

export type ApiErrorCode = ApiErrorDto["error"]["code"];

export type ApiFieldError = NonNullable<
  ApiErrorDto["error"]["fieldErrors"]
>[number];

/**
 * Every failed request from the generated client rejects with this. Callers
 * branch on `code` — never on `message`, which is written for humans and is free
 * to change without warning.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId: string;
  readonly fieldErrors?: ApiFieldError[];

  constructor(status: number, payload: ApiErrorDto["error"]) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.fieldErrors = payload.fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * A response the API never produced — a proxy timing out, a gateway HTML page, a
 * dropped connection. It is deliberately a different type from `ApiError` so
 * "the API said no" and "we never reached the API" cannot be confused.
 */
export class ApiTransportError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiTransportError";
    this.status = status;
  }
}
