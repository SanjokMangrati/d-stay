"use client";

import {
  formatStayDate,
  formatStayDayOfMonth,
  formatStayWeekday,
  type StayDate,
} from "@d-stay/domain/datetime";
import { formatPaiseAsWholeRupees, type Paise } from "@d-stay/domain/money";
import { isWeekendNight, type RateSource } from "@d-stay/domain/pricing";
import { BanIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  type PointerEventHandler,
  type RefObject,
} from "react";
import {
  cellKey,
  type StayCells,
  type StaySegment,
} from "@/lib/calendar/stay-cells";
import {
  CELL_DATE_ATTRIBUTE,
  CELL_ROOM_ATTRIBUTE,
  type CalendarSelection,
} from "@/lib/calendar/use-range-selection";
import { cn } from "@/lib/utils";

export interface CalendarRoom {
  roomId: string;
  name: string;
}

type CellState = "free" | "booked" | "blocked";

interface MonthGridProps {
  rooms: CalendarRoom[];
  nights: StayDate[];
  cells: StayCells;
  segments: ReadonlyMap<string, StaySegment[]>;
  /** Null where the host has not priced the room for that night. */
  rateFor: (
    roomId: string,
    date: StayDate,
  ) => { rate: Paise; source: RateSource } | null;
  selection: CalendarSelection | null;
  today: StayDate;
  /** A gesture is claiming the row, so the month must stop scrolling under it. */
  isArmed: boolean;
  /** The scroller, so a swipe at its edge can turn the month over. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  gestureProps: {
    onPointerDown: PointerEventHandler<HTMLElement>;
    onPointerMove: PointerEventHandler<HTMLElement>;
    onPointerUp: PointerEventHandler<HTMLElement>;
    onPointerCancel: () => void;
  };
}

/** Row one is the date header; the first room is row two. */
const FIRST_ROOM_ROW = 2;
/** Column one is the room name; the first night is column two. */
const FIRST_NIGHT_COLUMN = 2;

/**
 * The month, room by room and night by night.
 *
 * Every element is placed explicitly rather than flowing, because the stay bars
 * share their grid cells with the buttons underneath them — a bar is one element
 * spanning the nights it covers, not a mark repeated on each.
 *
 * Controlled and injectable: it takes rooms, cells, rates and a gesture, and owns
 * nothing, which is what lets it be exercised without a backend. Not virtualised
 * either — a month is 31 columns against at most a dozen rooms.
 */
export function MonthGrid({
  rooms,
  nights,
  cells,
  segments,
  rateFor,
  selection,
  today,
  isArmed,
  scrollerRef,
  gestureProps,
}: MonthGridProps) {
  const t = useTranslations("calendar");

  // A new month starts on its first day, not wherever the last one was left.
  const firstNight = nights[0];
  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [firstNight, scrollerRef]);

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "border-border overflow-x-auto rounded-xl border",
        // Horizontal panning is how a host moves through the month; it is only
        // taken away once a press has claimed a row.
        isArmed ? "touch-none select-none" : "touch-pan-x",
      )}
      {...gestureProps}
    >
      <div
        className={cn(
          "grid min-w-max",
          // Narrow enough that a 360px phone shows most of a week, wider once
          // there is room for it.
          "[--night:2.75rem] [--room:5.25rem]",
          "sm:[--night:3.5rem] sm:[--room:8rem]",
        )}
        style={{
          gridTemplateColumns: `var(--room) repeat(${nights.length}, var(--night))`,
        }}
      >
        <div
          className="bg-background border-border sticky left-0 z-20 border-r border-b"
          style={{ gridRow: 1, gridColumn: 1 }}
        />

        {nights.map((night, index) => (
          <div
            key={night}
            style={{ gridRow: 1, gridColumn: FIRST_NIGHT_COLUMN + index }}
            className={cn(
              "border-border flex h-12 flex-col items-center justify-center border-b text-[10px] leading-tight",
              night === today && "bg-primary/10",
              isWeekendNight(night) && night !== today && "bg-secondary/60",
            )}
          >
            <span
              className={cn(
                night === today ? "text-primary" : "text-muted-foreground",
              )}
            >
              {formatStayWeekday(night)}
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                night === today ? "text-primary" : "text-foreground",
              )}
            >
              {formatStayDayOfMonth(night)}
            </span>
          </div>
        ))}

        {rooms.map((room, roomIndex) => {
          const row = FIRST_ROOM_ROW + roomIndex;

          return (
            <Row
              key={room.roomId}
              room={room}
              row={row}
              nights={nights}
              cells={cells}
              segments={segments.get(room.roomId) ?? []}
              rateFor={rateFor}
              selection={selection}
              today={today}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

function Row({
  room,
  row,
  nights,
  cells,
  segments,
  rateFor,
  selection,
  today,
  t,
}: {
  room: CalendarRoom;
  row: number;
  nights: StayDate[];
  cells: StayCells;
  segments: StaySegment[];
  rateFor: MonthGridProps["rateFor"];
  selection: CalendarSelection | null;
  today: StayDate;
  t: ReturnType<typeof useTranslations<"calendar">>;
}) {
  const selected =
    selection && selection.roomId === room.roomId
      ? {
          startIndex: nights.indexOf(selection.from),
          endIndex: nights.indexOf(selection.to),
        }
      : null;

  return (
    <>
      <div
        style={{ gridRow: row, gridColumn: 1 }}
        className="bg-background border-border sticky left-0 z-20 flex h-14 items-center border-r border-b px-2"
      >
        <span className="truncate text-xs font-medium">{room.name}</span>
      </div>

      {nights.map((night, index) => {
        const stay = cells.get(cellKey(room.roomId, night));
        const state: CellState =
          stay === undefined
            ? "free"
            : stay.kind === "BLOCK"
              ? "blocked"
              : "booked";
        const rate = state === "free" ? rateFor(room.roomId, night) : null;

        return (
          <button
            key={night}
            type="button"
            {...{
              [CELL_ROOM_ATTRIBUTE]: room.roomId,
              [CELL_DATE_ATTRIBUTE]: night,
            }}
            style={{ gridRow: row, gridColumn: FIRST_NIGHT_COLUMN + index }}
            aria-label={cellLabel(t, {
              room: room.name,
              date: formatStayDate(night),
              state,
              rate: rate?.rate ?? null,
            })}
            className={cn(
              "border-border relative flex h-14 items-center justify-center border-b text-[11px] tabular-nums",
              night === today && "bg-primary/5",
              isWeekendNight(night) && night !== today && "bg-secondary/40",
              // The bar above says what a taken night is; the cell only carries
              // a price when there is a price to carry.
              state !== "free" && "text-transparent",
            )}
          >
            {state === "free" &&
              (rate ? (
                <span
                  className={cn(
                    "font-medium",
                    rate.source === "override"
                      ? "text-primary"
                      : "text-foreground",
                  )}
                >
                  {formatPaiseAsWholeRupees(rate.rate)}
                </span>
              ) : (
                <span className="text-muted-foreground/50" aria-hidden>
                  —
                </span>
              ))}
          </button>
        );
      })}

      {/* One bar per stay, over the nights it covers. `pointer-events-none` so
          the buttons underneath stay tappable — the bar is what the host reads,
          the cell is what they hit. */}
      {segments.map(({ stay, startIndex, span, startsHere, endsHere }) => (
        <div
          key={stay.id}
          aria-hidden
          style={{
            gridRow: row,
            gridColumn: `${FIRST_NIGHT_COLUMN + startIndex} / span ${span}`,
          }}
          className={cn(
            "pointer-events-none z-10 my-1.5 flex items-center gap-1 self-center overflow-hidden px-1.5 text-[11px] font-medium",
            "h-11",
            stay.kind === "BLOCK"
              ? "bg-muted text-muted-foreground border-border border"
              : "bg-primary/15 text-primary border-primary/30 border",
            // Left open where the stay runs on past the edge of the month, so a
            // clipped bar cannot read as one that ends there.
            startsHere ? "ml-1 rounded-l-lg" : "rounded-l-none",
            endsHere ? "mr-1 rounded-r-lg" : "rounded-r-none",
          )}
        >
          {stay.kind === "BLOCK" ? (
            <BanIcon className="size-3 shrink-0" />
          ) : (
            <UserRoundIcon className="size-3 shrink-0" />
          )}
          <span className="truncate">
            {stay.reason ?? t(`stay.${stay.kind === "BLOCK" ? "block" : "booking"}`)}
          </span>
        </div>
      ))}

      {/* The run being picked, drawn as one band rather than a ring per cell. */}
      {selected && selected.startIndex >= 0 && selected.endIndex >= 0 && (
        <div
          aria-hidden
          style={{
            gridRow: row,
            gridColumn: `${FIRST_NIGHT_COLUMN + selected.startIndex} / span ${
              selected.endIndex - selected.startIndex + 1
            }`,
          }}
          className="ring-ring bg-ring/10 pointer-events-none z-20 rounded-lg ring-2 ring-inset"
        />
      )}
    </>
  );
}

/**
 * A cell is a coloured square and a number, so everything it means has to be in
 * its label — including the price, which is the reason a host is reading the row
 * at all.
 */
function cellLabel(
  t: ReturnType<typeof useTranslations<"calendar">>,
  cell: { room: string; date: string; state: CellState; rate: Paise | null },
): string {
  if (cell.state !== "free") {
    return t(`cell.${cell.state}`, { room: cell.room, date: cell.date });
  }

  return cell.rate === null
    ? t("cell.unpriced", { room: cell.room, date: cell.date })
    : t("cell.free", {
        room: cell.room,
        date: cell.date,
        rate: formatPaiseAsWholeRupees(cell.rate),
      });
}
