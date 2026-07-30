import { useTranslations } from "next-intl";
import { AuthTabs } from "../auth-tabs";
import { GoogleSignInButton } from "../google-sign-in-button";
import { SignInForm } from "./sign-in-form";
import { FieldSeparator } from "@/components/ui/field";

export default function SignInPage() {
  const t = useTranslations("auth");

  return (
    <section className="space-y-6">
      <AuthTabs active="signIn" />

      <SignInForm />

      <FieldSeparator>{t("continueWith")}</FieldSeparator>

      <GoogleSignInButton />
    </section>
  );
}
