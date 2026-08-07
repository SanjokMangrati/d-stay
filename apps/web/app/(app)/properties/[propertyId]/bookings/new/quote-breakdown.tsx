"use client";

import { formatPaise } from "@d-stay/domain/money";
import type { Quote } from "@d-stay/domain/pricing";
import { useTranslations } from "next-intl";

/**
 * What the host is about to quote, moving as they pick rooms and heads. The same
 * pure function runs on the server when the booking is written, so this is a
 * preview of the real number rather than a second opinion about it.
 */
export function QuoteBreakdown({
  quote,
  rooms,
}: {
  quote: Quote;
  rooms: { roomId: string; name: string }[];
}) {
  const t = useTranslations("booking");

  const unpriced = rooms.filter((room) =>
    quote.unpricedRoomIds.includes(room.roomId),
  );

  return (
    <section
      aria-live="polite"
      className="bg-secondary/40 space-y-2 rounded-lg border p-4 text-sm"
    >
      <h2 className="font-medium">{t("quote.title")}</h2>

      <Line label={t("quote.rooms")} amount={quote.roomTotal} />
      {quote.extraGuestTotal > 0 && (
        <Line label={t("quote.extraGuests")} amount={quote.extraGuestTotal} />
      )}
      {quote.mealTotal > 0 && (
        <Line label={t("quote.meals")} amount={quote.mealTotal} />
      )}
      <Line label={t("quote.tax")} amount={quote.taxTotal} />

      <div className="flex items-baseline justify-between gap-3 border-t pt-2 font-medium">
        <span>{t("quote.total", { count: quote.nightCount })}</span>
        <span>{formatPaise(quote.total)}</span>
      </div>

      {unpriced.map((room) => (
        <p key={room.roomId} className="text-destructive">
          {t("quote.unpriced", { room: room.name })}
        </p>
      ))}

      {quote.minStayShortfalls.map((shortfall) => (
        <p key={shortfall.roomId} className="text-destructive">
          {t("quote.minStay", { nights: shortfall.requiredNights })}
        </p>
      ))}
    </section>
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
