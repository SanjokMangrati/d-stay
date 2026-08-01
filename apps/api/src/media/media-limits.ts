/**
 * What an upload is allowed to be. These are the server's numbers; the browser
 * downscales before it asks for a URL, so a host on a phone camera never sends
 * eight megabytes over a rural connection — but nothing about that is trusted.
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Generous next to the ~500KB a downscaled photo actually is. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Per listing — the property's own gallery, and each room's. Enough for a
 * homestay; a cap is what stops a bucket becoming free hosting.
 */
export const MAX_PHOTOS_PER_LISTING = 20;

/** A presigned URL is used immediately or not at all. */
export const UPLOAD_URL_TTL_SECONDS = 300;

/**
 * An upload the host walked away from. Long enough that a phone that lost signal
 * mid-upload can still finish, short enough that the bucket does not accumulate.
 */
export const ABANDONED_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The three sizes the apps ask for: a grid thumbnail, a card, and the full-width
 * image a guest opens. Every derivative is WebP — the format decision is made
 * once here rather than per call site.
 */
export const DERIVATIVE_VARIANTS = {
  thumb: { width: 320, quality: 70 },
  card: { width: 800, quality: 75 },
  full: { width: 1600, quality: 80 },
} as const;

export type DerivativeVariant = keyof typeof DERIVATIVE_VARIANTS;
