"use client";

import type { StayDate } from "@d-stay/domain/datetime";
import { useCallback, useEffect, useRef, useState } from "react";

/** Nights the host has picked out of one room's row, both ends inclusive. */
export interface CalendarSelection {
  roomId: string;
  from: StayDate;
  to: StayDate;
}

/** A cell identifies itself through the DOM so the grid needs no handler per cell. */
export const CELL_ROOM_ATTRIBUTE = "data-room-id";
export const CELL_DATE_ATTRIBUTE = "data-date";

/**
 * How long a finger has to rest before a drag begins. Short enough not to feel
 * broken, long enough that scrolling the month sideways never selects anything.
 */
const LONG_PRESS_MS = 400;

interface CellAddress {
  roomId: string;
  date: StayDate;
}

/**
 * Picking a run of nights, with the two gestures the two devices actually have:
 * a mouse drags, and a finger presses and holds before it drags — because on a
 * phone the same horizontal swipe is how the host moves through the month, and
 * a grid that selects on every swipe is a grid that cannot be scrolled.
 *
 * The selection stays within one room's row. A block spanning rooms is several
 * blocks, and letting a drag imply that would make the common case — one room,
 * a few nights — harder to hit accurately.
 */
export function useRangeSelection({
  onSelect,
  onOpen,
}: {
  /** Called once a run of nights is settled on. */
  onSelect: (selection: CalendarSelection) => void;
  /** A plain tap: the host is asking what is already in that cell. */
  onOpen: (cell: CellAddress) => unknown;
}) {
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [isArmed, setIsArmed] = useState(false);

  const anchor = useRef<CellAddress | null>(null);
  const hasMoved = useRef(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `selection`, because a quick click fires pointerdown and pointerup
  // before React re-renders and the handler's closure would still see null.
  const pending = useRef<CalendarSelection | null>(null);

  const cancelLongPress = () => {
    if (longPress.current !== null) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  // A pointer released outside the grid — or a component unmounting mid-drag —
  // must not leave the row armed and the next tap extending a stale selection.
  useEffect(() => cancelLongPress, []);

  const clear = useCallback(() => {
    cancelLongPress();
    anchor.current = null;
    hasMoved.current = false;
    pending.current = null;
    setIsArmed(false);
    setSelection(null);
  }, []);

  const extendTo = (cell: CellAddress) => {
    const start = anchor.current;
    if (!start || start.roomId !== cell.roomId) {
      return;
    }
    const next = {
      roomId: cell.roomId,
      from: start.date <= cell.date ? start.date : cell.date,
      to: start.date <= cell.date ? cell.date : start.date,
    };
    pending.current = next;
    setSelection(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) {
      // A press on the room column or the date header is not the start of a
      // selection, and must not leave a previous one half-open.
      clear();
      return;
    }

    // Without capture, a pointer released outside the grid never delivers its
    // `pointerup` here — the row stays anchored and every later mouse movement
    // extends a selection nobody is holding.
    event.currentTarget.setPointerCapture(event.pointerId);
    hasMoved.current = false;

    if (event.pointerType === "mouse") {
      anchor.current = cell;
      setIsArmed(true);
      extendTo(cell);
      return;
    }

    // Touch: the row is not armed until the finger has stayed put, so the swipe
    // that scrolls the month never leaves a selection behind it.
    longPress.current = setTimeout(() => {
      longPress.current = null;
      anchor.current = cell;
      setIsArmed(true);
      extendTo(cell);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!anchor.current) {
      // Still deciding whether this is a press or a scroll — any real movement
      // settles it as a scroll.
      cancelLongPress();
      return;
    }

    hasMoved.current = true;
    // Touch pointers stay captured by the element the gesture began on, so the
    // cell under the finger has to be looked up rather than read off the event.
    const cell = cellAt(event.clientX, event.clientY);
    if (cell) {
      extendTo(cell);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    cancelLongPress();

    const settled = pending.current;
    const wasArmed = anchor.current !== null;
    anchor.current = null;
    pending.current = null;
    setIsArmed(false);

    if (!wasArmed) {
      // A tap that never armed the row: the host is asking about that night.
      //
      // Located by coordinate, never by `event.target` — the pointer is captured
      // by the grid, and capture retargets every later event to the capturing
      // element, so the target here is the grid rather than the cell under the
      // finger. Reading it would silently drop every tap on a touch screen.
      const cell = cellAt(event.clientX, event.clientY);
      if (cell && !hasMoved.current) {
        onOpen(cell);
      }
      return;
    }

    if (settled) {
      setSelection(null);
      onSelect(settled);
    }
  };

  return {
    /** The run being dragged out, for the grid to draw as it happens. */
    selection,
    /** Whether a gesture is currently claiming the row. */
    isArmed,
    gestureProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      // Fired when the browser takes the gesture over to scroll the month.
      onPointerCancel: clear,
    },
  };
}

function cellAt(x: number, y: number): CellAddress | null {
  const element = document.elementFromPoint(x, y);
  return element ? cellFromElement(element) : null;
}

function cellFromElement(element: Element): CellAddress | null {
  const cell = element.closest(`[${CELL_DATE_ATTRIBUTE}]`);
  const roomId = cell?.getAttribute(CELL_ROOM_ATTRIBUTE);
  const date = cell?.getAttribute(CELL_DATE_ATTRIBUTE);

  return roomId && date ? { roomId, date } : null;
}
