import { pricingFind } from "@d-stay/api-client/endpoints/pricing";
import { addDays, todayStayDate } from "@d-stay/domain/datetime";
import { getTranslations } from "next-intl/server";
import { BookingForm } from "./booking-form";

/**
 * Taking a booking. The nights and the room arrive in the URL from wherever the
 * host started — a run drawn on the calendar, usually — and default to tonight
 * for the host who came here straight off a phone call.
 */
export default async function NewBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    roomId?: string;
  }>;
}) {
  const [{ propertyId }, query, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("booking"),
  ]);

  const today = todayStayDate();
  const checkIn = query.checkIn ?? today;
  const checkOut = query.checkOut ?? addDays(checkIn, 1);

  const pricing = await pricingFind(propertyId);

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("new.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("new.subtitle")}</p>
      </div>

      <BookingForm
        propertyId={propertyId}
        initialPricing={pricing}
        checkIn={checkIn}
        checkOut={checkOut}
        roomId={query.roomId ?? null}
      />
    </section>
  );
}
