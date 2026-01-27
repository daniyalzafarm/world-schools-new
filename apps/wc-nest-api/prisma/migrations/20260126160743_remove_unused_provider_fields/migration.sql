/*
  Warnings:

  - You are about to drop the column `address` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `max_age` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `min_age` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verified` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verified_at` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `postal_code` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `providers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "providers" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "max_age",
DROP COLUMN "min_age",
DROP COLUMN "name",
DROP COLUMN "phone_verified",
DROP COLUMN "phone_verified_at",
DROP COLUMN "postal_code",
DROP COLUMN "state";
