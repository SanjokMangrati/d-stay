"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthFormError } from "../auth-form-error";
import { PasswordField } from "../password-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { authErrorMessageKey } from "@/lib/auth/auth-error";
import { SIGN_IN_PATH } from "@/lib/auth/auth-paths";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    setFailure(null);
    const { error } = await authClient.resetPassword({ token, newPassword });
    if (error) {
      setFailure(authErrorMessageKey(error));
      return;
    }
    // Resetting does not create a session, so the host signs in with the
    // password they just chose.
    router.replace(SIGN_IN_PATH);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <AuthFormError messageKey={failure} />

      <FieldGroup>
        <PasswordField
          id="newPassword"
          autoComplete="new-password"
          label={t("fields.newPassword")}
          description={t("fields.passwordHint")}
          error={
            form.formState.errors.newPassword &&
            t("validation.passwordTooShort")
          }
          {...form.register("newPassword")}
        />
      </FieldGroup>

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? t("resetPassword.submitting")
          : t("resetPassword.submit")}
      </Button>
    </form>
  );
}
