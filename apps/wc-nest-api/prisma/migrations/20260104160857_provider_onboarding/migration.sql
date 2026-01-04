-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'under_review', 'info_requested', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_reupload');

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "application_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "application_reviewed_by" TEXT,
ADD COLUMN     "application_submitted_at" TIMESTAMP(3),
ADD COLUMN     "approval_decision_at" TIMESTAMP(3),
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "approved_by_admin_id" TEXT,
ADD COLUMN     "camp_type" TEXT,
ADD COLUMN     "contact_first_name" TEXT,
ADD COLUMN     "contact_last_name" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "contact_phone_country_code" TEXT,
ADD COLUMN     "contact_role" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "legal_apt_suite" TEXT,
ADD COLUMN     "legal_city" TEXT,
ADD COLUMN     "legal_company_name" TEXT,
ADD COLUMN     "legal_country" TEXT,
ADD COLUMN     "legal_postal_code" TEXT,
ADD COLUMN     "legal_state_province" TEXT,
ADD COLUMN     "legal_street_address" TEXT,
ADD COLUMN     "max_age" INTEGER,
ADD COLUMN     "min_age" INTEGER,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_current_step" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "onboarding_started_at" TIMESTAMP(3),
ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ADD COLUMN     "provider_agreement_accepted_at" TIMESTAMP(3),
ADD COLUMN     "provider_agreement_version" TEXT,
ADD COLUMN     "rejection_category" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "terms_version" TEXT,
ADD COLUMN     "trust_score" INTEGER,
ADD COLUMN     "trust_score_breakdown" JSONB,
ADD COLUMN     "year_founded" INTEGER;

-- CreateTable
CREATE TABLE "google_business_profiles" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "formatted_address" TEXT NOT NULL,
    "street_number" TEXT,
    "street_name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "rating" DECIMAL(2,1),
    "reviews_count" INTEGER,
    "phone" TEXT,
    "website" TEXT,
    "photos" JSONB,
    "types" JSONB,
    "data_raw" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_settings" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "deposit_required" BOOLEAN NOT NULL DEFAULT false,
    "deposit_type" TEXT,
    "deposit_percentage" INTEGER,
    "deposit_fixed_amount" DECIMAL(10,2),
    "cancellation_policy" TEXT NOT NULL DEFAULT 'moderate',
    "cancellation_policy_custom" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "review_status" "DocumentReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_admin_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_checklist" JSONB,
    "review_notes" TEXT,
    "rejection_reason" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_business_profiles_provider_id_key" ON "google_business_profiles"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_business_profiles_place_id_key" ON "google_business_profiles"("place_id");

-- CreateIndex
CREATE INDEX "google_business_profiles_place_id_idx" ON "google_business_profiles"("place_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_settings_provider_id_key" ON "provider_settings"("provider_id");

-- CreateIndex
CREATE INDEX "verification_documents_provider_id_idx" ON "verification_documents"("provider_id");

-- CreateIndex
CREATE INDEX "verification_documents_document_type_idx" ON "verification_documents"("document_type");

-- CreateIndex
CREATE INDEX "providers_approval_status_idx" ON "providers"("approval_status");

-- CreateIndex
CREATE INDEX "providers_approved_by_admin_id_idx" ON "providers"("approved_by_admin_id");

-- CreateIndex
CREATE INDEX "providers_application_reviewed_by_idx" ON "providers"("application_reviewed_by");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_application_reviewed_by_fkey" FOREIGN KEY ("application_reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_business_profiles" ADD CONSTRAINT "google_business_profiles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
