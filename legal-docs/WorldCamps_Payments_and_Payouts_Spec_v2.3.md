# Payments and Payouts — Engineering Specification

**Version:** v2.3  
**Date:** 2026-06-03  
**Owner:** Alex Peipers (Legal)  
**Recipient:** Daniyal (Engineering Lead); cc Stephanie (Design)  
**Status:** Supersedes v1.1 in full

---

## 1. What Changed and Why

The previous spec (v1.1) captured the full booking value at acceptance and held it in the Provider's Stripe balance, releasing funds via a scheduled Tranche engine as portions became non-refundable. This architecture had a structural flaw: Stripe Connect Express accounts allow Providers to initiate manual payouts at any time, bypassing the hold.

This spec replaces that model entirely with a single organising principle:

**Capture money only when it is already non-refundable. Once captured, it is immediately the Provider's.**

**Key architectural decisions confirmed with Stripe Support (Christopher, June 2026):**
- Connected account type: **Standard** (not Express). Under Standard + Direct Charges, the Provider is the merchant of record and carries full liability for refunds, disputes, and negative balances. The platform has zero exposure. Express would reverse this liability allocation.
- `delay_days` is **not available** on Standard accounts. The platform cannot control Provider payout timing. This is not needed — see below.
- Payout behaviour: **Standard Stripe automatic payouts**. No platform-side restrictions. Providers manage their own payout schedule. This is correct by design.

**Why no payout restrictions are needed:**
The deposit is the only amount captured before its non-refundable date (during the 24-hour grace window). This is solved architecturally: capture only fires once the grace window expires. By the time any amount lands in the Provider's Stripe balance, it is already non-refundable and the Provider is entitled to it.

Consequences:
- No funds ever sit in the Provider's Stripe balance waiting to be held
- No Tranche release engine — Stripe's automatic payout schedule handles everything
- Customer cancellations before a capture date require no refund call — the charge simply never fires
- Provider-drain risk is eliminated structurally, not mechanically

---

## 2. Architecture Overview

Every booking has exactly two payment types:

**Deposit** — auth-held at booking request; captured once the 24-hour grace window expires (or immediately on acceptance if grace has already expired); non-refundable from capture  
**Balance** — captured on configured commitment date(s); non-refundable immediately upon capture

The balance is captured in one of three modes, configured by the Provider at onboarding:

| Mode | Description | Best for |
|---|---|---|
| **Binary** | One commitment date; full balance captured on that date | US residential, US day camps, simple European day camps |
| **Two-Stage** | Two capture dates; balance split across both | European residential, premium international, language schools |
| **Custom** | Up to four capture events; Provider configures refund percentage per time band | Camps with complex or non-standard policies |

---

## 3. Provider Payment Configuration

### 3.1 Camp Type — Drives Onboarding Defaults

The Provider selects their camp type at onboarding. This pre-populates the payment configuration fields below. All fields remain editable.

| Camp type | Deposit default | Mode | Capture Date 1 | Capture Date 2 |
|---|---|---|---|---|
| European day camp | 20% | Binary | 14 days before start | — |
| European residential | 20% | Two-Stage | 60 days before start (50% of balance) | 30 days before start (50%) |
| US day camp | 15% | Binary | 21 days before start | — |
| US residential | 25% | Binary | Fixed calendar date (Provider sets) | — |
| Premium / international | 25% | Two-Stage | 90 days before start (50% of balance) | 60 days before start (50%) |

### 3.2 Deposit

Three sub-modes:

- **Percentage** — X% of gross Booking price (e.g. 20%)
- **Fixed amount** — fixed sum in settlement currency (e.g. £500)
- **No deposit** — full programme price follows the cancellation policy only. No auth-hold on a separate deposit amount; the entire price is treated as balance and captured on the commitment date(s).

Validation: if fixed-amount deposit is selected, the system must block Listing activation if `deposit_amount >= listing_price`. Error message: *"Your deposit (£X) equals or exceeds this Listing price. Reduce the deposit or switch to no-deposit for this Listing."*

### 3.3 Capture Schedule — Binary Mode

One commitment date. Full balance charged on that date.

Date mode (Provider selects one):

- **Fixed calendar date** — e.g. "1 March 2026". Best for US residential camps with a fixed-season deadline.
- **Days before programme start** — e.g. "30 days before start". Best for recurring programmes with rolling booking windows.

### 3.4 Capture Schedule — Two-Stage Mode

Two capture dates. Provider configures:

