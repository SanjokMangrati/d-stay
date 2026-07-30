import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/auth-paths";

/**
 * Better Auth redirects here with the token on the query string after checking
 * it exists; the token is only proven valid when the new password is submitted.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.resetPassword");

  if (!token) {
    return (
      <section className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>{t("missingToken")}</AlertTitle>
        </Alert>
        <p className="text-center text-sm">
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="text-foreground underline underline-offset-4"
          >
            {t("requestNewLink")}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <ResetPasswordForm token={token} />
    </section>
  );
}
