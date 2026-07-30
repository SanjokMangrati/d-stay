import { useTranslations } from "next-intl";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";
import { SIGN_IN_PATH } from "@/lib/auth/auth-paths";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm">
        <Link
          href={SIGN_IN_PATH}
          className="text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {t("backToSignIn")}
        </Link>
      </p>
    </section>
  );
}
