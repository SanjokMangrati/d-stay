"use client";

import { useAvailabilityFind } from "@d-stay/api-client/endpoints/availability";
import { usePricingFind } from "@d-stay/api-client/endpoints/pricing";
import type {
  PricingDtoOutput,
  StayListDtoOutput,
} from "@d-stay/api-client/models";
import {
  formatStayMonth,
  todayStayDate,
  type StayDate,
} from "@d-stay/domain/datetime";
import { resolveNightlyRate } from "@d-stay/domain/pricing";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { MonthGrid, type CalendarRoom } from "./month-grid";
import { QuoteStay } from "./quote-stay";
import { SelectionSheet } from "./selection-sheet";
import { StaySheet } from "./stay-sheet";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { Button } from "@/components/ui/button";
import {
  cellKey,
  indexStays,
  staySegmentsByRoom,
  type Stay,
} from "@/lib/calendar/stay-cells";
import {
  monthNights,
  monthWindow,
  shiftMonth,
  startOfMonth,
  type CalendarMonth,
} from "@/lib/calendar/month";
import { useMonthSwipe } from "@/lib/calendar/use-month-swipe";
import {
  useRangeSelection,
  type CalendarSelection,
} from "@/lib/calendar/use-range-selection";
import { newRoomPath } from "@/lib/properties/property-paths";

/** One reference, so a month that has not arrived does not rebuild the grid. */
const NO_STAYS: Stay[] = [];

/**
 * The calendar surface: occupancy from the availability module, rates from the
 * pricing module, and one grid over both. Neither endpoint knows about the
 * other — composing them here is what keeps a single source of truth for each.
 */
export function CalendarScreen({
  propertyId,
  initialStays,
  initialPricing,
}: {
  propertyId: string;
  initialStays: StayListDtoOutput;
  initialPricing: PricingDtoOutput;
}) {
  const t = useTranslations("calendar");
  const today = todayStayDate();
  const [month, setMonth] = useState<CalendarMonth>(() => startOfMonth(today));
  const [openStay, setOpenStay] = useState<Stay | null>(null);
  const [selected, setSelected] = useState<CalendarSelection | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const visibleWindow = monthWindow(month);
  const isInitialMonth = month === startOfMonth(today);

  const {
    data: availability,
    error,
    isFetching,
  } = useAvailabilityFind(propertyId, visibleWindow, {
    query: {
      // The month rendered on the server needs no loading state. Every other
      // month is fetched, and until it arrives the grid says so rather than
      // drawing empty cells a host could read as "free".
      initialData: isInitialMonth ? initialStays : undefined,
    },
  });
  const { data: pricing } = usePricingFind(propertyId, {
    query: { initialData: initialPricing },
  });

  const nights = useMemo(() => monthNights(month), [month]);
  const stays = availability?.stays ?? NO_STAYS;
  const cells = useMemo(() => indexStays(stays), [stays]);
  const segments = useMemo(
    () => staySegmentsByRoom(stays, nights),
    [stays, nights],
  );

  const rooms: CalendarRoom[] = pricing.rooms
    .filter((room) => room.isActive)
    .map((room) => ({ roomId: room.roomId, name: room.name }));

  const rateFor = (roomId: string, date: StayDate) => {
    const rates = pricing.rooms.find((room) => room.roomId === roomId);
    return rates
      ? resolveNightlyRate(rates, pricing.overrides, date)
      : null;
  };

  const scrollerRef = useRef<HTMLDivElement>(null);
  const goToMonth = useCallback(
    (direction: -1 | 1) => setMonth((current) => shiftMonth(current, direction)),
    [],
  );
  useMonthSwipe(scrollerRef, goToMonth);

  /**
   * One night, however it was reached — a tap on a phone or a click on a
   * desktop. What is already there is what the host is asking about; an empty
   * night is the one they want to price or hold, which is the common case and
   * must not need a long press of its own.
   */
  const openNight = (roomId: string, date: StayDate) => {
    const stay = cells.get(cellKey(roomId, date));
    if (stay) {
      setOpenStay(stay);
    } else {
      setSelected({ roomId, from: date, to: date });
    }
  };

  const { selection, isArmed, gestureProps } = useRangeSelection({
    onSelect: (picked) =>
      picked.from === picked.to
        ? openNight(picked.roomId, picked.from)
        : setSelected(picked),
    onOpen: (cell) => openNight(cell.roomId, cell.date),
  });

  if (rooms.length === 0) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm">{t("noRooms")}</p>
        <Button
          render={<Link href={newRoomPath(propertyId)} />}
          nativeButton={false}
          size="xl"
        >
          {t("addRoom")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={t("previousMonth")}
          onClick={() => goToMonth(-1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>

        <p className="flex-1 text-center font-medium">
          {formatStayMonth(month)}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={t("nextMonth")}
          onClick={() => goToMonth(1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>

        {/* Behind a button rather than a card under the grid: the grid already
            answers "is this room free", and a panel repeating that is what made
            the screen read as two things. What it adds is the total for a range
            across every room, which is a question, not a view. */}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={t("quote.title")}
          onClick={() => setIsQuoting(true)}
        >
          <SearchIcon aria-hidden />
        </Button>
      </div>

      <ApiErrorAlert error={error} />

      {availability === undefined ? (
        // Shaped like the grid it replaces, so the month does not jump when it
        // arrives — and empty of cells, because a cell that looks free and is
        // not is the one mistake this screen must never make.
        <div
          aria-busy
          aria-label={t("loading")}
          className="bg-muted/40 h-72 animate-pulse rounded-lg border"
        />
      ) : (
        // `aria-busy` rather than swapping the text under it: the grid stays
        // readable while a month refreshes, and the server's markup and the
        // client's first render cannot disagree about what this says.
        <div aria-busy={isFetching}>
          <MonthGrid
            rooms={rooms}
            nights={nights}
            cells={cells}
            segments={segments}
            rateFor={rateFor}
            selection={selection ?? selected}
            today={today}
            isArmed={isArmed}
            scrollerRef={scrollerRef}
            gestureProps={gestureProps}
          />
        </div>
      )}

      <p className="text-muted-foreground text-xs">{t("hint")}</p>

      {isQuoting && (
        <QuoteStay
          propertyId={propertyId}
          pricing={pricing}
          onClose={() => setIsQuoting(false)}
        />
      )}

      {selected && (
        <SelectionSheet
          propertyId={propertyId}
          selection={selected}
          rooms={rooms}
          cells={cells}
          overrides={pricing.overrides}
          visibleWindow={visibleWindow}
          onClose={() => setSelected(null)}
        />
      )}

      {openStay && (
        <StaySheet
          propertyId={propertyId}
          stay={openStay}
          rooms={rooms}
          visibleWindow={visibleWindow}
          onClose={() => setOpenStay(null)}
        />
      )}
    </div>
  );
}