- **Capture Date 1** — date + percentage of balance to capture at this date (default 50%)
- **Capture Date 2** — date; captures the remainder (auto-calculated: 100% minus Capture 1 percentage)
- Each date uses the same fixed-calendar / days-before-start modes as §3.3

### 3.4A Capture Schedule — Custom Mode

Up to four capture events, corresponding to the onboarding policy builder time bands:

| Band | Days before start | Provider sets |
|---|---|---|
| Band 1 | 90+ days | Refund % if cancelled in this band |
| Band 2 | 60–89 days | Refund % |
| Band 3 | 30–59 days | Refund % |
| Band 4 | Under 30 days | Refund % |

The system derives capture events from transitions between bands. Each time the refund percentage drops (e.g. from 100% to 50%), the newly non-refundable portion is scheduled for capture at the boundary date. Multiple bands with the same refund percentage generate a single capture at the first boundary where the percentage drops.

Example: 100% refund at 90+ days, 0% from 60 days onward → one capture event at 90 days before start for 100% of the balance. This is functionally equivalent to Binary mode.

Example: 100% at 90+ days, 50% at 60–89 days, 0% under 60 days → two capture events: 50% at 90 days, 50% at 60 days. Functionally equivalent to Two-Stage.

### 3.5 Validation Rules

- Capture Date 2 must be later than Capture Date 1
- Both capture dates must be before programme start date
- If using fixed calendar dates: dates must be in the future at the time of Listing activation
- At booking time: if a capture date resolves to a date already in the past (e.g. a last-minute booking after the first capture date has passed), skip that capture and apply the `max(capture_date, grace_deadline)` rule — the corresponding portion is non-refundable from grace expiry. `grace_deadline = booking_request_time + 24h`
- Platform Fee rate: read from `provider.platform_fee_rate`; default 15%. Do not hard-code.

---

## 4. Stripe Account Setup at Onboarding

Providers connect via **Standard connected accounts**. Stripe handles KYC and onboarding compliance. The platform uses Direct Charges — every charge is created directly on the Provider's connected account.

```js
// Create or retrieve Standard connected account
// Stripe handles onboarding via OAuth or Connect onboarding link
const accountLink = await stripe.accountLinks.create({
  account: stripeAccountId,
  refresh_url: `${BASE_URL}/onboarding/stripe/refresh`,
  return_url: `${BASE_URL}/onboarding/stripe/complete`,
  type: 'account_onboarding',
});
```

**No payout schedule configuration by the platform.** `delay_days` is not available on Standard accounts (confirmed by Stripe Support, June 2026) and is not needed. Providers manage their own payout schedule through their Stripe dashboard. By architecture, no amount is ever captured while refundable, so there is nothing for the platform to hold back.

**Platform Fee** is collected via `application_fee_amount` on each PaymentIntent. Read from `provider.platform_fee_rate` (default 15%). Do not hard-code.

---

## 5. Customer Payment Events

### 5.1 Booking Request — Deposit Auth Hold Only

Auth hold placed on the Customer's card for the **deposit amount only**. The balance is not touched.

```js
const depositPI = await stripe.paymentIntents.create({
  amount: depositAmountMinorUnits,
  currency: provider.settlementCurrency.toLowerCase(),
  payment_method: paymentMethodId,
  capture_method: 'manual',
  confirm: true,
  application_fee_amount: Math.round(depositAmountMinorUnits * provider.platform_fee_rate),
  customer: stripeCustomerId,
  setup_future_usage: 'off_session',
  metadata: {
    booking_request_id: bookingRequest.id,
    type: 'deposit',
  },
}, { stripeAccount: provider.stripeAccountId });
```

Note: `on_behalf_of` is not included — it is redundant in Direct Charges where the charge is already created on the connected account via `{ stripeAccount: provider.stripeAccountId }`. Including it can cause confusion around settlement and reporting.

`setup_future_usage: 'off_session'` saves the payment method for the future off-session balance captures. The Customer object must be created on the connected account (not the platform account) for this to work correctly under Direct Charges.

Store `depositPI.id` as `deposit_payment_intent_id` on the Booking record.

Also at this point: resolve absolute capture dates from Provider config and store on Booking record. Create `booking_scheduled_captures` records (status: `scheduled`).

**Grace deadline:** Set `grace_deadline = booking_request_time + 24h` on the Booking record at this point. This is the single timestamp that drives deposit capture timing.

**Consent snapshot:** Store a record of the exact cancellation policy shown to the Customer at checkout — deposit amount, 24-hour grace window from submission, each future capture date and amount, and refundability — tied to this Booking record. This snapshot is used as dispute evidence and satisfies the SCA mandate requirement for off-session charges.

