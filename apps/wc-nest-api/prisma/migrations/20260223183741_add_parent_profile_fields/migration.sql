-- AlterTable
ALTER TABLE "parents" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primary_nationality" TEXT,
ADD COLUMN     "profile_photo_url" TEXT,
ADD COLUMN     "secondary_nationality" TEXT;
