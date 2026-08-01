"use client";

import {
  PropertiesUpdateBody,
  propertiesUpdateBodyCityMax,
  propertiesUpdateBodyDirectionsMax,
  propertiesUpdateBodyDistrictMax,
  propertiesUpdateBodyLandmarkMax,
  propertiesUpdateBodyStateMax,
} from "@d-stay/api-client/schemas/properties";
import { zodResolver } from "@hookform/resolvers/zod";
import { CrosshairIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  emptyToNull,
  SetupStepFooter,
  type SetupStepProps,
} from "../setup-step";
import { FORM_VALIDATION_MODE } from "@/lib/form-mode";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";

// Leaflet reaches for `window` as it loads, and a map has nothing to say to a
// server render anyway.
const LocationMap = dynamic(
  () => import("./location-map").then((module) => module.LocationMap),
  {
    ssr: false,
    loading: () => <div className="bg-muted h-60 w-full animate-pulse rounded-lg" />,
  },
);

/**
 * The pair rule is the server's, restated: OpenAPI cannot carry a cross-field
 * refinement, so the generated schema has lost it and the host would otherwise
 * only learn about it from a rejected request.
 */
const locationSchema = PropertiesUpdateBody.pick({
  latitude: true,
  longitude: true,
  landmark: true,
  directions: true,
  city: true,
  district: true,
  state: true,
}).refine(
  (values) =>
    (values.latitude === null || values.latitude === undefined) ===
    (values.longitude === null || values.longitude === undefined),
  { path: ["latitude"] },
);

type LocationValues = z.infer<typeof locationSchema>;

export function LocationStep({
  property,
  onSave,
  isSaving,
  onBack,
}: SetupStepProps) {
  const t = useTranslations("property");
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const form = useForm<LocationValues>({
    ...FORM_VALIDATION_MODE,
    resolver: zodResolver(locationSchema),
    defaultValues: {
      latitude: property.latitude,
      longitude: property.longitude,
      landmark: property.landmark ?? "",
      directions: property.directions ?? "",
      city: property.city ?? "",
      district: property.district ?? "",
      state: property.state ?? "",
    },
  });
  const { errors, isValid } = form.formState;
  const [latitude, longitude] = useWatch({
    control: form.control,
    name: ["latitude", "longitude"],
  });

  const setPin = ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    // Only the second write validates: half a pin is a state this passes
    // through, and the host should never be told off for it.
    form.setValue("latitude", latitude, { shouldDirty: true });
    form.setValue("longitude", longitude, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Standing in their own courtyard, a host's phone knows the answer better than
  // they could drop a pin; the map is then how they correct it.
  const useCurrentLocation = () => {
    setLocating(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPin({
          latitude: Number(coords.latitude.toFixed(6)),
          longitude: Number(coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        setLocationDenied(true);
        setLocating(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const onSubmit = form.handleSubmit((values) =>
    onSave({
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      landmark: emptyToNull(values.landmark),
      directions: emptyToNull(values.directions),
      city: emptyToNull(values.city),
      district: emptyToNull(values.district),
      state: emptyToNull(values.state),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.latitude)}>
          <LocationMap
            latitude={latitude ?? null}
            longitude={longitude ?? null}
            onChange={setPin}
            ariaLabel={t("location.mapLabel")}
          />
          <FieldDescription>
            {typeof latitude === "number" && typeof longitude === "number"
              ? // Formatted here rather than by the catalog: a locale number
              // format would round a coordinate to three decimals.
              t("location.pinned", {
                latitude: latitude.toFixed(6),
                longitude: longitude.toFixed(6),
              })
              : t("location.dropPin")}
          </FieldDescription>
          <FieldError>
            {errors.latitude && t("validation.coordinatePair")}
          </FieldError>
        </Field>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          <CrosshairIcon aria-hidden />
          {locating ? t("location.locating") : t("location.useCurrent")}
        </Button>
        {locationDenied && (
          <p className="text-muted-foreground text-sm">
            {t("location.denied")}
          </p>
        )}

        <TextField
          id="landmark"
          maxLength={propertiesUpdateBodyLandmarkMax}
          label={t("fields.landmark")}
          placeholder={t("fields.landmarkPlaceholder")}
          {...form.register("landmark")}
        />

        <TextAreaField
          id="directions"
          rows={4}
          maxLength={propertiesUpdateBodyDirectionsMax}
          label={t("fields.directions")}
          description={t("fields.directionsHint")}
          {...form.register("directions")}
        />

        <TextField
          id="city"
          maxLength={propertiesUpdateBodyCityMax}
          label={t("fields.city")}
          {...form.register("city")}
        />
        <TextField
          id="district"
          maxLength={propertiesUpdateBodyDistrictMax}
          label={t("fields.district")}
          {...form.register("district")}
        />
        <TextField
          id="state"
          maxLength={propertiesUpdateBodyStateMax}
          label={t("fields.state")}
          {...form.register("state")}
        />
      </FieldGroup>

      <SetupStepFooter onBack={onBack} isSaving={isSaving} isValid={isValid} />
    </form>
  );
}
