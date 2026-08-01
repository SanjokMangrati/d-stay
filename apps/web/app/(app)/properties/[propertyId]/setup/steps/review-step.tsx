"use client";

import {
  getPropertiesFindOneQueryKey,
  getPropertiesListQueryKey,
  usePropertiesSubmitForReview,
} from "@d-stay/api-client/endpoints/properties";
import {
  PropertyDetailDtoOutputMissingFieldsItem,
  type PropertyDetailDtoOutput,
} from "@d-stay/api-client/models";
import { useQueryClient } from "@tanstack/react-query";
import { BedDoubleIcon, CheckIcon, CircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { PropertyStatusBadge } from "@/components/property-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { propertyRoomsPath } from "@/lib/properties/property-paths";

const CHECKLIST = Object.values(PropertyDetailDtoOutputMissingFieldsItem);

/** Only a draft or a rejected property is the host's to send in. */
const SUBMITTABLE = ["DRAFT", "REJECTED"];

export function ReviewStep({
  property,
  onBack,
}: {
  property: PropertyDetailDtoOutput;
  onBack?: () => void;
}) {
  const t = useTranslations("property");
  const queryClient = useQueryClient();

  const submit = usePropertiesSubmitForReview({
    mutation: {
      onSuccess: async (updated) => {
        queryClient.setQueryData(
          getPropertiesFindOneQueryKey(updated.id),
          updated,
        );
        await queryClient.invalidateQueries({
          queryKey: getPropertiesListQueryKey(),
        });
      },
    },
  });

  const isSubmittable =
    SUBMITTABLE.includes(property.status) && property.missingFields.length === 0;

  return (
    <div className="space-y-5">
      <ApiErrorAlert error={submit.error} />

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {t("review.currentStatus")}
        </span>
        <PropertyStatusBadge status={property.status} />
      </div>

      {property.status === "REJECTED" && property.rejectionReason && (
        <Alert variant="destructive">
          <AlertTitle>{t("review.rejected")}</AlertTitle>
          <AlertDescription>{property.rejectionReason}</AlertDescription>
        </Alert>
      )}

      <ul className="space-y-2">
        {CHECKLIST.map((field) => {
          const done = !property.missingFields.includes(field);
          return (
            <li key={field} className="flex items-center gap-2 text-sm">
              {done ? (
                <CheckIcon className="text-primary size-4 shrink-0" aria-hidden />
              ) : (
                <CircleIcon
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              )}
              <span className={done ? "text-muted-foreground" : undefined}>
                {t(`checklist.${field}`)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Every other checklist entry is a field of this form; rooms are their own
          screen, so the one entry a host cannot act on from here gets a way to. */}
      {property.missingFields.includes(
        PropertyDetailDtoOutputMissingFieldsItem.rooms,
      ) && (
        <Button
          variant="outline"
          size="xl"
          className="w-full"
          nativeButton={false}
          render={<Link href={propertyRoomsPath(property.id)} />}
        >
          <BedDoubleIcon aria-hidden />
          {t("review.addRooms")}
        </Button>
      )}

      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button type="button" variant="outline" size="xl" onClick={onBack}>
            {t("setup.back")}
          </Button>
        )}
        <Button
          type="button"
          size="xl"
          className="flex-1"
          disabled={!isSubmittable || submit.isPending}
          onClick={() => submit.mutate({ propertyId: property.id })}
        >
          {submit.isPending ? t("review.submitting") : t("review.submit")}
        </Button>
      </div>

      {!SUBMITTABLE.includes(property.status) && (
        <p className="text-muted-foreground text-sm">
          {t(`review.notSubmittable.${property.status}`)}
        </p>
      )}
    </div>
  );
}
