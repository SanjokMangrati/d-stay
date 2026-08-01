"use client";

import type { PropertyListDtoOutputPropertiesItem } from "@d-stay/api-client/models";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NEW_PROPERTY_PATH,
  propertyHomePath,
} from "@/lib/properties/property-paths";

interface PropertySwitcherProps {
  properties: PropertyListDtoOutputPropertiesItem[];
  activeProperty: PropertyListDtoOutputPropertiesItem | null;
}

/**
 * The one control that answers "which property am I looking at" and "how do I
 * get to the other one". Switching lands on the today view rather than the
 * equivalent page, because the same screen for a different property is rarely
 * what the host meant.
 */
export function PropertySwitcher({
  properties,
  activeProperty,
}: PropertySwitcherProps) {
  const t = useTranslations("shell");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 w-full justify-between px-2 font-semibold"
          />
        }
      >
        <span className="truncate">
          {activeProperty?.name ?? t("properties")}
        </span>
        <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-56">
        {properties.map((property) => (
          <DropdownMenuItem
            key={property.id}
            className="min-h-11 justify-between gap-3"
            render={<Link href={propertyHomePath(property.id)} />}
          >
            <span className="min-w-0">
              <span className="block truncate">{property.name}</span>
              {/* A manager or a staff member is standing in someone else's
                  property; the switcher is the one place that says so. */}
              {property.membershipRole &&
                property.membershipRole !== "OWNER" && (
                  <span className="text-muted-foreground block text-xs">
                    {t(`role.${property.membershipRole}`)}
                  </span>
                )}
            </span>
            {property.id === activeProperty?.id && <CheckIcon aria-hidden />}
          </DropdownMenuItem>
        ))}

        {properties.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem
          className="min-h-11"
          render={<Link href={NEW_PROPERTY_PATH} />}
        >
          <PlusIcon aria-hidden />
          {t("addProperty")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
