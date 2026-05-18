# Testing the Stripe provider onboarding flow

End-to-end runbook for validating the Stripe Connect provider onboarding feature against Stripe **test mode**. Targets ~10–15 minutes from a fresh local DB to a fully onboarded test provider with capabilities synced via webhook.

## Overview

**In scope:** Stripe Connect **Standard** (Direct Charges, `controller.stripe_dashboard.type: 'full'`) account creation, embedded KYC, capability syncing via `account.updated` / `capability.updated` / `account.application.deauthorized` webhooks on the **platform** webhook endpoint.

**Out of scope for this runbook:** parent-side payment processing (covered in [STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md](STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md)). Connected-account webhooks (`payment_intent.*`, `charge.*`, `refund.*`, `charge.dispute.*`, `radar.early_fraud_warning.*`) fire on the **Connect** endpoint and are validated against `STRIPE_CONNECT_WEBHOOK_SECRET` — this runbook only walks the platform-endpoint lifecycle events.

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
STRIPE_WEBHOOK_SECRET=whsec_...                  # platform-account events; filled in step 4
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...          # connected-account events (Direct Charges); filled in step 4
STRIPE_WEBHOOK_EVENT_RETENTION_DAYS=90           # optional (default 90); H1 retention cron drops `stripe_webhook_events` rows older than this
```

In **staging / production** these are **two different secrets** — one per Dashboard webhook endpoint (see step 4). The Connect secret is required because, under Direct Charges, every `payment_intent.*` / `charge.*` / `charge.dispute.*` / `refund.*` / `radar.early_fraud_warning.*` event fires on the connected (provider) account and ships to a separate endpoint with its own signing key. Account-lifecycle events (`account.*`, `capability.*`, `person.*`, `payout.*`) continue to hit the platform endpoint with the original `STRIPE_WEBHOOK_SECRET`.

In **local dev with the Stripe CLI** the two env vars take the **same `whsec_…` value** — `stripe listen` binds a single signing secret to your device and reuses it across `--forward-to` and `--forward-connect-to`. See step 4 for details.

Prefix validation lives in [apps/wc-nest-api/src/config/config.service.ts:195](apps/wc-nest-api/src/config/config.service.ts#L195) — it refuses `sk_live_*` outside production and refuses any webhook secret that isn't `whsec_*`. In production both webhook secrets are required; in dev/test either may be empty (`webhooks.constructEvent` only runs against the secret tied to the endpoint that received the event). If you see a `Config error - STRIPE_*` on boot, double-check the prefix and your `NODE_ENV`.

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

Two endpoints are wired in [stripe-webhook.controller.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.controller.ts), each with its own signing secret:

| Endpoint | Receives | Dashboard config | Env var |
|---|---|---|---|
| `POST /stripe/webhooks` | Platform-account events: `account.*`, `capability.*`, `person.*`, `payout.*` | **"Listen to events on your account"** | `STRIPE_WEBHOOK_SECRET` |
| `POST /stripe/webhooks/connect` | Connected-account events (Direct Charges): `payment_intent.*`, `charge.*`, `charge.dispute.*`, `refund.*`, `radar.early_fraud_warning.*` | **"Listen to events on Connect applications"** | `STRIPE_CONNECT_WEBHOOK_SECRET` |

### Dashboard setup (staging / production)

For each endpoint above, in Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
1. URL: `https://<api-host>/stripe/webhooks` (or `/stripe/webhooks/connect`)
2. Tick the matching listen scope from the table
3. Select the event types from the corresponding row
4. Copy the resulting `whsec_…` into the matching env var and restart wc-nest-api

The two endpoints share the same `processEvent` dispatch path, so a fresh `whsec_*` for the Connect endpoint is the only Stripe-side moving piece beyond what platform-only setups already had.

### Local dev (Stripe CLI)

A single `stripe listen` can proxy both scopes — pass both `--forward-*` flags in one invocation:

```bash
# one-time, opens a browser
stripe login
# platform events + Direct Charges events
stripe listen \
  --forward-to localhost:3000/stripe/webhooks \           
  --forward-connect-to localhost:3000/stripe/webhooks/connect
```

