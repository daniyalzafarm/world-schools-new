-- Strict is now a locked, selectable named cancellation policy (Alex, 2026-06-17):
-- 100% refund until 90 days before, 50% until 60 days, 0% after. Widen the
-- `provider_settings.cancellation_policy` CHECK to include 'strict' so providers
-- can save it (without this, the DB rejects a Strict selection).
--
-- The column stays a plain String — the canonical union lives in
-- @world-schools/wc-types and Prisma does not model CHECK constraints, so this is
-- a hand-authored raw-SQL migration mirroring
-- 20260604133046_provider_settings_policy_check_constraints. No data scrub is
-- needed: that earlier migration already normalized any legacy 'strict' rows to
-- 'moderate', and there are no production providers.

ALTER TABLE "provider_settings"
  DROP CONSTRAINT IF EXISTS "provider_settings_cancellation_policy_check";

ALTER TABLE "provider_settings"
  ADD CONSTRAINT "provider_settings_cancellation_policy_check"
  CHECK ("cancellation_policy" IN ('flexible', 'moderate', 'strict', 'custom'));
