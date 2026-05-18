# Stripe Payment Processing — Manual Test Plan (Case Matrix)

Companion to [STRIPE_PROVIDER_ONBOARDING_MANUAL_TEST_PLAN.md](STRIPE_PROVIDER_ONBOARDING_MANUAL_TEST_PLAN.md). Provider onboarding must pass before this plan runs (each booking needs an onboarded provider with a **Standard** (Direct Charges) connected account).

This file is a **case matrix** — every realistic state of the parent-side payment lifecycle, the off-session balance-charge cron, refunds, disputes, payouts, and webhook resilience. Mark each row Pass / Fail / Skip as you go. A row is **Pass** only when every column it claims to verify is actually observed.

---

## Section A — Pre-flight

Re-verify each session:

- `apps/wc-nest-api/.env` has `STRIPE_SECRET_KEY=sk_test_*`, `STRIPE_PUBLISHABLE_KEY=pk_test_*`, `STRIPE_WEBHOOK_SECRET=whsec_*`, `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_*`, plus the billing knobs `BILLING_OFF_SESSION_MAX_ATTEMPTS`, `BILLING_OFF_SESSION_RETRY_HOURS`, `BILLING_OFF_SESSION_STEP_UP_WINDOW_HOURS`, `BILLING_AUTH_EXPIRY_WARN_DAYS`, `BILLING_AUTH_EXPIRY_CANCEL_DAYS`, and optional `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS=90` (default; H1 retention cron).
- Stripe CLI listening on **both** webhook scopes. Under Direct Charges, every parent-side event (`payment_intent.*`, `charge.*`, `refund.*`, `charge.dispute.*`, `radar.early_fraud_warning.*`) fires on the connected account and arrives on the Connect endpoint — the platform listener alone will look silent for the entire booking flow. Recommended single-invocation form (see §4 of the runbook for the two-terminal alternative):

  ```bash
  stripe listen \
    --forward-to         localhost:3000/stripe/webhooks \
    --forward-connect-to localhost:3000/stripe/webhooks/connect
  ```

  In **local dev with the Stripe CLI** the two env vars take the **same `whsec_…` value** — `stripe listen` binds a single signing secret to your device and reuses it across `--forward-to` and `--forward-connect-to`. Stripe prints **one** `whsec_…` on the first line; put that same value in **both** `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` and **restart wc-nest-api**.

  In **staging / production** the two env vars take **two different `whsec_…`** — one per Stripe Dashboard webhook endpoint (Developers → Webhooks → "Listen to events on your account" + "Listen to events on Connect applications"). Each issues its own `whsec_*`; copy each one into the matching env var.
- A fully-onboarded provider seeded (rerun Sections B7 + Section 5–7 of the onboarding plan).
- Apps running: `npx nx serve wc-nest-api`, `npx nx dev wc-booking`, `npx nx dev wc-provider`, `npx nx dev wc-superadmin`.
- Stripe Dashboard test mode tabs open at https://dashboard.stripe.com/test/connect/accounts AND, after the first booking, drill into the provider's `acct_*` → **Payments** tab. **Under Direct Charges the PaymentIntent appears on the connected-account view, NOT on the platform's `https://dashboard.stripe.com/test/payments` tab** — the platform Payments tab will be empty for booking flows.
- Prisma Studio open: `npx nx prisma:studio wc-nest-api`.

