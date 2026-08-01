-- CreateEnum
CREATE TYPE "RoomAmenity" AS ENUM ('ATTACHED_BATHROOM', 'BALCONY', 'HEATER', 'AIR_CONDITIONING');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "double_beds" INTEGER NOT NULL DEFAULT 0,
    "single_beds" INTEGER NOT NULL DEFAULT 0,
    "extra_mattresses" INTEGER NOT NULL DEFAULT 0,
    "standard_occupancy" INTEGER NOT NULL,
    "max_occupancy" INTEGER NOT NULL,
    "amenities" "RoomAmenity"[],
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_property_id_sort_order_idx" ON "rooms"("property_id", "sort_order");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Occupancy is what the quote and the availability check both read, so the
-- shapes they cannot handle are refused here rather than trusted from the edge.
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_occupancy_positive" CHECK ("standard_occupancy" >= 1),
  ADD CONSTRAINT "rooms_max_occupancy_not_below_standard"
    CHECK ("max_occupancy" >= "standard_occupancy"),
  ADD CONSTRAINT "rooms_beds_not_negative"
    CHECK ("double_beds" >= 0 AND "single_beds" >= 0 AND "extra_mattresses" >= 0);
