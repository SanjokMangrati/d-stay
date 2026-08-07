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

