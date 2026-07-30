"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { SIGN_IN_PATH } from "@/lib/auth/auth-paths";

export function SignOutButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await authClient.signOut();
        router.replace(SIGN_IN_PATH);
        // Server Components hold the previous host's data until this reruns.
        router.refresh();
      }}
    >
      {t("signOut")}
    </Button>
  );
}
