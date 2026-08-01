-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('ROOM_ONLY', 'BREAKFAST', 'BREAKFAST_DINNER', 'ALL_MEALS');

-- CreateEnum
CREATE TYPE "PropertyAmenity" AS ENUM ('PARKING', 'HOT_WATER', 'WIFI', 'GENERATOR', 'BONFIRE', 'PETS_ALLOWED');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "amenities" "PropertyAmenity"[],
ADD COLUMN     "check_in_time" VARCHAR(5),
ADD COLUMN     "check_out_time" VARCHAR(5),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "directions" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "gst_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "homestay_registration_number" TEXT,
ADD COLUMN     "house_rules" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "meal_plan" "MealPlan",
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- Constraints Prisma cannot express. The API validates these at the edge too;
-- these exist so a later write path that forgets cannot store a broken pin or a
-- time no clock can show.
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_coordinates_paired" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
  ),
  ADD CONSTRAINT "properties_latitude_range" CHECK (
    "latitude" IS NULL OR "latitude" BETWEEN -90 AND 90
  ),
  ADD CONSTRAINT "properties_longitude_range" CHECK (
    "longitude" IS NULL OR "longitude" BETWEEN -180 AND 180
  ),
  ADD CONSTRAINT "properties_check_in_time_format" CHECK (
    "check_in_time" IS NULL OR "check_in_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  ADD CONSTRAINT "properties_check_out_time_format" CHECK (
    "check_out_time" IS NULL OR "check_out_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
