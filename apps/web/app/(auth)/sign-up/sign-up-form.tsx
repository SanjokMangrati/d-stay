"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { normalizePhone } from "@d-stay/domain/phone";
import { MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "../auth-field";
import { AuthFormError } from "../auth-form-error";
import { PasswordField } from "../password-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { authErrorMessageKey } from "@/lib/auth/auth-error";
import { HOME_PATH } from "@/lib/auth/auth-paths";

/**
 * Hosts type their number the way they say it — `98765 43210`. `normalizePhone`
 * is the same function the API validates with, so what the browser accepts and
 * what the server accepts cannot drift apart.
 */
const signUpSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return normalized;
  }),
  password: z.string().min(8).max(128),
});

type SignUpValues = z.input<typeof signUpSchema>;

export function SignUpForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<SignUpValues, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    const { error } = await authClient.signUp.email(values);
    if (error) {
      setFailure(authErrorMessageKey(error));
      return;
    }
    router.replace(HOME_PATH);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <AuthFormError messageKey={failure} />

      <FieldGroup>
        <AuthField
          id="name"
          icon={UserIcon}
          autoComplete="name"
          label={t("fields.name")}
          placeholder={t("fields.namePlaceholder")}
          error={errors.name && t("validation.nameRequired")}
          {...form.register("name")}
        />

        <AuthField
          id="email"
          icon={MailIcon}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          label={t("fields.email")}
          placeholder={t("fields.emailPlaceholder")}
          error={errors.email && t("validation.emailInvalid")}
          {...form.register("email")}
        />

        <AuthField
          id="phone"
          icon={PhoneIcon}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label={t("fields.phone")}
          placeholder={t("fields.phonePlaceholder")}
          description={t("fields.phoneHint")}
          error={errors.phone && t("validation.phoneInvalid")}
          {...form.register("phone")}
        />

        <PasswordField
          id="password"
          autoComplete="new-password"
          label={t("fields.password")}
          description={t("fields.passwordHint")}
          error={errors.password && t("validation.passwordTooShort")}
          {...form.register("password")}
        />
      </FieldGroup>

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("signUp.submitting") : t("signUp.submit")}
      </Button>
    </form>
  );
}
