import { describe, expect, it } from "vitest";
import {
  gstBasisPointsFor,
  isWeekendNight,
  quote,
  type QuoteInput,
  type RateOverride,
  type RoomRates,
} from "./pricing";

const ROOM = "room-1";

const rates: RoomRates = {
  roomId: ROOM,
  standardOccupancy: 2,
  baseRate: 200_000,
  weekendRate: 300_000,
  extraGuestCharge: 50_000,
};

/** A Thursday-to-Friday night, so weekday and weekend are one date apart. */
const THURSDAY = "2026-08-06";
const FRIDAY = "2026-08-07";
const SATURDAY = "2026-08-08";
const SUNDAY = "2026-08-09";

function ask(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    checkIn: THURSDAY,
    checkOut: FRIDAY,
    rooms: [{ roomId: ROOM, adults: 2, children: 0 }],
    rates: [rates],
    overrides: [],
    mealPlan: "ROOM_ONLY",
    mealChargePerPerson: 0,
    gstEnabled: false,
    ...overrides,
  };
}

describe("weekend nights", () => {
  it.each([
    [THURSDAY, false],
    [FRIDAY, true],
    [SATURDAY, true],
    [SUNDAY, false],
  ])("%s is a weekend night: %s", (date, expected) => {
    expect(isWeekendNight(date)).toBe(expected);
  });
});

describe("GST slabs", () => {
  it.each([
    [0, 0],
    [99_999, 0],
    // The boundaries the slab table is most often got wrong at.
    [100_000, 0],
    [100_001, 500],
    [750_000, 500],
    [750_001, 1800],
    [1_200_000, 1800],
  ])("a tariff of %d paise attracts %d basis points", (tariff, expected) => {
    expect(gstBasisPointsFor(tariff)).toBe(expected);
  });
});

