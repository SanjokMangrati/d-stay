"use client";

import { useMediaList } from "@d-stay/api-client/endpoints/media";
import { useRoomsList } from "@d-stay/api-client/endpoints/rooms";
import type { PropertyDetailDtoOutput } from "@d-stay/api-client/models";
import { formatPaise } from "@d-stay/domain/money";
import { BedDoubleIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SetupStep } from "./setup-step";
import { ReviewStep } from "./steps/review-step";
import { RoomCover } from "@/components/room-cover";
import { Button } from "@/components/ui/button";
import { propertyRoomsPath } from "@/lib/properties/property-paths";

/**
 * What the host has already told us, read-only. A property that is past draft is
 * one they open to look at far more often than to change, and dropping them into
 * a live form invites an accidental edit to a listing that is in the queue or
 * already live. Editing is a deliberate tap, per section.
 */
export function PropertySummary({
  property,
  onEdit,
}: {
  property: PropertyDetailDtoOutput;
  onEdit: (step: SetupStep) => void;
}) {
  const t = useTranslations("property");

  const pin =
    property.latitude !== null && property.longitude !== null
      ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`
      : null;

  return (
    <div className="space-y-4">
      <Section
        title={t("setup.steps.basics")}
        step="basics"
        onEdit={onEdit}
      >
        <Row label={t("fields.name")} value={property.name} />
        <Row label={t("fields.description")} value={property.description} />
      </Section>

      <Section title={t("setup.steps.location")} step="location" onEdit={onEdit}>
        <Row label={t("summary.pin")} value={pin} />
        <Row label={t("fields.landmark")} value={property.landmark} />
        <Row label={t("fields.directions")} value={property.directions} />
        <Row label={t("fields.city")} value={property.city} />
        <Row label={t("fields.district")} value={property.district} />
        <Row label={t("fields.state")} value={property.state} />
      </Section>

      <Section title={t("setup.steps.stay")} step="stay" onEdit={onEdit}>
        <Row label={t("fields.checkInTime")} value={property.checkInTime} />
        <Row label={t("fields.checkOutTime")} value={property.checkOutTime} />
        <Row
          label={t("fields.mealPlan")}
          value={property.mealPlan && t(`mealPlan.${property.mealPlan}`)}
        />
        {property.mealPlan !== null && property.mealPlan !== "ROOM_ONLY" && (
          <Row
            label={t("fields.mealCharge")}
            value={formatPaise(property.mealChargePerPerson)}
          />
        )}
      </Section>

      <PhotosSection propertyId={property.id} onEdit={onEdit} />

      <RoomsSection propertyId={property.id} />

      <Section title={t("setup.steps.house")} step="house" onEdit={onEdit}>
        <Row
          label={t("fields.amenities")}
          value={
            property.amenities.length > 0
              ? property.amenities
                  .map((amenity) => t(`amenity.${amenity}`))
                  .join(", ")
              : null
          }
        />
        <Row label={t("fields.houseRules")} value={property.houseRules} />
      </Section>

      <Section
        title={t("setup.steps.compliance")}
        step="compliance"
        onEdit={onEdit}
      >
        <Row
          label={t("summary.gst")}
          value={t(property.gstEnabled ? "summary.gstOn" : "summary.gstOff")}
        />
        {property.gstEnabled && (
          <Row label={t("fields.gstin")} value={property.gstin} />
        )}
        <Row
          label={t("fields.homestayRegistrationNumber")}
          value={property.homestayRegistrationNumber}
        />
      </Section>

      <ReviewStep property={property} />
    </div>
  );
}

/**
 * How many of a listing's photos a summary card shows. This is a glance, not the
 * gallery — the edit button is how a host reaches the rest.
 */
const STRIP_LIMIT = 5;

/**
 * The photos the host already has, at a glance. The strip is deliberately not the
 * grid from the setup step — nothing is reorderable or deletable here, and the
 * edit button is the way to those actions.
 */
function PhotosSection({
  propertyId,
  onEdit,
}: {
  propertyId: string;
  onEdit: (step: SetupStep) => void;
}) {
  const t = useTranslations("property");
  const { data, isPending } = useMediaList(propertyId);
  const photos = data?.media ?? [];

  return (
    <section className="rounded-lg border p-4">
      <SectionHeader
        title={t("setup.steps.photos")}
        step="photos"
        onEdit={onEdit}
      />
      <div className="mt-3">
        {isPending ? (
          <div className="bg-muted size-16 animate-pulse rounded-md" />
        ) : photos.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("summary.notSet")}</p>
        ) : (
          <ul className="flex gap-2">
            {photos.slice(0, STRIP_LIMIT).map((photo) => (
              <li key={photo.id} className="shrink-0">
                {/* Sized by the API's derivatives; see the setup step. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  className="bg-muted size-16 rounded-md object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Rooms are not a step of this form, so this section links out rather than
 * editing in place — but a host looking at their property expects to see how
 * many rooms it has without having to remember where they live.
 *
 * Rates are counted here rather than given a card of their own: a room's price
 * is part of the room, and a property whose rooms have no price is one nobody
 * can be quoted for.
 */
function RoomsSection({ propertyId }: { propertyId: string }) {
  const t = useTranslations("room");
  const { data } = useRoomsList(propertyId);
  const rooms = data?.rooms ?? [];
  const active = rooms.filter((room) => room.isActive).length;
  const unpriced = rooms.filter((room) => room.baseRate === null).length;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <Button
          variant="outline"
          size="lg"
          className="h-11"
          nativeButton={false}
          render={<Link href={propertyRoomsPath(propertyId)} />}
        >
          <BedDoubleIcon aria-hidden />
          {t("manage")}
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {rooms.length > 0 && (
          // One cover per room rather than every photo: the question this card
          // answers is "which rooms do I have", not "what do they look like".
          <ul className="flex gap-2">
            {rooms.slice(0, STRIP_LIMIT).map((room) => (
              <li key={room.id}>
                <RoomCover room={room} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-sm">
          {rooms.length === 0
            ? t("empty")
            : t("roomCount", { active, total: rooms.length })}
        </p>
        {unpriced > 0 && (
          <p className="text-destructive text-sm">
            {t("unpricedCount", { count: unpriced })}
          </p>
        )}
      </div>
    </section>
  );
}

function Section({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <SectionHeader title={title} step={step} onEdit={onEdit} />
      <dl className="mt-3 space-y-3">{children}</dl>
    </section>
  );
}

function SectionHeader({
  title,
  step,
  onEdit,
}: {
  title: string;
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
}) {
  const t = useTranslations("property.summary");

  return (
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button
        type="button"
        variant="outline"
        size="lg"
        // Every step's edit sits under a thumb, so it keeps the 44px target the
        // size scale only guarantees at `xl`.
        className="h-11"
        aria-label={t("editSection", { section: title })}
        onClick={() => onEdit(step)}
      >
        <PencilIcon aria-hidden />
        {t("edit")}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  const t = useTranslations("property.summary");

  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm whitespace-pre-line">
        {value ?? <span className="text-muted-foreground">{t("notSet")}</span>}
      </dd>
    </div>
  );
}
