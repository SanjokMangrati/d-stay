"use client";

import type {
  PropertyDetailDtoOutput,
  UpdatePropertyDto,
} from "@d-stay/api-client/models";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export const SETUP_STEPS = [
  "basics",
  "location",
  "stay",
  "house",
  "photos",
  "compliance",
  "review",
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

/**
 * Every step is a form over a slice of the property that saves that slice and
 * moves on. Saving per step rather than at the end is what makes a back gesture
 * survivable — the host's work is on the server before they leave the screen.
 */
export interface SetupStepProps {
  property: PropertyDetailDtoOutput;
  onSave: (changes: UpdatePropertyDto) => Promise<void>;
  isSaving: boolean;
  onBack?: () => void;
}

export function SetupStepFooter({
  onBack,
  isSaving,
  isValid,
}: Pick<SetupStepProps, "onBack" | "isSaving"> & { isValid: boolean }) {
  const t = useTranslations("property.setup");

  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <Button type="button" variant="outline" size="xl" onClick={onBack}>
          {t("back")}
        </Button>
      )}
      <Button
        type="submit"
        size="xl"
        className="flex-1"
        disabled={isSaving || !isValid}
      >
        {isSaving ? t("saving") : t("saveAndContinue")}
      </Button>
    </div>
  );
}

/** Inputs hand back `""` for a field the host cleared; the API wants `null`. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Register options for an optional field whose schema is a *pattern* — a time,
 * a GSTIN. `""` is not "absent" to a regex, it is a string that fails, so an
 * untouched field would otherwise hold the whole step invalid. Fields validated
 * only by a length limit do not need this: `""` passes `.max()` happily.
 */
export const optionalPatternField = { setValueAs: emptyToNull } as const;

/** The same, for a field the server upper-cases before it matches its pattern. */
export const optionalUpperCaseField = {
  setValueAs: (value: string) => emptyToNull(value)?.toUpperCase() ?? null,
} as const;
