/*
  Warnings:

  - You are about to drop the column `profile_photo_url` on the `parents` table. All the data in the column will be lost.

*/

-- Step 1: Add profile_photo_url column to users table
ALTER TABLE "users" ADD COLUMN "profile_photo_url" TEXT;

-- Step 2: Copy existing profile_photo_url values from parents to users
UPDATE "users" u
SET "profile_photo_url" = p."profile_photo_url"
FROM "parents" p
WHERE u."id" = p."user_id"
  AND p."profile_photo_url" IS NOT NULL;

-- Step 3: Drop profile_photo_url column from parents table
ALTER TABLE "parents" DROP COLUMN "profile_photo_url";
