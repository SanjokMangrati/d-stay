import { getTranslations } from "next-intl/server";

/** Placeholder destination: the month calendar replaces this whole file. */
export default async function CalendarPage() {
  const t = await getTranslations("calendar");

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("empty")}</p>
    </section>
  );
}
