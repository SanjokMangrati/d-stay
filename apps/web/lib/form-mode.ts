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

/** Inputs hand back `""` for a field the host cleared; the API wants `null`. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Register options for an optional text field: an email nobody gave, a note
 * nobody wrote, a time left blank. `""` is not "absent" to a regex or a format
 * check, it is a value that fails one — and React Hook Form runs this over the
 * default too, so it must survive being handed `null` before anything is typed.
 */
export const optionalTextField = { setValueAs: emptyToNull } as const;

/** The same, for a field the server upper-cases before it matches its pattern. */
export const optionalUpperCaseField = {
  setValueAs: (value: string) => emptyToNull(value)?.toUpperCase() ?? null,
} as const;
