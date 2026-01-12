-- CreateEnum
CREATE TYPE "CampType" AS ENUM ('day', 'residential');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('provider', 'different');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('coed', 'boys', 'girls');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AddOnType" AS ENUM ('activity', 'service', 'equipment', 'language');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('per_child', 'per_hour', 'per_session', 'per_week', 'per_bag', 'one_time');

-- CreateTable
CREATE TABLE "camps" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "CampType" NOT NULL,
    "description" TEXT NOT NULL,
    "locationType" "LocationType" NOT NULL,
    "location_place_id" TEXT,
    "location_name" TEXT,
    "location_address" TEXT,
    "location_lat" DECIMAL(10,8),
    "location_lng" DECIMAL(11,8),
    "ageGroups" JSONB NOT NULL,
    "languages" TEXT[],
    "gender" "Gender" NOT NULL,
    "activities" TEXT[],
    "photos" JSONB,
    "whatsIncluded" JSONB,
    "dailySchedule" JSONB,
    "meals" JSONB,
    "sportsActivities" JSONB,
    "languagePrograms" JSONB,
    "artsAndCrafts" JSONB,
    "adventureActivities" JSONB,
    "waterActivities" JSONB,
    "environmentalActivities" JSONB,
    "academics" JSONB,
    "religionPrograms" JSONB,
    "excursionsTrips" JSONB,
    "campusFacilities" JSONB,
    "accommodation" JSONB,
    "gettingThere" JSONB,
    "campFocus" JSONB,
    "status" "CampStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "add_ons" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(10),
    "type" "AddOnType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CHF',
    "pricingUnit" "PricingUnit" NOT NULL,
    "max_quantity" INTEGER,
    "quantity_unit" VARCHAR(50),
    "min_age" INTEGER,
    "max_age" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_add_ons" (
    "camp_id" TEXT NOT NULL,
    "add_on_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_add_ons_pkey" PRIMARY KEY ("camp_id","add_on_id")
);

-- CreateIndex
CREATE INDEX "camps_provider_id_idx" ON "camps"("provider_id");

-- CreateIndex
CREATE INDEX "camps_status_idx" ON "camps"("status");

-- CreateIndex
CREATE INDEX "add_ons_provider_id_idx" ON "add_ons"("provider_id");

-- CreateIndex
CREATE INDEX "add_ons_type_idx" ON "add_ons"("type");

-- CreateIndex
CREATE INDEX "add_ons_is_active_idx" ON "add_ons"("is_active");

-- CreateIndex
CREATE INDEX "add_ons_sort_order_idx" ON "add_ons"("sort_order");

-- CreateIndex
CREATE INDEX "camp_add_ons_camp_id_idx" ON "camp_add_ons"("camp_id");

-- CreateIndex
CREATE INDEX "camp_add_ons_add_on_id_idx" ON "camp_add_ons"("add_on_id");

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_ons" ADD CONSTRAINT "add_ons_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_add_ons" ADD CONSTRAINT "camp_add_ons_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_add_ons" ADD CONSTRAINT "camp_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
