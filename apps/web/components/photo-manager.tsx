"use client";

import {
  getMediaListQueryKey,
  useMediaList,
  useMediaRemove,
  useMediaReorder,
  useMediaSetCover,
} from "@d-stay/api-client/endpoints/media";
import { getPropertiesFindOneQueryKey } from "@d-stay/api-client/endpoints/properties";
import type {
  MediaListDtoOutput,
  MediaListDtoOutputMediaItem,
} from "@d-stay/api-client/models";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImagePlusIcon,
  MoreVerticalIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePhotoUpload } from "@/lib/media/use-photo-upload";

/**
 * One grid for both listings a homestay has photos of: the property, and each of
 * its rooms. They are the same endpoints with a different owner, so they are the
 * same component with a different `roomId` — the alternative was two grids that
 * drift apart the first time one of them gains a feature.
 */
export function PhotoManager({
  propertyId,
  roomId = null,
}: {
  propertyId: string;
  roomId?: string | null;
}) {
  const t = useTranslations("photos");
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const params = roomId ? { roomId } : undefined;
  const { data, isPending, error } = useMediaList(propertyId, params);
  const photos = data?.media ?? [];

  // Every one of these returns the whole list, so the grid is written from the
  // response rather than refetched. The property is invalidated alongside it
  // because deleting its last photo puts `photos` back on the checklist — a
  // room's photos are not on any checklist.
  const onListChanged = async (list: MediaListDtoOutput) => {
    queryClient.setQueryData(getMediaListQueryKey(propertyId, params), list);
    if (!roomId) {
      await queryClient.invalidateQueries({
        queryKey: getPropertiesFindOneQueryKey(propertyId),
      });
    }
  };
  const mutation = { mutation: { onSuccess: onListChanged } };

  const upload = usePhotoUpload(propertyId, roomId);
  const reorder = useMediaReorder(mutation);
  const setCover = useMediaSetCover(mutation);
  const remove = useMediaRemove(mutation);

  const isBusy =
    upload.isPending ||
    reorder.isPending ||
    setCover.isPending ||
    remove.isPending;

  const move = (from: number, to: number) => {
    const order = photos.map((photo) => photo.id);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    reorder.mutate({ propertyId, data: { roomId, mediaIds: order } });
  };

  return (
    <div className="space-y-4">
      {/* The list's own failure is first: without it, a read that never arrives
          is indistinguishable from a listing with no photos in it, and the host
          is told they have nothing when they have everything. */}
      <ApiErrorAlert
        error={
          error ??
          upload.error ??
          reorder.error ??
          setCover.error ??
          remove.error
        }
      />

      {isPending ? (
        <ul className="grid grid-cols-2 gap-3">
          {[0, 1].map((key) => (
            <li
              key={key}
              className="bg-muted aspect-[4/3] animate-pulse rounded-lg"
            />
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <Photo
                photo={photo}
                position={index}
                total={photos.length}
                disabled={isBusy}
                onMove={move}
                onSetCover={() =>
                  setCover.mutate({ propertyId, mediaId: photo.id })
                }
                onRemove={() =>
                  remove.mutate({ propertyId, mediaId: photo.id })
                }
              />
            </li>
          ))}

          {upload.isPending && (
            <li className="bg-muted flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg">
              <span className="text-muted-foreground text-xs">
                {t("uploading")}
              </span>
            </li>
          )}
        </ul>
      )}

      {photos.length === 0 && !isPending && !upload.isPending && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t("empty")}
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = "";
          if (files.length > 0) {
            upload.mutate(files);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="xl"
        className="w-full"
        disabled={isBusy}
        onClick={() => fileInput.current?.click()}
      >
        <ImagePlusIcon aria-hidden />
        {upload.isPending ? t("uploading") : t("add")}
      </Button>
    </div>
  );
}

function Photo({
  photo,
  position,
  total,
  disabled,
  onMove,
  onSetCover,
  onRemove,
}: {
  photo: MediaListDtoOutputMediaItem;
  position: number;
  total: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onSetCover: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("photos");

  return (
    <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
      {/* Not `next/image`: the API already serves three sizes of every photo, so
          a second optimiser in front of them is a proxy hop for nothing — and it
          would mean this app holding a copy of the bucket's hostname. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl}
        alt=""
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        className="h-full w-full object-cover"
      />

      {photo.isCover && (
        <span className="bg-background/90 absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium">
          {t("cover")}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              disabled={disabled}
              aria-label={t("actions")}
              className="absolute right-2 bottom-2"
            />
          }
        >
          <MoreVerticalIcon aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="min-h-11"
            disabled={photo.isCover}
            onClick={onSetCover}
          >
            <StarIcon aria-hidden />
            {t("makeCover")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={position === 0}
            onClick={() => onMove(position, position - 1)}
          >
            <ChevronLeftIcon aria-hidden />
            {t("moveEarlier")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={position === total - 1}
            onClick={() => onMove(position, position + 1)}
          >
            <ChevronRightIcon aria-hidden />
            {t("moveLater")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            variant="destructive"
            onClick={onRemove}
          >
            <Trash2Icon aria-hidden />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
