import "server-only";
import pino from "pino";
import { serverEnv } from "./env";

/**
 * Server-side logging only. The browser does not get a logger: client-side
 * diagnostics go to PostHog, and shipping pino to the browser would cost a host
 * on a rural connection real bytes for no benefit.
 *
 * Log structured objects with a static message — `logger.warn({ propertyId },
 * "property publish rejected")` — never an interpolated sentence.
 */
export const logger = pino({
  level: serverEnv.LOG_LEVEL,
  redact: [
    "*.password",
    "*.token",
    "*.otp",
    "*.phone",
    "*.email",
    "*.guestPhone",
    "*.guestEmail",
  ],
  transport:
    serverEnv.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { singleLine: true, translateTime: "SYS:HH:MM:ss" },
        }
      : undefined,
});
