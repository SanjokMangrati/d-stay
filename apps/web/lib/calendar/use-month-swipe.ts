"use client";

import { useEffect, type RefObject } from "react";

/** Far enough that it cannot be the tail of a scroll or a mis-hit. */
const SWIPE_THRESHOLD_PX = 64;

/** Within this of an edge counts as being at it, since scrollLeft is fractional. */
const EDGE_TOLERANCE_PX = 2;

/**
 * Swiping between months on a grid that itself scrolls sideways. The two
 * gestures are the same gesture, so they are told apart by where the month
 * already is: a swipe that begins with the grid against its edge and carries on
 * in that direction is the host asking for the next month, because there is
 * nothing left of this one to scroll to.
 *
 * Touch listeners rather than pointer ones, so this never competes with the
 * pointer gestures that select a range of nights.
 *
 * `onSwipe` has to be stable — the listeners are reattached whenever it changes.
 */
export function useMonthSwipe(
  scroller: RefObject<HTMLDivElement | null>,
  onSwipe: (direction: -1 | 1) => void,
): void {
  useEffect(() => {
    const element = scroller.current;
    if (!element) {
      return;
    }

    let startX = 0;
    let startedAtStart = false;
    let startedAtEnd = false;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) {
        return;
      }
      startX = touch.clientX;
      startedAtStart = element.scrollLeft <= EDGE_TOLERANCE_PX;
      startedAtEnd =
        element.scrollLeft + element.clientWidth >=
        element.scrollWidth - EDGE_TOLERANCE_PX;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      const travelled = touch.clientX - startX;

      if (startedAtEnd && travelled <= -SWIPE_THRESHOLD_PX) {
        onSwipe(1);
      } else if (startedAtStart && travelled >= SWIPE_THRESHOLD_PX) {
        onSwipe(-1);
      }
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
    };
  }, [scroller, onSwipe]);
}
