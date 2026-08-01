import type { PropertyDetailDtoOutput } from "@d-stay/api-client/models";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";

type PropertyStatus = PropertyDetailDtoOutput["status"];
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

/**
 * Draft and pending read as "nothing is wrong, nothing is finished" — the host
 * runs their bookings either way, so neither is dressed as a warning. Only a
 * rejection and a suspension are.
 */
const VARIANT: Record<PropertyStatus, BadgeVariant> = {
  DRAFT: "outline",
  PENDING_REVIEW: "secondary",
  PUBLISHED: "default",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  const t = useTranslations("property.status");

  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
