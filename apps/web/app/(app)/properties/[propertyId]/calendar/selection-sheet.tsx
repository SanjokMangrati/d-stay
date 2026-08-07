"use client";

import {
  getPricingFindQueryKey,
  usePricingCreateOverride,
  usePricingRemoveOverride,
} from "@d-stay/api-client/endpoints/pricing";
import { isApiError } from "@d-stay/api-client/error";
import type {
  AvailabilityFindParams,
  PricingDtoOutputOverridesItem,
} from "@d-stay/api-client/models";
import { addDays, formatStayDate, daysBetween } from "@d-stay/domain/datetime";
import { formatPaise, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  BanIcon,
  IndianRupeeIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CalendarRoom } from "./month-grid";
import { useBlockDates } from "./use-blocks";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { staysBlocking, type StayCells } from "@/lib/calendar/stay-cells";
import type { CalendarSelection } from "@/lib/calendar/use-range-selection";
import { newBookingPath } from "@/lib/properties/property-paths";
import { FORM_VALIDATION_MODE } from "@/lib/form-mode";
import { MAX_RATE_RUPEES, rupeeAmount } from "@/lib/pricing/rupees";

/**
 * What a host does with a run of nights they have just drawn on the calendar:
 * price them, or hold them back. Both live in one sheet because the decision is
 * made about the same nights and sending the host to a second screen to price
 * what they are already looking at is the split the calendar exists to close.
 */
