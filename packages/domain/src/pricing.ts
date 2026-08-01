import { nightsBetween, parseStayDate, type StayDate } from "./datetime";
import type { Paise } from "./money";

/**
 * The one place a price is decided. This function is pure and dependency-free
 * because it runs twice for every booking: on the server, where its output is
 * written as an immutable snapshot, and in the browser, where the host watches
 * the number move as they pick dates. Two implementations would eventually
 * disagree, and the host would find out from a guest.
 */

/** Mirrors the `MealPlan` enum; the domain package holds no database types. */
export type MealPlan =
  | "ROOM_ONLY"
  | "BREAKFAST"
  | "BREAKFAST_DINNER"
  | "ALL_MEALS";

/**
 * GST on accommodation is banded by what the room-night actually costs, so tax
 * cannot be one percentage held on the property. Slabs are listed lowest first
 * and read in order; the last one has no ceiling.
 *
 * Boundaries are inclusive: a ₹1,000 night is 0% and a ₹7,500 night is 5%. When
 * the government moves them, this array is the single edit — and the version
 * below is what a snapshot can be read back against.
 */
export const GST_SLAB_VERSION = "2025-09";

export const GST_SLABS: readonly {
  readonly maxTariff: Paise | null;
  readonly basisPoints: number;
}[] = [
  { maxTariff: 100_000, basisPoints: 0 },
  { maxTariff: 750_000, basisPoints: 500 },
  { maxTariff: null, basisPoints: 1800 },
];

/** The GST rate a single room-night attracts, from that night's own tariff. */
export function gstBasisPointsFor(tariff: Paise): number {
  const slab = GST_SLABS.find(
    (candidate) => candidate.maxTariff === null || tariff <= candidate.maxTariff,
  );
  if (!slab) {
    throw new RangeError(`No GST slab covers a tariff of ${tariff} paise.`);
  }
  return slab.basisPoints;
}

/**
 * Friday and Saturday nights. Not configurable: an Indian hill-station homestay
 * fills on exactly these two, and a setting nobody would change is a setting
 * that only makes the pricing harder to reason about.
 */
export function isWeekendNight(date: StayDate): boolean {
  const day = parseStayDate(date).getUTCDay();
  return day === 5 || day === 6;
}

export interface RoomRates {
  roomId: string;
  /** Guests the room rate covers; beyond it, each head is charged nightly. */
  standardOccupancy: number;
  /** Absent until the host has priced the room — such a room cannot be quoted. */
  baseRate: Paise | null;
  weekendRate: Paise | null;
  extraGuestCharge: Paise;
}

/** Both dates are nights the override covers, first and last inclusive. */
export interface RateOverride {
  roomId: string;
  startDate: StayDate;
  endDate: StayDate;
  nightlyRate: Paise;
  minStayNights: number | null;
}

export interface QuotedRoom {
  roomId: string;
  adults: number;
  children: number;
}

export interface QuoteInput {
  checkIn: StayDate;
  /** Exclusive, as every stay range in this system is. */
  checkOut: StayDate;
  rooms: QuotedRoom[];
  rates: RoomRates[];
  overrides: RateOverride[];
  mealPlan: MealPlan;
  /** Per person per night, charged whenever the plan includes any meal. */
  mealChargePerPerson: Paise;
  gstEnabled: boolean;
}

/** Which rule set this night's rate: a date override, the weekend rate, the base. */
export type RateSource = "override" | "weekend" | "base";

export interface QuoteNight {
  roomId: string;
  date: StayDate;
  source: RateSource;
  roomCharge: Paise;
  extraGuests: number;
  extraGuestCharge: Paise;
  mealCharge: Paise;
  /** What the slab is read from: everything charged for this room-night. */
  tariff: Paise;
  gstBasisPoints: number;
  taxAmount: Paise;
}

/** A room the host asked to price for fewer nights than an override demands. */
export interface MinStayShortfall {
  roomId: string;
  requiredNights: number;
}

export interface Quote {
  nights: QuoteNight[];
  nightCount: number;
  roomTotal: Paise;
  extraGuestTotal: Paise;
  mealTotal: Paise;
  subtotal: Paise;
  taxTotal: Paise;
  total: Paise;
  minStayShortfalls: MinStayShortfall[];
  /**
   * Rooms with no rate for at least one of the nights asked for. They are left
   * out of the totals rather than counted as free: the server refuses to write
   * a booking naming one, and the host is told which room to go and price.
   */
  unpricedRoomIds: string[];
}

