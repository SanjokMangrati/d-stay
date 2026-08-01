/**
 * Route literals live here for the same reason the auth paths do: a redirect and
 * the page it lands on must never disagree, and grepping for a string is not a
 * refactor.
 */
export const NEW_PROPERTY_PATH = "/properties/new";

/** The today view: where a host lands, and the root of everything property-scoped. */
export function propertyHomePath(propertyId: string): string {
  return `/properties/${propertyId}`;
}

export function propertyCalendarPath(propertyId: string): string {
  return `${propertyHomePath(propertyId)}/calendar`;
}

export function propertyBookingsPath(propertyId: string): string {
  return `${propertyHomePath(propertyId)}/bookings`;
}

export function propertySetupPath(propertyId: string): string {
  return `${propertyHomePath(propertyId)}/setup`;
}

export function propertyRoomsPath(propertyId: string): string {
  return `${propertyHomePath(propertyId)}/rooms`;
}

export function propertyPricingPath(propertyId: string): string {
  return `${propertyHomePath(propertyId)}/pricing`;
}

export function newRoomPath(propertyId: string): string {
  return `${propertyRoomsPath(propertyId)}/new`;
}

export function roomPath(propertyId: string, roomId: string): string {
  return `${propertyRoomsPath(propertyId)}/${roomId}`;
}

/**
 * Which property the shell is showing. The shell wraps the whole signed-in
 * group, so it sits above the `[propertyId]` segment and is never handed the
 * param — the URL is the only thing that knows.
 */
export function propertyIdFromPathname(pathname: string): string | null {
  const [, segment, propertyId] = pathname.split("/");
  if (segment !== "properties" || !propertyId || propertyId === "new") {
    return null;
  }
  return propertyId;
}
