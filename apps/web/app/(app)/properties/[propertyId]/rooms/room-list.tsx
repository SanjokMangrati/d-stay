"use client";

import { getPropertiesFindOneQueryKey } from "@d-stay/api-client/endpoints/properties";
import {
  getRoomsListQueryKey,
  useRoomsList,
  useRoomsRemove,
  useRoomsReorder,
} from "@d-stay/api-client/endpoints/rooms";
import type {
  RoomListDtoOutput,
  RoomListDtoOutputRoomsItem,
} from "@d-stay/api-client/models";
import { formatPaise } from "@d-stay/domain/money";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { RoomCover } from "@/components/room-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { newRoomPath, roomPath } from "@/lib/properties/property-paths";

/**
 * The host's inventory. Order matters beyond tidiness — it is the order the
 * month calendar will read in, which is why reordering lives here rather than
 * being an alphabetical accident.
 */
export function RoomList({
  propertyId,
  initialRooms,
}: {
  propertyId: string;
  initialRooms: RoomListDtoOutput;
}) {
  const t = useTranslations("room");
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { data } = useRoomsList(propertyId, {
    query: { initialData: initialRooms },
  });
  const rooms = data.rooms;

  const onListChanged = async (list: RoomListDtoOutput) => {
    queryClient.setQueryData(getRoomsListQueryKey(propertyId), list);
    await queryClient.invalidateQueries({
      queryKey: getPropertiesFindOneQueryKey(propertyId),
    });
  };
  const mutation = { mutation: { onSuccess: onListChanged } };

  const reorder = useRoomsReorder(mutation);
  const remove = useRoomsRemove(mutation);
  const isBusy = reorder.isPending || remove.isPending;

  const move = (from: number, to: number) => {
    const order = rooms.map((room) => room.id);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    reorder.mutate({ propertyId, data: { roomIds: order } });
  };

  return (
    <div className="space-y-4">
      <ApiErrorAlert error={reorder.error ?? remove.error} />

      {rooms.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room, index) => (
            <li key={room.id} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <RoomCover room={room} />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{room.name}</h2>
                    {!room.isActive && (
                      <Badge variant="secondary">{t("inactive")}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {bedSummary(room, t)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t("occupancySummary", {
                      standard: room.standardOccupancy,
                      max: room.maxOccupancy,
                    })}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {room.photoCount > 0
                      ? t("photoCount", { count: room.photoCount })
                      : t("noPhotos")}
                  </p>
                  {/* A room with no rate cannot be quoted, which is worth saying
                      here rather than leaving the host to find it out from an
                      empty calendar cell. */}
                  <p
                    className={
                      room.baseRate === null
                        ? "text-destructive text-sm"
                        : "text-sm font-medium"
                    }
                  >
                    {room.baseRate === null
                      ? t("unpriced")
                      : t("perNight", { amount: formatPaise(room.baseRate) })}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        disabled={isBusy}
                        aria-label={t("actions", { room: room.name })}
                      />
                    }
                  >
                    <MoreVerticalIcon aria-hidden />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="min-h-11"
                      render={<Link href={roomPath(propertyId, room.id)} />}
                    >
                      <PencilIcon aria-hidden />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUpIcon aria-hidden />
                      {t("moveUp")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      disabled={index === rooms.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDownIcon aria-hidden />
                      {t("moveDown")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11"
                      variant="destructive"
                      onClick={() => setConfirmingDelete(room.id)}
                    >
                      <Trash2Icon aria-hidden />
                      {t("remove")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Confirmation is inline rather than a dialog: a host on a phone
                  keeps the room they are deleting in view while they decide. */}
              {confirmingDelete === room.id && (
                <div className="border-destructive/40 mt-3 space-y-3 rounded-lg border p-3">
                  <p className="text-sm">{t("confirmDelete")}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-11 flex-1"
                      onClick={() => setConfirmingDelete(null)}
                    >
                      {t("form.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      className="h-11 flex-1"
                      disabled={isBusy}
                      onClick={() => {
                        setConfirmingDelete(null);
                        remove.mutate({ propertyId, roomId: room.id });
                      }}
                    >
                      {t("confirmDeleteAction")}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button
        size="xl"
        className="w-full"
        // Base UI assumes a real <button> unless told otherwise; this one is a
        // link, and saying so is what keeps its semantics honest.
        nativeButton={false}
        render={<Link href={newRoomPath(propertyId)} />}
      >
        <PlusIcon aria-hidden />
        {t("add")}
      </Button>
    </div>
  );
}

/** "1 double bed, 1 single bed, 1 extra mattress" — empty when nothing is set. */
function bedSummary(
  room: RoomListDtoOutputRoomsItem,
  t: (key: string, values: Record<string, number>) => string,
): string {
  const parts = [
    { key: "double", count: room.doubleBeds },
    { key: "single", count: room.singleBeds },
    { key: "mattress", count: room.extraMattresses },
  ]
    .filter(({ count }) => count > 0)
    .map(({ key, count }) => t(`beds.${key}`, { count }));

  return parts.length > 0 ? parts.join(", ") : t("beds.none", {});
}
