/**
 * Validate on blur, re-validate on change. A host is told a field is wrong once
 * they have finished with it rather than while they are still typing it, and the
 * message goes the moment they fix it. It also keeps React Hook Form's `isValid`
 * live, which is what lets a submit button show that it is not ready yet.
 *
 * Every form in the app spreads this, so the timing is one decision.
 */
export const FORM_VALIDATION_MODE = {
  mode: "onTouched",
  reValidateMode: "onChange",
} as const;

/**
 * Register options for a number input the host may leave blank, where blank
 * means "no value" rather than zero — an unset weekend rate, no minimum stay.
 * Without this React Hook Form hands the resolver `NaN` and the field fails
 * validation instead of clearing.
 */
export const OPTIONAL_NUMBER_INPUT = {
  // Not just what the host types: React Hook Form runs this over the default
  // value too, so it sees `null` before it ever sees an empty string.
  setValueAs: (value: unknown) =>
    value === null || value === undefined || String(value).trim() === ""
      ? null
      : Number(value),
} as const;
