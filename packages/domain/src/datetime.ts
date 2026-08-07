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

const monthFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  timeZone: TIMEZONE,
});

const dayOfMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  timeZone: TIMEZONE,
});

/** `"2026-07-14"` → `"14 Jul 2026"`. */
export function formatStayDate(date: StayDate): string {
  return stayDateFormatter.format(parseStayDate(date));
}

/** `"2026-07-14"` → `"July 2026"`. The calendar's heading. */
export function formatStayMonth(date: StayDate): string {
  return monthFormatter.format(parseStayDate(date));
}

/** `"2026-07-14"` → `"Tue"`. A calendar column is too narrow for more. */
export function formatStayWeekday(date: StayDate): string {
  return weekdayFormatter.format(parseStayDate(date));
}

/** `"2026-07-14"` → `"14"`. */
export function formatStayDayOfMonth(date: StayDate): string {
  return dayOfMonthFormatter.format(parseStayDate(date));
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
 * The nights a stay occupies. Stay ranges are half-open — `[checkIn, checkOut)` —
 * so a guest leaving on the 16th does not hold the night of the 15th, and the
 * next guest may arrive that same morning.
 */
export function nightsBetween(checkIn: StayDate, checkOut: StayDate): StayDate[] {
  const last = parseStayDate(checkOut).getTime();
  const nights: StayDate[] = [];

  for (
    let night = parseStayDate(checkIn).getTime();
    night < last;
    night += MILLISECONDS_PER_DAY
  ) {
    nights.push(toStayDate(new Date(night)));
  }

  return nights;
}

/** The stay date `count` days later. Negative counts walk backwards. */
export function addDays(date: StayDate, count: number): StayDate {
  return toStayDate(
    new Date(parseStayDate(date).getTime() + count * MILLISECONDS_PER_DAY),
  );
}

/** Whole days between two stay dates. Negative when they are the wrong way round. */
export function daysBetween(from: StayDate, to: StayDate): number {
  return (
    (parseStayDate(to).getTime() - parseStayDate(from).getTime()) /
    MILLISECONDS_PER_DAY
  );
}

// Stay dates are parsed at UTC midnight, where every day is exactly this long —
// the product timezone has no DST, and this arithmetic never crosses one anyway.
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The inverse of `parseStayDate`, and what a `DATE` column arrives as: a Date at
 * UTC midnight carrying nothing but a calendar day. Reading it in any other zone
 * is how a stay moves a day.
 */
export function toStayDate(date: Date): StayDate {
  return date.toISOString().slice(0, 10);
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
