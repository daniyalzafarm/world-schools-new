-- AlterTable
ALTER TABLE "children" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "camp_preferences" JSONB,
ADD COLUMN     "emergency_contacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "medical_info" JSONB,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "profile_completion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "school_year" TEXT,
ALTER COLUMN "last_name" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "children_archived_idx" ON "children"("archived");

-- Data Migration: Transform existing child records from school-focused to camp-focused model
-- This migration maps old fields to new JSONB structures

-- Step 1: Migrate special needs to medical info
UPDATE "children"
SET "medical_info" = jsonb_build_object(
  'allergies', '[]'::jsonb,
  'dietaryRequirements', '[]'::jsonb,
  'specialNeeds', COALESCE("special_needs_notes", '')
)
WHERE "special_needs_notes" IS NOT NULL AND "special_needs_notes" != '';

-- Step 2: Migrate interests to camp preferences
UPDATE "children"
SET "camp_preferences" = jsonb_build_object(
  'interests', COALESCE(
    (SELECT jsonb_agg(interest) FROM unnest("interests") AS interest),
    '[]'::jsonb
  ),
  'languagesSpoken', COALESCE(
    (SELECT jsonb_agg(lang) FROM unnest("languages") AS lang),
    '["English"]'::jsonb
  )
)
WHERE array_length("interests", 1) > 0 OR array_length("languages", 1) > 0;

-- Step 3: Calculate initial profile completion for all existing children
-- Formula: Basic (30%) + Medical (20%) + Emergency (25%) + Preferences (15%) + Photo (10%)
UPDATE "children"
SET "profile_completion" = (
  -- Basic info (30%): firstName, dateOfBirth, gender
  CASE WHEN "first_name" IS NOT NULL AND "date_of_birth" IS NOT NULL AND "gender" IS NOT NULL THEN 30 ELSE 0 END +

  -- Medical info (20%): has medical_info with any data
  CASE WHEN "medical_info" IS NOT NULL AND "medical_info" != '{}'::jsonb THEN 20 ELSE 0 END +

  -- Emergency contacts (25%): has at least 1 contact (currently 0 for all)
  CASE WHEN jsonb_array_length("emergency_contacts") >= 1 THEN 25 ELSE 0 END +

  -- Preferences (15%): has camp_preferences with interests
  CASE WHEN "camp_preferences" IS NOT NULL AND
            "camp_preferences"->>'interests' IS NOT NULL AND
            jsonb_array_length("camp_preferences"->'interests') > 0 THEN 15 ELSE 0 END +

  -- Photo (10%): has photo_url
  CASE WHEN "photo_url" IS NOT NULL THEN 10 ELSE 0 END
);

-- Note: Old fields (nationality, languages, currentGrade, favoriteSubjects, etc.) are kept for now
-- They will be removed in a future migration after a grace period (30 days recommended)
