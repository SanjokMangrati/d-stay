import { roomsList } from "@d-stay/api-client/endpoints/rooms";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RoomForm } from "../room-form";
import { PhotoManager } from "@/components/photo-manager";

/**
 * Read from the property's list rather than a room-by-id endpoint: a homestay's
 * rooms are a handful of rows the host is about to see anyway, and one fewer
 * endpoint is one fewer thing to authorize.
 */
export default async function EditRoomPage({
  params,
}: {
  params: Promise<{ propertyId: string; roomId: string }>;
}) {
  const { propertyId, roomId } = await params;
  const [{ rooms }, t] = await Promise.all([
    roomsList(propertyId),
    getTranslations("room"),
  ]);

  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-6">
        <h1 className="text-lg font-semibold">{t("editTitle")}</h1>
        <RoomForm propertyId={propertyId} room={room} />
      </div>

      {/* Below the form rather than inside it: photos save themselves as they are
          uploaded, so they are not part of what the save button submits. */}
      <div className="space-y-3 border-t pt-6">
        <div className="space-y-1">
          <h2 className="font-medium">{t("photosTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("photosHint")}</p>
        </div>
        <PhotoManager propertyId={propertyId} roomId={room.id} />
      </div>
    </section>
  );
}
