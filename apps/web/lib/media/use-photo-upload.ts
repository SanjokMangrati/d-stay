"use client";

import {
  getMediaListQueryKey,
  mediaCompleteUpload,
  mediaCreateUpload,
} from "@d-stay/api-client/endpoints/media";
import { getPropertiesFindOneQueryKey } from "@d-stay/api-client/endpoints/properties";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { downscaleImage } from "./downscale-image";

/**
 * The three-step upload: the API signs, the browser writes the bytes straight to
 * object storage, and the API is told what landed. Image bytes never pass through
 * the API, which is the only reason a photo upload is affordable at all.
 *
 * Files go one at a time on purpose — a host uploading five photos from a village
 * connection gets them one by one instead of five stalled requests.
 */
export function usePhotoUpload(propertyId: string, roomId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const image = await downscaleImage(file);
        const intent = await mediaCreateUpload(propertyId, {
          roomId,
          contentType: image.contentType,
          byteSize: image.blob.size,
        });

        // The one request in the app that does not go through the generated
        // client: its target is the bucket, and the URL was signed for exactly
        // this method and content type.
        const stored = await fetch(intent.uploadUrl, {
          method: "PUT",
          body: image.blob,
          headers: { "content-type": image.contentType },
        });
        if (!stored.ok) {
          throw new Error(
            `Object storage refused the upload with ${stored.status}.`,
          );
        }

        await mediaCompleteUpload(propertyId, intent.mediaId, {
          width: image.width,
          height: image.height,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getMediaListQueryKey(
          propertyId,
          roomId ? { roomId } : undefined,
        ),
      });
      // A first photo of the property is what clears `photos` from the
      // completeness checklist; a room's photos are on no checklist.
      if (!roomId) {
        await queryClient.invalidateQueries({
          queryKey: getPropertiesFindOneQueryKey(propertyId),
        });
      }
    },
  });
}
