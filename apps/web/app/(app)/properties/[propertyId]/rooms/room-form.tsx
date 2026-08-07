"use client";

import {
  getRoomsListQueryKey,
  useRoomsCreate,
  useRoomsUpdate,
} from "@d-stay/api-client/endpoints/rooms";
import type { RoomDtoOutput } from "@d-stay/api-client/models";
import {
  RoomsUpdateBody,
  roomsUpdateBodyDescriptionMax,
  roomsUpdateBodyDoubleBedsMax,
  roomsUpdateBodyMaxOccupancyMax,
  roomsUpdateBodyNameMax,
} from "@d-stay/api-client/schemas/rooms";
import { paiseToRupees, rupeesToPaise } from "@d-stay/domain/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { getPropertiesFindOneQueryKey } from "@d-stay/api-client/endpoints/properties";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { FORM_VALIDATION_MODE, OPTIONAL_NUMBER_INPUT } from "@/lib/form-mode";
import {
  MAX_RATE_RUPEES,
  optionalRupeeAmount,
  rupeeAmount,
} from "@/lib/pricing/rupees";
import { propertyRoomsPath, roomPath } from "@/lib/properties/property-paths";

/**
 * The occupancy rule is the database's CHECK constraint restated: OpenAPI cannot
 * carry a cross-field refinement, so the generated schema has lost it and the
 * host would otherwise learn about it from a rejected request.
 *
 * Rates are overridden to rupees because that is what a host says out loud and
 * types; they are converted back to paise at submit, which is the only unit that
 * crosses the wire.
 */
const roomSchema = RoomsUpdateBody.extend({
  baseRate: optionalRupeeAmount,
  weekendRate: optionalRupeeAmount,
  extraGuestCharge: rupeeAmount,
}).refine((values) => values.maxOccupancy >= values.standardOccupancy, {
  path: ["maxOccupancy"],
});

type RoomValues = z.infer<typeof roomSchema>;

const AMENITIES = RoomsUpdateBody.shape.amenities.element.options;

/**
 * One screen for a whole room, on both routes: a room is small enough to fill in
 * at one sitting, so there is no per-step draft to keep the way the property
 * setup has.
 */
