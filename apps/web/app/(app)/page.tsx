import { propertiesList } from "@d-stay/api-client/endpoints/properties";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The property switcher, and for now the whole home page. The today view —
 * arrivals, departures, in-house — replaces this once bookings exist; the list
 * itself moves into the shell's property selector at that point.
 */
export default async function HomePage() {
  const [{ properties }, t] = await Promise.all([
    propertiesList(),
    getTranslations("shell"),
  ]);

  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">{t("properties")}</h1>

      {properties.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noProperties")}</p>
      ) : (
        <ul className="space-y-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{property.name}</CardTitle>
                </CardHeader>
                {property.membershipRole && (
                  <CardContent className="text-muted-foreground text-sm">
                    {t(`role.${property.membershipRole}`)}
                  </CardContent>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
