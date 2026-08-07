import { bookingsList } from "@d-stay/api-client/endpoints/bookings";
import { getTranslations } from "next-intl/server";
import { BookingList } from "./booking-list";

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [bookings, t] = await Promise.all([
    bookingsList(propertyId),
    getTranslations("booking"),
  ]);

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("list.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("list.subtitle")}</p>
      </div>

      <BookingList propertyId={propertyId} initialBookings={bookings} />
    </section>
  );
}