### 5.1A Provider Acceptance Window — 72 Hours

After the booking request is submitted and the auth-hold is placed, the Provider has **72 hours** to accept or decline (Customer Terms §5.2 / Provider Terms §5.1).

During this window:
- The deposit is **auth-held only** — it has not been captured, so no funds have moved and there is no payout risk regardless of `delay_days` configuration
- The auth-hold is valid on standard card networks (Visa, Mastercard) for up to 7 days, which comfortably covers the 72-hour window
- The `booking_scheduled_captures` records are already created (status: `scheduled`) but no capture engine will fire until after Acceptance

**If Provider declines or the 72-hour window expires without response:**
- Release the auth-hold by cancelling the PaymentIntent
- Cancel all `scheduled` captures for this booking
- Notify the Customer

```js
// Provider decline or acceptance window expiry
await stripe.paymentIntents.cancel(
  booking.deposit_payment_intent_id,
  { cancellation_reason: 'abandoned' },
  { stripeAccount: provider.stripeAccountId }
);

await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'provider_declined_or_expired' }
});
```

No refund call is needed — a cancelled auth-hold releases the reservation on the Customer's card automatically.

### 5.2 Provider Accepts — Deposit Capture or Deferred

On Provider's Accept click, record `acceptance_time` = server UTC timestamp. Then check whether the 24-hour grace window has already expired:

```js
const now = new Date();
const graceExpired = now >= booking.grace_deadline;

if (graceExpired) {
  // Grace already passed — capture immediately
  await stripe.paymentIntents.capture(
    booking.deposit_payment_intent_id,
    {},
    { stripeAccount: provider.stripeAccountId }
  );
  await db.bookings.update({
    where: { id: booking.id },
    data: { status: 'confirmed', deposit_captured_at: now }
  });
} else {
  // Still within grace window — schedule deferred capture at grace_deadline
  await db.booking_scheduled_captures.create({
    data: {
      booking_id: booking.id,
      type: 'deposit',
      scheduled_date: booking.grace_deadline,
      amount_minor_units: booking.deposit_amount_minor_units,
      status: 'scheduled',
    }
  });
  await db.bookings.update({
    where: { id: booking.id },
    data: { status: 'accepted_grace_pending' }
  });
  // Notify Customer: "Booking confirmed — cancel free until [grace_deadline]"
}
```

**In practice:** most Providers accept after several hours or days. The grace deadline (24h from request) will typically have already expired by acceptance time, so immediate capture is the common path. Deferred capture only triggers when a Provider responds unusually quickly.

### 5.3 Grace Period — 24 Hours from Request Submission

The grace window runs from `booking_request_time` to `grace_deadline` (= `booking_request_time + 24h`), regardless of when the Provider accepts.

**If Customer cancels before `grace_deadline`** (and deposit not yet captured):

```js
// No capture has occurred — simply cancel the auth-hold
await stripe.paymentIntents.cancel(
  booking.deposit_payment_intent_id,
  { cancellation_reason: 'requested_by_customer' },
  { stripeAccount: provider.stripeAccountId }
);

// Cancel all scheduled captures including any deferred deposit capture
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'grace_period_cancellation' }
});
```

No refund call needed. No Stripe fees lost. The auth-hold is simply released.

**If `grace_deadline` passes with no cancellation** and a deferred deposit capture was scheduled, the cron engine (§8) fires the deposit capture:

```js
await stripe.paymentIntents.capture(
  booking.deposit_payment_intent_id,
  {},
  { stripeAccount: provider.stripeAccountId }
);
```

Deposit is permanently non-refundable from this point. Stripe's automatic payout schedule transfers it to the Provider's bank account.

### 5.4 Scheduled Capture — Balance (Capture Date 1 / Commitment Date)

Executed by the cron engine (§8) when `scheduled_date <= now()`.

```js
const balancePI = await stripe.paymentIntents.create({
  amount: capture.amount_minor_units,
  currency: provider.settlementCurrency.toLowerCase(),
  customer: booking.stripe_customer_id,
  payment_method: booking.saved_payment_method_id,
  off_session: true,
  confirm: true,
  application_fee_amount: Math.round(capture.amount_minor_units * provider.platform_fee_rate),
  metadata: {
    booking_id: booking.id,
    capture_id: capture.id,
    type: 'balance_capture_1', // or 'balance_capture_2'
  },
}, { stripeAccount: provider.stripeAccountId });
```

On success: mark `capture.status = 'completed'`, store `payment_intent_id`. Amount is immediately non-refundable. Provider can access immediately through their Stripe balance.