export function SelectionSheet({
  propertyId,
  selection,
  rooms,
  cells,
  overrides,
  visibleWindow,
  onClose,
}: {
  propertyId: string;
  selection: CalendarSelection;
  rooms: CalendarRoom[];
  /** The month's occupancy, so a refused block can name what is in the way. */
  cells: StayCells;
  /** Every season, so nights already carrying one offer to lift it. */
  overrides: PricingDtoOutputOverridesItem[];
  /** The month on screen, so an optimistic block lands in the right cache. */
  visibleWindow: AvailabilityFindParams;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const [allRooms, setAllRooms] = useState(false);

  const room = rooms.find((candidate) => candidate.roomId === selection.roomId);
  const roomIds = allRooms
    ? rooms.map((candidate) => candidate.roomId)
    : [selection.roomId];
  const nights = daysBetween(selection.from, selection.to) + 1;

  // The seasons the picked nights sit on. Removing one is how a host undoes a
  // season now that the calendar is the only place they are set — without this,
  // a rate could be created and never taken back.
  const covering = overrides.filter(
    (override) =>
      override.roomId === selection.roomId &&
      override.startDate <= selection.to &&
      override.endDate >= selection.from,
  );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {selection.from === selection.to
              ? formatStayDate(selection.from)
              : t("selection.range", {
                  from: formatStayDate(selection.from),
                  to: formatStayDate(selection.to),
                })}
          </SheetTitle>
          <SheetDescription>
            {t("selection.nights", { count: nights, room: room?.name ?? "" })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {rooms.length > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="all-rooms" className="font-normal">
                {t("selection.allRooms")}
              </Label>
              <Switch
                id="all-rooms"
                checked={allRooms}
                onCheckedChange={setAllRooms}
              />
            </div>
          )}

          {/* First, because it is what a host is most often doing with nights
              they have just drawn: someone is on the phone asking for them. */}
          <Button
            size="xl"
            className="w-full"
            nativeButton={false}
            render={
              <Link
                href={newBookingPath(propertyId, {
                  checkIn: selection.from,
                  // The selection names nights; a stay ends the morning after
                  // the last of them.
                  checkOut: addDays(selection.to, 1),
                  roomId: selection.roomId,
                })}
              />
            }
          >
            <UserRoundPlusIcon aria-hidden />
            {t("selection.book")}
          </Button>

          <RateForm
            propertyId={propertyId}
            selection={selection}
            roomIds={roomIds}
            onDone={onClose}
          />

          {covering.length > 0 && (
            <ExistingSeasons
              propertyId={propertyId}
              overrides={covering}
              onDone={onClose}
            />
          )}

          <BlockForm
            propertyId={propertyId}
            selection={selection}
            roomIds={roomIds}
            rooms={rooms}
            cells={cells}
            visibleWindow={visibleWindow}
            onDone={onClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

const rateSchema = z.object({ nightlyRate: rupeeAmount });

/**
 * A rate override, which is what "set a price for these nights" already means in
 * this system — the calendar is a second way into the same record, not a second
 * kind of price. Its dates are inclusive of both ends, which is why the
 * selection is passed through untouched.
 */
function RateForm({
  propertyId,
  selection,
  roomIds,
  onDone,
}: {
  propertyId: string;
  selection: CalendarSelection;
  roomIds: string[];
  onDone: () => void;
}) {
  const t = useTranslations("calendar");
  const queryClient = useQueryClient();

  const create = usePricingCreateOverride({
    mutation: {
      onSuccess: (pricing) => {
        queryClient.setQueryData(getPricingFindQueryKey(propertyId), pricing);
        onDone();
      },
    },
  });

  const form = useForm({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(rateSchema),
    defaultValues: { nightlyRate: 0 },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    create.mutateAsync({
      propertyId,
      data: {
        roomIds,
        startDate: selection.from,
        endDate: selection.to,
        nightlyRate: rupeesToPaise(values.nightlyRate),
        minStayNights: null,
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <h3 className="font-medium">{t("selection.rate.title")}</h3>

      <ApiErrorAlert error={create.error} />

      <TextField
        id="nightlyRate"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_RATE_RUPEES}
        label={t("selection.rate.label")}
        description={t("selection.rate.hint")}
        error={errors.nightlyRate && t("validation.amount")}
        {...form.register("nightlyRate", { valueAsNumber: true })}
      />

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        <IndianRupeeIcon aria-hidden />
        {isSubmitting ? t("selection.rate.saving") : t("selection.rate.save")}
      </Button>
    </form>
  );
}

/**
 * The seasons already on these nights. A season is not edited — its price is
 * replaced by lifting it and drawing another, which is the same two taps an edit
 * form would be without a second way to write the same record.
 */
function ExistingSeasons({
  propertyId,
  overrides,
  onDone,
}: {
  propertyId: string;
  overrides: PricingDtoOutputOverridesItem[];
  onDone: () => void;
}) {
  const t = useTranslations("calendar");
  const queryClient = useQueryClient();

  const remove = usePricingRemoveOverride({
    mutation: {
      onSuccess: (pricing) =>
        queryClient.setQueryData(getPricingFindQueryKey(propertyId), pricing),
    },
  });

  return (
    <div className="space-y-3 border-t pt-6">
      <h3 className="font-medium">{t("selection.seasons.title")}</h3>

      <ApiErrorAlert error={remove.error} />

      <ul className="space-y-2">
        {overrides.map((override) => (
          <li
            key={override.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{formatPaise(override.nightlyRate)}</p>
              <p className="text-muted-foreground">
                {t("selection.range", {
                  from: formatStayDate(override.startDate),
                  to: formatStayDate(override.endDate),
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              disabled={remove.isPending}
              aria-label={t("selection.seasons.remove")}
              onClick={async () => {
                await remove.mutateAsync({
                  propertyId,
                  overrideId: override.id,
                });
                onDone();
              }}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const blockSchema = z.object({ reason: z.string().trim().min(1).max(120) });

function BlockForm({
  propertyId,
  selection,
  roomIds,
  rooms,
  cells,
  visibleWindow,
  onDone,
}: {
  propertyId: string;
  selection: CalendarSelection;
  roomIds: string[];
  rooms: CalendarRoom[];
  cells: StayCells;
  /** The month on screen, so an optimistic block lands in the right cache. */
  visibleWindow: AvailabilityFindParams;
  onDone: () => void;
}) {
  const t = useTranslations("calendar");
  const block = useBlockDates(propertyId, visibleWindow);

  // The refusal the database hands back names nothing the host can act on, and
  // the mutation refetches the month before this renders — so the rooms in the
  // way are read from the same occupancy the grid behind the sheet is drawing.
  const conflicts =
    isApiError(block.error) && block.error.code === "BOOKING_CONFLICT"
      ? staysBlocking(cells, roomIds, selection.from, selection.to)
      : [];

  const form = useForm({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(blockSchema),
    defaultValues: { reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    await block.mutateAsync({
      propertyId,
      data: {
        roomIds,
        checkIn: selection.from,
        // The selection names nights; a stay range ends the morning after the
        // last of them.
        checkOut: addDays(selection.to, 1),
        reason: values.reason,
      },
    });
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 border-t pt-6">
      <h3 className="font-medium">{t("selection.block.title")}</h3>

      {conflicts.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{t("selection.block.conflict.title")}</AlertTitle>
          <AlertDescription>
            <ul>
              {conflicts.map((stay) => (
                <li key={stay.id}>
                  {t("selection.block.conflict.stay", {
                    room:
                      rooms.find((room) => room.roomId === stay.roomId)?.name ??
                      "",
                    from: formatStayDate(stay.checkIn),
                    // Half-open: the last night is the one before check-out.
                    to: formatStayDate(addDays(stay.checkOut, -1)),
                  })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <ApiErrorAlert error={block.error} />
      )}

      <TextField
        id="reason"
        label={t("selection.block.label")}
        description={t("selection.block.hint")}
        error={errors.reason && t("validation.reason")}
        {...form.register("reason")}
      />

      <Button
        type="submit"
        variant="outline"
        size="xl"
        className="w-full"
        disabled={isSubmitting}
      >
        <BanIcon aria-hidden />
        {isSubmitting ? t("selection.block.saving") : t("selection.block.save")}
      </Button>
    </form>
  );
}
