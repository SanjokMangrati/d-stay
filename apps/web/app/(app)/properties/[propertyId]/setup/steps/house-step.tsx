"use client";

import {
  UpdatePropertyDtoAmenitiesItem,
  type UpdatePropertyDtoAmenitiesItem as Amenity,
} from "@d-stay/api-client/models";
import {
  PropertiesUpdateBody,
  propertiesUpdateBodyHouseRulesMax,
} from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SetupStepFooter, type SetupStepProps } from "../setup-step";
import { FORM_VALIDATION_MODE, emptyToNull } from "@/lib/form-mode";
import { TextAreaField } from "@/components/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

const houseSchema = PropertiesUpdateBody.pick({
  amenities: true,
  houseRules: true,
});

type HouseValues = z.infer<typeof houseSchema>;

const AMENITIES = Object.values(UpdatePropertyDtoAmenitiesItem);

export function HouseStep({
  property,
  onSave,
  isSaving,
  onBack,
}: SetupStepProps) {
  const t = useTranslations("property");
  const form = useForm<HouseValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(houseSchema),
    defaultValues: {
      amenities: property.amenities,
      houseRules: property.houseRules ?? "",
    },
  });
  const { isValid } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      amenities: values.amenities ?? [],
      houseRules: emptyToNull(values.houseRules),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <Controller
          control={form.control}
          name="amenities"
          render={({ field }) => {
            const selected = field.value ?? [];
            const toggle = (amenity: Amenity, checked: boolean) =>
              field.onChange(
                checked
                  ? [...selected, amenity]
                  : selected.filter((value) => value !== amenity),
              );

            return (
              <FieldSet>
                <FieldLegend variant="label">
                  {t("fields.amenities")}
                </FieldLegend>
                {AMENITIES.map((amenity) => (
                  <Field key={amenity} orientation="horizontal">
                    <Checkbox
                      id={`amenity-${amenity}`}
                      checked={selected.includes(amenity)}
                      onCheckedChange={(checked) => toggle(amenity, checked)}
                    />
                    <FieldLabel
                      htmlFor={`amenity-${amenity}`}
                      className="font-normal"
                    >
                      {t(`amenity.${amenity}`)}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
            );
          }}
        />

        <TextAreaField
          id="houseRules"
          rows={5}
          maxLength={propertiesUpdateBodyHouseRulesMax}
          label={t("fields.houseRules")}
          placeholder={t("fields.houseRulesPlaceholder")}
          description={t("fields.houseRulesHint")}
          {...form.register("houseRules")}
        />
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
