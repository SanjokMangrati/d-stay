import { roomsList } from "@d-stay/api-client/endpoints/rooms";
import { getTranslations } from "next-intl/server";
import { RoomList } from "./room-list";

/**
 * Rooms are their own screen rather than a step of the property setup: a host
 * comes back to them long after setup is done — a room goes out of service, a
 * new cottage is built — and that is a different rhythm from filling in a form
 * once.
 */
export default async function RoomsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [rooms, t] = await Promise.all([
    roomsList(propertyId),
    getTranslations("room"),
  ]);

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <RoomList propertyId={propertyId} initialRooms={rooms} />
    </section>
  );
}
