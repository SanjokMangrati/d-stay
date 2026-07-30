import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Designed at 360px first: a dark brand band the page scrolls under, and a sheet
 * that rises over it holding the form. On anything wider the whole thing centres
 * at phone width rather than stretching — this screen has no desktop layout to
 * earn.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.hero");

  return (
    <div className="bg-brand min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col">
        <header className="text-brand-foreground space-y-2 px-6 pt-16 pb-10">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="text-brand-foreground/70 text-sm">{t("subtitle")}</p>
        </header>

        <main className="bg-background flex flex-1 flex-col gap-6 rounded-t-4xl px-6 pt-6 pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
