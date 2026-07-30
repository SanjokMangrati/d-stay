import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["(98765) 43210", "+919876543210"],
  ])("reads %s as %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["", "nothing typed"],
    ["98765", "too few digits"],
    ["98765432100", "too many digits"],
    ["5876543210", "Indian mobile numbers start 6-9"],
    ["+14155552671", "not an Indian number"],
    ["not a number", "not digits at all"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups an E.164 number the way it is read aloud", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("refuses a value that was never normalised", () => {
    expect(() => formatPhone("9876543210")).toThrow(RangeError);
  });
});
