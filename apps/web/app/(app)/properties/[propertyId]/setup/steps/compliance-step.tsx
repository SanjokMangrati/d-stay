"use client";

import {
  PropertiesUpdateBody,
  propertiesUpdateBodyHomestayRegistrationNumberMax,
} from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SetupStepFooter, type SetupStepProps } from "../setup-step";
import { FORM_VALIDATION_MODE, emptyToNull, optionalUpperCaseField } from "@/lib/form-mode";
import { TextField } from "@/components/text-field";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

const complianceSchema = PropertiesUpdateBody.pick({
  gstEnabled: true,
  gstin: true,
  homestayRegistrationNumber: true,
});

type ComplianceValues = z.infer<typeof complianceSchema>;

export function ComplianceStep({
  property,
  onSave,
  isSaving,
  onBack,
}: SetupStepProps) {
  const t = useTranslations("property");
  const form = useForm<ComplianceValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(complianceSchema),
    defaultValues: {
      gstEnabled: property.gstEnabled,
      gstin: property.gstin ?? "",
      homestayRegistrationNumber: property.homestayRegistrationNumber ?? "",
    },
  });
  const { errors, isValid } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      gstEnabled: values.gstEnabled ?? false,
      gstin: emptyToNull(values.gstin),
      homestayRegistrationNumber: emptyToNull(
        values.homestayRegistrationNumber,
      ),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <Controller
          control={form.control}
          name="gstEnabled"
          render={({ field }) => (
            <>
              <Field orientation="horizontal">
                <Switch
                  id="gstEnabled"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="gstEnabled">
                    {t("fields.gstEnabled")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("fields.gstEnabledHint")}
                  </FieldDescription>
                </div>
              </Field>

              {/* Asking for a GSTIN from a host who does not charge GST is a
                  field they will guess at. It appears only once they say yes. */}
              {field.value && (
                <TextField
                  id="gstin"
                  autoCapitalize="characters"
                  // A GSTIN is exactly 15 characters; the schema says so with a
                  // pattern, which is not a length the generated client exports.
                  maxLength={15}
                  label={t("fields.gstin")}
                  placeholder={t("fields.gstinPlaceholder")}
                  error={errors.gstin && t("validation.gstinInvalid")}
                  {...form.register("gstin", optionalUpperCaseField)}
                />
              )}
            </>
          )}
        />

        <TextField
          id="homestayRegistrationNumber"
          maxLength={propertiesUpdateBodyHomestayRegistrationNumberMax}
          label={t("fields.homestayRegistrationNumber")}
          description={t("fields.homestayRegistrationNumberHint")}
          {...form.register("homestayRegistrationNumber")}
        />
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
