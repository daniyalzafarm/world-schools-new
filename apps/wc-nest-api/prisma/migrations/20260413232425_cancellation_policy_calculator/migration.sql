-- AlterTable
ALTER TABLE "provider_settings" ADD COLUMN     "cancellation_policy_agreed_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_policy_special_circumstances" JSONB;
