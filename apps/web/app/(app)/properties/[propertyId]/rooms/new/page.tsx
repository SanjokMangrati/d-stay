import { getTranslations } from "next-intl/server";
import { RoomForm } from "../room-form";

export default async function NewRoomPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const t = await getTranslations("room");

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <h1 className="text-lg font-semibold">{t("newTitle")}</h1>
      <RoomForm propertyId={propertyId} />
    </section>
  );
}
