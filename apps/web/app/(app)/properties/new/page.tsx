import { getTranslations } from "next-intl/server";
import { NewPropertyForm } from "./new-property-form";

/**
 * A name is all it takes to start. Everything else belongs to the setup flow,
 * which the host reaches immediately after and can leave and return to.
 */
export default async function NewPropertyPage() {
  const t = await getTranslations("property.new");

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <NewPropertyForm />
    </section>
  );
}
