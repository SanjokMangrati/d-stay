import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ERROR_CODES } from './error-codes';

const fieldErrorSchema = z.object({
  /** Dot path into the submitted body, so a form can attach it to the right input. */
  path: z.string(),
  message: z.string(),
});

/**
 * Every non-2xx response from this API has this shape, without exception. It is
 * registered on every operation in the OpenAPI document, which is how the web app
 * gets a typed `code` to branch on instead of parsing message text.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    /** Correlates the response with the server log line that explains it. */
    requestId: z.string(),
    fieldErrors: z.array(fieldErrorSchema).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}