On failure: execute §7 failure flow.

### 5.5 Scheduled Capture — Balance Capture Date 2 (Two-Stage Only)

Same as §5.4. `type: 'balance_capture_2'`. Fires on `capture_date_2`.

---

## 6. Provider Payouts

### 6.1 Standard Automatic Payouts — No Platform Intervention

The Tranche release engine from v1.1 is removed. World Camps does not call `stripe.payouts.create` and does not configure or restrict Provider payout schedules.

Under Standard connected accounts with Direct Charges, Providers manage their own payout schedule through their Stripe dashboard (automatic daily, weekly, or manual). This is correct by design: by the time any amount is captured, it is already non-refundable and belongs to the Provider. There is no platform interest in delaying or restricting access to captured funds.

- Deposit → captured at `grace_deadline` or acceptance (whichever is later); Provider accesses via their own payout schedule
- Balance captures → captured on commitment dates; immediately available to Provider via their payout schedule
- Platform Fee → deducted at each capture via `application_fee_amount`; flows to World Camps platform account automatically

No payout webhooks or monitoring required for normal booking flows.

---

## 7. Balance Capture Failure Handling

### 7.1 On First Failure

1. Mark `capture.status = 'failed'`; record `failure_reason`
2. Set `retry_deadline = now() + 48h`
3. Send Customer notification immediately (email + in-app):

> *"Your payment of [amount] for [camp name] failed on [date]. Please update your payment method before [retry_deadline] to keep your booking."*

Include a direct link to update payment method and retry.

### 7.1A SCA / Authentication Required

Distinct from a card decline. When `payment_intent.last_payment_error.code === 'authentication_required'`:

1. Mark capture `status = 'failed'`, `failure_reason: 'authentication_required'`
2. Send Customer notification with an **authentication link** — not a generic "update your card" message:

> *"Your payment of [amount] for [camp name] requires additional authentication. Please complete authentication before [retry_deadline] to keep your booking."*

Authentication URL: `paymentIntent.next_action.redirect_to_url.url`

3. Set `retry_deadline = now() + 48h`
4. On successful authentication: charge completes automatically → mark `capture.status = 'completed'`
5. On non-completion before deadline: escalate per §7.3

> **[CONFIRM — Stripe]** Confirm recommended SCA retry flow for off-session charges under Direct Charges (Standard connected accounts). Specifically: whether the authentication link approach above is the correct flow, and whether there are Standard-account-specific constraints. (Response pending from Christopher, Stripe Support.)

### 7.2 On Customer Retry (within 48h)

Customer updates their payment method and initiates retry. Create new PaymentIntent (same parameters as §5.4). On success: mark `capture.status = 'completed'`.

### 7.3 On Retry Deadline Passing Without Payment

Flag booking `status = 'payment_review'`. Alert admin. Do not automatically cancel. Admin options:
- Grant extension (extend `retry_deadline`)
- Cancel booking → triggers Provider Cancellation refund flow (§9.3)
- Escalate to Provider

### 7.4 Failure Prevention — Pre-Capture Notifications

Send Customer notifications before each scheduled capture:

| Timing | Message |
|---|---|
| 30 days before capture date | "Your balance of [amount] for [camp name] will be charged on [date]. Ensure your card details are up to date." |
| 7 days before capture date | Reminder: same message |
| If saved card expires before capture date | Dashboard banner at next login: "Your card expires before your upcoming payment for [camp name]. Please update your payment method." |

---

## 8. Scheduled Capture Cron Engine

Runs **hourly**. For each `booking_scheduled_captures` record where `scheduled_date <= now()` and `status = 'scheduled'`:

1. Load Booking. If `booking.status = 'cancelled'` → mark capture `cancelled`, skip.
2. Mark capture `status = 'processing'`.
3. Fire off-session PaymentIntent (§5.4 or §5.5).
4. On success → mark `completed`, store `payment_intent_id`, send Provider and Customer success notifications.
5. On failure → execute §7.1 failure flow.

Each execution writes an audit entry (§11).

---

## 9. Cancellation Handling

### 9.1 Customer Cancellation — Within 24-Hour Grace Window

Auth-hold cancelled. No capture, no refund call, no Stripe fees. All scheduled captures cancelled.

See §5.3. The deposit has not been captured at this point — cancelling the PaymentIntent releases the hold automatically.

### 9.2 Customer Cancellation — After Grace, Before Any Balance Capture

Deposit forfeited. No refund call. Cancel all scheduled future captures.

```js
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'customer_cancellation' }
});
// Update booking status
await db.bookings.update({ where: { id: booking.id }, data: { status: 'cancelled' } });
```

