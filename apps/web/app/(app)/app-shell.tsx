"use client";

import type {
  PropertyListDtoOutputPropertiesItem,
  UserProfileDtoOutput,
} from "@d-stay/api-client/models";
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  HouseIcon,
  SunIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PropertySwitcher } from "./property-switcher";
import { SignOutButton } from "./sign-out-button";
import { cn } from "@/lib/utils";
import {
  propertyBookingsPath,
  propertyCalendarPath,
  propertyHomePath,
  propertyIdFromPathname,
  propertySetupPath,
} from "@/lib/properties/property-paths";

/**
 * Four destinations, because a fifth would put the bottom nav below the width a
 * 360px phone can give a 44px target. Money and insight live inside bookings
 * and today rather than as their own tabs.
 */
const NAV_ITEMS = [
  { key: "today", href: propertyHomePath, icon: SunIcon },
  { key: "calendar", href: propertyCalendarPath, icon: CalendarDaysIcon },
  { key: "bookings", href: propertyBookingsPath, icon: ClipboardListIcon },
  { key: "property", href: propertySetupPath, icon: HouseIcon },
] as const;

interface AppShellProps {
  host: UserProfileDtoOutput;
  properties: PropertyListDtoOutputPropertiesItem[];
  children: ReactNode;
}

/**
 * The signed-in chrome: bottom nav on a phone, sidebar from `md` up. It wraps
 * the whole authenticated group rather than the `[propertyId]` subtree so that
 * switching property, or standing on the new-property page, never costs the
 * host their navigation.
 */
export function AppShell({ host, properties, children }: AppShellProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const propertyId = propertyIdFromPathname(pathname);
  const activeProperty =
    properties.find((property) => property.id === propertyId) ?? null;

  const navigation = propertyId
    ? NAV_ITEMS.map((item) => {
        const href = item.href(propertyId);
        return {
          ...item,
          href,
          label: t(`nav.${item.key}`),
          // Today is the property root, so every other destination starts with
          // it — only an exact match means the host is standing on it.
          isActive: item.key === "today" ? pathname === href : pathname.startsWith(href),
        };
      })
    : [];

  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-border hidden md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:gap-4 md:border-r md:p-3">
        <PropertySwitcher
          properties={properties}
          activeProperty={activeProperty}
        />

        <nav className="flex flex-col gap-1">
          {navigation.map(({ key, href, label, icon: Icon, isActive }) => (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-border mt-auto space-y-2 border-t pt-3">
          <p className="truncate px-3 text-sm font-medium">
            {t("signedInAs", { name: host.name })}
          </p>
          {host.role === "ADMIN" && (
            <p className="text-muted-foreground px-3 text-xs">
              {t("adminBadge")}
            </p>
          )}
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh w-full min-w-0 flex-col">
        <header className="border-border flex items-center gap-2 border-b px-2 py-2 md:hidden">
          <div className="min-w-0 flex-1">
            <PropertySwitcher
              properties={properties}
              activeProperty={activeProperty}
            />
          </div>
          <SignOutButton />
        </header>

        {/* The bottom nav is fixed, so the last thing on the page needs room to
            clear it — otherwise a submit button sits under the tabs. */}
        <main className="flex-1 px-4 py-6 pb-28 md:pb-6">{children}</main>

        {navigation.length > 0 && (
          <nav className="bg-background border-border fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
            {navigation.map(({ key, href, label, icon: Icon, isActive }) => (
              <Link
                key={key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
