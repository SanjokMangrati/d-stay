import { propertiesFindOne } from "@d-stay/api-client/endpoints/properties";
import { getTranslations } from "next-intl/server";
import { PropertyStatusBadge } from "@/components/property-status-badge";

/**
 * The screen a host opens the app on. Arrivals, departures and in-house guests
 * land here with the bookings module; until then it is the property's standing,
 * and it fetches the property so a foreign id is refused here rather than only
 * in the switcher.
 */
export default async function TodayPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [property, t] = await Promise.all([
    propertiesFindOne(propertyId),
    getTranslations("today"),
  ]);

  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <PropertyStatusBadge status={property.status} />
      </div>
      <p className="text-muted-foreground text-sm">{t("empty")}</p>
    </section>
  );
}
