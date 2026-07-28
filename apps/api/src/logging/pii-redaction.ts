/**
 * Logs are shipped off-box and kept far longer than any request. A guest's phone
 * number in a log line is a data-protection problem that no later deletion fixes,
 * so PII is removed at the logger rather than at each call site.
 *
 * Request and response bodies are never logged at all — this list covers the
 * headers and any object a developer explicitly passes to the logger.
 */
export const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.otp',
  '*.phone',
  '*.email',
  '*.guestPhone',
  '*.guestEmail',
];