describe("rate resolution", () => {
  it("uses the base rate on a weekday", () => {
    const result = quote(ask());

    expect(result.nights).toHaveLength(1);
    expect(result.nights[0]).toMatchObject({
      source: "base",
      roomCharge: 200_000,
    });
    expect(result.total).toBe(200_000);
  });

  it("uses the weekend rate on Friday and Saturday", () => {
    const result = quote(ask({ checkIn: FRIDAY, checkOut: SUNDAY }));

    expect(result.nights.map((night) => night.source)).toEqual([
      "weekend",
      "weekend",
    ]);
    expect(result.total).toBe(600_000);
  });

  it("falls back to the base rate when no weekend rate is set", () => {
    const result = quote(
      ask({
        checkIn: FRIDAY,
        checkOut: SATURDAY,
        rates: [{ ...rates, weekendRate: null }],
      }),
    );

    expect(result.nights[0]?.source).toBe("base");
    expect(result.total).toBe(200_000);
  });

  it("lets a date override beat both", () => {
    const override: RateOverride = {
      roomId: ROOM,
      startDate: FRIDAY,
      endDate: SATURDAY,
      nightlyRate: 500_000,
      minStayNights: null,
    };

    const result = quote(
      ask({ checkIn: THURSDAY, checkOut: SUNDAY, overrides: [override] }),
    );

    expect(result.nights.map((night) => night.source)).toEqual([
      "base",
      "override",
      "override",
    ]);
    expect(result.roomTotal).toBe(200_000 + 500_000 + 500_000);
  });

  it("prices the last night of an override and not the night after it", () => {
    const result = quote(
      ask({
        checkIn: THURSDAY,
        checkOut: SUNDAY,
        rates: [{ ...rates, weekendRate: null }],
        overrides: [
          {
            roomId: ROOM,
            startDate: THURSDAY,
            endDate: FRIDAY,
            nightlyRate: 900_000,
            minStayNights: null,
          },
        ],
      }),
    );

    expect(result.nights.map((night) => night.roomCharge)).toEqual([
      900_000, 900_000, 200_000,
    ]);
  });

  it("reports a room it cannot price rather than quoting it as free", () => {
    const result = quote(
      ask({ rates: [{ ...rates, baseRate: null, weekendRate: null }] }),
    );

    expect(result.unpricedRoomIds).toEqual([ROOM]);
    expect(result.nights).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("prices a room that has only an override covering every night", () => {
    const result = quote(
      ask({
        rates: [{ ...rates, baseRate: null, weekendRate: null }],
        overrides: [
          {
            roomId: ROOM,
            startDate: THURSDAY,
            endDate: THURSDAY,
            nightlyRate: 150_000,
            minStayNights: null,
          },
        ],
      }),
    );

    expect(result.unpricedRoomIds).toEqual([]);
    expect(result.total).toBe(150_000);
  });
});

describe("guests and meals", () => {
  it("charges per head above the standard occupancy", () => {
    const result = quote(ask({ rooms: [{ roomId: ROOM, adults: 3, children: 1 }] }));

    expect(result.nights[0]).toMatchObject({
      extraGuests: 2,
      extraGuestCharge: 100_000,
    });
    expect(result.total).toBe(300_000);
  });

  it("charges nothing extra at or below the standard occupancy", () => {
    const result = quote(ask({ rooms: [{ roomId: ROOM, adults: 1, children: 0 }] }));

    expect(result.extraGuestTotal).toBe(0);
  });

  it("charges meals per person per night when the plan includes them", () => {
    const result = quote(
      ask({
        checkIn: THURSDAY,
        checkOut: SATURDAY,
        rooms: [{ roomId: ROOM, adults: 2, children: 1 }],
        mealPlan: "BREAKFAST",
        mealChargePerPerson: 30_000,
      }),
    );

    expect(result.mealTotal).toBe(30_000 * 3 * 2);
  });

  it("charges no meals on a room-only plan", () => {
    const result = quote(ask({ mealPlan: "ROOM_ONLY", mealChargePerPerson: 30_000 }));

    expect(result.mealTotal).toBe(0);
  });
});

describe("GST on a quote", () => {
  it("is nothing at all when the host does not charge it", () => {
    const result = quote(ask({ gstEnabled: false }));

    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  it("reads the slab from the whole room-night, not the room rate alone", () => {
    // ₹2,000 room + ₹500 extra guest + ₹1,000 meals = ₹3,500 → 5%.
    const result = quote(
      ask({
        rooms: [{ roomId: ROOM, adults: 3, children: 0 }],
        mealPlan: "ALL_MEALS",
        mealChargePerPerson: 33_333,
        gstEnabled: true,
      }),
    );

    const night = result.nights[0];
    expect(night?.tariff).toBe(200_000 + 50_000 + 99_999);
    expect(night?.gstBasisPoints).toBe(500);
    expect(night?.taxAmount).toBe(Math.round((349_999 * 500) / 10_000));
    expect(result.total).toBe(result.subtotal + result.taxTotal);
  });

  it("bands each night separately when a rate change crosses a slab", () => {
    const result = quote(
      ask({
        checkIn: THURSDAY,
        checkOut: SATURDAY,
        rates: [{ ...rates, weekendRate: null }],
        gstEnabled: true,
        overrides: [
          {
            roomId: ROOM,
            startDate: FRIDAY,
            endDate: FRIDAY,
            nightlyRate: 800_000,
            minStayNights: null,
          },
        ],
      }),
    );

    expect(result.nights.map((night) => night.gstBasisPoints)).toEqual([
      500, 1800,
    ]);
    expect(result.taxTotal).toBe(10_000 + 144_000);
  });
});

describe("minimum stay", () => {
  const festival: RateOverride = {
    roomId: ROOM,
    startDate: FRIDAY,
    endDate: SATURDAY,
    nightlyRate: 400_000,
    minStayNights: 3,
  };

  it("reports a stay shorter than an override it touches", () => {
    const result = quote(
      ask({ checkIn: FRIDAY, checkOut: SUNDAY, overrides: [festival] }),
    );

    expect(result.minStayShortfalls).toEqual([
      { roomId: ROOM, requiredNights: 3 },
    ]);
  });

  it("is satisfied by a long enough stay", () => {
    const result = quote(
      ask({ checkIn: THURSDAY, checkOut: SUNDAY, overrides: [festival] }),
    );

    expect(result.minStayShortfalls).toEqual([]);
  });

  it("ignores an override the stay never touches", () => {
    const result = quote(
      ask({ checkIn: THURSDAY, checkOut: FRIDAY, overrides: [festival] }),
    );

    expect(result.minStayShortfalls).toEqual([]);
  });
});

describe("a stay covering no nights", () => {
  it("is refused rather than quoted at zero", () => {
    expect(() => quote(ask({ checkOut: THURSDAY }))).toThrow(RangeError);
  });
});
