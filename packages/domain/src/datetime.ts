import { LOCALE, TIMEZONE } from "./locale";

/**
 * A calendar date with no time and no zone, `YYYY-MM-DD`. Stay dates are this and
 * never a timestamp: a check-in on the 14th is the 14th regardless of when the row
 * was written or who is reading it.
 */
export type StayDate = string;

export const STAY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const stayDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIMEZONE,
});

const timestampFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIMEZONE,
});

const isoDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIMEZONE,
});

/** `"2026-07-14"` → `"14 Jul 2026"`. */
export function formatStayDate(date: StayDate): string {
  return stayDateFormatter.format(parseStayDate(date));
}

/** An operational timestamp (created, checked in) rendered in the host's timezone. */
export function formatTimestamp(instant: Date | string): string {
  return timestampFormatter.format(
    typeof instant === "string" ? new Date(instant) : instant,
  );
}

/**
 * Today as the host experiences it. Server processes may run in UTC, so "today"
 * is always resolved through the product timezone rather than the host clock.
 */
export function todayStayDate(now: Date = new Date()): StayDate {
  return isoDatePartsFormatter.format(now);
}

/**
 * Parses to a UTC-midnight Date so that formatting and comparison are stable.
 * Only for turning a wire value into something `Intl`/`Date` arithmetic accepts.
 */
export function parseStayDate(date: StayDate): Date {
  if (!STAY_DATE_PATTERN.test(date)) {
    throw new RangeError(
      `Expected a YYYY-MM-DD stay date, received "${date}".`,
    );
  }
  return new Date(`${date}T00:00:00.000Z`);
}