The `3000` must match the `PORT` value in your `apps/wc-nest-api/.env` (defaults to `3000` via [config.service.ts](apps/wc-nest-api/src/config/config.service.ts) — if you've overridden it, swap the port here too).

The CLI prints **one** `whsec_…` on its first line and reuses it for both scopes (the secret is bound to your device's CLI login, not to the forward flag). Put that **same** value in **both** env vars:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_…   # identical to above when using the Stripe CLI
```

Then **restart wc-nest-api** so the new values are picked up. If you prefer two terminals (e.g. you want separate event streams), running `stripe listen --forward-to …` in one and `stripe listen --forward-connect-to …` in another also works — they'll still print the same `whsec_…`, because it's tied to your CLI login, not the listener.

> Why this is needed: Stripe's servers can't reach `localhost`. The CLI proxies events from your Stripe account into your local endpoints and signs each delivery with the secret printed for that listener. Without a match, every webhook 400s with `Invalid signature`.
>
> For pure onboarding testing (no Direct-Charges payments yet), the platform listener (`--forward-to`) alone is enough — you can skip the `--forward-connect-to` listener until you exercise the payment flow.

## 5. Walk the embedded Stripe Connect onboarding

Log back in to wc-provider as `provider1@gmail.com`. The frontend gate at [onboarding-access.ts:8](apps/wc-provider/src/utils/onboarding-access.ts#L8) now passes (`onboardingCompletedAt` is set and `approvalStatus === 'approved'`), so the route opens up.

Navigate to `/onboarding/stripe-connect`. The page hosts Stripe's embedded `ConnectAccountOnboarding` component ([page.tsx](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx)). API calls fire in this order:

1. `POST /provider/stripe-connect/account` → creates the **Standard** (Direct Charges) connected account on the platform
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

**Stripe Dashboard** → Connect → Accounts: `acct_…` appears as type **Standard** (Dashboard column reads "Stripe Dashboard", i.e. full dashboard). Platform controls remain in place — fees/losses both `payer=application` per the controller config in [stripe-connect.service.ts](apps/wc-nest-api/src/modules/provider/stripe-connect/stripe-connect.service.ts).

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

For per-provider resets that *also* drop the per-(parent, provider) Stripe customers (otherwise a re-onboarded provider's first booking returns the stale `ProviderConnectCustomer` row and the Stripe call fails with `resource_missing`), additionally run:

```sql
DELETE FROM provider_connect_customers
WHERE provider_id = (SELECT id FROM providers WHERE email = 'provider1@gmail.com');
```

`SavedPaymentMethod` rows cascade away through the FK. This leaves the connected account intact in your Stripe dashboard. For a fully clean run, delete the account from Stripe → Connect → Accounts as well.

**Whole-environment reset (staging only):** the consolidated script at [apps/wc-nest-api/prisma/manual-scripts/staging-reset-stripe-providers.sql](apps/wc-nest-api/prisma/manual-scripts/staging-reset-stripe-providers.sql) does both the `provider_connect_customers` DELETE and the providers UPDATE for *every* provider in one transaction. Use it after the Express → Standard cutover or any time the staging Stripe sandbox accounts are recycled. **Never** run on production.

**Disconnect simulation:** from a connected account in Stripe dashboard, click **Disconnect**. This fires `account.application.deauthorized`; verify the corresponding `providers` row has `stripeAccountId` cleared and all capability flags reset to false ([stripe-webhook.service.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.service.ts)).

## 9. Common gotchas

- **`Stripe account can only be created after your application has been approved`** — Step 3 wasn't completed, or you tried as a different provider.
- **`Provider currency must be set before creating a Stripe account`** — Step 2 (Find Your Camp) was skipped or didn't capture currency/timezone from the Google Business Profile. Confirm `provider_settings.currency` is populated.
- **`400 Invalid signature`** on webhook deliveries — the secret bound to the endpoint that received the event is stale. Identify which endpoint was hit: deliveries to `/stripe/webhooks` validate against `STRIPE_WEBHOOK_SECRET`; deliveries to `/stripe/webhooks/connect` validate against `STRIPE_CONNECT_WEBHOOK_SECRET`. Copy the latest `whsec_*` from the corresponding `stripe listen` and restart wc-nest-api. Swapping the two secrets (e.g. putting the Connect `whsec_*` into `STRIPE_WEBHOOK_SECRET`) reproduces this exact error since `webhooks.constructEvent` runs HMAC against the wrong key.
- **Direct Charges events never arrive locally** — you started `stripe listen --forward-to …` but not `--forward-connect-to …`. The first only proxies platform-account events; `payment_intent.*` etc. fire on the connected account and need the second listener. Both must be running in parallel.
- **`Config error - STRIPE_SECRET_KEY must be a live key (sk_live_*) in production`** — `NODE_ENV` is set to `production` locally. Set it to `development`.
- **Embedded form never finishes loading** — `account-session` returned an expired `client_secret`. The page must re-fetch on every render (single-use); refresh the route.
