import { pricingFind } from "@d-stay/api-client/endpoints/pricing";
import { getTranslations } from "next-intl/server";
import { PricingScreen } from "./pricing-screen";

/**
 * Rates are their own screen for now. The month calendar will edit them in
 * place, which is where a host will reach for a single date — this is where the
 * standing prices are decided.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [pricing, t] = await Promise.all([
    pricingFind(propertyId),
    getTranslations("pricing"),
  ]);

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <PricingScreen propertyId={propertyId} initialPricing={pricing} />
    </section>
  );
}
