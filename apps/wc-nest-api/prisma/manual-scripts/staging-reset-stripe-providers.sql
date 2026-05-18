-- =============================================================================
-- One-time staging reset for the Direct Charges cutover
-- =============================================================================
--
-- Run this ONCE on staging after deploying the
-- `feat/direct-charges-stripe-implementation` branch and applying the
-- `direct_charges_payments_billing` migration. NEVER run on production.
--
-- Why: existing staging providers were onboarded with
--   `controller.stripe_dashboard.type = 'express'` (Stripe Express dashboard).
-- The new code creates accounts with `type = 'full'` (full Stripe Dashboard).
-- The two configurations can't be flipped on an existing Stripe account, so
-- the simplest path is to delete the sandbox Stripe accounts and clear the
-- DB Stripe-account fields on each `providers` row. Each provider then re-
-- onboards through `/onboarding/stripe-connect` and a new `full`-dashboard
-- account is minted.
--
-- Before running this SQL:
--   1. In the Stripe sandbox dashboard, delete every connected account this
--      staging environment created (Connect → Accounts → ⋯ → Delete).
--      Or use the Stripe CLI: `stripe accounts delete acct_XXX --confirm`.
--   2. Communicate the reset to anyone testing on staging so they know to
--      re-onboard their provider after logging in.
--
-- After running this SQL:
--   - Providers see the onboarding wizard again on their next login.
--   - Completing it produces a `full` Stripe Dashboard account with platform
--     controls (fees/losses still payer=application).
--
-- Safety: idempotent — running twice on the same DB is a no-op (the WHERE
--   clauses filter to rows that still reference an existing Stripe account).
-- =============================================================================

BEGIN;

-- Drop the per-(parent, provider) Stripe customers tied to the about-to-be-
-- cleared connected accounts. The `ProviderConnectCustomer.stripeAccountId`
-- field is denormalized at create time and is NOT auto-updated when the
-- provider's `stripeAccountId` changes — so without this DELETE, a
-- re-onboarded provider's first booking returns the stale `ProviderConnectCustomer`
-- row via `findUnique({where:{parentId_providerId}})`, the code reuses the
-- now-deleted `stripeAccountId`, and the Stripe call fails with
-- `resource_missing`.
--
-- Cascade: `SavedPaymentMethod.providerConnectCustomerId` has `onDelete: Cascade`,
-- so the saved-card display rows fall away with the customer. Run BEFORE the
-- providers UPDATE so the FK reads stay consistent.
DELETE FROM provider_connect_customers
WHERE provider_id IN (
  SELECT id FROM providers WHERE stripe_account_id IS NOT NULL
);

-- Clear all Stripe-Connect snapshot fields on `providers`. We do NOT touch
-- `approval_status`, `onboarding_*`, `terms_accepted_at`, or any other
-- non-Stripe lifecycle field — those represent business state independent of
-- the Stripe-side identity.
UPDATE providers
SET
  stripe_account_id              = NULL,
  stripe_onboarding_completed    = false,
  stripe_onboarding_completed_at = NULL,
  stripe_onboarding_skipped_at   = NULL,
  stripe_charges_enabled         = false,
  stripe_payouts_enabled         = false,
  stripe_details_submitted       = false,
  stripe_attention_required      = false,
  updated_at                     = NOW()
WHERE stripe_account_id IS NOT NULL;

-- Sanity report — how many providers were reset and how many connect-customers
-- were dropped. Surfaces in psql/CI output.
SELECT count(*) AS providers_reset
FROM providers
WHERE stripe_account_id IS NULL
  AND stripe_onboarding_completed = false;

SELECT count(*) AS connect_customers_remaining
FROM provider_connect_customers;

COMMIT;
