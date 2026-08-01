import { getTranslations } from "next-intl/server";

/** Placeholder destination: the booking list replaces this whole file. */
export default async function BookingsPage() {
  const t = await getTranslations("bookings");

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("empty")}</p>
    </section>
  );
}
