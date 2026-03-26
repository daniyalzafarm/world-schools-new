-- Add draft status for booking group pre-submit state
ALTER TYPE "BookingGroupStatus" ADD VALUE IF NOT EXISTS 'draft';
