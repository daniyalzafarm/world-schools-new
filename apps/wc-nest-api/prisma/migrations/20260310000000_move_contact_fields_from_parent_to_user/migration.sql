/*
  Migration: Move general user contact fields from Parent to User model.
  Fields: phone, phone_verified, address, city, state, postal_code, country
*/

-- Step 1: Add columns to users table
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "city" TEXT;
ALTER TABLE "users" ADD COLUMN "state" TEXT;
ALTER TABLE "users" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "users" ADD COLUMN "country" TEXT;

-- Step 2: Copy existing values from parents to users
UPDATE "users" u
SET
  "phone" = p."phone",
  "phone_verified" = p."phone_verified",
  "address" = p."address",
  "city" = p."city",
  "state" = p."state",
  "postal_code" = p."postal_code",
  "country" = p."country"
FROM "parents" p
WHERE u."id" = p."user_id";

-- Step 3: Drop columns from parents table
ALTER TABLE "parents" DROP COLUMN "phone";
ALTER TABLE "parents" DROP COLUMN "phone_verified";
ALTER TABLE "parents" DROP COLUMN "address";
ALTER TABLE "parents" DROP COLUMN "city";
ALTER TABLE "parents" DROP COLUMN "state";
ALTER TABLE "parents" DROP COLUMN "postal_code";
ALTER TABLE "parents" DROP COLUMN "country";
