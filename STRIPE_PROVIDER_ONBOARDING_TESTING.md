# Testing the Stripe provider onboarding flow

End-to-end runbook for validating the Stripe Connect provider onboarding feature against Stripe **test mode**. Targets ~10–15 minutes from a fresh local DB to a fully onboarded test provider with capabilities synced via webhook.

## Overview

**In scope:** Stripe Connect Express account creation, embedded KYC, capability syncing via `account.updated` / `account.application.deauthorized` webhooks.

**Out of scope:** charges, payouts, refunds — there is no payment-flow code on this branch yet.

## Prerequisites

- A Stripe account with **test mode** enabled and Connect turned on (Stripe Dashboard → Connect → Get started).
- The [Stripe CLI](https://docs.stripe.com/stripe-cli) installed locally.
- Local DB migrated:

  ```bash
  npx nx prisma:migrate wc-nest-api
  ```

- All three apps runnable from this monorepo:

  ```bash
  npx nx serve wc-nest-api      # API on :3000
  npx nx dev wc-provider        # Provider portal on :4302
  npx nx dev wc-superadmin      # Superadmin portal on :4301
  ```

## 1. Configure environment

Add the following to `apps/wc-nest-api/.env` (test-mode values from your Stripe Dashboard → Developers → API keys with the **Test mode** toggle on):

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # filled in step 4
```

Prefix validation lives in [apps/wc-nest-api/src/config/config.service.ts:195](apps/wc-nest-api/src/config/config.service.ts#L195) — it refuses `sk_live_*` outside production and refuses any webhook secret that isn't `whsec_*`. If you see a `Config error - STRIPE_*` on boot, double-check the prefix and your `NODE_ENV`.

## 2. Complete the provider application

Log in to `wc-provider` and walk the 7-step onboarding wizard:

| Step | Page              | What it persists                                                    |
|------|-------------------|---------------------------------------------------------------------|
| 1    | Contact Info      | `provider.contact*` fields                                          |
| 2    | Find Your Camp    | Google Business Profile + **`ProviderSettings.currency`+`timezone`** |
| 3    | About Your Camp   | `description`, `campType`                                           |
| 4    | Verification Docs | uploads to `verification_documents`                                 |
| 5    | Deposit Settings  | `provider_settings.deposit*`                                        |
| 6    | Cancellation      | `provider_settings.cancellation*`                                   |
| 7    | Review & Submit   | `onboardingCompletedAt` set, `approvalStatus → under_review`        |

**Step 2 is critical for Stripe** — it's where `ProviderSettings` is created with `currency` and `timezone`. The Stripe Connect service will reject account creation if `provider.settings?.currency` is missing. The upsert happens in [google-business.service.ts:237](apps/wc-nest-api/src/modules/provider/onboarding/services/google-business.service.ts#L237).

After hitting **Submit** on step 7, the wizard transitions the provider to `under_review` ([onboarding.service.ts:573](apps/wc-nest-api/src/modules/provider/onboarding/services/onboarding.service.ts#L573)) and you land on `/onboarding/status`.

## 3. Approve the application as superadmin

Log in to wc-superadmin as **`admin@world-camps.org` / `Camps@231`**. Navigate to [Applications](apps/wc-superadmin/src/app/(dashboard)/applications), find provider1's submission, and click **Approve**.

Backed by [application-review.service.ts:344](apps/wc-nest-api/src/modules/superadmin/application-review/services/application-review.service.ts#L344) — flips `provider.approvalStatus` to `approved` and stamps `applicationReviewedAt`.

> **Tip:** while you're here, exercising the **Reject** and **Request More Info** paths against `provider2@gmail.com`–`provider10@gmail.com` is a good way to cover the failure branches that the Stripe Connect endpoint guards against ([stripe-connect.service.ts:35](apps/wc-nest-api/src/modules/provider/stripe-connect/stripe-connect.service.ts#L35)).

## 4. Start the Stripe webhook listener

In a separate terminal:

```bash
stripe login                                                   # one-time, opens a browser
stripe listen --forward-to localhost:3000/stripe/webhooks
```

The `3000` in `--forward-to` must match the `PORT` value in your `apps/wc-nest-api/.env` (defaults to `3000` via [config.service.ts](apps/wc-nest-api/src/config/config.service.ts) — if you've overridden it, swap the port here too).

The CLI prints a `whsec_*` secret on its first line. Copy it into `STRIPE_WEBHOOK_SECRET` in `.env` and **restart wc-nest-api** so the new value is picked up.

> Why this is needed: Stripe's servers can't reach `localhost`. The CLI proxies events from your Stripe account into your local endpoint and signs them with the printed secret. Without that match, every webhook 400s with `Invalid signature` (see [stripe-webhook.controller.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.controller.ts)).

## 5. Walk the embedded Stripe Connect onboarding

Log back in to wc-provider as `provider1@gmail.com`. The frontend gate at [onboarding-access.ts:8](apps/wc-provider/src/utils/onboarding-access.ts#L8) now passes (`onboardingCompletedAt` is set and `approvalStatus === 'approved'`), so the route opens up.

Navigate to `/onboarding/stripe-connect`. The page hosts Stripe's embedded `ConnectAccountOnboarding` component ([page.tsx](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx)). API calls fire in this order:

1. `POST /provider/stripe-connect/account` → creates the Express connected account
2. `POST /provider/stripe-connect/account-session` → returns a single-use `client_secret`
3. *(embedded form renders inline)*
4. `onExit` → `POST /provider/stripe-connect/complete` → syncs live account status

While you fill the form, watch the `stripe listen` terminal — `account.updated` events fire repeatedly as Stripe accepts each piece of KYC data, and each one persists a row in `stripe_webhook_events`.

## 6. Stripe test KYC values

Stripe only accepts these in **test mode**. Pick the country block matching the provider's `default_currency` — for the seeded provider in CHF you'll be on **Switzerland**.

### Universal (every country)

| Field                  | Test value                                        |
|------------------------|---------------------------------------------------|
| Email / SMS OTP code   | `000000`                                          |
| Date of birth          | any 18+ date, e.g. `01 / 01 / 1990`               |
| Legal first name       | `Test`                                            |
| Legal last name        | `User`                                            |
| ID document upload     | use the test-mode **Skip** / **Use test data** option |
| Business website (URL) | `https://example.com`                             |

### Switzerland (CHF) — what the seeded provider uses

| Field                  | Test value                                        |
|------------------------|---------------------------------------------------|
| Business type          | Sole proprietorship (Individual)                  |
| Street address         | `Bahnhofstrasse 1`                                |
| Apartment              | leave blank                                       |
| Postal code            | `8001`                                            |
| City                   | `Zürich`                                          |
| Phone number           | `+41 78 123 45 67` *(placeholder is accepted)*    |
| **IBAN** (payout bank) | `CH9300762011623852957`                           |

### United States (USD)

| Field                  | Test value                                        |
|------------------------|---------------------------------------------------|
| SSN (full)             | `000-00-0000`  (last 4: `0000`)                   |
| EIN (business)         | `000000000`                                       |
| Address line 1         | `address_full_match` *(magic value, US only)*     |
| City / state / ZIP     | any, e.g. `San Francisco`, `CA`, `94103`          |
| Phone number           | `+1 408 555 0125`                                 |
| Routing number         | `110000000`                                       |
| Account number         | `000123456789`                                    |

### Triggering specific outcomes

Stripe also exposes magic values to deliberately fail KYC, simulate review states, etc. — useful for testing the failure branches in `stripe-webhook.service.ts`:

- SSN `000-00-0002` → identity not verified (will keep `chargesEnabled = false`)
- DOB `1900-01-01` → identity check will fail
- IBAN `CH3008999000000123456` → external account will fail verification

Authoritative references:
- [docs.stripe.com/testing](https://docs.stripe.com/testing) — general test cards & values
- [docs.stripe.com/connect/testing](https://docs.stripe.com/connect/testing) — Connect-specific (test bank accounts per country, identity test data)

## 7. Verify

**wc-nest-api logs:**

- `Created Stripe account acct_… for provider …` on the first `POST .../account`
- `Synced Stripe account status for provider …: charges=true, payouts=true, details=true` once Stripe finishes capability checks (a few seconds after `onExit`)

**Database** (Prisma Studio: `npx nx prisma:studio wc-nest-api`):

- `providers` row: `stripeAccountId` set, `stripeOnboardingCompleted = true`, `stripeChargesEnabled` + `stripePayoutsEnabled` both `true` after capability pass
- `stripe_webhook_events`: one row per delivered event with `processed_at` set and `processing_error` `NULL`

**Stripe Dashboard** → Connect → Accounts: `acct_…` appears as type **Express**.

**Idempotency / dedup exercise** — re-deliver a prior event:

```bash
# Copy an event id from `stripe listen` output (looks like evt_…)
stripe events resend evt_...
```

The wc-nest-api log should read `Skipping already-processed Stripe event evt_…` and `processed_at` on the corresponding row stays unchanged.

## 8. Reset / replay tips

To put `provider1` back to a pre-Stripe state and run the embedded flow again:

```sql
UPDATE providers SET
  stripe_account_id = NULL,
  stripe_onboarding_completed = false,
  stripe_onboarding_completed_at = NULL,
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false,
  stripe_details_submitted = false,
  onboarding_completed_at = NULL,
  approval_status = 'pending'
WHERE email = 'provider1@gmail.com';
```

This leaves the connected account intact in your Stripe dashboard. For a fully clean run, delete the account from Stripe → Connect → Accounts as well.

**Disconnect simulation:** from a connected account in Stripe dashboard, click **Disconnect**. This fires `account.application.deauthorized`; verify the corresponding `providers` row has `stripeAccountId` cleared and all capability flags reset to false ([stripe-webhook.service.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.service.ts)).

## 9. Common gotchas

- **`Stripe account can only be created after your application has been approved`** — Step 3 wasn't completed, or you tried as a different provider.
- **`Provider currency must be set before creating a Stripe account`** — Step 2 (Find Your Camp) was skipped or didn't capture currency/timezone from the Google Business Profile. Confirm `provider_settings.currency` is populated.
- **`400 Invalid signature`** on webhook deliveries — `STRIPE_WEBHOOK_SECRET` is stale. Copy the latest `whsec_*` from `stripe listen` and restart wc-nest-api.
- **`Config error - STRIPE_SECRET_KEY must be a live key (sk_live_*) in production`** — `NODE_ENV` is set to `production` locally. Set it to `development`.
- **Embedded form never finishes loading** — `account-session` returned an expired `client_secret`. The page must re-fetch on every render (single-use); refresh the route.
