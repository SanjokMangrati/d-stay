"use client";

import {
  getPricingFindQueryKey,
  usePricingFind,
  usePricingUpdateMealCharge,
} from "@d-stay/api-client/endpoints/pricing";
import type { PricingDtoOutput } from "@d-stay/api-client/models";
import { paiseToRupees, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { OverrideSection } from "./override-section";
import { QuotePreview } from "./quote-preview";
import { RoomRates } from "./room-rates";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FORM_VALIDATION_MODE } from "@/lib/form-mode";
import { MAX_RATE_RUPEES, rupeeAmount } from "@/lib/pricing/rupees";

/**
 * Where a host decides what their homestay costs: the standing rate per room,
 * the seasons that replace it, and a preview that prices a stay the way the
 * booking form will.
 */
export function PricingScreen({
  propertyId,
  initialPricing,
}: {
  propertyId: string;
  initialPricing: PricingDtoOutput;
}) {
  const { data } = usePricingFind(propertyId, {
    query: { initialData: initialPricing },
  });

  return (
    <div className="space-y-8">
      <RoomRates propertyId={propertyId} rooms={data.rooms} />

      {/* Meals are a property-level charge, so they sit apart from the rooms
          rather than being repeated on each one. */}
      {data.mealPlan !== null && data.mealPlan !== "ROOM_ONLY" && (
        <MealCharge
          propertyId={propertyId}
          mealChargePerPerson={data.mealChargePerPerson}
        />
      )}

      <OverrideSection
        propertyId={propertyId}
        rooms={data.rooms}
        overrides={data.overrides}
      />

      <QuotePreview pricing={data} />
    </div>
  );
}

const mealChargeSchema = z.object({ mealChargePerPerson: rupeeAmount });

function MealCharge({
  propertyId,
  mealChargePerPerson,
}: {
  propertyId: string;
  mealChargePerPerson: number;
}) {
  const t = useTranslations("pricing");
  const queryClient = useQueryClient();

  const update = usePricingUpdateMealCharge({
    mutation: {
      onSuccess: (pricing) =>
        queryClient.setQueryData(getPricingFindQueryKey(propertyId), pricing),
    },
  });

  const form = useForm({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(mealChargeSchema),
    values: { mealChargePerPerson: paiseToRupees(mealChargePerPerson) },
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    await update.mutateAsync({
      propertyId,
      data: { mealChargePerPerson: rupeesToPaise(values.mealChargePerPerson) },
    });
    form.reset(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium">{t("meals.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("meals.hint")}</p>
      </div>

      <ApiErrorAlert error={update.error} />

      <TextField
        id="mealChargePerPerson"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_RATE_RUPEES}
        label={t("meals.perPerson")}
        error={errors.mealChargePerPerson && t("validation.amount")}
        {...form.register("mealChargePerPerson", { valueAsNumber: true })}
      />

      <Button type="submit" size="xl" disabled={!isDirty || isSubmitting}>
        {isSubmitting ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