**Test cards** (per https://docs.stripe.com/testing):

| Card number | Behavior |
|---|---|
| `4242 4242 4242 4242` | Succeeds, no 3DS |
| `4000 0025 0000 3155` | Requires 3DS challenge |
| `4000 0000 0000 9995` | Insufficient funds (decline) |
| `4000 0000 0000 0341` | Succeeds on-session, fails off-session (saved-card balance test) |
| `4000 0000 0000 0259` | Triggers `charge.dispute.created` |
| `4000 0000 0000 1976` | Radar early-fraud-warning |
| `4000 0027 6000 3184` | 3DS required EVERY transaction (off-session step-up) |

**Reset between cases**: SQL block to revert a booking back to pre-payment state without nuking the Stripe-side intent:

```sql
DELETE FROM payments WHERE booking_group_id = '<id>';
UPDATE booking_groups SET
  status = 'request',
  paid_amount = 0,
  refunded_amount = 0,
  payout_event_id = NULL
WHERE id = '<id>';
```

For a fully clean "first booking with this provider" state (so the next submit re-creates the connected-account `Customer` from scratch — useful when verifying `ensureProviderConnectCustomer` race-safety), also drop the per-(parent, provider) row:

```sql
DELETE FROM provider_connect_customers
WHERE id IN (SELECT provider_connect_customer_id FROM payments WHERE booking_group_id = '<id>');
```

`SavedPaymentMethod` rows cascade away through the FK. For a fully clean run, also cancel the matching PaymentIntent / SetupIntent in the Stripe dashboard.

---

## Section B — On-session payment (parent submits booking)

For each row: **Trigger** → walk the booking flow, **Expected UI**, **Expected DB writes**, **Expected webhook**, **Pass criteria**.

| # | Case | Pass criteria |
|---|---|---|
| B1 | Deposit-mode booking, no 3DS | After "Authorize and submit": `payment_intent.amount_capturable_updated` arrives on the **Connect** listener → Payment row `requires_capture`, BookingGroup `request`. Under Direct Charges the intent is created with the `Stripe-Account: acct_*` request header (visible in Stripe Dashboard → Connect → Accounts → [acct_*] → Developers → API logs). There is **no** `transfer_data` and **no** `on_behalf_of`. `application_fee_amount` is still present (unchanged semantics). Also verify: `Payment.stripeAccountId` matches the provider's `acct_*`; the parent's `ProviderConnectCustomer` row exists with `(parentId, providerId, stripeAccountId, stripeCustomerId)` (live customer on the connected account, not the platform). |
| B2 | Full-mode booking, no 3DS | Same as B1 but `Payment.kind = full`, `amount = group.totalAmount`. |
| B3 | Setup-mode booking (no deposit, balance > 90 days) | `setup_intent.succeeded` webhook (on the Connect listener) → Payment row `processing` with `dueAt = balanceDueAt`, BookingGroup `request`. Under Direct Charges the Stripe SetupIntent shows the saved PM attached to the **connected-account** `Customer` (the per-(parent, provider) `ProviderConnectCustomer.stripeCustomerId`), NOT a platform-side customer. A parent booking with a different provider later will get a separate `cus_*` on that other provider's account and re-enter their card. |
| B4 | Deposit + 3DS challenge required | `confirmPayment` redirects to issuer → returns to `/payment/authorize?payment_intent_client_secret=…&booking_group_id=…` → page calls `syncPayment` and **waits** before redirecting (post-B1 fix). Final redirect lands on `/bookings` with up-to-date row. |
| B5 | 3DS challenge declined at issuer | `/payment/authorize` shows "Card verification failed", booking stays `requires_payment_method`. Backend Payment row reflects `last_payment_error` + redacted `failureMessage` (post-H6 fix). |
| B6 | Insufficient-funds card | Submit fails with inline Stripe error; PaymentIntent created but stays `requires_payment_method`; no BookingGroup advance. |
| B7 | Apple Pay / Google Pay | Wallet sheet opens (device-dependent); confirms with same outcome as B1. Verify on macOS Safari + a touch device. |
| B8 | Refresh during pending PaymentIntent | Submit reuses the existing intent — idempotency lives in the connect-customer + intent-create path (`ensureProviderConnectCustomer` + `buildIdempotencyKey` per-booking key) in [payment-intents.service.ts](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.ts). Only ONE Payment row exists, ONE PaymentIntent on the connected account. |
| B9 | Two parallel browser tabs submitting same booking | Idempotency key collapses both submits to ONE PaymentIntent. Verify with `stripe listen` log + DB row count. |
| B10 | Wrong AVS postal code | Stripe declines, friendly inline error. Stripe dashboard shows the AVS `fail` reason. |
| B11 | Provider's Stripe account loses `chargesEnabled` mid-flow | Backend returns 412 `STRIPE_CAPABILITIES_DISABLED` from `assertProviderPaymentReady`. Frontend surfaces a "provider not accepting payments" message. |
| B12 | Provider has no Stripe account | 412 `STRIPE_ACCOUNT_MISSING`. |
| B13 | Network failure mid-confirmPayment | Spinner stays / retry succeeds; PaymentIntent stays in pending state at Stripe; refresh recovers. |
| B14 | `syncPayment` after confirmPayment fails (mock 5xx via DevTools blocking) | Post-B1/B6 fix: success panel shows but a "We're confirming your booking…" badge appears; auto-resolves once webhook arrives. |
| B15 | Statement descriptor suffix on real card statement | After a real test-mode card charge, Stripe dashboard → Payment → "Statement descriptor" reads `<connected_descriptor> * BG-<bookingGroupNumber>` (post-H1 fix). |
| B16 | Redirect-only PM (e.g. iDEAL) cannot be selected | Post-H2 fix: `automatic_payment_methods.allow_redirects: 'never'` filters them out. PaymentElement does NOT show iDEAL/Bancontact. |
| B17 (H5) | Stripe.js fails to load | Trigger: DevTools → Network → right-click `js.stripe.com` → "Block request URL", then reload the booking review page. Pass: the H5 fallback panel renders ("Payment form failed to load — this usually means an ad-blocker, browser extension, or your network is blocking js.stripe.com…") with a **Refresh** button. No frozen Elements form. After unblocking + refresh, the form mounts normally. Implementation: [stripe-payment-section.tsx](apps/wc-booking/src/components/camp-booking/stripe-payment-section.tsx) (`stripeLoadState === 'failed'` branch) + [lib/stripe.ts](apps/wc-booking/src/lib/stripe.ts) (coerces `loadStripe` rejection to `null`). |
| B18 (H4) | Authorize page when `stripe_account` is missing | Trigger: hand-craft `/payment/authorize?payment_intent_client_secret=pi_x_secret_y` (no `stripe_account` param). Pass: failure panel renders the H4 message ("This payment-verification link is missing the connected-account reference and we can't verify your card from it. Return to your bookings and try the payment again…") AND a **Return to bookings** CTA navigates to `/bookings`. Implementation: [authorize/page.tsx](apps/wc-booking/src/app/payment/authorize/page.tsx). |

---

## Section C — Off-session balance-charge cron (Phase 3)

| # | Case | Pass criteria |
|---|---|---|
| C1 | Setup-mode Payment hits `dueAt`, charge succeeds without 3DS | Cron fires (`stripe listen` shows `payment_intent.succeeded`) → Payment `succeeded`, BookingGroup → `fully_paid`. |
| C2 | Saved card requires fresh 3DS (use `4000 0027 6000 3184`) | Cron sets Payment `requires_action`, parent receives recovery email. Email link → `/payment/authorize?payment_intent_client_secret=…` (no `booking_group_id`) → "Verify card" button → `handleNextAction` → success. |
| C3 | Cron decline (use `4000 0000 0000 0341` saved as default) | Payment `failed`, `attemptCount = 1`, `nextRetryAt = +24h`. Wait for next pickup → attempt 2. |
| C4 | Cron decline twice | Payment terminal `failed`, BookingGroup → `payment_failed`, final-failure email to parent. Verify the failure email links into the parent's booking. |
| C5 | 3DS challenge sits in `requires_action` for 48h | Next cron pickup calls `markStepUpAbandoned` → `paymentIntents.cancel` at Stripe → Payment terminal. BookingGroup → `payment_failed`. |
| C6 | Parent detached saved card before cron fires | Post-H4 fix: cron's `paymentMethods.retrieve` precheck returns `resource_missing` → cron treats as clean abandonment (single audit log, NOT a noisy decline log). BookingGroup → `payment_failed`. |
| C7 | BookingGroup is `cancelled` before cron fires | Cron skips (terminal-booking guard at [payment-intents.service.ts:82-91](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.ts#L82-L91)). |
| C8 | Two cron instances race on the same Payment | Redis SET-NX lock prevents double-charge. Verify by manually triggering two crons in parallel. |
| C9 | `payment_intent.requires_action` webhook arrives async | Post-B2 fix: explicit case in dispatch updates Payment row to `requires_action` even if not triggered through cron's synchronous create response. |
| C10 | Override `BILLING_OFF_SESSION_MAX_ATTEMPTS=3` | Post-H5 fix: cron honors env value, allows 3 attempts before terminal. |
| C11 | Override `BILLING_OFF_SESSION_STEP_UP_WINDOW_HOURS=24` | Post-H5 fix: stuck `requires_action` rows are abandoned at 24h instead of 48h. |
| C12 (B1) | Out-of-order webhook for an off-session charge | Trigger: `payment_intent.succeeded` first, then `payment_intent.payment_failed` for the same intent id (`stripe events resend evt_…` in two windows, swapping order). Pass: Payment row remains `succeeded`; `BookingGroup.paidAmount` was incremented exactly once. The B1 status-guarded `updateMany` in `markFailed` matches zero rows when the prior status is `succeeded`. Cross-link: [payment-intents.service.spec.ts](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.spec.ts) describe block "B1 / T1: out-of-order webhook delivery regression guards". |
| C13 (B1) | Concurrent `markSucceeded` race | Trigger: replay the same `payment_intent.succeeded` event twice in parallel via two Stripe CLI windows running `stripe events resend evt_…` simultaneously. Pass: `BookingGroup.paidAmount` incremented exactly once even though both dispatches enter `markSucceeded`. The race winner's `updateMany` returns `count=1` and proceeds to the BookingGroup write; the loser returns `count=0` and short-circuits before the increment. |

---

## Section D — Capture & cancellation (provider acceptance / decline)

| # | Case | Pass criteria |
|---|---|---|
| D1 | Provider accepts | PaymentIntent captured, Payment `succeeded`, BookingGroup → `deposit_paid` (or `fully_paid`). When deposit < total, balance Payment row created with `dueAt = balanceDueAt`. |
| D2 | Provider declines | PaymentIntent canceled, Payment `canceled`, BookingGroup → `declined`, parent never charged. |
| D3 | Provider acceptance lands AFTER auth-window expired | Catches `payment_intent_unexpected_state` → throws `PaymentAuthorizationExpiredError` → BookingGroup → `expired`, parent emailed. |
| D4 | Concurrent capture (provider double-clicks accept) | Idempotency collapses; second call returns cached. Only one capture event in Stripe. |
| D5 | Auth-expiry monitor cron warns at d5, cancels at d6.95 (post-B9 fix) | Leave a deposit-mode booking unaccepted for >5 days → email "acceptance needed within Xh". At d6 23h → auto-cancel + parent email "auth expired". Verify Stripe-side intent ends in `canceled`. |
| D6 | Capture amount mismatch defensive check (post-B7 fix) | Manually tweak the Stripe Dashboard to capture less than authorized → `markSucceeded` logs ERROR + skips BookingGroup advance. Verify `paidAmount` is NOT incremented. |
| D7 (B2) | Capture-API races with a `payment_intent.canceled` webhook | Trigger: hold a debug breakpoint inside `captureForBookingGroup`'s non-succeeded branch in [payment-intents.service.ts](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.ts) while a concurrent `cancelForBookingGroup` flow flips the row to `canceled`. Resume. Pass: Payment row stays `canceled` — does NOT flip back to `requires_action`. The capture branch's status-guarded `updateMany` (restricted to `{ requires_capture, processing }`) returns `count=0` and the write is a no-op. Cross-link: spec assertions in [payment-intents.service.spec.ts](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.spec.ts) `captureForBookingGroup` describe. |
| D8 (N1) | Auth-expiry cron measures from `intent.created`, not webhook receipt | Trigger: seed a Payment row with `processingStartedAt = NOW() - 7 days`, `status = requires_capture`, `stripePaymentIntentId = pi_*`, `stripeAccountId = acct_*`. Call `AuthExpiryMonitorCron.runBatch()` from a REPL (or wait for 03:00 UTC). Pass: row is canceled BEFORE Stripe's 7-day silent void cliff. Verify `paymentIntents.cancel` was called with `{ stripeAccount: payment.stripeAccountId, idempotencyKey: … }` by inspecting **Stripe Dashboard → Connect → Accounts → [acct_*] → Developers → API logs** for the `Stripe-Account: acct_*` header on `POST /v1/payment_intents/pi_*/cancel`. Unit-test coverage: [auth-expiry-monitor.cron.spec.ts](apps/wc-nest-api/src/modules/billing/intents/crons/auth-expiry-monitor.cron.spec.ts). |

---

## Section E — Refunds matrix

| # | Case | Pass criteria |
|---|---|---|
| E1 | Parent cancels in grace (48h) | 100% refund (deposit + balance) with `refund_application_fee: true`. **No `reverse_transfer` parameter** — under Direct Charges the platform-side transfer doesn't exist, so the only knob is whether the platform's `application_fee_amount` is reversed. The refund call is scoped to the connected account via `{ stripeAccount }`. BookingGroup → `fully_refunded`. The refund is debited from the **connected-account balance** (under `losses.payments: 'stripe'` / `stripe_dashboard.type: 'full'`) — the platform balance is unaffected aside from the reversed application fee. Stripe Dashboard (connected-account view) shows the application fee refunded back to the connected account; the platform's `application_fees` ledger entry is reversed. |
| E2 | Parent cancels post-grace, before transfer | Policy-tier refund (deposit non-refundable, balance per tier %) with `refund_application_fee: false` (named constant `REFUND_FLAGS_KEEP_PLATFORM_FEE` in [refunds.service.ts](apps/wc-nest-api/src/modules/billing/refunds/refunds.service.ts)). The connected account is debited for the parent-facing portion only; the platform retains its `application_fee_amount`. Verify the **connected-account balance** reflects the refund debit AND the kept platform fee (Stripe Dashboard → Connect → Accounts → [acct_*] → Payments → the refund's "amount" minus the `application_fee_amount` portion). |
| E3 | Parent cancels post-payout | Refund + Reimbursement row created (`requiresReimbursement=true`). Reimbursement appears in [wc-superadmin reimbursements page](apps/wc-superadmin/src/app/(dashboard)/reimbursements/page.tsx) with status `pending`. |
| E4 | Camp/provider cancels | 100% refund + reimbursement if payout disbursed. |
| E5 | Force-majeure (admin discretionary, cash mode) | No Stripe call; internal credit-note path. Refund row has `stripeRefundId = null` and `reason = force_majeure`. |
| E6 | Refund fires `refund.updated` webhook | BookingGroup `refundedAmount` increments exactly once. Resend the same event via `stripe events resend evt_…` → no second increment. |
| E7 | Refund fails on Stripe side (`charge_disputed` etc.) | Refund row `failed`, audit log, BookingGroup unchanged. |
| E8 | Two parallel refund attempts with same reason | Unique constraint `(paymentId, reason)` collapses to one. Second call returns the existing row. |
| E9 | Partial refund | BookingGroup advances to `partially_refunded`. Verify the remaining balance Payment is canceled appropriately. |
| E10 | `application_fee.refunded` webhook arrives (post-B5 fix) | Audit log + (stretch) Refund row reconciliation. |

---

## Section F — Disputes matrix

| # | Case | Pass criteria |
|---|---|---|
| F1 | Use card `4000 0000 0000 0259` to trigger `charge.dispute.created` | Dispute event fires on the **Connect** webhook endpoint (validated against `STRIPE_CONNECT_WEBHOOK_SECRET`). Dispute row created, BookingGroup → `disputed`. Under `losses.payments: 'stripe'` (Direct Charges + full dashboard), `charge.dispute.funds_withdrawn` debits the **connected-account balance** — NOT the platform balance — so the loss exposure rests on the provider. `Dispute.fundsWithdrawnAt` is stamped as usual; the platform-side Reimbursement flow does NOT fire for disputes (only for refunds-after-payout). Dispute appears in [wc-superadmin disputes list](apps/wc-superadmin/src/app/(dashboard)/disputes/page.tsx). |
| F2 | Admin submits evidence | `disputes.update` succeeds at Stripe. Trigger close `won` via Stripe CLI → `funds_reinstated` webhook → `Dispute.fundsReinstatedAt` set. |
| F3 | Dispute closes `lost` | Stripe auto-issues refund → `refund.updated` arrives with no matching Refund row → `recoverOrphanRefund` creates synthetic Refund (reason=dispute) → BookingGroup `refundedAmount` incremented. |
| F4 | Admin overrides outcome via "Override outcome" action | Audit log entry, Dispute row updated, no Stripe call. |
| F5 | Radar early-fraud-warning fires (post-B3 fix) | Use card `4000 0000 0000 1976` → Payment annotated `failureCode=early_fraud_warning`, ops alert via structured log. |

---

## Section G — Payouts matrix

| # | Case | Pass criteria |
|---|---|---|
| G1 | Booking session starts, transferDate = +1 business day | Payout-release cron creates Stripe Payout via `payouts.create({}, {stripeAccount})`, PayoutEvent row `pending`. Note: under Direct Charges the captured funds settled on the connected account **at capture time** (no platform→connected transfer step), so the cron is operating on already-settled balance — the only delay is the per-booking payout-release timing, not transfer settlement. |
| G2 | `payout.paid` webhook | PayoutEvent `paid`, BookingGroup.payoutEventId backfilled (Phase 7). |
| G3 | `payout.failed` webhook | PayoutEvent `failed`, alert fires; cron does NOT auto-retry the same payout (intentional — admin decides). |
| G4 | Early-payout enabled provider | transferDate = `sessionStart - earlyPayoutOffsetDays`. |
| G5 | Refund AFTER payout disbursed | Reimbursement row created (Phase 7); admin settles via wc-superadmin Reimbursements page. |
| G6 | `transfer.created` webhook arrives (post-B4 fix) | Audit log only — no DB mutation. |
| G7 | `transfer.reversed` webhook arrives after refund | Audit log only. Verify the structured log line matches the refund's stripeRefundId for forensic traceability. |

---

## Section H — Webhook delivery resilience

| # | Case | Pass criteria |
|---|---|---|
| H1 | Stripe webhook signature mismatch | Controller returns 400. No DB write. Stripe dashboard surfaces the failure. |
| H2 | Duplicate delivery | Idempotent — `stripe_webhook_events.processed_at` unchanged on second delivery. |
| H3 | Handler throws | Controller returns 500, Stripe retries, eventually succeeds. |
| H4 | Webhook arrives BEFORE the DB row exists (race in setup-intent → cron flow) | `findPaymentForIntent` falls back to `metadata.paymentId` and resolves correctly. |
| H5 | Webhook tolerance — set `STRIPE_WEBHOOK_TOLERANCE_SECONDS=10`, replay a delayed event | 400 invalid signature. |
| H6 | Connected-account event arrives with `event.account` populated | Post-H10 fix: controller log line includes `account=<acct_id> livemode=<bool>`. |
| H7 | `charge.captured` / `charge.succeeded` / `charge.failed` / `charge.updated` arrive (post-P1 fix) | Each is dispatched to a dedicated audit-log handler, not the unhandled fallback. |
| H8 | `payment_intent.processing` / `payment_intent.partially_funded` arrive (post-P1 fix) | Dispatched to dedicated handlers. |
| H9 (B1 / H2 / T1) | Data-layer idempotency contract | Run `npx nx test wc-nest-api --testPathPatterns='payment-intents.service.spec'` — all four cases under the "B1 / T1: out-of-order webhook delivery regression guards" describe pass (markCapturable can't roll a `failed` row back; markFailed can't overwrite `succeeded`; markCanceled can't overwrite `succeeded`; concurrent markSucceeded increments paidAmount exactly once). Cross-reference: docstring contract in [stripe-webhook.service.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.service.ts) (H2 — "Handler-idempotency contract"). |
| H10 (H1) | Webhook event retention cron | SQL-seed a `stripe_webhook_events` row dated 100 days ago, call `WebhookEventRetentionCron.runBatch()` (or wait for 03:30 UTC). Log line `webhook-event-retention: deleted N rows older than 90 days`. Rows inside the retention window untouched. Knob: `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS` (default 90; 0 disables). |

---

## Section I — Production-readiness checks (per Stripe official spec)

- [ ] **PCI**: Stripe.js loaded from `js.stripe.com`, NOT bundled. Verify via DevTools → Network → look for `m.stripe.network` script tag injected by `loadStripe`. The wc-booking [stripe.ts:1-31](apps/wc-booking/src/lib/stripe.ts#L1-L31) carries the H11 citation comment.
- [ ] **HTTPS**: production checkout URL starts with `https://` (Stripe spec verbatim: *"The checkout page address must start with https:// rather than http://"*).
- [ ] **Server-side amount**: confirm no path lets the client dictate the charge amount. Backend reads `BookingGroup.totalAmount` snapshot at [payment-intents.service.ts:1269-1270](apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.ts#L1269-L1270).
- [ ] **Webhook authoritative**: `/payment/authorize` redirect waits on sync (post-B1 fix). Race-test by killing the webhook listener and observing the page UX.
- [ ] **Statement descriptor suffix** visible on real card statements (post-H1 fix). Use a real card in test mode + check the issuer's app for the line item.
- [ ] All test cards from Section A walked successfully against `stripe listen`.
- [ ] `appInfo.version` populated in Stripe Dashboard → Developers → API requests for every payment.
- [ ] Sentry alerts fire on `Stripe customer orphan` (post-B8) and `markStepUpAbandoned cancel failed` (post-H7).
- [ ] Webhook endpoint behind LB preserves raw body (verify with `curl -X POST … --data-raw '{}'`).
- [ ] `payments.sync.row_failed` audit signal visible in metrics (post-H13).
- [ ] No PII in `Payment.failureMessage` rows — sample audit post-H6 (verify on rows from the C3/C4 retries).
- [ ] Off-session retry / step-up window envs honored in deployed environment (post-H5).
- [ ] Auth-expiry monitor cron running daily and warning emails reach providers (post-B9).
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` set and starts with `whsec_*` (enforced at boot — config rejects empty in production).
- [ ] Connect webhook endpoint registered in **Stripe Dashboard → Developers → Webhooks → "Listen to events on Connect applications"** with: `payment_intent.*`, `charge.*`, `charge.dispute.*`, `refund.*`, `radar.early_fraud_warning.*`.
- [ ] `Payment.stripeChargeId` unique constraint (N4) present — verify with `\d payments` in psql showing the `payments_stripe_charge_id_key` unique index.
- [ ] `STRIPE_WEBHOOK_TOLERANCE_SECONDS` ≤ 86400 (N2 boot guard).
- [ ] `WebhookEventRetentionCron` (H1) running daily at 03:30 UTC; pick a recent run from logs and confirm `webhook-event-retention: deleted N rows older than X days`.
- [ ] Data-layer idempotency contract documented in [stripe-webhook.service.ts](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.service.ts) "Handler-idempotency contract" docblock (H2) — read before adding any new webhook handler.

---

## Section J — Failure-mode drills

| # | Drill | Pass criteria |
|---|---|---|
| J1 | wc-nest-api offline mid-3DS-return | `/payment/authorize` page shows error, parent retries via post-B1/B14 toast → succeeds when API recovers. |
| J2 | Stripe API offline (block egress) | 503 surfaced from `mapStripeError`; `syncPayment` retries succeed once egress restored. No half-state in DB. |
| J3 | Webhook secret rotation | Existing in-flight events 400, Stripe retries, succeed once env updated. No data loss. |
| J4 | DB primary failover during webhook delivery | Stripe retries; dedup table prevents double-processing. |
| J5 | Provider's Stripe account loses `chargesEnabled` while a Payment is `requires_capture` | Capture fails on provider accept → `STRIPE_CAPABILITIES_DISABLED` 412. Document the manual remediation path until H12 admin UI ships. |
| J6 | Cron lock held by stuck instance | 10-min TTL expires, next pickup proceeds. |
| J7 | Auth-window cliff (post-B9 fix) | Leave a deposit-mode booking unaccepted for >7 days → auth-expiry monitor cron warns + cancels before silent void. Verify Stripe-side intent ends `canceled` AND inspect **Stripe Dashboard → Connect → Accounts → [acct_*] → Developers → API logs** for `POST /v1/payment_intents/pi_*/cancel` carrying the `Stripe-Account: acct_*` header (Direct Charges fix — `paymentIntents.cancel` must be scoped to the connected account). |
| J8 | Parent re-authenticates between bookings (changes email) | Post-H3 fix: low-priority cron updates Stripe Customer email + name on next pass. |

---

## Section K — Provider payout modes (Phase 8)

The platform supports three per-provider payout modes (`ProviderSettings.payoutMode`). Each booking snapshots the mode at submit time and generates its `BookingPayoutSchedule` rows at acceptance — so changing a provider's mode never retroactively shifts in-flight bookings.

**Setup helpers:**
- Tranche rows are visible in Prisma Studio and via `SELECT * FROM booking_payout_schedules WHERE booking_group_id = 'bg-X';`
- A SQL helper to fast-forward a tranche so the cron picks it up immediately: `UPDATE booking_payout_schedules SET release_at = NOW() - INTERVAL '1 minute' WHERE id = 't-...';`
- Cron cadence is 15 minutes — for ad-hoc runs, call `payoutsService.releasePendingTranche(trancheId)` from the REPL.

| # | Case | Expected outcome |
|---|---|---|
| **K1** | Default mode end-to-end. SuperAdmin sets `payoutMode = default_after_start`; parent books + completes 3DS; provider accepts. | Exactly ONE `BookingPayoutSchedule` row with `reason = final_default`, `releaseAt =` first business day after `session.startDate` (provider-tz aware). |
| K2 | After `releaseAt`, the cron releases the tranche. | One `stripe.payouts.create` call; tranche → `released`; `payout.paid` webhook → `paid`; `BookingGroup.payoutReleasedAt` set. |
| K3 | Default mode + parent grace cancel before `releaseAt`. | Tranche → `canceled` with `skipReason: refund:grace_period`; cron does not fire payout. |
| **K4** | Offset-days mode. SuperAdmin sets `payoutMode = offset_days, offsetDays = 14, agreementNote = "Q4 contract"`; provider gets a new booking accepted. | Exactly ONE tranche with `reason = offset_release`, `releaseAt = sessionStart - 14d`, `plannedAmount = totalAmount`. |
| K5 | Cron releases the tranche at the offset date. | Stripe payout fires for full amount; `payout.paid` linkage matches. |
| K6 | Offset-days mode where the offset would land in the past (booking accepted very close to camp start). | `buildTranches` falls back to `final_default` at the default first-business-day-after-session-start releaseAt — never schedules a release before now. |
| **K7** | Policy_staged with `flexible` policy (`[{30d, 100%}]`). | Tranches: `deposit_grace` @ `gracePeriodEndsAt` for `depositAmount`; `tier_threshold` @ `sessionStart - 30d` for the full balance; no `final_default` (residual = 0). |
| K8 | Policy_staged with `moderate` policy (`[{60d, 100%}, {30d, 50%}, {0d, 0%}]`) and a 2000 booking with 600 deposit. | Tranches: `deposit_grace` (600) @ grace-end; `tier_threshold` (700) @ -60d; `tier_threshold` (700) @ -30d; total = 2000. |
| K9 | Policy_staged with `strict` policy (`[{60d, 50%}]`). | Tranches: `deposit_grace` (deposit + 700 initial non-refundable balance) @ grace-end; `tier_threshold` (700) @ -60d when policy expires entirely; no residual. |
| K10 | Policy_staged with `super_strict` policy (`[{90d, 50%}]`). | Same shape as K9 but the tier-expiration tranche fires at -90d. |
| K11 | Policy_staged with custom JSON tiers. | Schedule reflects whatever tiers were stored on `ProviderSettings.cancellationPolicyCustom` (parse + sort + walk). |
| K12 | Policy_staged + booking accepted within the matched tier (e.g. moderate booking accepted at -45d). | `deposit_grace` includes the deposit + the 50% balance already non-refundable at acceptance time; subsequent `tier_threshold` tranches only cover the increment past that. Total still = totalAmount. |
| **K13** | Parent cancels in policy_staged mode AFTER the deposit-grace tranche has paid. | Refund for the policy-eligible balance fraction; `Reimbursement` row created (camp owes back the over-released portion); remaining pending tranches recomputed (cancelled-from-tail until pending sum ≤ remaining due). |
| K14 | Camp cancels mid-schedule. | All pending tranches → `canceled`; paid tranches generate Reimbursement rows for their full amount. |
| K15 | SuperAdmin overrides a single booking from default → policy_staged via `enablePerBookingOverride`. | Pending tranches → `canceled` with `skipReason: admin_override`; new schedule generated; `BookingGroup.payoutOverrideAgreedAt` + `payoutOverrideAgreedByAdminId` set. |
| K16 | Off-session balance capture fails repeatedly. The first tier_threshold tranche fires before balance settles. | Cron runs `releasePendingTranche` → `available < plannedAmount` → releases what's available, generates a `partial_residual` tranche for the residual; next tick retries. |
| K17 | Legacy bookings (pre-migration) backfilled. | Each legacy `BookingGroup` with non-null `transferDate` has exactly one `BookingPayoutSchedule` row whose status correctly mirrors the BG's pre-migration `payoutReleasedAt` / `payoutEventId` state. The cron releases pending ones; paid ones stay linked. |
| K18 | `payout.failed` webhook for a released tranche. | Tranche → `failed`; a fresh `partial_residual` pending tranche queued for retry under a new Stripe payout id. |
| K19 | Tranche releaseAt clamping. Set provider deposit + cancellation policy so a `tier_threshold` would land before `balanceDueAt + 24h`. | The tranche's `releaseAt` is clamped forward to `balanceDueAt + 24h`. |
| K20 | Tranche releaseAt clamping vs. grace. Tier breakpoint that would land before `gracePeriodEndsAt`. | Tranche clamped forward to `gracePeriodEndsAt` (deposit-grace tranche fires first; tier tranches never beat the grace window). |

---

## Section L — Per-camp deposit settings (Phase 9)

Phase 9 moves deposit settings from **provider-level only** to **per-camp**, with provider-level remaining the **default for new camps**. Each camp has its own `Camp.{depositRequired, depositType, depositPercentage, depositFixedAmount}` snapshotted at creation; the booking submit flow reads from the camp directly.

The provider edits per-camp deposit settings on `apps/wc-provider/src/app/camps/[campId]/edit/sessions` via the new `CampDepositSettingsCard` at the top of the page. Three modes:

  1. **Percentage**: deposit = `depositPercentage`% of the booking total (1..100 integer)
  2. **Fixed**: a fixed monetary amount; the value MUST be strictly less than every existing session's price for the camp (per spec)
  3. **No deposit**: charge the full amount at booking time (`paymentMode = full_at_booking`, or `full_at_due` for ≥90d-out bookings)

**Setup helpers:**
- View camp-level fields: `SELECT id, name, deposit_required, deposit_type, deposit_percentage, deposit_fixed_amount FROM camps WHERE id = '...';`
- Compare to provider defaults: `SELECT provider_id, deposit_required, deposit_type FROM provider_settings WHERE provider_id = '...';`
- Frontend inspection: open the camp edit/sessions page and look for the "Deposit Settings" card above the sessions list.

| # | Case | Expected outcome |
|---|---|---|
| **L1** | New camp creation snapshots provider deposit settings. Provider has `depositRequired=true, depositType=percentage, depositPercentage=25`. Provider creates a new camp via the wizard. | New `Camp` row has the same four deposit fields copied from `ProviderSettings`. Editing the provider's deposit settings later does NOT change this camp's row. |
| L2 | New camp creation when provider has `depositRequired=false`. | New camp has `depositRequired=false`, all other deposit fields null. |
| L3 | New camp creation when the provider has not yet completed the deposit-settings onboarding step. | New camp falls back to safe defaults: `depositRequired=false`, others null. |
| **L4** | Existing camps (pre-Phase-9) are backfilled by the migration. | Every pre-existing camp has the same deposit values that its provider had at the migration moment. Spot-check via SQL. |
| **L5** | Provider edits a camp's deposit to **No deposit** (mode = "none"). | `Camp.depositRequired=false, depositType=null, depositPercentage=null, depositFixedAmount=null`. Subsequent bookings under this camp route to `full_at_booking` (or `full_at_due` for ≥90d-out). |
| **L6** | Provider edits a camp's deposit to **Percentage** with valid value (e.g., 30). | `Camp.depositRequired=true, depositType='percentage', depositPercentage=30, depositFixedAmount=null`. Booking submit computes deposit = 30% × totalAmount. |
| L7 | Provider edits Percentage with invalid value (0, 101, 25.5). | API rejects with 400; UI shows inline validation message. |
| **L8** | Provider edits a camp's deposit to **Fixed amount** = 100, when every session's lowest price ≥ 200. | Save succeeds. Booking submit computes deposit = 100 (capped at totalAmount if smaller). |
| **L9** | Provider tries to set Fixed amount = 300 when at least one session is priced 250. | API rejects with 400 message: `Fixed deposit 300.00 must be strictly less than every session price. Session "..." has a price of 250.00.` UI surfaces the message verbatim. |
| L10 | Provider sets Fixed amount = 100 on a camp with sessions using **age-group pricing**, where the cheapest tier across all sessions is 80. | Rejects (cheapest tier 80 < fixed 100). |
| L11 | Provider sets Fixed amount = 100 on a camp with **draft sessions that have no price set**. | Skips draft sessions. Save succeeds (validation only blocks against priced sessions). |
| L12 | Provider toggles a camp from **Fixed → Percentage**. | The save clears `depositFixedAmount` (set to null) so a stale value can't leak back into the booking math if mode is later toggled again. |
| L13 | Provider toggles a camp from **Percentage → Fixed**. | The save clears `depositPercentage` (set to null) symmetrically. |
| **L14** | Per-camp override semantics: provider edits camp A to `depositRequired=false`, then edits **provider-level** settings to `depositRequired=true, depositType=percentage`. | Camp A still has `depositRequired=false`. Provider-level edits don't propagate to existing camps. The next NEW camp created inherits the new provider defaults. |
| L15 | Booking submit reads from the camp, not the provider. Camp has `depositRequired=true, depositPercentage=30`; provider settings still show `depositRequired=true, depositPercentage=20` (different value, e.g., from a recent edit). | `BookingGroup.depositAmount` = 30% × totalAmount (camp wins). |
| L16 | Parent-side camp detail page displays deposit text matching the camp, not the provider. | The cancellation/deposit explainer copy reflects the camp's percentage / fixed amount. |
| L17 | Parent payment plan UI mirrors the camp deposit. | `computePaymentPlan` gets `depositSettings` from the camp; displayed "you'll be charged X today" matches the backend snapshot at submit. |
| L18 | Frontend inline validation for Percentage. | Typing 0 / 101 / 25.5 surfaces an inline error before the Save button is enabled. |
| L19 | Frontend inline validation for Fixed amount. | Typing 0 / negative surfaces an inline error; server-side fixed-vs-session-price error appears in a toast on save attempt. |
| L20 | Save button gating. | Save is disabled when (a) form is unchanged from the loaded value, (b) the input fails client validation, or (c) a save is in flight. |

---

## Sign-off checklist

- [ ] Section A pre-flight passes for the deployment environment.
- [ ] Sections B + C + D + E observed end-to-end against `stripe listen`.
- [ ] Sections F + G observed against trigger-able events.
- [ ] Section H webhook resilience verified.
- [ ] Section I production checklist fully ticked.
- [ ] Section J failure drills run on staging at least once.
- [ ] Section K observed for at least one booking per mode (K1, K4, K7), plus K13 (cancel-mid-schedule) and K15 (admin override).
- [ ] Section L observed for L1 (snapshot on create), L9 (fixed-vs-session validation rejection), L14 (no retroactive update), and L15 (booking reads camp, not provider).
- [ ] Backend tests green: `npx nx test wc-nest-api -- --testPathPatterns='(billing|stripe|camps|payment-intents|auth-expiry)'`. Includes the B1/T1 out-of-order webhook regression guards and the new `auth-expiry-monitor.cron.spec.ts`.
- [ ] Lint clean: `npx nx lint wc-nest-api && npx nx lint wc-booking && npx nx lint wc-superadmin && npx nx lint wc-provider`.
- [ ] One backend + one frontend engineer sign off in writing in the release ticket.
