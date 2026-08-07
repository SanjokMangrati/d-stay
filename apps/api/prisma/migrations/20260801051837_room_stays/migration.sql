-- CreateEnum
CREATE TYPE "StayKind" AS ENUM ('BOOKING', 'BLOCK');

-- CreateTable
CREATE TABLE "room_stays" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "kind" "StayKind" NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "reason" TEXT,
    "occupies" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "room_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_stays_property_id_check_in_idx" ON "room_stays"("property_id", "check_in");

-- CreateIndex
CREATE INDEX "room_stays_room_id_check_in_idx" ON "room_stays"("room_id", "check_in");

-- AddForeignKey
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_room_id_property_id_fkey" FOREIGN KEY ("room_id", "property_id") REFERENCES "rooms"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A stay covers at least one night. A zero-length range would satisfy the
-- exclusion constraint against everything, because an empty daterange overlaps
-- nothing — so the row that means nothing is refused at the door.
ALTER TABLE "room_stays"
  ADD CONSTRAINT "room_stays_covers_a_night" CHECK ("check_out" > "check_in");

-- A block is what a host writes a reason on; a booking's guest is its label.
ALTER TABLE "room_stays"
  ADD CONSTRAINT "room_stays_reason_is_for_blocks"
    CHECK ("kind" = 'BLOCK' OR "reason" IS NULL);

-- ============================================================================
-- The guarantee.
--
-- Double-booking is the failure that makes a host abandon this product and
-- never trust it again, so it is prevented by PostgreSQL rather than by
-- application code — including by application code nobody has written yet, in a
-- guest app that will reach this table by a path no one has thought of.
--
-- Ranges are half-open, `[check_in, check_out)`, which is what makes same-day
-- turnover legal by construction: `[10,12)` and `[12,14)` do not overlap.
--
-- The range is built in the constraint rather than stored as a generated
-- column, matching `rate_overrides_no_overlap`: Prisma can express neither, and
-- an expression leaves no column behind for it to read as schema drift. The
-- GiST index the constraint creates is on that same expression, so range
-- queries against it are still indexed.
--
-- `occupies` is the predicate, not `kind`: a cancelled booking keeps its row and
-- releases its dates. Any future status or stay kind that changes what
-- "occupies" means must change this predicate in the same migration.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "room_stays"
  ADD CONSTRAINT "room_stays_no_overlap" EXCLUDE USING gist (
    "room_id" WITH =,
    daterange("check_in", "check_out", '[)') WITH &&
  ) WHERE ("occupies");