Customer is not charged anything further.

### 9.3 Customer Cancellation — After Capture 1, Before Capture 2 (Two-Stage Only)

Deposit + Capture 1 amount: forfeited (already non-refundable). Cancel Capture 2. No refund call.

```js
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, capture_number: 2, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'customer_cancellation' }
});
```

### 9.4 Customer Cancellation — After All Captures

Everything forfeited. No action needed. Update booking status to `cancelled`.

### 9.5 Provider Cancellation

Full refund of all captured amounts (deposit + any balance captures). Platform Fee refunded on all. All scheduled future captures cancelled. Provider listings suspended pending admin review (PT v1.6 §17.2).

```js
// Cancel future captures
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'provider_cancellation' }
});

// Refund deposit
await stripe.refunds.create({
  payment_intent: booking.deposit_payment_intent_id,
  refund_application_fee: true,
  metadata: { reason: 'provider_cancellation' }
}, { stripeAccount: provider.stripeAccountId });

// Refund each completed balance capture
for (const capture of booking.completed_captures) {
  await stripe.refunds.create({
    payment_intent: capture.payment_intent_id,
    refund_application_fee: true,
    metadata: { reason: 'provider_cancellation', capture_id: capture.id }
  }, { stripeAccount: provider.stripeAccountId });
}

// Suspend Provider
await db.providers.update({
  where: { id: provider.id },
  data: { status: 'suspended', suspension_reason: 'provider_cancellation' }
});
```

If Provider's Stripe balance is insufficient: Stripe will attempt to debit the Provider's linked bank account where account configuration and country support this. Recovery is not guaranteed across all jurisdictions or account types. The Provider's contractual obligation to maintain sufficient funds applies regardless (PT v1.6 §6.6).

> **[CONFIRM — Stripe]** Verify negative balance recovery behaviour for our four launch countries: US, UK, Eurozone, Switzerland. Specifically: (a) whether Stripe automatically debits the linked bank account in each jurisdiction; (b) any account-type or onboarding conditions required; (c) what happens if recovery fails. This determines provider onboarding eligibility by country.

### 9.6 Force Majeure — Admin Bulk Action

Required admin tooling (PT v1.6 Annex A §A.4):

1. Admin selects affected Bookings (filter by Programme date range, Provider, region)
2. All scheduled future captures cancelled immediately
3. All captured amounts refunded to Customers, **excluding Platform Fee** (general rule — PT v1.6 §7.4(c))
4. Admin option: refund Platform Fee too (discretionary, for catastrophic / industry-wide events)
5. Audit entry written with: operator identity, FM event description, affected Booking count, total refunded, Platform Fee disposition

```js
// Step 1 — Cancel future captures
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: { in: affectedBookingIds }, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'force_majeure', fm_event_id: fmEvent.id }
});

// Step 2 — Refund all captured amounts, retain Platform Fee
for (const booking of affectedBookings) {
  for (const capture of booking.all_captured_payments) {
    const refundAmount = capture.amount_minor_units - capture.platform_fee_minor_units;
    await stripe.refunds.create({
      payment_intent: capture.payment_intent_id,
      amount: refundAmount,
      refund_application_fee: false,
      metadata: { reason: 'force_majeure', fm_event_id: fmEvent.id }
    }, { stripeAccount: provider.stripeAccountId });
  }
}

// Step 3 (optional, admin discretion) — Refund Platform Fee
if (adminElectsPlatformFeeRefund) {
  for (const booking of affectedBookings) {
    for (const capture of booking.all_captured_payments) {
      await stripe.refunds.create({
        payment_intent: capture.payment_intent_id,
        amount: capture.platform_fee_minor_units,
        refund_application_fee: true,
        metadata: { reason: 'force_majeure_platform_fee_discretionary', fm_event_id: fmEvent.id }
      }, { stripeAccount: provider.stripeAccountId });
    }
  }
}
```

Note: in most FM scenarios the event occurs before balance captures have fired. In that case, the captures are simply cancelled and the only captured amount is the deposit. The refund exposure is small.

---

## 10. Platform Fee

- Rate: 15% of each captured amount. Read from `provider.platform_fee_rate`; 15% is the default. Do not hard-code.
- Applied via `application_fee_amount` on every PaymentIntent (deposit and each balance capture).
- Provider-facing displays must make clear: "You receive gross price minus 15% Platform Fee minus Stripe processing fees."

**Refunded (`refund_application_fee: true`) in:**
- In-grace Customer cancellation
- Provider cancellation
- FM with admin election to refund Platform Fee (discretionary)

