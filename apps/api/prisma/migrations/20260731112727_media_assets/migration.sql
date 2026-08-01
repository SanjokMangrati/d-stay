-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "sort_order" INTEGER NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_property_id_sort_order_idx" ON "media_assets"("property_id", "sort_order");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One cover per property, enforced here rather than by the service: setting a
-- cover is two writes (clear the old, set the new) and a crash between them
-- must not be able to leave a listing with two.
CREATE UNIQUE INDEX "media_assets_one_cover_per_property"
  ON "media_assets" ("property_id")
  WHERE "is_cover";
