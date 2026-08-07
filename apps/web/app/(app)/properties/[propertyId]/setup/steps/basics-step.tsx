"use client";

import {
  PropertiesUpdateBody,
  propertiesUpdateBodyDescriptionMax,
  propertiesUpdateBodyNameMax,
} from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { SetupStepFooter, type SetupStepProps } from "../setup-step";
import { FORM_VALIDATION_MODE, emptyToNull } from "@/lib/form-mode";
import { TextAreaField, TextField } from "@/components/text-field";
import { FieldGroup } from "@/components/ui/field";

const basicsSchema = PropertiesUpdateBody.pick({
  name: true,
  description: true,
});

type BasicsValues = z.infer<typeof basicsSchema>;

export function BasicsStep({
  property,
  onSave,
  isSaving,
  onBack,
}: SetupStepProps) {
  const t = useTranslations("property");
  const form = useForm<BasicsValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      name: property.name,
      description: property.description ?? "",
    },
  });
  const { errors, isValid } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      name: values.name,
      description: emptyToNull(values.description),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <TextField
          id="name"
          maxLength={propertiesUpdateBodyNameMax}
          label={t("fields.name")}
          placeholder={t("fields.namePlaceholder")}
          error={errors.name && t("validation.nameRequired")}
          {...form.register("name")}
        />

        <TextAreaField
          id="description"
          rows={5}
          maxLength={propertiesUpdateBodyDescriptionMax}
          label={t("fields.description")}
          placeholder={t("fields.descriptionPlaceholder")}
          description={t("fields.descriptionHint")}
          error={errors.description && t("validation.tooLong")}
          {...form.register("description")}
        />
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
