"use client";

import {
  getBookingsFindQueryKey,
  getBookingsListQueryKey,
  useBookingsChangeStatus,
  useBookingsFind,
  useBookingsUpdateNote,
} from "@d-stay/api-client/endpoints/bookings";
import type { BookingDtoOutput } from "@d-stay/api-client/models";
import { nextStatuses, type BookingStatus } from "@d-stay/domain/booking";
import { addDays, formatStayDate } from "@d-stay/domain/datetime";
import { formatPaise } from "@d-stay/domain/money";
import { formatPhone } from "@d-stay/domain/phone";
import { useQueryClient } from "@tanstack/react-query";
import { PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { TextAreaField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/text-field";

/** The moves that need the host to say why, because the reason is the record. */
const NEEDS_REASON: readonly BookingStatus[] = ["CANCELLED", "NO_SHOW"];

/**
 * One booking, and everything a host does to it: move it through its life, read
 * what it costs and why, and keep a note for themselves. Editing dates or moving
 * rooms is not here — that rewrites the price snapshot and the rooms held, and
 * it is its own change.
 */
export function BookingDetail({
  propertyId,
  bookingId,
  initialBooking,
}: {
  propertyId: string;
  bookingId: string;
  initialBooking: BookingDtoOutput;
}) {
  const t = useTranslations("booking");
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(initialBooking.note ?? "");

  const { data: booking } = useBookingsFind(propertyId, bookingId, {
    query: { initialData: initialBooking },
  });

  const onChanged = async (updated: BookingDtoOutput) => {
    queryClient.setQueryData(
      getBookingsFindQueryKey(propertyId, bookingId),
      updated,
    );
    await queryClient.invalidateQueries({
      queryKey: getBookingsListQueryKey(propertyId),
    });
  };

  const changeStatus = useBookingsChangeStatus({
    mutation: {
      onSuccess: async (updated) => {
        setPendingStatus(null);
        setReason("");
        await onChanged(updated);
      },
    },
  });

  const updateNote = useBookingsUpdateNote({
    mutation: { onSuccess: onChanged },
  });

  const moves = nextStatuses(booking.status);
  const lastNight = addDays(booking.checkOut, -1);

  const move = (status: BookingStatus) =>
    changeStatus.mutate({
      propertyId,
      bookingId,
      data: {
        status,
        reason: NEEDS_REASON.includes(status) ? reason.trim() || null : null,
      },
    });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">
              {booking.guestName}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("list.nights", {
                from: formatStayDate(booking.checkIn),
                to: formatStayDate(lastNight),
              })}
            </p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        {booking.expiresAt !== null && (
          <p className="text-sm">
            {t("detail.expires", {
              when: new Date(booking.expiresAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
      </header>

      <ApiErrorAlert error={changeStatus.error ?? updateNote.error} />

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{t("detail.guest")}</h2>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start"
          nativeButton={false}
          render={<a href={`tel:${booking.guestPhone}`} />}
        >
          <PhoneIcon aria-hidden />
          {formatPhone(booking.guestPhone)}
        </Button>
        {booking.guestEmail !== null && (
          <p className="text-muted-foreground text-sm">{booking.guestEmail}</p>
        )}
        <p className="text-muted-foreground text-sm">
          {t("detail.party", {
            adults: booking.adults,
            children: booking.children,
          })}
        </p>
        <p className="text-muted-foreground text-sm">
          {t("detail.source", { source: t(`source.${booking.source}`) })}
        </p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">{t("detail.rooms")}</h2>
        <ul className="text-muted-foreground space-y-1 text-sm">
          {booking.rooms.map((room) => (
            <li key={room.roomId}>{room.name}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">{t("detail.money")}</h2>
        <Line label={t("quote.rooms")} amount={booking.roomTotal} />
        {booking.extraGuestTotal > 0 && (
          <Line
            label={t("quote.extraGuests")}
            amount={booking.extraGuestTotal}
          />
        )}
        {booking.mealTotal > 0 && (
          <Line label={t("quote.meals")} amount={booking.mealTotal} />
        )}
        <Line label={t("quote.tax")} amount={booking.taxTotal} />
        <div className="flex items-baseline justify-between gap-3 border-t pt-2 font-medium">
          <span>{t("detail.total")}</span>
          <span>{formatPaise(booking.total)}</span>
        </div>

        {booking.overrideTotal !== null && (
          <div className="space-y-1 border-t pt-2">
            <div className="flex items-baseline justify-between gap-3 font-medium">
              <span>{t("detail.charged")}</span>
              <span>{formatPaise(booking.overrideTotal)}</span>
            </div>
            <p className="text-muted-foreground">{booking.overrideReason}</p>
          </div>
        )}
      </section>

      {moves.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">{t("detail.actions")}</h2>

          {pendingStatus !== null && NEEDS_REASON.includes(pendingStatus) ? (
            <div className="space-y-3 rounded-lg border p-4">
              <TextField
                id="reason"
                label={t(`detail.reasonFor.${pendingStatus}`)}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 flex-1"
                  onClick={() => setPendingStatus(null)}
                >
                  {t("detail.cancelAction")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="h-11 flex-1"
                  disabled={changeStatus.isPending || reason.trim() === ""}
                  onClick={() => move(pendingStatus)}
                >
                  {t(`detail.confirm.${pendingStatus}`)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {moves.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="xl"
                  variant={NEEDS_REASON.includes(status) ? "outline" : "default"}
                  disabled={changeStatus.isPending}
                  onClick={() =>
                    NEEDS_REASON.includes(status)
                      ? setPendingStatus(status)
                      : move(status)
                  }
                >
                  {t(`detail.move.${status}`)}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <TextAreaField
          id="note"
          rows={3}
          label={t("detail.note")}
          description={t("detail.noteHint")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={updateNote.isPending || note === (booking.note ?? "")}
          onClick={() =>
            updateNote.mutate({
              propertyId,
              bookingId,
              data: { note: note.trim() === "" ? null : note.trim() },
            })
          }
        >
          {t("detail.saveNote")}
        </Button>
      </section>

      <section className="text-muted-foreground space-y-1 text-xs">
        <p>{t("detail.createdBy", { name: booking.createdBy })}</p>
        <p>{t("detail.updatedBy", { name: booking.updatedBy })}</p>
        {booking.cancellationReason !== null && (
          <p>{t("detail.cancelledFor", { reason: booking.cancellationReason })}</p>
        )}
      </section>
    </div>
  );
}

function Line({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="text-muted-foreground flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="tabular-nums">{formatPaise(amount)}</span>
    </div>
  );
}
