/**
 * Hosts and guests are Indian mobile numbers. The web form and the API must
 * agree on what counts as valid — a signup accepted by the browser and rejected
 * by the server is the worst version of this bug — so the rule lives here.
 */

/** Storage and transport form: E.164, always `+91` followed by ten digits. */
export const PHONE_PATTERN = /^\+91[6-9]\d{9}$/;

const NON_DIGITS = /[^\d]/g;

/**
 * Accepts what a host actually types — `98765 43210`, `+91 98765-43210`,
 * `09876543210` — and returns the E.164 form, or `null` when it is not an Indian
 * mobile number. Callers decide what to do with `null`; this never guesses.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(NON_DIGITS, "");
  const local = digits.startsWith("91")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  const candidate = `+91${local}`;
  return PHONE_PATTERN.test(candidate) ? candidate : null;
}

/** `"+919876543210"` → `"+91 98765 43210"`. Display only. */
export function formatPhone(phone: string): string {
  if (!PHONE_PATTERN.test(phone)) {
    throw new RangeError(
      `Expected an E.164 Indian mobile number, received ${phone}.`,
    );
  }
  return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
}
