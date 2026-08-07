import type { BookingDtoOutput } from "@d-stay/api-client/models";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";

export type BookingStatus = BookingDtoOutput["status"];
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

/**
 * A pencilled-in enquiry is the one status a host has to act on, so it is the
 * only one drawn as unfinished business. A cancellation and a no-show are facts
 * rather than problems — they read as quiet, not as errors.
 */
const VARIANT: Record<BookingStatus, BadgeVariant> = {
  PENDING: "outline",
  CONFIRMED: "default",
  CHECKED_IN: "default",
  CHECKED_OUT: "secondary",
  CANCELLED: "secondary",
  NO_SHOW: "secondary",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations("booking.status");

  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
