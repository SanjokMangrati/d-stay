"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { HOME_PATH, SIGN_IN_PATH } from "@/lib/auth/auth-paths";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Google's brand mark, inlined because Lucide carries no brand icons and its
 * four fixed colours are a licensing requirement, not a theme choice.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * The redirect leaves the page, so there is no success state to render — only a
 * pending one, and a failure that lands back on sign-in with an error.
 */
export function GoogleSignInButton() {
  const t = useTranslations("auth.google");
  const [redirecting, setRedirecting] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="xl"
      className="w-full font-medium mt-3"
      disabled={redirecting}
      onClick={() => {
        setRedirecting(true);
        void authClient.signIn.social({
          provider: "google",
          callbackURL: HOME_PATH,
          errorCallbackURL: SIGN_IN_PATH,
        });
      }}
    >
      <GoogleMark />
      {redirecting ? t("redirecting") : t("continue")}
    </Button>
  );
}
