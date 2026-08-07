"use client";

import {
  ApiTransportError,
  isApiError,
  type ApiErrorCode,
} from "@d-stay/api-client/error";
import { useTranslations } from "next-intl";
import { Alert, AlertTitle } from "@/components/ui/alert";

/**
 * The API's `code` decides what the host reads — never its `message`, which is
 * written for a developer reading a log. Codes without an entry here fall back
 * to the generic line rather than leaking server prose into the UI.
 */
const MESSAGE_KEY: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_FAILED: "validationFailed",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "notFound",
  PROPERTY_INCOMPLETE: "propertyIncomplete",
  INVALID_STATUS_TRANSITION: "invalidStatusTransition",
  MEDIA_LIMIT_REACHED: "mediaLimitReached",
  ROOM_LIMIT_REACHED: "roomLimitReached",
  ROOM_HAS_BOOKINGS: "roomHasBookings",
  RATE_OVERRIDE_CONFLICT: "rateOverrideConflict",
  BOOKING_CONFLICT: "bookingConflict",
};

export function ApiErrorAlert({ error }: { error: unknown }) {
  const t = useTranslations("errors");

  if (!error) {
    return null;
  }

  const key = isApiError(error)
    ? (MESSAGE_KEY[error.code] ?? "unexpected")
    : error instanceof ApiTransportError
      ? "unreachable"
      : "unexpected";

  return (
    <Alert variant="destructive">
      <AlertTitle>{t(key)}</AlertTitle>
    </Alert>
  );
}
