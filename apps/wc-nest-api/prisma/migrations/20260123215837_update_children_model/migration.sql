/*
  Warnings:

  - You are about to drop the column `grade` on the `children` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "children" DROP COLUMN "grade",
ADD COLUMN     "current_grade" TEXT,
ADD COLUMN     "favorite_subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "interested_in_boarding" TEXT,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages_of_instruction" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "learning_style" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "preferred_schedule" TEXT,
ADD COLUMN     "special_needs_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "special_needs_notes" TEXT,
ADD COLUMN     "special_needs_support_needs" TEXT[] DEFAULT ARRAY[]::TEXT[];
