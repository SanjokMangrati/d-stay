import { describe, expect, it } from "vitest";
import {
  canTransition,
  nextStatuses,
  occupiesRooms,
  type BookingStatus,
} from "./booking";

const ALL: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

describe("canTransition", () => {
  it("walks the happy path a stay actually takes", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "CHECKED_OUT")).toBe(true);
  });

  it("refuses to skip a step", () => {
    expect(canTransition("PENDING", "CHECKED_IN")).toBe(false);
    expect(canTransition("CONFIRMED", "CHECKED_OUT")).toBe(false);
  });

  it("never moves out of a terminal state", () => {
    for (const terminal of ["CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("refuses to move backwards", () => {
    expect(canTransition("CONFIRMED", "PENDING")).toBe(false);
    expect(canTransition("CHECKED_IN", "CONFIRMED")).toBe(false);
  });

  it("takes a no-show only from a guest who never arrived", () => {
    expect(canTransition("PENDING", "NO_SHOW")).toBe(true);
    expect(canTransition("CONFIRMED", "NO_SHOW")).toBe(true);
    expect(canTransition("CHECKED_IN", "NO_SHOW")).toBe(false);
  });

  it("does not allow a status to transition to itself", () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe("occupiesRooms", () => {
  it("holds rooms while the stay is live", () => {
    expect(occupiesRooms("PENDING")).toBe(true);
    expect(occupiesRooms("CONFIRMED")).toBe(true);
    expect(occupiesRooms("CHECKED_IN")).toBe(true);
  });

  it("releases them once the stay is over or off", () => {
    expect(occupiesRooms("CHECKED_OUT")).toBe(false);
    expect(occupiesRooms("CANCELLED")).toBe(false);
    expect(occupiesRooms("NO_SHOW")).toBe(false);
  });
});

describe("nextStatuses", () => {
  it("offers exactly the moves the graph allows", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(nextStatuses(from).includes(to)).toBe(canTransition(from, to));
      }
    }
  });
});
