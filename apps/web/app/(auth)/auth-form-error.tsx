"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertTitle } from "@/components/ui/alert";

/**
 * Every auth form fails the same way — a Better Auth error code turned into a
 * catalog key — so they all render it the same way rather than each inventing
 * its own banner.
 */
export function AuthFormError({ messageKey }: { messageKey: string | null }) {
  const t = useTranslations("auth.errors");

  if (!messageKey) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>{t(messageKey)}</AlertTitle>
    </Alert>
  );
}
