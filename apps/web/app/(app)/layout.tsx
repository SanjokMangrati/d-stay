import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { requireHost } from "@/lib/auth/session";

/**
 * Everything inside this group is signed-in. The check is here rather than on
 * each page so a new route cannot forget it, and it is a real API call rather
 * than a cookie read — `proxy.ts` only makes the signed-out case fast.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const host = await requireHost();
  const t = await getTranslations("shell");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {t("signedInAs", { name: host.name })}
          </p>
          {host.role === "ADMIN" && (
            <p className="text-muted-foreground text-xs">{t("adminBadge")}</p>
          )}
        </div>
        <SignOutButton />
      </header>

      <main className="flex-1 px-4 py-6">
        {!host.emailVerified && (
          <Alert className="mb-6">
            <AlertTitle>{t("unverifiedEmail")}</AlertTitle>
          </Alert>
        )}
        {children}
      </main>
    </div>
  );
}
