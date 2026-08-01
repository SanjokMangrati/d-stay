import { propertiesFindOne } from "@d-stay/api-client/endpoints/properties";
import { getTranslations } from "next-intl/server";
import { PropertyStatusBadge } from "@/components/property-status-badge";
import { PropertySetupForm } from "./property-setup-form";

/**
 * The property is fetched here so the first paint of a half-finished setup is
 * the host's own data, not a skeleton — on a rural connection the round trip
 * they can afford to wait for is the one already happening.
 */
export default async function PropertySetupPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [property, t] = await Promise.all([
    propertiesFindOne(propertyId),
    getTranslations("property.setup"),
  ]);

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold">{property.name}</h1>
          <PropertyStatusBadge status={property.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {t(property.status === "DRAFT" ? "subtitle" : "overviewSubtitle")}
        </p>
      </div>

      <PropertySetupForm property={property} />
    </section>
  );
}
