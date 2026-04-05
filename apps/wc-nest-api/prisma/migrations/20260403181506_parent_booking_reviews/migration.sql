-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('draft', 'pending', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "review_tag_dimension" AS ENUM ('happiness', 'safety', 'communication');

-- CreateTable
CREATE TABLE "camp_reviews" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "booking_group_id" TEXT,
    "booking_id" TEXT,
    "visit_month" INTEGER,
    "visit_year" INTEGER,
    "kid_count" INTEGER DEFAULT 1,
    "kid_ages" INTEGER[],
    "kid_tags" TEXT[],
    "happiness_rating" INTEGER,
    "safety_rating" INTEGER,
    "communication_rating" INTEGER,
    "as_described_rating" INTEGER,
    "growth_rating" INTEGER,
    "value_rating" INTEGER,
    "review_text" TEXT,
    "photos" TEXT[],
    "return_choice" BOOLEAN,
    "outcomes" TEXT[],
    "status" "review_status" NOT NULL DEFAULT 'draft',
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),

    CONSTRAINT "camp_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_review_tags" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "dimension" "review_tag_dimension" NOT NULL,
    "tag_value" TEXT NOT NULL,

    CONSTRAINT "camp_review_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_review_responses" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "response_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "camp_reviews_booking_id_key" ON "camp_reviews"("booking_id");

-- CreateIndex
CREATE INDEX "camp_reviews_camp_id_idx" ON "camp_reviews"("camp_id");

-- CreateIndex
CREATE INDEX "camp_reviews_parent_id_idx" ON "camp_reviews"("parent_id");

-- CreateIndex
CREATE INDEX "camp_reviews_status_idx" ON "camp_reviews"("status");

-- CreateIndex
CREATE INDEX "camp_reviews_booking_id_idx" ON "camp_reviews"("booking_id");

-- CreateIndex
CREATE INDEX "camp_review_tags_review_id_idx" ON "camp_review_tags"("review_id");

-- CreateIndex
CREATE INDEX "camp_review_tags_dimension_tag_value_idx" ON "camp_review_tags"("dimension", "tag_value");

-- CreateIndex
CREATE UNIQUE INDEX "camp_review_responses_review_id_key" ON "camp_review_responses"("review_id");

-- CreateIndex
CREATE INDEX "camp_review_responses_camp_id_idx" ON "camp_review_responses"("camp_id");

-- AddForeignKey
ALTER TABLE "camp_reviews" ADD CONSTRAINT "camp_reviews_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_reviews" ADD CONSTRAINT "camp_reviews_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_reviews" ADD CONSTRAINT "camp_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_reviews" ADD CONSTRAINT "camp_reviews_booking_group_id_fkey" FOREIGN KEY ("booking_group_id") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_review_tags" ADD CONSTRAINT "camp_review_tags_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "camp_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_review_responses" ADD CONSTRAINT "camp_review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "camp_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_review_responses" ADD CONSTRAINT "camp_review_responses_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_review_responses" ADD CONSTRAINT "camp_review_responses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_review_responses" ADD CONSTRAINT "camp_review_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
