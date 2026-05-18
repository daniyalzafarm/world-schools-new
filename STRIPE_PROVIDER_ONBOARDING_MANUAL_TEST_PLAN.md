# Stripe Provider Onboarding — Manual Test Plan (Case Matrix)

Companion to [STRIPE_PROVIDER_ONBOARDING_TESTING.md](STRIPE_PROVIDER_ONBOARDING_TESTING.md). The runbook covers the happy path; this file is a **case matrix** that walks every realistic state of the Stripe Connect **Standard** (Direct Charges, `controller.stripe_dashboard.type: 'full'`) embedded onboarding flow before we go live.

Mark each row Pass / Fail / Skip as you go. A row is **Pass** only when every column it claims to verify is actually observed (UI banner, DB row, webhook log, etc.) — partial green is a Fail.

---

## Section A — Pre-flight

Identical setup to the runbook; assume one-time work is already done. Re-verify each session:

- `apps/wc-nest-api/.env` has `STRIPE_SECRET_KEY=sk_test_*`, `STRIPE_PUBLISHABLE_KEY=pk_test_*`, `STRIPE_WEBHOOK_SECRET=whsec_*`, `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_*`, plus optional `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS=90` (default; H1 retention cron). Prefix validation: [config.service.ts](apps/wc-nest-api/src/config/config.service.ts) — production refuses anything that doesn't start with `sk_live_*` / `pk_live_*` / `whsec_*`; dev/test allow empty strings.
- Stripe CLI listening on both webhook scopes. The recommended single-invocation form (see §4 of the runbook for details + the two-terminal alternative):

  ```bash
  stripe listen \
    --forward-to         localhost:3000/stripe/webhooks \
    --forward-connect-to localhost:3000/stripe/webhooks/connect
  ```

  In **local dev with the Stripe CLI** the two env vars take the **same `whsec_…` value** — `stripe listen` binds a single signing secret to your device and reuses it across `--forward-to` and `--forward-connect-to`. Stripe prints **one** `whsec_…` on the first line; put that same value in **both** `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` and **restart wc-nest-api** so the new values are picked up.

  In **staging / production** the two env vars take **two different `whsec_…`** — one per Stripe Dashboard webhook endpoint (Developers → Webhooks → "Listen to events on your account" + "Listen to events on Connect applications"). The Connect secret is required under Direct Charges because `payment_intent.*` / `charge.*` / `charge.dispute.*` / `refund.*` / `radar.early_fraud_warning.*` events fire on the connected account and ship to the Connect endpoint with its own signing key.

  For pure onboarding tests (Section B/C only), the `--forward-connect-to` half can be skipped — `payment_intent.*` / `charge.*` etc. don't fire from onboarding flows.
- Local DB migrated: `npx nx prisma:migrate wc-nest-api`. Prisma Studio open in another tab: `npx nx prisma:studio wc-nest-api`.
- All apps running: `npx nx serve wc-nest-api`, `npx nx dev wc-provider`, `npx nx dev wc-superadmin`.
- A test-mode Stripe Dashboard tab open at https://dashboard.stripe.com/test/connect/accounts so you can disconnect / delete accounts mid-flow.
- For full-happy-path setup steps (provider application + superadmin approval) see Sections 1–3 of the runbook.

**Reset between cases**: use the SQL block at Section 8 of the runbook to revert `provider1@gmail.com` to a pre-Stripe state without nuking the Stripe-side account. To force a fully fresh `accounts.create`, also delete the connected account from the Stripe dashboard.

---

## Section B — Onboarding state matrix

For each row: **Trigger** → walk the steps. **Expected UI** → screenshot/observe. **Expected DB** → check `providers` row in Prisma Studio. **Expected webhooks** → look in the `stripe listen` terminal AND in `stripe_webhook_events` rows. **Verify** → the conditions that must hold for Pass.

