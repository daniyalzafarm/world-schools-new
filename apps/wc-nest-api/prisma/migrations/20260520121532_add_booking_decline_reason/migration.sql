-- CreateEnum
CREATE TYPE "BookingDeclineReason" AS ENUM ('capacity_or_scheduling', 'eligibility_criteria_not_met', 'operational_inability', 'safeguarding_concerns', 'other');

-- AlterTable
ALTER TABLE "booking_groups" ADD COLUMN     "decline_reason" "BookingDeclineReason",
ADD COLUMN     "decline_reason_other" TEXT;
