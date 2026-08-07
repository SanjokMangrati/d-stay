"use client";

import {
  getAvailabilityFindQueryKey,
  useAvailabilityCreateBlocks,
  useAvailabilityRemoveBlock,
} from "@d-stay/api-client/endpoints/availability";
import type {
  AvailabilityFindParams,
  CreateBlockDto,
  StayListDtoOutput,
} from "@d-stay/api-client/models";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Every month of this property's calendar. Blocking nights can land outside the
 * window on screen — a host selecting the last days of a month often means the
 * first of the next — so the whole property's availability is refetched rather
 * than the one key the mutation happened to be launched from.
 */
function availabilityKey(propertyId: string) {
  return getAvailabilityFindQueryKey(propertyId);
}

function windowKey(propertyId: string, visibleWindow: AvailabilityFindParams) {
  return getAvailabilityFindQueryKey(propertyId, visibleWindow);
}

/**
 * Holding dates back is the calendar action a host repeats, so it happens on
 * screen immediately and is put back if the server refuses — which it will, if
 * someone booked those nights while the sheet was open.
 */
export function useBlockDates(
  propertyId: string,
  visibleWindow: AvailabilityFindParams,
) {
  const queryClient = useQueryClient();

  return useAvailabilityCreateBlocks({
    mutation: {
      onMutate: async ({ data }: { data: CreateBlockDto }) => {
        const previous = await snapshot(queryClient, propertyId, visibleWindow);

        queryClient.setQueryData<StayListDtoOutput>(
          windowKey(propertyId, visibleWindow),
          (current) =>
            current && {
              stays: [
                ...current.stays,
                ...data.roomIds.map((roomId) => ({
                  // Replaced by the server's row on the refetch below. Cells are
                  // keyed by room and night, so this id is never rendered.
                  id: `pending-${roomId}-${data.checkIn}`,
                  roomId,
                  kind: "BLOCK" as const,
                  checkIn: data.checkIn,
                  checkOut: data.checkOut,
                  reason: data.reason,
                })),
              ],
            },
        );

        return previous;
      },
      onError: (_error, _variables, context) => restore(queryClient, context),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: availabilityKey(propertyId) }),
    },
  });
}

export function useRemoveBlock(
  propertyId: string,
  visibleWindow: AvailabilityFindParams,
) {
  const queryClient = useQueryClient();

  return useAvailabilityRemoveBlock({
    mutation: {
      onMutate: async ({ stayId }) => {
        const previous = await snapshot(queryClient, propertyId, visibleWindow);

        queryClient.setQueryData<StayListDtoOutput>(
          windowKey(propertyId, visibleWindow),
          (current) =>
            current && {
              stays: current.stays.filter((stay) => stay.id !== stayId),
            },
        );

        return previous;
      },
      onError: (_error, _variables, context) => restore(queryClient, context),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: availabilityKey(propertyId) }),
    },
  });
}

type Snapshot = { key: readonly unknown[]; stays: StayListDtoOutput | undefined };

/**
 * Stops any refetch already in flight before the cache is written by hand —
 * without this, a response that left before the mutation can land after it and
 * put the stale month back on screen.
 */
async function snapshot(
  queryClient: QueryClient,
  propertyId: string,
  visibleWindow: AvailabilityFindParams,
): Promise<Snapshot> {
  const key = windowKey(propertyId, visibleWindow);
  await queryClient.cancelQueries({ queryKey: key });

  return { key, stays: queryClient.getQueryData<StayListDtoOutput>(key) };
}

function restore(queryClient: QueryClient, context: Snapshot | undefined): void {
  if (context) {
    queryClient.setQueryData(context.key, context.stays);
  }
}
