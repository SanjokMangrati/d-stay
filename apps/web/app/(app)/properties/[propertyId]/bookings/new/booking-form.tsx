"use client";

import { useAvailabilityFreeRooms } from "@d-stay/api-client/endpoints/availability";
import { useBookingsCreate } from "@d-stay/api-client/endpoints/bookings";
import { usePricingFind } from "@d-stay/api-client/endpoints/pricing";
import type { PricingDtoOutput } from "@d-stay/api-client/models";
import { BookingsCreateBody } from "@d-stay/api-client/schemas/bookings";
import { addDays, daysBetween, todayStayDate } from "@d-stay/domain/datetime";
import { formatPaise, rupeesToPaise } from "@d-stay/domain/money";
import { quote } from "@d-stay/domain/pricing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { QuoteBreakdown } from "./quote-breakdown";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FORM_VALIDATION_MODE,
  OPTIONAL_NUMBER_INPUT,
  optionalTextField,
} from "@/lib/form-mode";
import { MAX_RATE_RUPEES } from "@/lib/pricing/rupees";
import { bookingPath } from "@/lib/properties/property-paths";

const SOURCES = [
  "PHONE",
  "WHATSAPP",
  "WALK_IN",
  "AIRBNB",
  "BOOKING_COM",
  "MAKEMYTRIP",
  "REFERRAL",
] as const;

/**
 * The rooms and the heads in each are what the server prices from, so the form
 * carries them as one list rather than a set of ids plus a party size. A room
 * with nobody in it is not booked — unticking it is how the host removes it.
 *
 * The negotiated total is in rupees here and converted at submit, like every
 * other amount a host types. `adults` and `children` are not asked for twice:
 * they are the sums of the rooms, computed at submit, because the server checks
 * that they agree and a second set of inputs could only ever disagree.
 */
