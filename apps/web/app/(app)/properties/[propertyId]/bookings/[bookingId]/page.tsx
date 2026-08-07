import { bookingsFind } from "@d-stay/api-client/endpoints/bookings";
import { BookingDetail } from "./booking-detail";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ propertyId: string; bookingId: string }>;
}) {
  const { propertyId, bookingId } = await params;
  const booking = await bookingsFind(propertyId, bookingId);

  return (
    <section className="mx-auto w-full max-w-md">
      <BookingDetail
        propertyId={propertyId}
        bookingId={bookingId}
        initialBooking={booking}
      />
    </section>
  );
}
