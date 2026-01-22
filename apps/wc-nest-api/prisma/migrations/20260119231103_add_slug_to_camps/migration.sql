/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `camps` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `camps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Step 1: Add slug column as nullable first
ALTER TABLE "camps" ADD COLUMN "slug" VARCHAR(150);

-- Step 2: Generate slugs for existing camps from their names
-- Convert to lowercase, replace spaces with hyphens, remove special characters
UPDATE "camps"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE "slug" IS NULL;

-- Step 3: Handle potential duplicates by appending the first 8 chars of id
UPDATE "camps" c1
SET "slug" = c1."slug" || '-' || SUBSTRING(c1.id, 1, 8)
WHERE EXISTS (
  SELECT 1 FROM "camps" c2
  WHERE c2."slug" = c1."slug"
  AND c2.id < c1.id
);

-- Step 4: Make slug NOT NULL
ALTER TABLE "camps" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "camps_slug_key" ON "camps"("slug");

-- CreateIndex
CREATE INDEX "camps_slug_idx" ON "camps"("slug");
