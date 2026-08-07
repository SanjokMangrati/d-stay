"use client";

import { UpdatePropertyDtoMealPlan } from "@d-stay/api-client/models";
import { PropertiesUpdateBody } from "@d-stay/api-client/schemas/properties";
import { paiseToRupees, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { SetupStepFooter, type SetupStepProps } from "../setup-step";
import { FORM_VALIDATION_MODE, emptyToNull, optionalTextField } from "@/lib/form-mode";
import { MAX_RATE_RUPEES, rupeeAmount } from "@/lib/pricing/rupees";
import { TextField } from "@/components/text-field";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The meal charge lives with the meal plan rather than with a room's rates: one
 * kitchen cooks for the whole house, so it is a fact about the property, and
 * declaring the plan without its price is the half-decision that leaves meals
 * absorbed instead of charged.
 */
const staySchema = PropertiesUpdateBody.pick({
  checkInTime: true,
  checkOutTime: true,
  mealPlan: true,
}).extend({ mealChargePerPerson: rupeeAmount });

type StayValues = z.infer<typeof staySchema>;

const MEAL_PLANS = Object.values(UpdatePropertyDtoMealPlan);

export function StayStep({
  property,
  onSave,
  isSaving,
  onBack,
}: SetupStepProps) {
  const t = useTranslations("property");
  // Base UI renders the selected label from `items`, so the labels are built
  // once here rather than looked up again inside the trigger.
  const options = MEAL_PLANS.map((plan) => ({
    value: plan,
    label: t(`mealPlan.${plan}`),
  }));
  const form = useForm<StayValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(staySchema),
    defaultValues: {
      checkInTime: property.checkInTime ?? "",
      checkOutTime: property.checkOutTime ?? "",
      mealPlan: property.mealPlan,
      mealChargePerPerson: paiseToRupees(property.mealChargePerPerson),
    },
  });
  const { errors, isValid } = form.formState;
  // `useWatch` rather than `form.watch`, which returns a function the React
  // Compiler cannot memoize and so skips optimising the whole step.
  const mealPlan = useWatch({ control: form.control, name: "mealPlan" });

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      checkInTime: emptyToNull(values.checkInTime),
      checkOutTime: emptyToNull(values.checkOutTime),
      mealPlan: values.mealPlan ?? null,
      mealChargePerPerson: rupeesToPaise(values.mealChargePerPerson),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="checkInTime"
            type="time"
            label={t("fields.checkInTime")}
            error={errors.checkInTime && t("validation.timeInvalid")}
            {...form.register("checkInTime", optionalTextField)}
          />
          <TextField
            id="checkOutTime"
            type="time"
            label={t("fields.checkOutTime")}
            error={errors.checkOutTime && t("validation.timeInvalid")}
            {...form.register("checkOutTime", optionalTextField)}
          />
        </div>

        <Controller
          control={form.control}
          name="mealPlan"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="mealPlan">{t("fields.mealPlan")}</FieldLabel>
              <Select
                items={options}
                value={field.value ?? null}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="mealPlan" className="w-full">
                  <SelectValue placeholder={t("fields.mealPlanPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("fields.mealPlanHint")}</FieldDescription>
            </Field>
          )}
        />

        {/* Room-only has no meals to charge for, so the field would be a box
            that must stay zero. */}
        {mealPlan !== null && mealPlan !== "ROOM_ONLY" && (
          <TextField
            id="mealChargePerPerson"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_RATE_RUPEES}
            label={t("fields.mealCharge")}
            description={t("fields.mealChargeHint")}
            error={errors.mealChargePerPerson && t("validation.amount")}
            {...form.register("mealChargePerPerson", { valueAsNumber: true })}
          />
        )}
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
