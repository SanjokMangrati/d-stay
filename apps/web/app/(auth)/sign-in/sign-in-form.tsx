"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
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
import { FORGOT_PASSWORD_PATH, HOME_PATH } from "@/lib/auth/auth-paths";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      setFailure(authErrorMessageKey(error));
      return;
    }
    router.replace(HOME_PATH);
    // The shell reads the session server-side, so the new cookie only takes
    // effect once this navigation's server render happens.
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <AuthFormError messageKey={failure} />

      <FieldGroup>
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

        <PasswordField
          id="password"
          autoComplete="current-password"
          label={t("fields.password")}
          {...form.register("password")}
        />
      </FieldGroup>

      <div className="flex justify-end">
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="text-primary text-sm font-medium"
        >
          {t("signIn.forgotPassword")}
        </Link>
      </div>

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("signIn.submitting") : t("signIn.submit")}
      </Button>
    </form>
  );
}