**Retained (`refund_application_fee: false`) in:**
- All Customer cancellations after grace (no refund call fires anyway for pre-capture cancellations)
- FM — general rule

---

## 11. Webhook Subscriptions

| Event | Handler |
|---|---|
| `account.updated` | Sync Provider account state (active / restricted / disabled). Block new Bookings if not active. |
| `payout.created` | Grace window check (§6.2). Alert admin if manual payout during active grace period. |
| `payout.failed` | Alert Provider and admin. |
| `payment_intent.payment_failed` | Trigger §7.1 capture failure flow. |
| `charge.dispute.created` | Alert Provider with evidence deadline countdown; alert admin. |
| `charge.refunded` | Update Booking and capture records. |
| `account.application.deauthorized` | Immediately suspend all Provider Listings; alert admin. |

---

## 12. Audit Trail

Every payment event must write an append-only entry to `booking_payment_audit`:

| Field | Notes |
|---|---|
| `id` | uuid |
| `timestamp_utc` | server time |
| `actor` | 'system' / operator name / customer ID |
| `event_type` | deposit_captured, grace_refund, capture_scheduled, capture_fired, capture_failed, capture_cancelled, provider_cancellation_refund, fm_action, etc. |
| `booking_id` | |
| `capture_id` | null for deposit events |
| `payment_intent_id` | |
| `amount_minor_units` | |
| `currency` | |
| `prior_status` | |
| `new_status` | |
| `reason_text` | required for all admin and FM actions |
| `fm_event_id` | null unless FM action |
| `platform_fee_disposition` | 'retained' or 'refunded', populated for refund events |

Retain 7 years (PT v1.6 §23.3). No UPDATE or DELETE on rows — corrections are new entries referencing the original.

---

## 13. Data Model

### booking_scheduled_captures (new table)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `booking_id` | uuid | FK → bookings |
| `capture_number` | int | 1–4 for balance captures; 0 for deferred deposit capture |
| `scheduled_date` | date | absolute UTC date, resolved at Booking Request time |
| `amount_minor_units` | int | resolved at Booking Request time |
| `currency` | varchar(3) | |
| `status` | enum | `scheduled` / `processing` / `completed` / `failed` / `cancelled` |
| `payment_intent_id` | varchar | null until completed |
| `failure_reason` | varchar | null unless failed |
| `retry_deadline` | timestamp | set on first failure |
| `cancelled_reason` | varchar | |
| `fm_event_id` | varchar | null unless cancelled by FM |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### bookings (additions)

| Field | Notes |
|---|---|
| `deposit_payment_intent_id` | Stripe PI ID for the deposit charge |
| `acceptance_time` | UTC timestamp of Provider Accept (existing) |
| `grace_deadline` | UTC timestamp = `booking_request_time + 24h` |
| `capture_mode` | enum: `binary` / `two_stage` / `custom` |
| `capture_date_1` | absolute UTC date, resolved at Booking Request |
| `capture_date_2` | absolute UTC date, null if binary |
| `capture_date_3` | absolute UTC date, null unless custom with 3+ events |
| `capture_date_4` | absolute UTC date, null unless custom with 4 events |
| `capture_1_amount_minor_units` | |
| `capture_2_amount_minor_units` | null if binary |
| `capture_3_amount_minor_units` | null unless custom |
| `capture_4_amount_minor_units` | null unless custom |
| `saved_payment_method_id` | Stripe payment method ID for off-session charges |
| `deposit_captured_at` | UTC timestamp; null until deposit is captured |

---

## 14. What Changes from v1.1

| Area | v1.1 | v2.0 |
|---|---|---|
| Auth hold at Booking Request | Full booking price | Deposit only |
| Capture at Acceptance | Full price (or deposit) | Deposit only |
| Balance capture timing | balance-due date (any time after acceptance) | Commitment date (when non-refundable by definition) |
| Connected account type | Express (assumed) | Standard (confirmed with Stripe) |
| Payout to Provider | Manual Tranche releases triggered by World Camps | Standard Stripe automatic payouts — no platform intervention |
| Tranche engine | Complex multi-band algorithm | Removed |
| Customer cancellation refunds | Stripe refund calls in most scenarios | Only in-grace cancellation needs a call (cancel auth-hold); all other cancellations = cancel future captures, no refund call |
| Cancellation policy structure | 4 tiers × 4 bands (Flexible / Moderate / Strict / Custom) | Binary / Two-Stage / Custom (up to 4 capture events) |
| Provider drain risk | Managed via monitoring + contractual prohibition | Structurally eliminated |
| Provider payout schedule | `interval: 'manual'` | Provider-managed (Standard account); no platform configuration |
| Grace period | 48h from acceptance time | 24h from request submission |
| Deposit capture timing | At acceptance | At grace_deadline or acceptance, whichever is later |
| delay_days | Planned (now known to be unavailable on Standard) | Removed |
| Grace payout monitoring | payout.created webhook watch | Removed — not needed by design |

