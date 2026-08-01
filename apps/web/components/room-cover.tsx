import type { RoomListDtoOutputRoomsItem } from "@d-stay/api-client/models";
import { ImageIcon } from "lucide-react";

/**
 * A room's cover at thumbnail size, wherever a room is listed. A room that has
 * photos should look like it — an all-text card reads as if the upload never
 * happened — and a room with none gets a placeholder rather than a gap, so
 * "nothing uploaded" and "failed to load" are not the same picture.
 */
export function RoomCover({ room }: { room: RoomListDtoOutputRoomsItem }) {
  if (!room.coverThumbnailUrl) {
    return (
      <div className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-md">
        <ImageIcon className="size-5" aria-hidden />
      </div>
    );
  }

  return (
    // The API already serves a thumbnail derivative; see `PhotoManager`.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={room.coverThumbnailUrl}
      alt=""
      className="bg-muted size-16 shrink-0 rounded-md object-cover"
    />
  );
}
