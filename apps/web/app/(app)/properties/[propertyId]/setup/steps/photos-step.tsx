"use client";

import type { PropertyDetailDtoOutput } from "@d-stay/api-client/models";
import { useTranslations } from "next-intl";
import { PhotoManager } from "@/components/photo-manager";
import { Button } from "@/components/ui/button";

/**
 * Photos are their own endpoints rather than fields on the property, so this step
 * saves as the host acts and its footer only moves them on — there is nothing
 * left unsaved by the time they press it.
 */
export function PhotosStep({
  property,
  onBack,
  onContinue,
}: {
  property: PropertyDetailDtoOutput;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations("property");

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm">{t("photos.hint")}</p>

      <PhotoManager propertyId={property.id} />

      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button type="button" variant="outline" size="xl" onClick={onBack}>
            {t("setup.back")}
          </Button>
        )}
        <Button
          type="button"
          size="xl"
          className="flex-1"
          onClick={onContinue}
        >
          {t("setup.continue")}
        </Button>
      </div>
    </div>
  );
}