---

## 15. Build Checklist

### Provider Onboarding
- [ ] Standard connected account onboarding via Stripe Connect (§4)
- [ ] Camp type selector; pre-populate payment config defaults per §3.1
- [ ] Deposit: percentage, fixed-amount, or no-deposit toggle with validation (§3.2)
- [ ] Capture mode: Binary / Two-Stage / Custom policy builder (§3.3 / §3.4 / §3.4A)
- [ ] Binary: commitment date field (days-before-start for beta; fixed calendar date V2)
- [ ] Two-Stage: Capture Date 1 + percentage + Capture Date 2 fields
- [ ] Custom: refund percentage dropdowns per time band; system derives capture events
- [ ] Special circumstances: medical / FM / weather toggle with refund percentage selector
- [ ] Validation rules (§3.5) enforced on save and on Listing activation
- [ ] No payout schedule configuration — Provider manages via their own Stripe dashboard

### Booking Request
- [ ] Auth hold on deposit amount only — `capture_method: 'manual'` (§5.1)
- [ ] Set `grace_deadline = booking_request_time + 24h` on Booking record
- [ ] Resolve absolute capture dates from Provider config at request time
- [ ] Create `booking_scheduled_captures` records with resolved dates and amounts
- [ ] Store `deposit_payment_intent_id` and `saved_payment_method_id` on Booking
- [ ] Store consent snapshot (§5.1)

### Acceptance
- [ ] Record `acceptance_time` on Provider Accept (§5.2)
- [ ] Check `now() >= grace_deadline`
  - If yes → capture deposit immediately
  - If no → create deferred deposit capture record (`type: deposit`, `scheduled_date: grace_deadline`)
- [ ] Notify Customer: confirmation email with charge schedule; include grace deadline if still active

### Cancellation — Customer within Grace
- [ ] Cancel auth-hold: `stripe.paymentIntents.cancel` — no refund call needed (§5.3)
- [ ] Cancel all `scheduled` captures for this booking (including any deferred deposit capture)

### Cancellation — Customer after Grace
- [ ] Cancel all `scheduled` captures (§9.2 / §9.3)
- [ ] No refund call

### Cancellation — Provider
- [ ] Cancel all scheduled captures (§9.5)
- [ ] Refund deposit + all completed captures, `refund_application_fee: true`
- [ ] Set Provider `status = 'suspended'`

### Scheduled Capture Cron
- [ ] Hourly cron: process due `scheduled` captures (§8)
- [ ] Off-session PaymentIntent creation and confirmation
- [ ] Success path: mark `completed`, notify Provider + Customer
- [ ] Failure path: §7.1 flow

### Capture Failure Handling
- [ ] Immediate Customer notification on failure with retry link (§7.1)
- [ ] 48h retry deadline; mark `payment_review` on deadline pass
- [ ] Admin alert and flag on deadline pass
- [ ] Pre-capture notifications: 30-day and 7-day emails (§7.4)
- [ ] Card expiry warning banner if card expires before a scheduled capture date

### Force Majeure Admin Tooling
- [ ] Bulk booking selector (filter by date range, Provider, region)
- [ ] One-action: cancel all future captures + issue refunds (§9.6)
- [ ] Admin toggle: refund Platform Fee (discretionary)
- [ ] Audit entry with all required fields

### Webhooks
- [ ] `account.updated` — Provider account state sync
- [ ] `payment_intent.payment_failed` — trigger failure flow (§7.1 / §7.1A)
- [ ] `charge.dispute.created` — Provider evidence deadline alert
- [ ] `charge.refunded` — record sync
- [ ] `account.application.deauthorized` — listing suspension

Note: `payout.created` monitoring is **not required**. Under Standard accounts with the 24h-from-request grace architecture, no amount is captured while still refundable, so Provider payouts are always legitimate by the time they occur.

