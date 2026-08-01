"use client";

import { UpdatePropertyDtoMealPlan } from "@d-stay/api-client/models";
import { PropertiesUpdateBody } from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  emptyToNull,
  optionalPatternField,
  SetupStepFooter,
  type SetupStepProps,
} from "../setup-step";
import { FORM_VALIDATION_MODE } from "@/lib/form-mode";
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

const staySchema = PropertiesUpdateBody.pick({
  checkInTime: true,
  checkOutTime: true,
  mealPlan: true,
});

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
    },
  });
  const { errors, isValid } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      checkInTime: emptyToNull(values.checkInTime),
      checkOutTime: emptyToNull(values.checkOutTime),
      mealPlan: values.mealPlan ?? null,
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
            {...form.register("checkInTime", optionalPatternField)}
          />
          <TextField
            id="checkOutTime"
            type="time"
            label={t("fields.checkOutTime")}
            error={errors.checkOutTime && t("validation.timeInvalid")}
            {...form.register("checkOutTime", optionalPatternField)}
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
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
