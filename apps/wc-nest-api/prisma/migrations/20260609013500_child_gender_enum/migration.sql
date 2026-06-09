-- CreateEnum
CREATE TYPE "ChildGender" AS ENUM ('boy', 'girl');

-- Retire removed child gender options (e.g. 'non_binary', 'prefer_not_to_say')
-- before the type conversion. Parents will be re-prompted to re-select on their
-- next profile visit. Production has no data, so this is a no-op there.
UPDATE "children"
SET "gender" = NULL
WHERE "gender" IS NOT NULL
  AND "gender" NOT IN ('boy', 'girl');

-- AlterTable: convert the free-text column to the ChildGender enum, preserving the
-- remaining valid 'boy' / 'girl' values.
ALTER TABLE "children"
  ALTER COLUMN "gender" TYPE "ChildGender" USING ("gender"::text::"ChildGender");
