/**
 * What the bookings queue carries. A discriminated union, like the media queue,
 * so a processor branch and its payload cannot disagree.
 */
export const BOOKINGS_QUEUE = 'bookings';

export type BookingJobData =
  /** Releases pencilled-in enquiries whose hold has run out. */
  { kind: 'release-expired-holds' };

/**
 * A repeatable sweep rather than a delayed job per hold: the sweep re-reads the
 * booking's state when it runs, so a hold that was confirmed, cancelled or given
 * a different expiry in the meantime needs no job to be cancelled or rescheduled.
 * One scheduler is also one thing to reassert on boot.
 *
 * Five minutes is close enough that a released room is bookable again while the
 * guest who wanted it is still on the phone.
 */
export const RELEASE_HOLDS_SCHEDULER_ID = 'bookings-release-expired-holds';
export const RELEASE_HOLDS_INTERVAL_MS = 5 * 60 * 1000;
