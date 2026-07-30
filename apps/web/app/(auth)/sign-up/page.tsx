import { useTranslations } from "next-intl";
import { AuthTabs } from "../auth-tabs";
import { GoogleSignInButton } from "../google-sign-in-button";
import { SignUpForm } from "./sign-up-form";
import { FieldSeparator } from "@/components/ui/field";

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <section className="space-y-6">
      <AuthTabs active="signUp" />

      <SignUpForm />

      <FieldSeparator>{t("continueWith")}</FieldSeparator>

      <GoogleSignInButton />
    </section>
  );
}