const bookingSchema = BookingsCreateBody.omit({
  adults: true,
  children: true,
  rooms: true,
  overrideTotal: true,
})
  .extend({
    rooms: z.array(
      z.object({
        roomId: z.string(),
        isBooked: z.boolean(),
        adults: z.number().int().min(0).max(20),
        children: z.number().int().min(0).max(20),
      }),
    ),
    overrideTotal: z.number().min(0).max(MAX_RATE_RUPEES).nullable(),
  })
  .refine((values) => values.checkOut > values.checkIn, { path: ["checkOut"] })
  .refine((values) => values.rooms.some((room) => room.isBooked), {
    path: ["rooms"],
  })
  .refine(
    (values) =>
      values.rooms
        .filter((room) => room.isBooked)
        .every((room) => room.adults + room.children > 0),
    { path: ["rooms"] },
  )
  .refine(
    (values) =>
      values.overrideTotal === null || values.overrideReason !== null,
    { path: ["overrideReason"] },
  );

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingForm({
  propertyId,
  initialPricing,
  checkIn,
  checkOut,
  roomId,
}: {
  propertyId: string;
  initialPricing: PricingDtoOutput;
  /** The nights the host drew on the calendar, or today onwards if they came here cold. */
  checkIn: string;
  checkOut: string;
  roomId: string | null;
}) {
  const t = useTranslations("booking");
  const router = useRouter();

  const { data: pricing } = usePricingFind(propertyId, {
    query: { initialData: initialPricing },
  });
  const rooms = pricing.rooms.filter((room) => room.isActive);

  const form = useForm<BookingFormValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: "",
      guestPhone: "+91",
      guestEmail: null,
      checkIn,
      checkOut,
      source: "PHONE",
      status: "CONFIRMED",
      isWholeProperty: false,
      note: null,
      overrideTotal: null,
      overrideReason: null,
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        // Only the room the host tapped starts ticked; a booking that quietly
        // took the whole house would be the expensive kind of surprise.
        isBooked: roomId === null ? false : room.roomId === roomId,
        adults: 2,
        children: 0,
      })),
    },
  });
  const { errors, isSubmitting } = form.formState;

  // `useWatch` rather than `form.watch`, which hands React Compiler a function
  // it cannot memoize and so opts this whole screen out of compilation. Named
  // fields rather than the whole form, which arrives partial.
  const [checkInValue, checkOutValue, roomValues, overrideTotal] = useWatch({
    control: form.control,
    name: ["checkIn", "checkOut", "rooms", "overrideTotal"],
  });
  const isRangeValid = checkOutValue > checkInValue;
  const picked = roomValues.filter((room) => room.isBooked);

  // Which rooms are actually free for these nights. The form still submits what
  // the host asked for — the server is the authority — but offering a room that
  // is already taken is how a host ends up reading a conflict error instead of
  // taking a booking.
  const { data: free } = useAvailabilityFreeRooms(
    propertyId,
    { checkIn: checkInValue, checkOut: checkOutValue },
    { query: { enabled: isRangeValid } },
  );

  const priced = isRangeValid && picked.length > 0
    ? quote({
        checkIn: checkInValue,
        checkOut: checkOutValue,
        rooms: picked.map((room) => ({
          roomId: room.roomId,
          adults: room.adults,
          children: room.children,
        })),
        rates: pricing.rooms,
        overrides: pricing.overrides,
        mealPlan: pricing.mealPlan ?? "ROOM_ONLY",
        mealChargePerPerson: pricing.mealChargePerPerson,
        gstEnabled: pricing.gstEnabled,
      })
    : null;

  const create = useBookingsCreate({
    mutation: {
      onSuccess: (booking) =>
        router.replace(bookingPath(propertyId, booking.id)),
    },
  });

  const onSubmit = form.handleSubmit(async (submitted) => {
    const booked = submitted.rooms.filter((room) => room.isBooked);

    await create.mutateAsync({
      propertyId,
      data: {
        ...submitted,
        adults: booked.reduce((total, room) => total + room.adults, 0),
        children: booked.reduce((total, room) => total + room.children, 0),
        rooms: booked.map(({ roomId: id, adults, children }) => ({
          roomId: id,
          adults,
          children,
        })),
        isWholeProperty: booked.length === rooms.length && rooms.length > 1,
        overrideTotal:
          submitted.overrideTotal === null
            ? null
            : rupeesToPaise(submitted.overrideTotal),
      },
    });
  });

  const nights = isRangeValid ? daysBetween(checkInValue, checkOutValue) : 0;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <ApiErrorAlert error={create.error} />

      <FieldSet>
        <FieldLegend>{t("form.stay")}</FieldLegend>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="checkIn"
              type="date"
              min={todayStayDate()}
              label={t("form.checkIn")}
              error={errors.checkIn && t("validation.dates")}
              {...form.register("checkIn")}
            />
            <TextField
              id="checkOut"
              type="date"
              min={addDays(checkInValue, 1)}
              label={t("form.checkOut")}
              description={t("form.nights", { count: nights })}
              error={errors.checkOut && t("validation.dates")}
              {...form.register("checkOut")}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t("form.rooms")}</FieldLegend>
        <FieldDescription>{t("form.roomsHint")}</FieldDescription>

        <ul className="mt-3 space-y-3">
          {rooms.map((room, index) => {
            const isBooked = roomValues[index]?.isBooked ?? false;
            const isFree = !isRangeValid || (free?.roomIds.includes(room.roomId) ?? true);

            return (
              <li key={room.roomId} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{room.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {room.baseRate === null
                        ? t("form.roomUnpriced")
                        : t("form.roomRate", {
                            amount: formatPaise(room.baseRate),
                            sleeps: room.standardOccupancy,
                          })}
                    </p>
                    {!isFree && (
                      <p className="text-destructive text-sm">
                        {t("form.roomTaken")}
                      </p>
                    )}
                  </div>

                  <Controller
                    control={form.control}
                    name={`rooms.${index}.isBooked`}
                    render={({ field }) => (
                      <Switch
                        aria-label={t("form.pickRoom", { room: room.name })}
                        checked={field.value}
                        disabled={room.baseRate === null}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>

                {isBooked && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      id={`adults-${room.roomId}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={room.maxOccupancy}
                      label={t("form.adults")}
                      {...form.register(`rooms.${index}.adults`, {
                        valueAsNumber: true,
                      })}
                    />
                    <TextField
                      id={`children-${room.roomId}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={room.maxOccupancy}
                      label={t("form.children")}
                      {...form.register(`rooms.${index}.children`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {errors.rooms && (
          <p className="text-destructive mt-2 text-sm">{t("validation.rooms")}</p>
        )}
      </FieldSet>

      {priced && <QuoteBreakdown quote={priced} rooms={rooms} />}

      <FieldSet>
        <FieldLegend>{t("form.guest")}</FieldLegend>
        <FieldGroup>
          <TextField
            id="guestName"
            label={t("form.guestName")}
            error={errors.guestName && t("validation.guestName")}
            {...form.register("guestName")}
          />
          <TextField
            id="guestPhone"
            type="tel"
            inputMode="tel"
            label={t("form.guestPhone")}
            description={t("form.guestPhoneHint")}
            error={errors.guestPhone && t("validation.guestPhone")}
            {...form.register("guestPhone")}
          />
          <TextField
            id="guestEmail"
            type="email"
            label={t("form.guestEmail")}
            description={t("form.guestEmailHint")}
            error={errors.guestEmail && t("validation.guestEmail")}
            {...form.register("guestEmail", optionalTextField)}
          />

          <Controller
            control={form.control}
            name="source"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="source">{t("form.source")}</FieldLabel>
                <Select
                  items={SOURCES.map((source) => ({
                    value: source,
                    label: t(`source.${source}`),
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {t(`source.${source}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{t("form.sourceHint")}</FieldDescription>
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t("form.terms")}</FieldLegend>
        <FieldGroup>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="hold">{t("form.hold")}</FieldLabel>
                  <FieldDescription>{t("form.holdHint")}</FieldDescription>
                </div>
                <Switch
                  id="hold"
                  checked={field.value === "PENDING"}
                  onCheckedChange={(checked) =>
                    field.onChange(checked ? "PENDING" : "CONFIRMED")
                  }
                />
              </div>
            )}
          />

          <TextField
            id="overrideTotal"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_RATE_RUPEES}
            label={t("form.overrideTotal")}
            description={t("form.overrideTotalHint")}
            error={errors.overrideTotal && t("validation.amount")}
            {...form.register("overrideTotal", OPTIONAL_NUMBER_INPUT)}
          />

          {overrideTotal !== null && (
            <TextField
              id="overrideReason"
              label={t("form.overrideReason")}
              error={errors.overrideReason && t("validation.overrideReason")}
              {...form.register("overrideReason", optionalTextField)}
            />
          )}

          <TextAreaField
            id="note"
            rows={3}
            label={t("form.note")}
            description={t("form.noteHint")}
            {...form.register("note", optionalTextField)}
          />
        </FieldGroup>
      </FieldSet>

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