| # | Case | Trigger | Expected UI | Expected DB | Expected webhook | Pass criteria |
|---|---|---|---|---|---|---|
| B1 | Not-approved provider blocked | Apply (don't get approved) → navigate to `/onboarding/stripe-connect` | Redirected to next accessible onboarding step (e.g. `/onboarding/status`) | `stripeAccountId` stays `null` | none | The Stripe Connect page never renders; no `accounts.create` call appears in API logs. |
| B2 | Missing currency rejected | Manually `UPDATE provider_settings SET currency=NULL` for an approved provider, then click Connect | 422 toast / inline error: "Provider currency must be set…" | no change | none | Backend log: `UnprocessableEntityException`. No `acct_*` created. |
| B3 | Unsupported currency rejected | `UPDATE provider_settings SET currency='INR'`, click Connect | 422 toast: "Currency INR is not supported…" | no change | none | Allow-list at [stripe.constants.ts:39](apps/wc-nest-api/src/modules/stripe/stripe.constants.ts#L39) blocks the call before it reaches Stripe. |
| B4 | First successful create | Approved provider, fresh state, click Connect | Embedded form renders inside the white card | `stripeAccountId` populated; `stripeChargesEnabled=false`; `stripeOnboardingCompleted=false` | none yet (account.updated arrives after first edit) | API log: `Created Stripe account acct_… for provider …` exactly once. Stripe Dashboard → Connect → Accounts shows the new **Standard** account (Type column reads `Standard`, Dashboard column reads `Stripe Dashboard`). |
| B5 | Refresh mid-init does not duplicate | Hit F5 during the "Loading payment setup…" spinner in [onboarding/stripe-connect/page.tsx](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx) | Form re-renders normally | `stripeAccountId` unchanged from B4 | none new | API log shows the **same** `acct_…` returned (idempotency key + DB short-circuit). Only one row in `providers` references it. |
| B6 | Two-tab race / orphan-detection log | Open `/onboarding/stripe-connect` in two tabs at once for a provider with `stripeAccountId=NULL` | Both tabs render the form | One `stripeAccountId` set; both tabs proceed | account.updated for the same `acct_…` | API log either contains `create_account.concurrent_resolved` (good) or `Stripe account orphan detected` (recoverable; alert hook fires per H8 once added). No duplicate rows. |
| B7 | Switzerland / CHF happy path | Walk the embedded form with the CHF values from the runbook (IBAN `CH9300762011623852957`) | Form transitions to Stripe's success state, `onExit` fires, dashboard redirect | `stripeOnboardingCompleted=true`; `stripeChargesEnabled=true`; `stripePayoutsEnabled=true`; `stripeDetailsSubmitted=true`; `stripeOnboardingSkippedAt=null` | several `account.updated` events; `capability.updated` for `card_payments` and `transfers` | Toast: "Your account is ready to accept bookings." Final redirect lands on `/dashboard`. **Also (H3):** click "Open Stripe Dashboard" on Account → Stripe Account — staging (`pk_test_*`) routes to `https://dashboard.stripe.com/test`; live (`pk_live_*`) routes to `https://dashboard.stripe.com`. The mode is derived from the publishable-key prefix in [apps/wc-provider/src/config/config.ts](apps/wc-provider/src/config/config.ts). |
| B8 | USA / USD happy path | Switch a test provider's currency to `usd`, walk the form with `address_full_match`, SSN `000-00-0000`, routing `110000000`, account `000123456789` | Same as B7 but for US fields | Same as B7 | Same as B7 | Stripe Dashboard shows account country `US`. |
| B9 | ID-not-verified branch | Walk form with SSN `000-00-0002` and otherwise valid data | Form completes; provider returns to "verification pending" warning per [onboarding/stripe-connect/page.tsx:333-341](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L333-L341) | `stripeChargesEnabled` stays `false`; `stripeAttentionRequired=true`; `requirementsCurrentlyDue` includes `individual.verification.document` | `account.updated` with attention required | UI shows the warning banner, NOT the success banner. |
| B10 | Hard rejection branch | Walk form with DOB `1900-01-01` | After webhook lands, the Account → Stripe Account page shows a **danger** banner with the humanized `disabled_reason` | `disabledReason` populated; `stripeAttentionRequired=true`; capabilities false | `account.updated` with `disabled_reason: rejected.fraud` (or similar) | The `humanizeDisabledReason` map at [stripe-account/page.tsx:162](apps/wc-provider/src/app/(dashboard)/account/business/stripe-account/page.tsx#L162) renders a friendly string (no raw `rejected.fraud` leaks). |
| B11 | Bad IBAN external_account fail | Walk form with IBAN `CH3008999000000123456` | After webhook lands, requirements list shows "Bank or payout account details" | `stripePayoutsEnabled=false`; `requirementsCurrentlyDue` includes `external_account` | `account.external_account.created` (post-fix) and `account.updated` | UI surfaces external_account in the requirements list with the human label. |
| B12 | Save & exit partway | Fill 1–2 fields, hit "Save and exit" (or close iframe) | "Saved your progress" toast; redirect to `/dashboard` | `stripeOnboardingCompleted=false`; `stripeOnboardingSkippedAt` stamped | possibly one `account.updated` if any field flushed | The wizard layout still allows `/onboarding/stripe-connect` because of the skip timestamp ([onboarding/layout.tsx](apps/wc-provider/src/app/onboarding/layout.tsx)). |
| B13 | Resume from dashboard | After B12, navigate Account → Stripe Account, click "Continue setup" | Redirects back to `/onboarding/stripe-connect`, embedded form resumes at the next missing step | no extra change beyond B12 | none new | The "You skipped this step earlier" pill renders at [onboarding/stripe-connect/page.tsx:341](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L341). |
| B14 | "Done" with capabilities still pending | Submit a complete form, but Stripe puts the account into pending review (use SSN `000-00-0002` to force this) | Toast: "Stripe is finishing verification — we will notify you when charges are enabled." Redirect to `/dashboard`. | `stripeOnboardingCompleted=true` BUT `stripeChargesEnabled=false` | `account.updated` with `details_submitted=true`, capabilities still false | Both flags coexist; Account → Stripe Account renders `pending` state, not `verified`. |
| B15 | Network failure during account-session | Block `POST /provider/stripe-connect/account-session` in DevTools (request blocking), then click Connect | Inline error banner + iframe shows generic error | no change | none | The "Couldn't reach Stripe" banner appears with the API error message. Removing the block + refresh recovers. |
| B16 | Network failure during create-or-get | Block `POST /provider/stripe-connect/account` in DevTools | Error card with "Try again" button at [onboarding/stripe-connect/page.tsx:461](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L461) | no change | none | Click "Try again" without the block → succeeds. The init-version ref ensures the older promise's late arrival can't overwrite state. |
| B17 | Stripe rate limit (mock 429) | Toggle `STRIPE_SECRET_KEY` to a malformed value to force a 429-ish path **OR** stub `accountSessions.create` to throw `StripeRateLimitError` | 503 surfaced as toast: "Payment provider is rate-limiting us…" | no change | none | `mapStripeError` maps to `ServiceUnavailableException` per [stripe-error.util.ts:42-45](apps/wc-nest-api/src/modules/stripe/stripe-error.util.ts#L42-L45). |
| B18 | Skip button | Click "Skip for now" button at [onboarding/stripe-connect/page.tsx:488](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L488) | "Saved for later" toast; redirect to `/dashboard` | `stripeOnboardingSkippedAt` set; `stripeOnboardingCompleted=false` | none | Subsequent attempts to take a paid booking 412 with `STRIPE_ACCOUNT_MISSING` (`assertProviderPaymentReady` at [stripe-connect.service.ts:519](apps/wc-nest-api/src/modules/provider/stripe-connect/stripe-connect.service.ts#L519)). |
| B19 | Already-completed provider can't re-onboard | Provider with `stripeOnboardingCompleted=true` AND `chargesEnabled=true` AND `payoutsEnabled=true` AND no requirements navigates to `/onboarding/stripe-connect` | Briefly shows spinner; redirects to `/dashboard` | no change | none | `isPaymentReady` short-circuit at [onboarding/stripe-connect/page.tsx:30](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L30) fires; the early-return render at [onboarding/stripe-connect/page.tsx:310](apps/wc-provider/src/app/onboarding/stripe-connect/page.tsx#L310) shows the success view. (The duplicate render block that used to live at L324-338 was removed in B4 of the audit.) |
| B20 | Stripe-side account deletion | Onboard fully (B7), then delete the account from Stripe Dashboard. Reload Account → Stripe Account. | UI offers "set up payment account" again | `stripeAccountId=null`; `stripeChargesEnabled=false`; `stripePayoutsEnabled=false`; **`appFeePercentage` preserved** | none (deauth webhook may also fire — see C4) | The resource_missing branch at [stripe-connect.service.ts:621-657](apps/wc-nest-api/src/modules/provider/stripe-connect/stripe-connect.service.ts#L621-L657) clears state but leaves the negotiated app fee intact. |

---

## Section C — Webhook matrix

Trigger via the Stripe CLI (`stripe trigger <event>`) or by walking the UI, then verify the API log + the `stripe_webhook_events` row + the resulting DB writes.

| # | Event | Trigger | Expected DB write | Expected log | Pass criteria |
|---|---|---|---|---|---|
| C1 | `account.updated` (capabilities flip) | Finish onboarding (B7) | charges/payouts/details flags flip true | `Synced Stripe account status for provider …: charges=true, payouts=true, details=true, attention=false` | One row in `stripe_webhook_events` with `processed_at` set. |
| C2 | `account.updated` (no-op replay) | `stripe events resend evt_…` for an event already processed | no DB write | `Skipping already-processed Stripe event evt_…` | `processed_at` unchanged. |
| C3 | `account.updated` (requirements added) | B9 path (SSN `000-00-0002`) | `stripeAttentionRequired=true`; matching requirements arrays surface via the next `getAccountStatus` call | sync log includes `attention=true` | The Account → Stripe Account "Attention" banner renders. |
| C4 | `account.application.deauthorized` | Stripe Dashboard → Account → Disconnect | `stripeAccountId=null`; flags reset; **`appFeePercentage` preserved** (post-B2 fix) | `Provider … disconnected their Stripe account acct_…` | Provider's negotiated app fee survives the round-trip. |
| C5 | `capability.updated` | `stripe trigger capability.updated` | Same downstream as C1 (re-sync via account fetch) | Routed handler log; not the legacy "Unhandled" line | Pre-fix this lands in `default`; post-fix it's a real case. |
| C6 | `account.application.authorized` | Reconnect after C4 (re-run B4) | audit-log only (no DB mutation) | `audit action=account.authorized providerId=…` | No DB diff but an audit log line. |
| C7 | `account.external_account.created` | Add a second bank account in the Stripe Dashboard | external accounts list refreshed via the live `accounts.retrieve` next page load (post-fix: trigger eager re-sync) | dispatched-handler log | Account page shows both bank rows. |
| C8 | `account.external_account.updated` | Edit the bank in the dashboard | UI shows new last4 on next refresh | dispatched-handler log | Last4 matches the dashboard. |
| C9 | `account.external_account.deleted` | Delete the bank | UI removes the row on next refresh | dispatched-handler log | Row vanishes. |
| C10 | `payout.created` | `stripe trigger payout.created` | `Payout` row created in `pending` (post-fix) | route to `recordPayoutCreated` | Pre-fix this is unhandled; post-fix a row appears. |
| C11 | `payout.paid` | `stripe trigger payout.paid` | `Payout.status='paid'` | route to `recordPayoutPaid` | Existing handler — verify it still works post-refactor. |
| C12 | `payout.failed` | `stripe trigger payout.failed` | `Payout.status='failed'`; alert fires (Sentry/log) | route to `recordPayoutFailed` | Verify the alert hook surfaces in the on-call channel. |
| C13 | Webhook signature mismatch | Set `STRIPE_WEBHOOK_SECRET` to a wrong value, restart, replay an event | controller returns 400 | `Webhook signature verification failed: …` | No `stripe_webhook_events` row created. |
| C14 | Webhook duplicate delivery | `stripe events resend evt_…` for a previously-processed event | no second processing | `Skipping already-processed Stripe event` | `processed_at` unchanged; no duplicate side-effects. |
| C15 | Webhook handler throws | Force a Prisma error mid-handler (e.g. block DB temporarily) | `processingError` populated; row remains unprocessed; controller returns 500 | `Stripe event evt_… handler failed: …` | Stripe automatically retries; on retry after DB recovery, the event processes cleanly. |
| C16 | Concurrent same-event delivery | Replay an event in two terminals at once | only one DB write succeeds (upsert serializes on PK) | both deliveries hit `dispatch`; second is a no-op for replay-safe handlers | No duplicate Payment / Payout / Provider rows. |
| C17 | `person.created` (company business_type) | Onboard a `business_type=company` test provider | currently logged at INFO; no DB mutation yet | `webhook.unhandled.person.created` (post-fix) — INFO level | Visible in metrics; fail-safe behavior until handler is wired. |
| C18 | `account.tax_id.created` | Submit a tax ID through the embedded form | currently logged at INFO; audit-only | `webhook.unhandled.account.tax_id.created` (post-fix) | Visible in metrics. |
| C19 | Connect-endpoint routing (Direct Charges) | Trigger a deposit booking against the onboarded provider; watch the two `stripe listen` terminals | n/a — verifying routing only | `payment_intent.*` / `charge.*` / `refund.*` / `charge.dispute.*` arrive on the `--forward-connect-to` listener ONLY; the platform listener stays quiet for those types | `stripe_webhook_events` rows for those events have `account_id = acct_*` (non-null); platform-event rows have `account_id = NULL`. |
| C20 | Webhook event retention cron (H1) | `INSERT INTO stripe_webhook_events (id,type,api_version,payload,received_at) VALUES ('evt_old','test',$$2024-01-01$$,'{}'::jsonb,NOW() - INTERVAL '100 days');` then call `WebhookEventRetentionCron.runBatch()` via REPL (or wait for 03:30 UTC) | n/a | Cron log: `webhook-event-retention: deleted 1 rows older than 90 days` | The seeded row is gone; rows inside the retention window remain. Knob: `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS` (default 90; 0 disables). |
| C21 | Out-of-order delivery regression (B1 / H2) | Use `stripe events resend` to fire `payment_intent.succeeded` then `payment_intent.payment_failed` for the same intent id (or reverse the order) | Payment row stays at `succeeded`; `BookingGroup.paidAmount` increments exactly once | both events processed, dispatcher routes each | The status-guarded `updateMany` in `markFailed` / `markCanceled` / `markCapturable` / `markSucceeded` rejects rollback attempts from a terminal state. Cross-link: regression tests in [payment-intents.service.spec.ts](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.spec.ts) under "B1 / T1: out-of-order webhook delivery regression guards". |

---

## Section D — Embedded component states (post-onboarding)

These exercise the **new** `notification_banner` + `account_management` mounts on `/account/business/stripe-account` (B4 fix).

| # | Case | Trigger | Pass criteria |
|---|---|---|---|
| D1 | Account management surface | After B7 completes, navigate Account → Stripe Account | The embedded `<ConnectAccountManagement />` renders with editable fields. Editing the business URL → save → `account.updated` fires → DB updates. |
| D2 | Notification banner shows requirements | Use B9/B10 to put the account into a "requirements" state, then visit Account → Stripe Account | The embedded `<ConnectNotificationBanner />` renders an in-iframe alert with a deeplink that opens the `account_onboarding` form to the offending field, no full-page reload. |
| D3 | Theming matches HeroUI | Walk B7 in light AND dark mode | Iframe colors use `appearance.variables` overrides; no jarring stark-white panels. Take a side-by-side screenshot for the PR. |
| D4 | Localization stays English | Switch the browser locale | The embedded form continues to render in English. Per product scope (wc-provider is English-only) we explicitly do **not** propagate locale to Stripe. |
| D5 | Skip button still visible on init failure | Reproduce B16 | The "Skip for now" button at the bottom of the page stays clickable so the provider isn't trapped. |
| D6 | H3: mode-aware "Open Stripe Dashboard" link | With `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`, hover the "Open Stripe Dashboard" button and check the href in DevTools → Elements; then redeploy with `pk_live_…` and re-check. | Test mode → `https://dashboard.stripe.com/test`; live mode → `https://dashboard.stripe.com`. Mode is derived from the publishable-key prefix in [apps/wc-provider/src/config/config.ts](apps/wc-provider/src/config/config.ts) (`config.stripe.dashboardUrl`). |
| D7 | H6: AccountSession session expiry self-heal | Sit on the Stripe Account page for ≥16 minutes after the embedded surface mounts, then click "Edit business info" inside `ConnectAccountManagement`. | The iframe self-heals via the SDK's on-demand `fetchClientSecret` callback — Stripe.js invokes our handler again and gets a fresh `client_secret`. **No** in-page "session expired" splat. (Documented contract in [use-stripe-connect-instance.ts](apps/wc-provider/src/hooks/use-stripe-connect-instance.ts) — we deliberately do NOT run an interval-based refresh because it would risk forcing an iframe remount and losing in-flight form state.) |

---

## Section E — Production-readiness checks

Run these against staging or just before the live cutover.

- [ ] Live keys validated: `sk_live_*`, `pk_live_*`, `whsec_*` (both `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`) all enforced by [config.service.ts](apps/wc-nest-api/src/config/config.service.ts) — boot fails fast on prefix mismatch.
- [ ] `STRIPE_WEBHOOK_TOLERANCE_SECONDS` ≤ 86400 (N2 upper bound) — larger values defeat replay protection and are now rejected at boot.
- [ ] `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS` set explicitly or relying on the 90-day default (H1).
- [ ] `WebhookEventRetentionCron` running daily at 03:30 UTC — verify by querying `MAX(received_at) - MIN(received_at)` on `stripe_webhook_events` ≤ retention window after ≥1 cron pass past initial backfill.
- [ ] Connect webhook endpoint registered in Stripe Dashboard → Developers → Webhooks → "Listen to events on Connect applications" with `payment_intent.*`, `charge.*`, `charge.dispute.*`, `refund.*`, `radar.early_fraud_warning.*` selected.
- [ ] CSRF skipped for `/stripe/webhooks` ([main.ts:84](apps/wc-nest-api/src/main.ts#L84)) — verify by `curl -X POST` with no CSRF header → 400 (not 403).
- [ ] Webhook endpoint behind a load balancer that preserves raw body — verify with:
  ```bash
  curl -X POST https://staging.api/stripe/webhooks --data-raw '{"foo":"bar"}' -H 'stripe-signature: t=…,v1=…'
  ```
  Expect 400 `Invalid signature`, NOT 400 `Missing raw body`.
- [ ] Sentry / PagerDuty alert wired on the `Stripe account orphan detected` log line.
- [ ] Reconciliation cron exists for orphan accounts, OR the alert hook above is the documented mitigation (H8).
- [ ] Stripe Dashboard → Developers → API → API requests shows `appInfo` populated with `world-camps` + the deployed version (post-H6 fix).
- [ ] `/health` endpoint returns `{"status":"ok","version":"X.Y.Z"}` matching the deployed `wc-vX.Y.Z` tag (referenced by the staging deploy pipeline at [.github/workflows/wc-staging-deploy.yml:202-237](.github/workflows/wc-staging-deploy.yml#L202-L237)).
- [ ] Webhook tolerance configured for the deployment environment (H4) — default 300 s is fine for a single Container App but bump for queued retries.

---

## Section F — Failure-mode drills

Run once before the first production launch and re-run after any infrastructure change. Each drill is a deliberate fault-injection.

| # | Drill | Steps | Pass criteria |
|---|---|---|---|
| F1 | wc-nest-api offline mid-onboarding | Start B7, kill `wc-nest-api` between fields, restart, refresh | The embedded form picks up where it left off (Stripe holds the partial state). No orphaned `acct_…` rows; no "complete" call ever fires for this aborted attempt. |
| F2 | Stripe API offline | Block egress to `api.stripe.com` (e.g. `iptables -A OUTPUT -d api.stripe.com -j REJECT`), click Connect | Client receives 503 with the friendly retry hint. No new `providers.stripeAccountId` set. Removing the block → retry succeeds without duplicate accounts. |
| F3 | Webhook secret rotation | Rotate `STRIPE_WEBHOOK_SECRET` in Stripe Dashboard, update `.env`, restart wc-nest-api | Existing in-flight events 400 with `Invalid signature` → Stripe retries → succeed once the secret is in sync. No data loss. |
| F4 | DB primary failover during webhook delivery | Trigger a Postgres failover (or restart the DB) while `stripe trigger` is firing | Events that were in-flight 500 → Stripe retries → eventually succeed. `stripe_webhook_events` rows reflect exactly one processed-at per event. |
| F5 | Company-type provider | Onboard with `business_type=company` (use Stripe test data for a corporate entity) | `person.created/updated` events arrive and log cleanly at INFO via the post-fix unhandled handler. No 500s. Future hook stub is left as a placeholder. |
| F6 | Two providers race for the same email | Two test providers with the same `owner.email`, both click Connect within the idempotency window | Each gets a distinct `acct_…` because the idempotency key is keyed on `providerId` (not email). Verify by inspecting `stripeAccountId` on both rows — they differ. |
| F7 | Provider deletes their Stripe account before our webhook lands | Onboard, then delete from Stripe Dashboard. Open Account → Stripe Account before the deauth webhook is delivered. | The resource_missing branch at [stripe-connect.service.ts:621-657](apps/wc-nest-api/src/modules/provider/stripe-connect/stripe-connect.service.ts#L621-L657) clears local cache. When the deauth webhook eventually arrives, `handleAccountDeauthorized` finds no provider (already cleared) and logs the convergence message at INFO — no alert fires. |

---

## Sign-off checklist

Before marking the feature production-ready:

- [ ] Section A pre-flight passes for the deployment environment.
- [ ] Every row in Section B observed: Pass / Fail / Skip with a note.
- [ ] Every row in Section C observed: Pass / Fail / Skip with a note.
- [ ] Section D walked by a designer (theming) and an engineer (component wiring).
- [ ] Section E checklist fully ticked.
- [ ] Section F drills run at least once on staging.
- [ ] Backend tests green: `npx nx test wc-nest-api -- --testPathPattern='stripe'`.
- [ ] Linker green: `npx nx lint wc`.
- [ ] One backend + one frontend engineer sign off in writing in the release ticket.
