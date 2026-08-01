"use client";

import {
  getPropertiesListQueryKey,
  usePropertiesCreate,
} from "@d-stay/api-client/endpoints/properties";
import {
  PropertiesCreateBody,
  propertiesCreateBodyNameMax,
} from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FORM_VALIDATION_MODE } from "@/lib/form-mode";
import { propertySetupPath } from "@/lib/properties/property-paths";

type NewPropertyValues = z.infer<typeof PropertiesCreateBody>;

export function NewPropertyForm() {
  const t = useTranslations("property");
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = usePropertiesCreate({
    mutation: {
      onSuccess: async (property) => {
        // The switcher on the home page is the only other reader of this list,
        // so it is invalidated by key rather than wholesale.
        await queryClient.invalidateQueries({
          queryKey: getPropertiesListQueryKey(),
        });
        router.replace(propertySetupPath(property.id));
        router.refresh();
      },
    },
  });

  const form = useForm<NewPropertyValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(PropertiesCreateBody),
    defaultValues: { name: "" },
  });
  const { errors, isSubmitting, isValid } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    create.mutateAsync({ data: values }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ApiErrorAlert error={create.error} />

      <FieldGroup>
        <TextField
          id="name"
          autoComplete="off"
          maxLength={propertiesCreateBodyNameMax}
          label={t("fields.name")}
          placeholder={t("fields.namePlaceholder")}
          description={t("fields.nameHint")}
          error={errors.name && t("validation.nameRequired")}
          {...form.register("name")}
        />
      </FieldGroup>

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={isSubmitting || !isValid}
      >
        {isSubmitting ? t("new.submitting") : t("new.submit")}
      </Button>
    </form>
  );
}
