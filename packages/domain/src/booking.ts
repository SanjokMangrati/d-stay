/**
 * The booking lifecycle, in one place because both apps act on it: the server
 * refuses an illegal move, and the host's screen offers only the moves that are
 * legal. Two copies of this graph would drift into a button that does nothing.
 *
 * Mirrors the `BookingStatus` enum; the domain package holds no database types.
 */
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

/**
 * The legal graph, forward-only. A guest who left cannot un-leave, and a
 * cancellation is not undone — the host writes a new booking, which is what
 * keeps the history honest about what happened.
 *
 * `NO_SHOW` is reachable only from the states where someone was expected and
 * did not arrive; a guest already in the house cannot become a no-show.
 */
const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * The statuses that hold rooms. This is the same predicate the database's
 * exclusion constraint runs on `RoomStay.occupies`, and it is why a cancelled
 * booking keeps its record while its dates go back on the market.
 *
 * Adding a status means deciding which side of this line it falls on, and
 * saying so in the migration that adds it.
 */
const OCCUPYING: readonly BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
];

export function occupiesRooms(status: BookingStatus): boolean {
  return OCCUPYING.includes(status);
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** What the host can do to a booking in this state, in the order it is offered. */
export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}
