"use client";

import { useAvailabilityFreeRooms } from "@d-stay/api-client/endpoints/availability";
import type { PricingDtoOutput } from "@d-stay/api-client/models";
import { addDays, daysBetween, todayStayDate } from "@d-stay/domain/datetime";
import { formatPaise } from "@d-stay/domain/money";
import { quote } from "@d-stay/domain/pricing";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * The phone call, answered in one panel. "Do you have a room for the 14th to the
 * 16th?" and "what would that cost?" are one question a guest asks in one
 * breath, and splitting them across two screens is what made a host reach for
 * the register instead.
 *
 * Which rooms are free comes from the server, because it is about to be
 * promised to someone. What they cost is computed here with the same pure
 * function the server writes bookings with, so the two cannot drift.
 */
export function QuoteStay({
  propertyId,
  pricing,
  onClose,
}: {
  propertyId: string;
  pricing: PricingDtoOutput;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const today = todayStayDate();
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(() => addDays(today, 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const isRangeValid = checkOut > checkIn;
  const { data, error, isFetching } = useAvailabilityFreeRooms(
    propertyId,
    { checkIn, checkOut },
    { query: { enabled: isRangeValid } },
  );

  const freeRoomIds = data?.roomIds ?? [];
  const nights = isRangeValid ? daysBetween(checkIn, checkOut) : 0;

  const quotes = pricing.rooms
    .filter((room) => freeRoomIds.includes(room.roomId))
    .map((room) => ({
      room,
      result: quote({
        checkIn,
        checkOut,
        rooms: [{ roomId: room.roomId, adults, children }],
        rates: [room],
        overrides: pricing.overrides.filter(
          (override) => override.roomId === room.roomId,
        ),
        mealPlan: pricing.mealPlan ?? "ROOM_ONLY",
        mealChargePerPerson: pricing.mealChargePerPerson,
        gstEnabled: pricing.gstEnabled,
      }),
    }));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("quote.title")}</SheetTitle>
          <SheetDescription>{t("quote.hint")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="quote-check-in"
              type="date"
              label={t("quote.checkIn")}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
            />
            <TextField
              id="quote-check-out"
              type="date"
              label={t("quote.checkOut")}
              error={isRangeValid ? undefined : t("quote.badRange")}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="quote-adults"
              type="number"
              inputMode="numeric"
              min={1}
              label={t("quote.adults")}
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
            />
            <TextField
              id="quote-children"
              type="number"
              inputMode="numeric"
              min={0}
              label={t("quote.children")}
              value={children}
              onChange={(event) => setChildren(Number(event.target.value))}
            />
          </div>

          <ApiErrorAlert error={error} />

          {isRangeValid && !error && (
            <div aria-live="polite" aria-busy={isFetching}>
              {data === undefined ? (
                <p className="text-muted-foreground text-sm">
                  {t("quote.checking")}
                </p>
              ) : quotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("quote.none")}
                </p>
              ) : (
                <ul className="divide-y">
                  {quotes.map(({ room, result }) => (
                    <li key={room.roomId} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{room.name}</span>
                        <span className="font-medium">
                          {result.unpricedRoomIds.length > 0
                            ? t("quote.unpriced")
                            : formatPaise(result.total)}
                        </span>
                      </div>

                      {result.unpricedRoomIds.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          {t("quote.breakdown", {
                            nights,
                            rooms: formatPaise(result.roomTotal),
                            tax: formatPaise(result.taxTotal),
                          })}
                        </p>
                      )}

                      {result.minStayShortfalls.map((shortfall) => (
                        <p
                          key={shortfall.roomId}
                          className="text-destructive text-xs"
                        >
                          {t("quote.minStay", {
                            nights: shortfall.requiredNights,
                          })}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
