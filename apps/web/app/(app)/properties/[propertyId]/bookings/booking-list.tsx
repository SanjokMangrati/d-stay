"use client";

import { useBookingsList } from "@d-stay/api-client/endpoints/bookings";
import type {
  BookingListDtoOutput,
  BookingsListParams,
  BookingsListStatus,
} from "@d-stay/api-client/models";
import { addDays, formatStayDate } from "@d-stay/domain/datetime";
import { formatPaise } from "@d-stay/domain/money";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookingPath, newBookingPath } from "@/lib/properties/property-paths";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly BookingsListStatus[];

/**
 * Every booking of the property, newest stay first. The filters are the two
 * questions a host actually asks — "what is still pencilled in?" and "where is
 * that guest who rang last week?" — and both are in the URL-free local state
 * because they are a glance, not a place.
 */
export function BookingList({
  propertyId,
  initialBookings,
}: {
  propertyId: string;
  initialBookings: BookingListDtoOutput;
}) {
  const t = useTranslations("booking");
  const [status, setStatus] = useState<BookingsListStatus | null>(null);
  const [search, setSearch] = useState("");

  const query: BookingsListParams = {
    ...(status ? { status } : {}),
    ...(search.trim().length > 0 ? { search: search.trim() } : {}),
  };
  const isFiltered = Object.keys(query).length > 0;

  const { data, error, isFetching } = useBookingsList(propertyId, query, {
    query: { initialData: isFiltered ? undefined : initialBookings },
  });

  const bookings = data?.bookings ?? [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          className="pl-9"
          value={search}
          aria-label={t("list.search")}
          placeholder={t("list.searchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {/* Scrolls sideways rather than wrapping into three rows on a phone. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip
          isActive={status === null}
          label={t("list.all")}
          onClick={() => setStatus(null)}
        />
        {STATUSES.map((candidate) => (
          <FilterChip
            key={candidate}
            isActive={status === candidate}
            label={t(`status.${candidate}`)}
            onClick={() => setStatus(candidate)}
          />
        ))}
      </div>

      <ApiErrorAlert error={error} />

      <div aria-busy={isFetching}>
        {data === undefined ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                aria-hidden
                className="bg-muted/40 h-28 animate-pulse rounded-lg border"
              />
            ))}
          </ul>
        ) : bookings.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {isFiltered ? t("list.noMatches") : t("list.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <Link
                  href={bookingPath(propertyId, booking.id)}
                  className="hover:bg-accent/40 block space-y-2 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {booking.guestName}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t("list.nights", {
                          from: formatStayDate(booking.checkIn),
                          // Half-open: the last night is the one before checkout.
                          to: formatStayDate(addDays(booking.checkOut, -1)),
                        })}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>

                  <p className="text-muted-foreground truncate text-sm">
                    {booking.rooms.map((room) => room.name).join(", ")}
                  </p>

                  <p className="text-sm font-medium">
                    {formatPaise(booking.overrideTotal ?? booking.total)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        size="xl"
        className="w-full"
        nativeButton={false}
        render={<Link href={newBookingPath(propertyId)} />}
      >
        <PlusIcon aria-hidden />
        {t("list.add")}
      </Button>
    </div>
  );
}

function FilterChip({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? "default" : "outline"}
      className="h-9 shrink-0"
      aria-pressed={isActive}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
