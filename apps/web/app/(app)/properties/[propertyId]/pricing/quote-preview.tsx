"use client";

import type { PricingDtoOutput } from "@d-stay/api-client/models";
import { addDays, formatStayDate, todayStayDate } from "@d-stay/domain/datetime";
import { formatPaise } from "@d-stay/domain/money";
import { quote, type QuoteInput } from "@d-stay/domain/pricing";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TextField } from "@/components/text-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";

/**
 * What a stay would cost, priced by the same function the server writes bookings
 * with. It is here so a host can check their own rates — "three nights over the
 * long weekend, four people" — before a guest is on the phone asking.
 */
export function QuotePreview({ pricing }: { pricing: PricingDtoOutput }) {
  const t = useTranslations("pricing");
  const today = todayStayDate();

  const [roomId, setRoomId] = useState(pricing.rooms[0]?.roomId ?? "");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const room = pricing.rooms.find((candidate) => candidate.roomId === roomId);

  const result = useMemo(() => {
    if (!room || checkOut <= checkIn) {
      return null;
    }

    const input: QuoteInput = {
      checkIn,
      checkOut,
      rooms: [{ roomId: room.roomId, adults, children }],
      rates: [
        {
          roomId: room.roomId,
          standardOccupancy: room.standardOccupancy,
          baseRate: room.baseRate,
          weekendRate: room.weekendRate,
          extraGuestCharge: room.extraGuestCharge,
        },
      ],
      overrides: pricing.overrides.filter(
        (override) => override.roomId === room.roomId,
      ),
      mealPlan: pricing.mealPlan ?? "ROOM_ONLY",
      mealChargePerPerson: pricing.mealChargePerPerson,
      gstEnabled: pricing.gstEnabled,
    };

    return quote(input);
  }, [room, checkIn, checkOut, adults, children, pricing]);

  if (pricing.rooms.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium">{t("preview.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("preview.hint")}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="previewRoom">{t("preview.room")}</FieldLabel>
        <Select
          value={roomId}
          onValueChange={(value) => setRoomId(value ?? roomId)}
        >
          <SelectTrigger id="previewRoom">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pricing.rooms.map((candidate) => (
              <SelectItem key={candidate.roomId} value={candidate.roomId}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="previewCheckIn"
          type="date"
          label={t("preview.checkIn")}
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
        />
        <TextField
          id="previewCheckOut"
          type="date"
          label={t("preview.checkOut")}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="previewAdults"
          type="number"
          inputMode="numeric"
          min={1}
          label={t("preview.adults")}
          value={adults}
          onChange={(event) => setAdults(Number(event.target.value))}
        />
        <TextField
          id="previewChildren"
          type="number"
          inputMode="numeric"
          min={0}
          label={t("preview.children")}
          value={children}
          onChange={(event) => setChildren(Number(event.target.value))}
        />
      </div>

      {result === null ? (
        <p className="text-muted-foreground text-sm">{t("preview.pickDates")}</p>
      ) : result.unpricedRoomIds.length > 0 ? (
        <p className="text-destructive text-sm">{t("preview.unpriced")}</p>
      ) : (
        <div className="space-y-3 rounded-lg border p-4">
          {result.minStayShortfalls.map((shortfall) => (
            <p key={shortfall.roomId} className="text-destructive text-sm">
              {t("preview.minStay", { nights: shortfall.requiredNights })}
            </p>
          ))}

          <ul className="space-y-1">
            {result.nights.map((night) => (
              <li
                key={night.date}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span>
                  {formatStayDate(night.date)}
                  {night.source !== "base" && (
                    <span className="text-muted-foreground">
                      {" "}
                      {t(`preview.source.${night.source}`)}
                    </span>
                  )}
                </span>
                <span>{formatPaise(night.roomCharge)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 border-t pt-3 text-sm">
            {result.extraGuestTotal > 0 && (
              <Line
                label={t("preview.extraGuests")}
                amount={result.extraGuestTotal}
              />
            )}
            {result.mealTotal > 0 && (
              <Line label={t("preview.meals")} amount={result.mealTotal} />
            )}
            {pricing.gstEnabled && (
              <Line label={t("preview.gst")} amount={result.taxTotal} />
            )}
            <div className="flex items-baseline justify-between gap-3 font-medium">
              <dt>{t("preview.total", { nights: result.nightCount })}</dt>
              <dd>{formatPaise(result.total)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function Line({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="text-muted-foreground flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd>{formatPaise(amount)}</dd>
    </div>
  );
}
