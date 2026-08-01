-- A photo can now belong to one of the property's rooms rather than to the
-- property itself.
ALTER TABLE "media_assets" ADD COLUMN "room_id" TEXT;

-- The composite key the photo's foreign key points at: it is what makes
-- "this room belongs to this property" a database guarantee rather than a
-- service check that a later write path could forget.
CREATE UNIQUE INDEX "rooms_id_property_id_key" ON "rooms"("id", "property_id");

CREATE INDEX "media_assets_room_id_sort_order_idx" ON "media_assets"("room_id", "sort_order");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_room_id_property_id_fkey"
  FOREIGN KEY ("room_id", "property_id") REFERENCES "rooms"("id", "property_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- One cover per listing, and a room is its own listing: the property's gallery
-- and each room's gallery each get exactly one.
DROP INDEX "media_assets_one_cover_per_property";

CREATE UNIQUE INDEX "media_assets_one_cover_per_property"
  ON "media_assets" ("property_id")
  WHERE "is_cover" AND "room_id" IS NULL;

CREATE UNIQUE INDEX "media_assets_one_cover_per_room"
  ON "media_assets" ("room_id")
  WHERE "is_cover" AND "room_id" IS NOT NULL;