### Customer-Facing
- [ ] Checkout: display full charge schedule (deposit auth-hold now; capture date = grace deadline or acceptance; each balance capture date and amount)
- [ ] Checkout: explicit Customer acknowledgement checkbox (cancellation policy + charge schedule) — **required for SCA mandate compliance and dispute evidence**
- [ ] Checkout: store consent snapshot (exact policy text shown, timestamp, IP) in `booking_consent_snapshots` table at submission
- [ ] Booking confirmation email: charge schedule with dates and amounts
- [ ] 30-day pre-capture notification email
- [ ] 7-day pre-capture reminder email
- [ ] Capture success confirmation email
- [ ] Capture failure email with retry link (generic card issue)
- [ ] Capture failure email with authentication link when `failure_reason = 'authentication_required'` (§7.1A)

### Provider-Facing
- [ ] Booking detail: show deposit received, upcoming capture dates, amounts
- [ ] Earnings dashboard: upcoming captures, completed captures, Stripe payout timeline
- [ ] Notification on each balance capture completing

### Admin
- [ ] Booking payment audit log viewer
- [ ] Manual capture override (delay or cancel individual capture)
- [ ] FM bulk action panel (§9.6)
- [ ] `payment_review` booking queue (failed captures awaiting resolution)

### Data Model
- [ ] Create `booking_scheduled_captures` table (§13) — supports deposit deferred capture (type: deposit) and up to 4 balance captures
- [ ] Add fields to `bookings` table (§13) — including `grace_deadline`, `deposit_captured_at`, `capture_mode`, up to 4 capture dates/amounts
- [ ] Create `booking_payment_audit` append-only table (§11)
- [ ] Create `booking_consent_snapshots` table

---

## 16. Cancellation Policy — Customer-Facing Strings

Generated dynamically from Provider configuration. Examples:

**Binary, 30 days before start:**
*"Full refund of your balance if you cancel 30 or more days before the programme starts. Non-refundable within 30 days. Deposit non-refundable 24 hours after your booking request."*

**Two-Stage, 60 days (50%) + 30 days (50%):**
*"Full refund of your balance if you cancel 60 or more days before the programme starts. 50% of your balance is non-refundable from 60 days before start; the remaining 50% is non-refundable from 30 days before start. Deposit non-refundable 24 hours after your booking request."*

**US Residential, fixed calendar date (1 March):**
*"Full refund of your balance if you cancel before 1 March 2026. Non-refundable from 1 March 2026. Deposit non-refundable 24 hours after your booking request."*

These strings feed the Listing detail page, checkout summary, and booking confirmation email.

---

## 17. Revision History

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-05-21 | Initial consolidated spec (superseded) |
| v1.1 | 2026-05-22 | Deposit modes, balance-due date, Tranche algorithm update (superseded) |
| v2.0 | 2026-05-27 | Full architectural rewrite. Capture-when-non-refundable model replaces Tranche engine. Binary and Two-Stage capture modes replace four-tier cancellation policy. Automatic Stripe payouts replace manual Tranche releases. |
| v2.1 | 2026-06-01 | Engineering review fixes: (1) `on_behalf_of` removed from §5.1 and §5.4 (redundant under Direct Charges); (2) `setup_future_usage: 'off_session'` added to deposit PaymentIntent §5.1; (3) `§7.1A` SCA/authentication-required failure flow added; (4) §9.5 negative balance language softened; (5) consent snapshot requirement added to §5.1 and §15; (6) two [CONFIRM — Stripe] flags added (§4 delay_days enforceability; §9.5 negative balance recovery by country). |
| v2.2 | 2026-06-01 | Added §5.1A: 72-hour Provider acceptance window as explicit payment flow step. Auth-hold validity, decline/expiry cancellation flow, and relationship to `delay_days` (which covers the post-capture grace window, not the pre-capture acceptance window) now documented. |
| v2.3 | 2026-06-03 | Major architecture update following Stripe Support confirmation (Christopher, June 2026). (1) Connected account type changed to Standard throughout — Express removed. (2) `delay_days` removed from §4 — not available on Standard accounts and not needed by design. (3) Grace period changed from 48h post-acceptance to 24h from request submission; deposit capture deferred to `grace_deadline` rather than at acceptance. (4) §5.2 and §5.3 rewritten with deferred capture logic. (5) §6 rewritten — manual payout monitoring removed; Standard automatic payouts confirmed as correct behaviour. (6) Custom policy mode added (§3.4A, §2 table, §15 checklist) — up to 4 capture events. (7) No-deposit option added to §3.2. (8) Data model updated — `grace_deadline`, `deposit_captured_at`, up to 4 capture date/amount fields, `capture_mode: custom`. (9) `payout.created` webhook removed from §15. (10) Customer-facing strings updated to reference 24h grace. (11) §14 comparison table updated. |

---

*End of specification.*
