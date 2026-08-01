import type { DerivativeVariant } from './media-limits';

/**
 * Every object belonging to one photo lives under one prefix, so deleting a
 * photo is a prefix's worth of keys computed from its id rather than a list of
 * keys stored in a column that could disagree with the bucket.
 */
function mediaPrefix(propertyId: string, mediaId: string): string {
  return `properties/${propertyId}/media/${mediaId}`;
}

/** What the host's browser uploads, untouched. */
export function originalKey(propertyId: string, mediaId: string): string {
  return `${mediaPrefix(propertyId, mediaId)}/original`;
}

export function derivativeKey(
  propertyId: string,
  mediaId: string,
  variant: DerivativeVariant,
): string {
  return `${mediaPrefix(propertyId, mediaId)}/${variant}.webp`;
}
