import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MediaStatus } from '../../generated/prisma/enums';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTOS_PER_LISTING,
  MAX_UPLOAD_BYTES,
} from './media-limits';

/**
 * One photo as the apps consume it: three ready-to-use URLs and enough to draw a
 * placeholder before any of them arrive. Storage keys never leave the API — they
 * are an implementation detail of the bucket layout.
 */
export const mediaAssetSchema = z.object({
  id: z.uuid(),
  /** The room this photo belongs to, or `null` for the property's own gallery. */
  roomId: z.uuid().nullable(),
  status: z.enum(MediaStatus),
  thumbnailUrl: z.url(),
  cardUrl: z.url(),
  fullUrl: z.url(),
  /** Absent until the derivative worker has looked at the image. */
  blurhash: z.string().nullable(),
  width: z.number().int().min(1).nullable(),
  height: z.number().int().min(1).nullable(),
  sortOrder: z.number().int(),
  isCover: z.boolean(),
});

export class MediaAssetDto extends createZodDto(mediaAssetSchema) {}

export const mediaListSchema = z.object({
  media: z.array(mediaAssetSchema),
});

export class MediaListDto extends createZodDto(mediaListSchema) {}

/**
 * Which listing a request is about: one of the property's rooms, or the property
 * itself when the room is absent. Every media route carries it, because a photo
 * of the property and a photo of a room are the same resource with different
 * owners rather than two resources.
 */
const owner = {
  roomId: z.uuid().nullable(),
};

export const mediaQuerySchema = z.object({
  /** Omitted means the property's own gallery, not "every photo". */
  roomId: z.uuid().optional(),
});

export class MediaQueryDto extends createZodDto(mediaQuerySchema) {}

/**
 * The browser declares what it is about to upload before it uploads it, and the
 * signature it gets back is bound to that type — so type and size are decided
 * here rather than discovered from bytes the API never sees.
 */
export const createUploadSchema = z.object({
  ...owner,
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  byteSize: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export class CreateUploadDto extends createZodDto(createUploadSchema) {}

export const uploadIntentSchema = z.object({
  /** The asset this upload will become, already reserved. */
  mediaId: z.uuid(),
  /** A presigned `PUT`. Short-lived, and only valid for the declared type. */
  uploadUrl: z.url(),
});

export class UploadIntentDto extends createZodDto(uploadIntentSchema) {}

/**
 * The browser knows the pixel dimensions it uploaded; the worker would otherwise
 * be the first thing that does, and the grid needs them to reserve space before
 * derivatives exist.
 */
export const completeUploadSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export class CompleteUploadDto extends createZodDto(completeUploadSchema) {}

/**
 * The complete new order, not a move instruction: the client already holds the
 * whole list, and sending all of it makes the write idempotent and the server's
 * job a single assignment rather than a shuffle it has to reason about.
 */
export const reorderMediaSchema = z.object({
  ...owner,
  mediaIds: z.array(z.uuid()).min(1).max(MAX_PHOTOS_PER_LISTING),
});

export class ReorderMediaDto extends createZodDto(reorderMediaSchema) {}
