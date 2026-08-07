-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PHONE', 'WHATSAPP', 'WALK_IN', 'AIRBNB', 'BOOKING_COM', 'MAKEMYTRIP', 'REFERRAL');

-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('OVERRIDE', 'WEEKEND', 'BASE');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "hold_expiry_hours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "room_stays" ADD COLUMN     "booking_id" TEXT;

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "guest_email" TEXT,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "is_whole_property" BOOLEAN NOT NULL DEFAULT false,
    "room_total" INTEGER NOT NULL,
    "extra_guest_total" INTEGER NOT NULL,
    "meal_total" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax_total" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "override_total" INTEGER,
    "override_reason" TEXT,
    "gst_slab_version" TEXT NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_line_items" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "RateSource" NOT NULL,
    "room_charge" INTEGER NOT NULL,
    "extra_guests" INTEGER NOT NULL,
    "extra_guest_charge" INTEGER NOT NULL,
    "meal_charge" INTEGER NOT NULL,
    "tariff" INTEGER NOT NULL,
    "gst_basis_points" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_property_id_check_in_idx" ON "bookings"("property_id", "check_in");

-- CreateIndex
CREATE INDEX "bookings_property_id_status_idx" ON "bookings"("property_id", "status");

-- CreateIndex
CREATE INDEX "bookings_property_id_guest_phone_idx" ON "bookings"("property_id", "guest_phone");

-- CreateIndex
CREATE INDEX "booking_line_items_booking_id_idx" ON "booking_line_items"("booking_id");

-- CreateIndex
CREATE INDEX "room_stays_booking_id_idx" ON "room_stays"("booking_id");

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_line_items" ADD CONSTRAINT "booking_line_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_line_items" ADD CONSTRAINT "booking_line_items_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- What Prisma cannot say. These are the invariants a later write path — human
-- or agent — must not be able to break by forgetting them.
-- ============================================================================

-- The same rule the stays carry: a booking covers at least one night, and the
-- range is half-open, so a departure on the 16th does not hold that night.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_covers_a_night" CHECK ("check_out" > "check_in");

-- Somebody has to be staying. Children may be zero; a booking for nobody is a
-- data-entry slip, not a stay.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_has_a_guest" CHECK ("adults" >= 1 AND "children" >= 0);

-- Money is paise and never negative. A discount is an override total, not a
-- negative line; a refund is a payment row, not a smaller booking.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_totals_are_not_negative" CHECK (
    "room_total" >= 0 AND "extra_guest_total" >= 0 AND "meal_total" >= 0
    AND "subtotal" >= 0 AND "tax_total" >= 0 AND "total" >= 0
    AND ("override_total" IS NULL OR "override_total" >= 0)
  );

-- A negotiated price without its reason is the number nobody can explain in six
-- months. The two are written together or not at all.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_override_carries_a_reason" CHECK (
    ("override_total" IS NULL) = ("override_reason" IS NULL)
  );

-- Only a pencilled-in enquiry expires. A confirmed booking carrying an expiry
-- would be released by the sweep that reads this column.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_only_a_hold_expires" CHECK (
    "status" = 'PENDING' OR "expires_at" IS NULL
  );

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_hold_expiry_is_positive" CHECK ("hold_expiry_hours" > 0);

-- The two kinds of stay are told apart by `kind`, and each carries exactly what
-- belongs to it: a booking's row points at its booking, a block's never does.
-- Without this, a booking row could lose its parent and become an unexplained
-- hold on a room that nothing in the app can remove.
ALTER TABLE "room_stays"
  ADD CONSTRAINT "room_stays_booking_rows_have_a_booking" CHECK (
    ("kind" = 'BOOKING') = ("booking_id" IS NOT NULL)
  );