export function RoomForm({
  propertyId,
  room,
}: {
  propertyId: string;
  room?: RoomDtoOutput;
}) {
  const t = useTranslations("room");
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSaved = async (destination: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getRoomsListQueryKey(propertyId),
      }),
      // The first active room is what clears `rooms` from the checklist.
      queryClient.invalidateQueries({
        queryKey: getPropertiesFindOneQueryKey(propertyId),
      }),
    ]);
    router.push(destination);
    router.refresh();
  };

  // A new room lands on its own page, where its photos are; editing an existing
  // one goes back to the list the host came from.
  const create = useRoomsCreate({
    mutation: {
      onSuccess: (created) => onSaved(roomPath(propertyId, created.id)),
    },
  });
  const update = useRoomsUpdate({
    mutation: { onSuccess: () => onSaved(propertyRoomsPath(propertyId)) },
  });

  const form = useForm<RoomValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room?.name ?? "",
      description: room?.description ?? "",
      doubleBeds: room?.doubleBeds ?? 1,
      singleBeds: room?.singleBeds ?? 0,
      extraMattresses: room?.extraMattresses ?? 0,
      standardOccupancy: room?.standardOccupancy ?? 2,
      maxOccupancy: room?.maxOccupancy ?? 3,
      amenities: room?.amenities ?? [],
      isActive: room?.isActive ?? true,
      baseRate: room?.baseRate == null ? null : paiseToRupees(room.baseRate),
      weekendRate:
        room?.weekendRate == null ? null : paiseToRupees(room.weekendRate),
      extraGuestCharge: paiseToRupees(room?.extraGuestCharge ?? 0),
    },
  });
  const { errors, isSubmitting, isValid } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const data = {
      ...values,
      description: values.description?.trim() ? values.description : null,
      // Rupees are what the host typed; paise are the only unit stored.
      baseRate: values.baseRate === null ? null : rupeesToPaise(values.baseRate),
      weekendRate:
        values.weekendRate === null ? null : rupeesToPaise(values.weekendRate),
      extraGuestCharge: rupeesToPaise(values.extraGuestCharge),
    };

    if (room) {
      await update.mutateAsync({ propertyId, roomId: room.id, data });
      return;
    }
    await create.mutateAsync({ propertyId, data });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ApiErrorAlert error={create.error ?? update.error} />

      <FieldGroup>
        <TextField
          id="name"
          autoComplete="off"
          maxLength={roomsUpdateBodyNameMax}
          label={t("fields.name")}
          placeholder={t("fields.namePlaceholder")}
          description={t("fields.nameHint")}
          error={errors.name && t("validation.nameRequired")}
          {...form.register("name")}
        />

        <TextAreaField
          id="description"
          rows={4}
          maxLength={roomsUpdateBodyDescriptionMax}
          label={t("fields.description")}
          placeholder={t("fields.descriptionPlaceholder")}
          error={errors.description && t("validation.tooLong")}
          {...form.register("description")}
        />

        <FieldSet>
          <FieldLegend variant="label">{t("fields.beds")}</FieldLegend>
          <FieldDescription>{t("fields.bedsHint")}</FieldDescription>
          <div className="grid grid-cols-3 gap-3">
            <TextField
              id="doubleBeds"
              type="number"
              inputMode="numeric"
              min={0}
              max={roomsUpdateBodyDoubleBedsMax}
              label={t("fields.doubleBeds")}
              {...form.register("doubleBeds", { valueAsNumber: true })}
            />
            <TextField
              id="singleBeds"
              type="number"
              inputMode="numeric"
              min={0}
              max={roomsUpdateBodyDoubleBedsMax}
              label={t("fields.singleBeds")}
              {...form.register("singleBeds", { valueAsNumber: true })}
            />
            <TextField
              id="extraMattresses"
              type="number"
              inputMode="numeric"
              min={0}
              max={roomsUpdateBodyDoubleBedsMax}
              label={t("fields.extraMattresses")}
              {...form.register("extraMattresses", { valueAsNumber: true })}
            />
          </div>
        </FieldSet>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="standardOccupancy"
            type="number"
            inputMode="numeric"
            min={1}
            max={roomsUpdateBodyMaxOccupancyMax}
            label={t("fields.standardOccupancy")}
            description={t("fields.standardOccupancyHint")}
            {...form.register("standardOccupancy", { valueAsNumber: true })}
          />
          <TextField
            id="maxOccupancy"
            type="number"
            inputMode="numeric"
            min={1}
            max={roomsUpdateBodyMaxOccupancyMax}
            label={t("fields.maxOccupancy")}
            error={errors.maxOccupancy && t("validation.occupancyOrder")}
            {...form.register("maxOccupancy", { valueAsNumber: true })}
          />
        </div>

        {/* What the room costs when no season says otherwise. It sits with the
            room because it is a standing fact about it, like its occupancy —
            a price that belongs to particular dates is set on the calendar. */}
        <FieldSet>
          <FieldLegend variant="label">{t("fields.rates")}</FieldLegend>
          <FieldDescription>{t("fields.ratesHint")}</FieldDescription>

          <TextField
            id="baseRate"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_RATE_RUPEES}
            label={t("fields.baseRate")}
            description={t("fields.baseRateHint")}
            error={errors.baseRate && t("validation.amount")}
            {...form.register("baseRate", OPTIONAL_NUMBER_INPUT)}
          />

          <TextField
            id="weekendRate"
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
            id="extraGuestCharge"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_RATE_RUPEES}
            label={t("fields.extraGuestCharge")}
            description={t("fields.extraGuestChargeHint")}
            error={errors.extraGuestCharge && t("validation.amount")}
            {...form.register("extraGuestCharge", { valueAsNumber: true })}
          />
        </FieldSet>

        <Controller
          control={form.control}
          name="amenities"
          render={({ field }) => {
            const selected = field.value;
            return (
              <FieldSet>
                <FieldLegend variant="label">
                  {t("fields.amenities")}
                </FieldLegend>
                {AMENITIES.map((amenity) => (
                  <Field key={amenity} orientation="horizontal">
                    <Checkbox
                      id={`amenity-${amenity}`}
                      checked={selected.includes(amenity)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...selected, amenity]
                            : selected.filter((value) => value !== amenity),
                        )
                      }
                    />
                    <FieldLabel
                      htmlFor={`amenity-${amenity}`}
                      className="font-normal"
                    >
                      {t(`amenity.${amenity}`)}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
            );
          }}
        />

        {/* Only an existing room can be taken out of service — a new one the host
            is still typing has nothing to withdraw. */}
        {room && (
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="isActive">
                    {t("fields.isActive")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("fields.isActiveHint")}
                  </FieldDescription>
                </div>
              </Field>
            )}
          />
        )}
      </FieldGroup>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="xl"
          onClick={() => router.push(propertyRoomsPath(propertyId))}
        >
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          size="xl"
          className="flex-1"
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  );
}
