"use client";

import {
  getPropertiesFindOneQueryKey,
  getPropertiesListQueryKey,
  usePropertiesFindOne,
  usePropertiesUpdate,
} from "@d-stay/api-client/endpoints/properties";
import type {
  PropertyDetailDtoOutput,
  UpdatePropertyDto,
} from "@d-stay/api-client/models";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PropertySummary } from "./property-summary";
import { SETUP_STEPS } from "./setup-step";
import { BasicsStep } from "./steps/basics-step";
import { ComplianceStep } from "./steps/compliance-step";
import { HouseStep } from "./steps/house-step";
import { LocationStep } from "./steps/location-step";
import { PhotosStep } from "./steps/photos-step";
import { ReviewStep } from "./steps/review-step";
import { StayStep } from "./steps/stay-step";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PropertySetupForm({
  property: initialProperty,
}: {
  property: PropertyDetailDtoOutput;
}) {
  const t = useTranslations("property.setup");
  const queryClient = useQueryClient();

  // A draft is unfinished work, so it opens on the form the host left off in.
  // Anything past draft is a listing they came to read; `null` is that overview,
  // and a step is only shown once they ask to edit one.
  const opensAsOverview = initialProperty.status !== "DRAFT";
  const [stepIndex, setStepIndex] = useState<number | null>(
    opensAsOverview ? null : 0,
  );

  // Rendered from the server's copy on first paint, then kept live by the same
  // query the mutations write into — so the checklist on the last step reflects
  // what was actually saved rather than what the form thinks it sent.
  const { data: property } = usePropertiesFindOne(initialProperty.id, {
    query: { initialData: initialProperty },
  });

  const update = usePropertiesUpdate({
    mutation: {
      onSuccess: async (updated) => {
        queryClient.setQueryData(
          getPropertiesFindOneQueryKey(updated.id),
          updated,
        );
        // The name and status this changed are what the switcher renders.
        await queryClient.invalidateQueries({
          queryKey: getPropertiesListQueryKey(),
        });
      },
    },
  });

  if (stepIndex === null) {
    return (
      <PropertySummary
        property={property}
        onEdit={(step) => setStepIndex(SETUP_STEPS.indexOf(step))}
      />
    );
  }

  const save = async (changes: UpdatePropertyDto) => {
    await update.mutateAsync({ propertyId: property.id, data: changes });
    setStepIndex(Math.min(stepIndex + 1, SETUP_STEPS.length - 1));
  };

  const step = SETUP_STEPS[stepIndex];
  const stepProps = {
    property,
    onSave: save,
    isSaving: update.isPending,
    onBack: stepIndex === 0 ? undefined : () => setStepIndex(stepIndex - 1),
  };

  return (
    <div className="space-y-6">
      {opensAsOverview && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="-ml-2.5 h-11"
          onClick={() => setStepIndex(null)}
        >
          <ChevronLeftIcon aria-hidden />
          {t("backToOverview")}
        </Button>
      )}

      <div className="space-y-2">
        <ol className="flex gap-1.5" aria-label={t("progress")}>
          {SETUP_STEPS.map((id, index) => (
            <li
              key={id}
              aria-current={index === stepIndex ? "step" : undefined}
              className={cn(
                "h-1 flex-1 rounded-full",
                index <= stepIndex ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </ol>
        <div>
          <p className="text-muted-foreground text-xs">
            {t("stepCount", {
              current: stepIndex + 1,
              total: SETUP_STEPS.length,
            })}
          </p>
          <h2 className="text-base font-semibold">{t(`steps.${step}`)}</h2>
        </div>
      </div>

      <ApiErrorAlert error={update.error} />

      {step === "basics" && <BasicsStep {...stepProps} />}
      {step === "location" && <LocationStep {...stepProps} />}
      {step === "stay" && <StayStep {...stepProps} />}
      {step === "house" && <HouseStep {...stepProps} />}
      {/* Photos save themselves as they are uploaded, so this step advances
          rather than submitting anything. */}
      {step === "photos" && (
        <PhotosStep
          property={property}
          onBack={stepProps.onBack}
          onContinue={() => setStepIndex(stepIndex + 1)}
        />
      )}
      {step === "compliance" && <ComplianceStep {...stepProps} />}
      {step === "review" && (
        <ReviewStep property={property} onBack={stepProps.onBack} />
      )}
    </div>
  );
}
