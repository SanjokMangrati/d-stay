"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthField } from "../auth-field";
import { AuthFormError } from "../auth-form-error";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { authErrorMessageKey } from "@/lib/auth/auth-error";
import { RESET_PASSWORD_PATH } from "@/lib/auth/auth-paths";

const forgotPasswordSchema = z.object({ email: z.email() });

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: RESET_PASSWORD_PATH,
    });
    if (error) {
      setFailure(authErrorMessageKey(error));
      return;
    }
    // Worded so it says the same thing whether or not the address exists — a
    // reset form that reveals which emails have accounts is an enumeration tool.
    setSent(true);
  });

  if (sent) {
    return (
      <Alert>
        <AlertTitle>{t("forgotPassword.sent")}</AlertTitle>
      </Alert>
    );
  }

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
          error={
            form.formState.errors.email && t("validation.emailInvalid")
          }
          {...form.register("email")}
        />
      </FieldGroup>

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? t("forgotPassword.submitting")
          : t("forgotPassword.submit")}
      </Button>
    </form>
  );
}
