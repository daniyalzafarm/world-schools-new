/*
  Warnings:

  - You are about to drop the column `current_grade` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_subjects` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `interested_in_boarding` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `interests` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `languages_of_instruction` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `learning_style` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `nationality` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_schedule` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `special_needs_areas` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `special_needs_notes` on the `children` table. All the data in the column will be lost.
  - You are about to drop the column `special_needs_support_needs` on the `children` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "children" DROP COLUMN "current_grade",
DROP COLUMN "favorite_subjects",
DROP COLUMN "interested_in_boarding",
DROP COLUMN "interests",
DROP COLUMN "languages_of_instruction",
DROP COLUMN "learning_style",
DROP COLUMN "nationality",
DROP COLUMN "preferred_schedule",
DROP COLUMN "special_needs_areas",
DROP COLUMN "special_needs_notes",
DROP COLUMN "special_needs_support_needs";
