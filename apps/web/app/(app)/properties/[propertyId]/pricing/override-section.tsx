"use client";

import {
  getPricingFindQueryKey,
  usePricingCreateOverride,
  usePricingRemoveOverride,
} from "@d-stay/api-client/endpoints/pricing";
import type {
  PricingDtoOutputOverridesItem,
  PricingDtoOutputRoomsItem,
} from "@d-stay/api-client/models";
import { pricingCreateOverrideBodyMinStayNightsMax } from "@d-stay/api-client/schemas/pricing";
import { addDays, formatStayDate, todayStayDate } from "@d-stay/domain/datetime";
import { formatPaise, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FORM_VALIDATION_MODE, OPTIONAL_NUMBER_INPUT } from "@/lib/form-mode";
import { MAX_RATE_RUPEES, rupeeAmount } from "@/lib/pricing/rupees";

/**
 * Seasons: the nights that cost something other than the standing rate. There is
 * no editing one — a host changing a festival week changes its price, and
 * deleting the row and setting it again is the same two taps as an edit form
 * would be, without a second way to write the same record.
 */
export function OverrideSection({
  propertyId,
  rooms,
  overrides,
}: {
  propertyId: string;
  rooms: PricingDtoOutputRoomsItem[];
  overrides: PricingDtoOutputOverridesItem[];
}) {
  const t = useTranslations("pricing");
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const remove = usePricingRemoveOverride({
    mutation: {
      onSuccess: (pricing) =>
        queryClient.setQueryData(getPricingFindQueryKey(propertyId), pricing),
    },
  });

  const roomName = (roomId: string) =>
    rooms.find((room) => room.roomId === roomId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium">{t("overrides.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("overrides.hint")}</p>
      </div>

      <ApiErrorAlert error={remove.error} />

      {overrides.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t("overrides.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {overrides.map((override) => (
            <li
              key={override.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {formatStayDate(override.startDate)} –{" "}
                  {formatStayDate(override.endDate)}
                </p>
                <p className="text-sm">
                  {t("overrides.room", {
                    room: roomName(override.roomId),
                    amount: formatPaise(override.nightlyRate),
                  })}
                </p>
                {override.minStayNights !== null && (
                  <p className="text-muted-foreground text-sm">
                    {t("overrides.minStay", { nights: override.minStayNights })}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                disabled={remove.isPending}
                aria-label={t("overrides.remove", {
                  room: roomName(override.roomId),
                })}
                onClick={() =>
                  remove.mutate({ propertyId, overrideId: override.id })
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <OverrideForm
          propertyId={propertyId}
          rooms={rooms}
          onDone={() => setIsAdding(false)}
        />
      ) : (
        <Button
          type="button"
          size="xl"
          className="w-full"
          disabled={rooms.length === 0}
          onClick={() => setIsAdding(true)}
        >
          <PlusIcon aria-hidden />
          {t("overrides.add")}
        </Button>
      )}
    </div>
  );
}

const overrideSchema = z
  .object({
    roomIds: z.array(z.uuid()).min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    nightlyRate: rupeeAmount,
    minStayNights: z
      .number()
      .int()
      .min(1)
      .max(pricingCreateOverrideBodyMinStayNightsMax)
      .nullable(),
  })
  .refine((override) => override.endDate >= override.startDate, {
    path: ["endDate"],
  });

function OverrideForm({
  propertyId,
  rooms,
  onDone,
}: {
  propertyId: string;
  rooms: PricingDtoOutputRoomsItem[];
  onDone: () => void;
}) {
  const t = useTranslations("pricing");
  const queryClient = useQueryClient();

  const create = usePricingCreateOverride({
    mutation: {
      onSuccess: (pricing) => {
        queryClient.setQueryData(getPricingFindQueryKey(propertyId), pricing);
        onDone();
      },
    },
  });

  const today = todayStayDate();
  const form = useForm({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      // Every room, because a season is usually the whole homestay's season.
      roomIds: rooms.map((room) => room.roomId),
      startDate: today,
      endDate: addDays(today, 1),
      nightlyRate: 0,
      minStayNights: null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync({
      propertyId,
      data: { ...values, nightlyRate: rupeesToPaise(values.nightlyRate) },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">{t("overrides.newTitle")}</h3>

      <ApiErrorAlert error={create.error} />

      <FieldGroup>
        <Controller
          control={form.control}
          name="roomIds"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">
                {t("overrides.fields.rooms")}
              </FieldLegend>
              {rooms.map((room) => (
                <Field key={room.roomId} orientation="horizontal">
                  <Checkbox
                    id={`override-room-${room.roomId}`}
                    checked={field.value.includes(room.roomId)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked
                          ? [...field.value, room.roomId]
                          : field.value.filter((id) => id !== room.roomId),
                      )
                    }
                  />
                  <FieldLabel
                    htmlFor={`override-room-${room.roomId}`}
                    className="font-normal"
                  >
                    {room.name}
                  </FieldLabel>
                </Field>
              ))}
            </FieldSet>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="startDate"
            type="date"
            label={t("overrides.fields.startDate")}
            error={errors.startDate && t("validation.date")}
            {...form.register("startDate")}
          />
          <TextField
            id="endDate"
            type="date"
            label={t("overrides.fields.endDate")}
            description={t("overrides.fields.endDateHint")}
            error={errors.endDate && t("validation.dateOrder")}
            {...form.register("endDate")}
          />
        </div>

        <TextField
          id="nightlyRate"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RATE_RUPEES}
          label={t("overrides.fields.nightlyRate")}
          description={t("overrides.fields.nightlyRateHint")}
          error={errors.nightlyRate && t("validation.amount")}
          {...form.register("nightlyRate", { valueAsNumber: true })}
        />

        <TextField
          id="minStayNights"
          type="number"
          inputMode="numeric"
          min={1}
          max={pricingCreateOverrideBodyMinStayNightsMax}
          label={t("overrides.fields.minStay")}
          description={t("overrides.fields.minStayHint")}
          error={errors.minStayNights && t("validation.minStay")}
          {...form.register("minStayNights", OPTIONAL_NUMBER_INPUT)}
        />
      </FieldGroup>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="xl" onClick={onDone}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" size="xl" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? t("form.saving") : t("overrides.save")}
        </Button>
      </div>
    </form>
  );
}
