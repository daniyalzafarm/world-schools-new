-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'under_review', 'info_requested', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_reupload');

-- CreateEnum
CREATE TYPE "CampType" AS ENUM ('day', 'residential');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('provider', 'different');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('coed', 'boys', 'girls');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('flexible', 'fixed');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partial', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "AddOnType" AS ENUM ('activity', 'service', 'equipment', 'language');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('per_child', 'per_hour', 'per_session', 'per_week', 'per_bag', 'one_time');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "auth_provider" TEXT NOT NULL,
    "auth_provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "legal_company_name" TEXT,
    "legal_street_address" TEXT,
    "legal_apt_suite" TEXT,
    "legal_city" TEXT,
    "legal_state_province" TEXT,
    "legal_postal_code" TEXT,
    "legal_country" TEXT,
    "year_founded" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contact_first_name" TEXT,
    "contact_last_name" TEXT,
    "contact_role" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "description" TEXT,
    "camp_type" TEXT,
    "trust_score" INTEGER,
    "trust_score_breakdown" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "approval_decision_at" TIMESTAMP(3),
    "approved_by_admin_id" TEXT,
    "rejection_reason" TEXT,
    "rejection_category" TEXT,
    "application_submitted_at" TIMESTAMP(3),
    "application_reviewed_at" TIMESTAMP(3),
    "application_reviewed_by" TEXT,
    "onboarding_started_at" TIMESTAMP(3),
    "onboarding_completed_at" TIMESTAMP(3),
    "onboarding_current_step" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "terms_accepted_at" TIMESTAMP(3),
    "terms_version" TEXT,
    "provider_agreement_accepted_at" TIMESTAMP(3),
    "provider_agreement_version" TEXT,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "nationality" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_grade" TEXT,
    "favorite_subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "learning_style" TEXT,
    "languages_of_instruction" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interested_in_boarding" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_schedule" TEXT,
    "special_needs_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "special_needs_support_needs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "special_needs_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "parent_id" TEXT NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

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
    "custom_title" TEXT,
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

-- CreateTable
CREATE TABLE "camps" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
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
    "session_type" "SessionType",
    "whatsIncluded" JSONB,
    "scheduleType" TEXT,
    "dailySchedule" JSONB,
    "weeklySchedule" JSONB,
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
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "type" "SessionType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "blackout_dates" JSONB,
    "base_price_per_day" DECIMAL(10,2),
    "require_consecutive_days" BOOLEAN DEFAULT false,
    "min_days_limit" INTEGER,
    "max_days_limit" INTEGER,
    "available_days_of_week" JSONB,
    "specific_start_days" JSONB,
    "discount_tiers" JSONB,
    "day_of_week_pricing" JSONB,
    "age_range" JSONB,
    "unlimited_capacity" BOOLEAN DEFAULT false,
    "boys_capacity" INTEGER,
    "girls_capacity" INTEGER,
    "separate_gender_capacity" BOOLEAN DEFAULT false,
    "session_start_date" TIMESTAMP(3),
    "session_end_date" TIMESTAMP(3),
    "price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "duration" JSONB,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(10,2),
    "add_ons" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_accounts_user_id_idx" ON "user_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_auth_provider_auth_provider_account_id_key" ON "user_accounts"("auth_provider", "auth_provider_account_id");

-- CreateIndex
CREATE INDEX "roles_provider_id_idx" ON "roles"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_provider_id_key" ON "roles"("name", "provider_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "providers_owner_id_key" ON "providers"("owner_id");

-- CreateIndex
CREATE INDEX "providers_owner_id_idx" ON "providers"("owner_id");

-- CreateIndex
CREATE INDEX "providers_approval_status_idx" ON "providers"("approval_status");

-- CreateIndex
CREATE INDEX "providers_approved_by_admin_id_idx" ON "providers"("approved_by_admin_id");

-- CreateIndex
CREATE INDEX "providers_application_reviewed_by_idx" ON "providers"("application_reviewed_by");

-- CreateIndex
CREATE UNIQUE INDEX "parents_user_id_key" ON "parents"("user_id");

-- CreateIndex
CREATE INDEX "parents_user_id_idx" ON "parents"("user_id");

-- CreateIndex
CREATE INDEX "children_parent_id_idx" ON "children"("parent_id");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- CreateIndex
CREATE INDEX "email_verifications_code_idx" ON "email_verifications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

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
CREATE UNIQUE INDEX "camps_slug_key" ON "camps"("slug");

-- CreateIndex
CREATE INDEX "camps_provider_id_idx" ON "camps"("provider_id");

-- CreateIndex
CREATE INDEX "camps_status_idx" ON "camps"("status");

-- CreateIndex
CREATE INDEX "camps_session_type_idx" ON "camps"("session_type");

-- CreateIndex
CREATE INDEX "camps_slug_idx" ON "camps"("slug");

-- CreateIndex
CREATE INDEX "sessions_camp_id_idx" ON "sessions"("camp_id");

-- CreateIndex
CREATE INDEX "sessions_type_idx" ON "sessions"("type");

-- CreateIndex
CREATE INDEX "sessions_is_active_idx" ON "sessions"("is_active");

-- CreateIndex
CREATE INDEX "sessions_sort_order_idx" ON "sessions"("sort_order");

-- CreateIndex
CREATE INDEX "bookings_session_id_idx" ON "bookings"("session_id");

-- CreateIndex
CREATE INDEX "bookings_camp_id_idx" ON "bookings"("camp_id");

-- CreateIndex
CREATE INDEX "bookings_parent_id_idx" ON "bookings"("parent_id");

-- CreateIndex
CREATE INDEX "bookings_child_id_idx" ON "bookings"("child_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");

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
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_application_reviewed_by_fkey" FOREIGN KEY ("application_reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_business_profiles" ADD CONSTRAINT "google_business_profiles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_ons" ADD CONSTRAINT "add_ons_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_add_ons" ADD CONSTRAINT "camp_add_ons_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_add_ons" ADD CONSTRAINT "camp_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
