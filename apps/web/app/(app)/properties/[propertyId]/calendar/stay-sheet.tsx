"use client";

import type { AvailabilityFindParams } from "@d-stay/api-client/models";
import { addDays, formatStayDate } from "@d-stay/domain/datetime";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CalendarRoom } from "./month-grid";
import { useRemoveBlock } from "./use-blocks";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Stay } from "@/lib/calendar/stay-cells";

/**
 * What is already in a cell the host tapped. A block can be lifted from here,
 * which is the whole of its lifecycle — there is no editing one, because
 * removing it and drawing it again is the same two taps as an edit form.
 */
export function StaySheet({
  propertyId,
  stay,
  rooms,
  visibleWindow,
  onClose,
}: {
  propertyId: string;
  stay: Stay;
  rooms: CalendarRoom[];
  /** The month on screen, so an optimistic removal lands in the right cache. */
  visibleWindow: AvailabilityFindParams;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const remove = useRemoveBlock(propertyId, visibleWindow);

  const room = rooms.find((candidate) => candidate.roomId === stay.roomId);
  // The stay range is half-open; the host thinks in nights, and the last night
  // is the one before check-out.
  const lastNight = addDays(stay.checkOut, -1);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>
            {stay.checkIn === lastNight
              ? formatStayDate(stay.checkIn)
              : t("selection.range", {
                  from: formatStayDate(stay.checkIn),
                  to: formatStayDate(lastNight),
                })}
          </SheetTitle>
          <SheetDescription>
            {stay.kind === "BLOCK"
              ? t("stay.blocked", { room: room?.name ?? "" })
              : t("stay.booked", { room: room?.name ?? "" })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {stay.reason !== null && <p className="text-sm">{stay.reason}</p>}

          <ApiErrorAlert error={remove.error} />

          {stay.kind === "BLOCK" && (
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-full"
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync({ propertyId, stayId: stay.id });
                onClose();
              }}
            >
              <Trash2Icon aria-hidden />
              {t("stay.remove")}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
