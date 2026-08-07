import { availabilityFind } from "@d-stay/api-client/endpoints/availability";
import { pricingFind } from "@d-stay/api-client/endpoints/pricing";
import { todayStayDate } from "@d-stay/domain/datetime";
import { getTranslations } from "next-intl/server";
import { CalendarScreen } from "./calendar-screen";
import { monthWindow, startOfMonth } from "@/lib/calendar/month";

/**
 * The current month is rendered on the server so the host sees their occupancy
 * rather than a skeleton; every other month is fetched as they page to it.
 */
export default async function CalendarPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [stays, pricing, t] = await Promise.all([
    availabilityFind(propertyId, monthWindow(startOfMonth(todayStayDate()))),
    pricingFind(propertyId),
    getTranslations("calendar"),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <CalendarScreen
        propertyId={propertyId}
        initialStays={stays}
        initialPricing={pricing}
      />
    </section>
  );
}
