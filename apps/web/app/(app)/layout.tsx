import { propertiesList } from "@d-stay/api-client/endpoints/properties";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { requireHost } from "@/lib/auth/session";

/**
 * Everything inside this group is signed-in. The check is here rather than on
 * each page so a new route cannot forget it, and it is a real API call rather
 * than a cookie read — `proxy.ts` only makes the signed-out case fast.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Sequential on purpose: an expired session must redirect out of here, not
  // fail on a parallel properties call that was never going to be authorised.
  const host = await requireHost();
  const [{ properties }, t] = await Promise.all([
    propertiesList(),
    getTranslations("shell"),
  ]);

  return (
    <AppShell host={host} properties={properties}>
      {!host.emailVerified && (
        <Alert className="mb-6">
          <AlertTitle>{t("unverifiedEmail")}</AlertTitle>
        </Alert>
      )}
      {children}
    </AppShell>
  );
}
