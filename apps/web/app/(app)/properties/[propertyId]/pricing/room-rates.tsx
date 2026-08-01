"use client";

import {
  getPricingFindQueryKey,
  usePricingUpdateRoomRates,
} from "@d-stay/api-client/endpoints/pricing";
import type { PricingDtoOutputRoomsItem } from "@d-stay/api-client/models";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FORM_VALIDATION_MODE, OPTIONAL_NUMBER_INPUT } from "@/lib/form-mode";
import {
  MAX_RATE_RUPEES,
  optionalRupeeAmount,
  rupeeAmount,
} from "@/lib/pricing/rupees";

/**
 * The standing price of each room. One room is edited at a time: these are four
 * numbers a host thinks about together for one room, and a page of every room's
 * fields at once is a page where the wrong ₹2,500 gets changed.
 */
export function RoomRates({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: PricingDtoOutputRoomsItem[];
}) {
  const t = useTranslations("pricing");
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium">{t("rooms.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("rooms.hint")}</p>
      </div>

      {rooms.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t("rooms.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room) => (
            <li key={room.roomId} className="rounded-lg border p-4">
              {editing === room.roomId ? (
                <RoomRateForm
                  propertyId={propertyId}
                  room={room}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <RoomRateSummary
                  room={room}
                  onEdit={() => setEditing(room.roomId)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomRateSummary({
  room,
  onEdit,
}: {
  room: PricingDtoOutputRoomsItem;
  onEdit: () => void;
}) {
  const t = useTranslations("pricing");

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{room.name}</h3>
          {!room.isActive && (
            <Badge variant="secondary">{t("rooms.inactive")}</Badge>
          )}
        </div>

        {room.baseRate === null ? (
          // A room with no rate cannot be quoted at all, so it is called out
          // rather than shown as a blank line the host might read as zero.
          <p className="text-destructive text-sm">{t("rooms.unpriced")}</p>
        ) : (
          <p className="text-sm">
            {t("rooms.perNight", { amount: formatPaise(room.baseRate) })}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          {room.weekendRate === null
            ? t("rooms.noWeekendRate")
            : t("rooms.weekend", { amount: formatPaise(room.weekendRate) })}
        </p>
        <p className="text-muted-foreground text-sm">
          {room.extraGuestCharge === 0
            ? t("rooms.noExtraGuestCharge")
            : t("rooms.extraGuest", {
                amount: formatPaise(room.extraGuestCharge),
                standard: room.standardOccupancy,
              })}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11"
        aria-label={t("rooms.editRates", { room: room.name })}
        onClick={onEdit}
      >
        <PencilIcon aria-hidden />
        {t("form.edit")}
      </Button>
    </div>
  );
}

const rateSchema = z.object({
  baseRate: rupeeAmount,
  weekendRate: optionalRupeeAmount,
  extraGuestCharge: rupeeAmount,
});

function RoomRateForm({
  propertyId,
  room,
  onDone,
}: {
  propertyId: string;
  room: PricingDtoOutputRoomsItem;
  onDone: () => void;
}) {
  const t = useTranslations("pricing");
  const queryClient = useQueryClient();

  const update = usePricingUpdateRoomRates({
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
    defaultValues: {
      baseRate: room.baseRate === null ? 0 : paiseToRupees(room.baseRate),
      weekendRate:
        room.weekendRate === null ? null : paiseToRupees(room.weekendRate),
      extraGuestCharge: paiseToRupees(room.extraGuestCharge),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    await update.mutateAsync({
      propertyId,
      roomId: room.roomId,
      data: {
        baseRate: rupeesToPaise(values.baseRate),
        weekendRate:
          values.weekendRate === null ? null : rupeesToPaise(values.weekendRate),
        extraGuestCharge: rupeesToPaise(values.extraGuestCharge),
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h3 className="font-medium">{room.name}</h3>

      <ApiErrorAlert error={update.error} />

      <FieldGroup>
        <TextField
          id={`baseRate-${room.roomId}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RATE_RUPEES}
          label={t("fields.baseRate")}
          description={t("fields.baseRateHint")}
          error={errors.baseRate && t("validation.amount")}
          {...form.register("baseRate", { valueAsNumber: true })}
        />

        <TextField
          id={`weekendRate-${room.roomId}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RATE_RUPEES}
          label={t("fields.weekendRate")}
          description={t("fields.weekendRateHint")}
          error={errors.weekendRate && t("validation.amount")}
          {...form.register("weekendRate", OPTIONAL_NUMBER_INPUT)}
        />

        <TextField
          id={`extraGuestCharge-${room.roomId}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RATE_RUPEES}
          label={t("fields.extraGuestCharge")}
          description={t("fields.extraGuestChargeHint", {
            standard: room.standardOccupancy,
          })}
          error={errors.extraGuestCharge && t("validation.amount")}
          {...form.register("extraGuestCharge", { valueAsNumber: true })}
        />
      </FieldGroup>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="xl" onClick={onDone}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" size="xl" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  );
}
