import {
  nightsBetween,
  parseStayDate,
  toStayDate,
  type StayDate,
} from "@d-stay/domain/datetime";

/**
 * A month is identified by its first day, so it is a `StayDate` like everything
 * else the calendar handles and needs no second date type to reason about.
 */
export type CalendarMonth = StayDate;

export function startOfMonth(date: StayDate): CalendarMonth {
  return `${date.slice(0, 7)}-01`;
}

/** Walks whole months. December plus one is January, not day 32. */
export function shiftMonth(month: CalendarMonth, by: number): CalendarMonth {
  const start = parseStayDate(month);
  return toStayDate(
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + by, 1)),
  );
}

/**
 * The window the calendar asks the API for, half-open like every range in this
 * system: the first of next month is the first date it does *not* cover.
 */
export function monthWindow(month: CalendarMonth): {
  from: StayDate;
  to: StayDate;
} {
  return { from: month, to: shiftMonth(month, 1) };
}

/** Every night the month's grid has a column for. */
export function monthNights(month: CalendarMonth): StayDate[] {
  return nightsBetween(month, shiftMonth(month, 1));
}
