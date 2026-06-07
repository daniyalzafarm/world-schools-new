-- Defense-in-depth: constrain the stringly-typed deposit/cancellation config
-- columns to their allowed value sets at the DB layer (mirrors the
-- class-validator @IsIn on the onboarding DTOs). Kept as String rather than a
-- Postgres enum to avoid enum-migration rigidity; the canonical unions live in
-- @world-schools/wc-types.
--
-- Normalize any legacy 'fixed_amount' deposit-type rows to the canonical
-- 'fixed' before constraining, so the tightened CHECK can't reject existing
-- data. The onboarding API never persisted 'fixed_amount' (the frontend
-- translates it and the DTO @IsIn rejects it), but the superadmin CSV import
-- path is unvalidated, so this scrub is defensive.
UPDATE "provider_settings" SET "deposit_type" = 'fixed' WHERE "deposit_type" = 'fixed_amount';

-- Defensively normalize any other non-canonical deposit_type to NULL ("not set")
-- so the tightened CHECK below can't reject unvalidated CSV-imported rows.
UPDATE "provider_settings"
SET "deposit_type" = NULL
WHERE "deposit_type" IS NOT NULL
  AND "deposit_type" NOT IN ('percentage', 'fixed');

-- Normalize legacy / non-canonical cancellation policies (e.g. 'strict',
-- 'super_strict') to 'moderate' before constraining. resolveTiers() already
-- treats every unknown policy name as MODERATE (cancellation-policy.util.ts),
-- so this preserves existing behavior, and — like the deposit_type scrub above —
-- keeps the tightened CHECK from rejecting rows written via the unvalidated
-- superadmin CSV import path.
UPDATE "provider_settings"
SET "cancellation_policy" = 'moderate'
WHERE "cancellation_policy" IS NOT NULL
  AND "cancellation_policy" NOT IN ('flexible', 'moderate', 'custom');

ALTER TABLE "provider_settings"
  ADD CONSTRAINT "provider_settings_cancellation_policy_check"
  CHECK ("cancellation_policy" IN ('flexible', 'moderate', 'custom'));

ALTER TABLE "provider_settings"
  ADD CONSTRAINT "provider_settings_deposit_type_check"
  CHECK ("deposit_type" IS NULL OR "deposit_type" IN ('percentage', 'fixed'));
