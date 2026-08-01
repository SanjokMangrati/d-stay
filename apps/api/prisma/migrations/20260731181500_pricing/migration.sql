-- Rates sit on the room they price. The meal charge sits on the property,
-- because one kitchen cooks for the whole house.
ALTER TABLE "rooms"
  ADD COLUMN "base_rate" INTEGER,
  ADD COLUMN "weekend_rate" INTEGER,
  ADD COLUMN "extra_guest_charge" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "properties"
  ADD COLUMN "meal_charge_per_person" INTEGER NOT NULL DEFAULT 0;

-- Money is integer paise everywhere in this system. A negative amount is a bug,
-- never a discount — discounts are a booking-level override with a reason.
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_rates_not_negative" CHECK (
    ("base_rate" IS NULL OR "base_rate" >= 0)
    AND ("weekend_rate" IS NULL OR "weekend_rate" >= 0)
    AND "extra_guest_charge" >= 0
  );

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_meal_charge_not_negative"
    CHECK ("meal_charge_per_person" >= 0);

-- CreateTable
CREATE TABLE "rate_overrides" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "nightly_rate" INTEGER NOT NULL,
    "min_stay_nights" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_overrides_property_id_start_date_idx"
  ON "rate_overrides"("property_id", "start_date");

-- AddForeignKey
ALTER TABLE "rate_overrides"
  ADD CONSTRAINT "rate_overrides_room_id_property_id_fkey"
  FOREIGN KEY ("room_id", "property_id") REFERENCES "rooms"("id", "property_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rate_overrides"
  ADD CONSTRAINT "rate_overrides_dates_ordered" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "rate_overrides_rate_not_negative" CHECK ("nightly_rate" >= 0),
  ADD CONSTRAINT "rate_overrides_min_stay_positive"
    CHECK ("min_stay_nights" IS NULL OR "min_stay_nights" >= 1);

-- Two overrides covering one night on one room would make the rate depend on
-- which row the query happened to read first. The database refuses the second
-- write instead, which is what keeps rate resolution a total function.
--
-- The range is built in the constraint rather than stored as a generated column:
-- Prisma cannot express either, and an expression leaves no column for it to
-- read as drift.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "rate_overrides"
  ADD CONSTRAINT "rate_overrides_no_overlap" EXCLUDE USING gist (
    "room_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  );
