-- CreateEnum
CREATE TYPE "ActivityCategoryStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityScaleVisualType" AS ENUM ('DOT', 'GRID');

-- CreateEnum
CREATE TYPE "ActivityScaleColorKey" AS ENUM ('PURPLE', 'TEAL', 'AMBER');

-- CreateEnum
CREATE TYPE "EligibilityMode" AS ENUM ('INFO', 'GATE');

-- CreateTable
CREATE TABLE "activity_categories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "emoji" VARCHAR(8),
    "status" "ActivityCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "surface_parent_interests" BOOLEAN NOT NULL DEFAULT true,
    "surface_camp_focus" BOOLEAN NOT NULL DEFAULT true,
    "surface_camp_interests" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "emoji" VARCHAR(8),
    "scale_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_scales" (
    "id" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "visual_type" "ActivityScaleVisualType" NOT NULL DEFAULT 'DOT',
    "color_key" "ActivityScaleColorKey" NOT NULL DEFAULT 'PURPLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_scale_levels" (
    "id" TEXT NOT NULL,
    "scale_id" TEXT NOT NULL,
    "value" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "activity_scale_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_interests" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "specific_activity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_skills" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "level_value" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_focus" (
    "camp_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,

    CONSTRAINT "camp_focus_pkey" PRIMARY KEY ("camp_id")
);

-- CreateTable
CREATE TABLE "camp_interests" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "specific_activity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_eligibility_requirements" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "mode" "EligibilityMode" NOT NULL DEFAULT 'INFO',
    "minimum_level_value" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_eligibility_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_categories_slug_key" ON "activity_categories"("slug");

-- CreateIndex
CREATE INDEX "activity_categories_status_order_idx" ON "activity_categories"("status", "order");

-- CreateIndex
CREATE INDEX "activities_category_id_idx" ON "activities"("category_id");

-- CreateIndex
CREATE INDEX "activities_scale_id_idx" ON "activities"("scale_id");

-- CreateIndex
CREATE INDEX "activities_is_active_idx" ON "activities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "activities_category_id_slug_key" ON "activities"("category_id", "slug");

-- CreateIndex
CREATE INDEX "activity_scale_levels_scale_id_order_idx" ON "activity_scale_levels"("scale_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "activity_scale_levels_scale_id_value_key" ON "activity_scale_levels"("scale_id", "value");

-- CreateIndex
CREATE INDEX "child_interests_child_id_idx" ON "child_interests"("child_id");

-- CreateIndex
CREATE INDEX "child_interests_category_id_idx" ON "child_interests"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_interests_child_id_category_id_key" ON "child_interests"("child_id", "category_id");

-- CreateIndex
CREATE INDEX "child_skills_child_id_idx" ON "child_skills"("child_id");

-- CreateIndex
CREATE INDEX "child_skills_activity_id_idx" ON "child_skills"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_skills_child_id_activity_id_key" ON "child_skills"("child_id", "activity_id");

-- CreateIndex
CREATE INDEX "camp_focus_category_id_idx" ON "camp_focus"("category_id");

-- CreateIndex
CREATE INDEX "camp_focus_activity_id_idx" ON "camp_focus"("activity_id");

-- CreateIndex
CREATE INDEX "camp_interests_camp_id_idx" ON "camp_interests"("camp_id");

-- CreateIndex
CREATE INDEX "camp_interests_category_id_idx" ON "camp_interests"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "camp_interests_camp_id_category_id_key" ON "camp_interests"("camp_id", "category_id");

-- CreateIndex
CREATE INDEX "camp_eligibility_requirements_camp_id_idx" ON "camp_eligibility_requirements"("camp_id");

-- CreateIndex
CREATE INDEX "camp_eligibility_requirements_activity_id_idx" ON "camp_eligibility_requirements"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "camp_eligibility_requirements_camp_id_activity_id_key" ON "camp_eligibility_requirements"("camp_id", "activity_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "activity_scales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_scale_levels" ADD CONSTRAINT "activity_scale_levels_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "activity_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_interests" ADD CONSTRAINT "child_interests_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_interests" ADD CONSTRAINT "child_interests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_skills" ADD CONSTRAINT "child_skills_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_skills" ADD CONSTRAINT "child_skills_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_focus" ADD CONSTRAINT "camp_focus_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_focus" ADD CONSTRAINT "camp_focus_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_focus" ADD CONSTRAINT "camp_focus_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_interests" ADD CONSTRAINT "camp_interests_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_interests" ADD CONSTRAINT "camp_interests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_eligibility_requirements" ADD CONSTRAINT "camp_eligibility_requirements_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_eligibility_requirements" ADD CONSTRAINT "camp_eligibility_requirements_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
