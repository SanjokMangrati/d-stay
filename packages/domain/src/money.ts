import { CURRENCY, LOCALE } from "./locale";

/**
 * Every money value that crosses a boundary — database column, API field, job
 * payload — is an integer count of paise. Rupees exist only as display text and
 * as what a host types into an input.
 */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;

/**
 * ₹10,00,000. Not a business rule — a typo guard shared by every rate a host can
 * type, so that someone who means ₹2,500 and enters the paise is told by the
 * form rather than by a guest.
 */
export const MAX_RATE_PAISE: Paise = 100_000_000;

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const wholeRupeeFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

function assertPaise(value: Paise): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Money must be an integer number of paise, received ${value}. A fractional value means rupees leaked into a paise field.`,
    );
  }
}

/** `150000` → `"₹1,500"`, `150050` → `"₹1,500.50"`. */
export function formatPaise(value: Paise): string {
  assertPaise(value);
  return formatter.format(value / PAISE_PER_RUPEE);
}

/** Drops any paise remainder. For summary figures where exactness is noise. */
export function formatPaiseAsWholeRupees(value: Paise): string {
  assertPaise(value);
  return wholeRupeeFormatter.format(value / PAISE_PER_RUPEE);
}

/** Converts host input (`1500.5`) into storable paise. Rounds to the nearest paise. */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) {
    throw new RangeError(`Cannot convert ${rupees} to paise.`);
  }
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/**
 * For prefilling a rupee-denominated form field only. Never accumulate or
 * compare the result — arithmetic stays in paise.
 */
export function paiseToRupees(value: Paise): number {
  assertPaise(value);
  return value / PAISE_PER_RUPEE;
}