export function quote(input: QuoteInput): Quote {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights.length === 0) {
    throw new RangeError(
      `A stay must cover at least one night; ${input.checkIn} to ${input.checkOut} covers none.`,
    );
  }

  const priced: QuoteNight[] = [];
  const unpricedRoomIds: string[] = [];
  const minStayShortfalls: MinStayShortfall[] = [];

  for (const room of input.rooms) {
    const rates = input.rates.find((candidate) => candidate.roomId === room.roomId);
    if (!rates) {
      unpricedRoomIds.push(room.roomId);
      continue;
    }

    const overrides = input.overrides.filter(
      (override) => override.roomId === room.roomId,
    );
    const guests = room.adults + room.children;
    // Children are charged as guests. A child rate is a real thing hosts ask
    // for, but it belongs to a discount model this product does not have yet.
    const extraGuests = Math.max(0, guests - rates.standardOccupancy);
    const mealCharge = mealChargeFor(input, guests);

    const roomNights: QuoteNight[] = [];
    for (const date of nights) {
      const resolved = resolveNightlyRate(rates, overrides, date);
      if (resolved === null) {
        roomNights.length = 0;
        unpricedRoomIds.push(room.roomId);
        break;
      }

      const extraGuestCharge = extraGuests * rates.extraGuestCharge;
      const tariff = resolved.rate + extraGuestCharge + mealCharge;
      const gstBasisPoints = input.gstEnabled ? gstBasisPointsFor(tariff) : 0;

      roomNights.push({
        roomId: room.roomId,
        date,
        source: resolved.source,
        roomCharge: resolved.rate,
        extraGuests,
        extraGuestCharge,
        mealCharge,
        tariff,
        gstBasisPoints,
        // Rounded per room-night, which is the unit the tax is levied on — one
        // rounding at the end would not reconcile with the line items.
        taxAmount: Math.round((tariff * gstBasisPoints) / 10_000),
      });
    }

    priced.push(...roomNights);

    const requiredNights = minStayFor(overrides, nights);
    if (requiredNights !== null && nights.length < requiredNights) {
      minStayShortfalls.push({ roomId: room.roomId, requiredNights });
    }
  }

  const roomTotal = sum(priced, (night) => night.roomCharge);
  const extraGuestTotal = sum(priced, (night) => night.extraGuestCharge);
  const mealTotal = sum(priced, (night) => night.mealCharge);
  const taxTotal = sum(priced, (night) => night.taxAmount);
  const subtotal = roomTotal + extraGuestTotal + mealTotal;

  return {
    nights: priced,
    nightCount: nights.length,
    roomTotal,
    extraGuestTotal,
    mealTotal,
    subtotal,
    taxTotal,
    total: subtotal + taxTotal,
    minStayShortfalls,
    unpricedRoomIds,
  };
}

/**
 * Date override beats weekend rate beats base rate. Null when the host has not
 * priced the room at all and no override covers the night.
 */
export function resolveNightlyRate(
  rates: RoomRates,
  overrides: RateOverride[],
  date: StayDate,
): { rate: Paise; source: RateSource } | null {
  const override = overrides.find((candidate) => covers(candidate, date));
  if (override) {
    return { rate: override.nightlyRate, source: "override" };
  }

  if (rates.weekendRate !== null && isWeekendNight(date)) {
    return { rate: rates.weekendRate, source: "weekend" };
  }

  return rates.baseRate === null
    ? null
    : { rate: rates.baseRate, source: "base" };
}

function covers(override: RateOverride, date: StayDate): boolean {
  return date >= override.startDate && date <= override.endDate;
}

function mealChargeFor(input: QuoteInput, guests: number): Paise {
  return input.mealPlan === "ROOM_ONLY" ? 0 : input.mealChargePerPerson * guests;
}

/**
 * The longest minimum stay any override touching the stay demands. A stay that
 * runs into a festival week has to satisfy that week's rule, not the average.
 */
function minStayFor(
  overrides: RateOverride[],
  nights: StayDate[],
): number | null {
  const required = overrides.flatMap((override) =>
    override.minStayNights !== null &&
    nights.some((night) => covers(override, night))
      ? [override.minStayNights]
      : [],
  );

  return required.length > 0 ? Math.max(...required) : null;
}

function sum(nights: QuoteNight[], of: (night: QuoteNight) => Paise): Paise {
  return nights.reduce((total, night) => total + of(night), 0);
}
