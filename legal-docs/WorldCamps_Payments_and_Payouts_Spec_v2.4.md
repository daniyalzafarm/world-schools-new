# Payments and Payouts — Engineering Specification

**Version:** v2.4
**Date:** 2026-06-12
**Owner:** Alex Peipers (Legal)
**Recipient:** Daniyal (Engineering Lead); cc Stephanie (Design)
**Status:** Supersedes v2.3 in full. Reconciles the spec with Provider Terms v1.7, Customer (Parent) Terms v1.4, and Privacy Policy v1.5 (pending publication) following the June 2026 query round.

---

## 1. What Changed and Why

The v1.1 spec captured the full booking value at acceptance and held it in the Provider's Stripe balance, releasing funds via a scheduled Tranche engine. That model had a structural flaw and was replaced (v2.0+) with a single organising principle:

**Capture money only when it is already non-refundable. Once captured, it is immediately the Provider's.**

This is a deliberate risk posture, not a default. It is the right one for a consumer marketplace handling parents' prepayments for children's programmes from an as-yet-unproven provider base: a failed refund to a parent is a far worse outcome for the Platform than a Provider waiting longer for funds. (Early payout to vetted, high-volume Providers remains a possible *future* feature; it is out of scope for launch and is not a configuration toggle — see §1.1.)

**Key architectural decisions, confirmed with Stripe Support (Christopher, June 2026):**
- Connected account type: **Standard** (not Express). Under Standard + Direct Charges, the Provider is the merchant of record and carries full liability for refunds, disputes, and negative balances; the Platform has no liability for these. Stripe debits the Provider's own bank account to recover negative balances (see §9.5). Express would reverse this liability allocation onto the Platform.
- `delay_days` is **not available** on Standard accounts. The Platform cannot control Provider payout timing. This is not needed — the capture-when-non-refundable rule means no refundable money ever reaches the Provider.
- Payout behaviour: **Standard Stripe automatic payouts**. No platform-side restrictions.

Consequences:
- No funds ever sit in the Provider's Stripe balance while still refundable.
- No Tranche release engine — Stripe's automatic payout schedule handles everything.
- Customer cancellations before a capture date require no refund call — the charge simply never fires.
- Provider-drain risk is eliminated structurally, not mechanically.

### 1.1 Relationship to the contractual documents

Where this spec and the contractual documents conflict, **the contractual documents prevail** (Provider Terms, Customer Terms, Privacy Policy). This version was produced specifically to remove the conflicts identified in the June 2026 query round; §18 records each reconciliation. Two contractual invariants override anything in this spec:

1. **No amount may be captured before the Provider accepts the Booking** (CT §5.2, §7.4; PT §6.2). The deposit authorisation hold is the only pre-acceptance financial event and is not a payment.
2. **Cancellation refund percentages apply to the balance only**; the deposit is non-refundable once the 24-hour grace window expires (CT §8.3).

---

## 2. Architecture Overview

Every booking has exactly two payment types:

**Deposit** — auth-held at booking request; captured once the 24-hour grace window expires (or immediately at acceptance if grace has already expired, including under the 7-day exclusion in §3.5); non-refundable from capture.
**Balance** — captured on the commitment date(s) derived from the Provider's Cancellation Policy; non-refundable immediately upon capture.

### 2.1 Cancellation Policy is the user-facing layer; capture modes are internal

The **Cancellation Policy** a Provider selects is the contractual and user-facing construct. Its canonical names — **Flexible, Moderate, Strict, and Custom** — are mandated by PT §7.1 and CT §8.2 and **must be the only names shown** in any Provider-facing or Customer-facing interface. The Provider never selects a "capture mode."

Internally, each Cancellation Policy compiles to a **refund schedule** (a refund percentage for each days-to-start band). The capture engine then **derives capture events** from the points at which the refund percentage drops: each time a portion of the balance becomes non-refundable, a capture is scheduled at that boundary date.

The shapes that fall out of this derivation are described internally as:

| Internal shape | Falls out when | Example |
|---|---|---|
| **Binary** | the schedule has a single drop point | 100% refund until 30 days before start, 0% thereafter → one capture at 30 days |
| **Two-Stage** | the schedule has two drop points | 100% → 50% at 60 days → 0% at 30 days → captures at 60 and 30 days |
| **Custom** | three or four drop points (up to four capture events) | a fully Provider-configured band table |

These labels are **implementation descriptors only**. They must not appear in onboarding, the policy builder, checkout, Listing pages, emails, or the Help Centre. There, the four named tiers are used.

> **[PRODUCT — pending]** The refund schedules behind the three standard tiers (Flexible, Moderate, Strict) — the day-bands and percentages, and the deposit treatment per tier — are being locked with Legal/Product. The engine and the Custom builder can be built against this section now; the three preset schedules drop in when confirmed. **Flexible is expected to carry a zero deposit** so that its "fully refundable" promise is honest (see §3.2 and §18 Q4).

---

## 3. Provider Payment Configuration

### 3.1 Camp Type — Drives Onboarding Defaults

The Provider selects their camp type at onboarding. This pre-populates the payment configuration fields below. All fields remain editable. The "internal shape" column is shown for engineering reference only and is **not** surfaced to the Provider.

| Camp type | Deposit default | Internal shape | Capture Date 1 | Capture Date 2 |
|---|---|---|---|---|
| European day camp | 20% | Binary | 14 days before start | — |
| European residential | 20% | Two-Stage | 60 days before start (50% of balance) | 30 days before start (50%) |
| US day camp | 15% | Binary | 21 days before start | — |
| US residential | 25% | Binary | Fixed calendar date (Provider sets) | — |
| Premium / international | 25% | Two-Stage | 90 days before start (50% of balance) | 60 days before start (50%) |

### 3.2 Deposit

**Configuration model.** Deposit settings are configured at **Provider level as the default**, with a **per-Listing on/off override** (a Listing may switch the deposit *off*; it does not, at launch, take a different deposit value). This mirrors the Provider-default / per-Listing-override pattern used for the Cancellation Policy (PT §7.1). (Full per-Listing deposit values are a possible post-launch enhancement; out of scope for beta.)

Three deposit sub-modes:

- **Percentage** — X% of gross Booking price (e.g. 20%).
- **Fixed amount** — fixed sum in settlement currency (e.g. £500).
- **No deposit** — the full programme price follows the Cancellation Policy only. There is no separate deposit auth-hold; the entire price is treated as balance and captured on the commitment date(s). See the no-deposit payment-method handling in §5.1A.

Validation: if a fixed-amount deposit is selected, block Listing activation where `deposit_amount >= listing_price`. Error message: *"Your deposit (£X) equals or exceeds this Listing price. Reduce the deposit or switch off the deposit for this Listing."*

**Deposit is non-refundable after grace.** Once captured (i.e. after the 24-hour grace window), the deposit is not returned on a Customer cancellation; cancellation refund percentages run on the balance only (CT §8.3). Provider generosity is therefore expressed by setting a **smaller or zero deposit**, not by making the deposit refundable. In particular, a tier marketed as fully refundable (Flexible) must carry a **zero deposit**.

### 3.3 Capture Schedule — single drop point (internal "Binary")

One commitment date. Full balance charged on that date.

Date mode (Provider selects one):
- **Fixed calendar date** — e.g. "1 March 2026". Best for fixed-season camps.
- **Days before programme start** — e.g. "30 days before start". Best for rolling booking windows. Resolved per §3.6.

### 3.4 Capture Schedule — two drop points (internal "Two-Stage")

Two capture dates. Provider configures:
- **Capture Date 1** — date + percentage of balance to capture (default 50%).
- **Capture Date 2** — date; captures the remainder (auto-calculated).
- Each date uses the same fixed-calendar / days-before-start modes as §3.3, resolved per §3.6.

### 3.4A Capture Schedule — Custom (up to four drop points)

Up to four capture events, derived from the Custom policy builder's time bands:

| Band | Days before start | Provider sets |
|---|---|---|
| Band 1 | 90+ days | Refund % if cancelled in this band |
| Band 2 | 60–89 days | Refund % |
| Band 3 | 30–59 days | Refund % |
| Band 4 | Under 30 days | Refund % |

The system derives capture events from transitions between bands. Each time the refund percentage drops, the newly non-refundable portion is scheduled for capture at the boundary date (resolved per §3.6). Bands with the same refund percentage generate a single capture at the first boundary where the percentage drops.

> Note: these 90+/60–89/30–59/<30 bands are the **Custom builder's** configurable bands. They are **not** a global replacement for the named tiers. Flexible / Moderate / Strict each resolve to their own preset schedule (per §2.1, pending product lock), which the same engine compiles.

### 3.5 Validation Rules

- Capture Date 2 must be later than Capture Date 1; all capture dates must be before the programme start date.
- If using fixed calendar dates: dates must be in the future at the time of Listing activation.
- **Late-booking / past-due rule.** At booking time, if a capture date resolves to a date already in the past (e.g. a last-minute booking after the first capture date has passed), the corresponding portion becomes due at `max(capture_date, grace_deadline, acceptance_time)`. The inclusion of `acceptance_time` is mandatory: **no capture may ever fire before the Booking is accepted** (§1.1, §8). `grace_deadline` is defined in §5.1.
- **7-day grace exclusion.** Where the programme start date is within seven (7) days of the Booking Request, the 24-hour grace window does not apply (CT §8.4(b), PT §7.3). Implement by setting `grace_deadline = booking_request_time`, so the deposit's "grace already expired" branch is always true and the deposit captures **at the Acceptance Time** (never at request time — §1.1 invariant 1).
- Platform Fee rate: read from `provider.platform_fee_rate`; default 15%. Do not hard-code.

### 3.6 Day-counting and timezone convention

This convention is authoritative for resolving every "N days before start" boundary — both capture dates and cancellation-policy bands — to an absolute instant.

- **Calendar days** (not business days).
- **Cutoff: 00:00 (midnight) at the start of the boundary date.** The boundary date is `programme_start_date − N calendar days`. A Customer cancellation submitted *before* that midnight falls in the more generous (earlier) band; at or after it, in the next band. This is the most consumer-favourable reading and matches what is displayed.
- **Timezone anchor: the Programme location's timezone**, with fallback to the **Provider's registered timezone** where the Programme-location timezone is not captured on the Listing. ("30 days before start" is measured where the camp actually runs.)
- **Resolution and storage.** Each boundary resolves to 00:00 in the anchor timezone and is stored as the corresponding **UTC instant** on the Booking record at Booking Request time (§13). The hourly cron (§8) fires a capture once `now() >= scheduled_date` (UTC). Cancellation-band determination compares the cancellation submission time (UTC) against the same stored UTC boundaries.
- **DST/edge cases.** Resolve using the anchor timezone's offset on the boundary date itself (not the booking date), so a DST change between booking and boundary does not shift the intended local midnight.

---

## 4. Stripe Account Setup at Onboarding

Providers connect via **Standard connected accounts**. Stripe handles KYC and onboarding compliance. The Platform uses Direct Charges — every charge is created directly on the Provider's connected account.

```js
// Create or retrieve Standard connected account
const accountLink = await stripe.accountLinks.create({
  account: stripeAccountId,
  refresh_url: `${BASE_URL}/onboarding/stripe/refresh`,
  return_url: `${BASE_URL}/onboarding/stripe/complete`,
  type: 'account_onboarding',
});
```

**No payout schedule configuration by the Platform.** `delay_days` is not available on Standard accounts and is not needed. Providers manage their own payout schedule through their Stripe dashboard. By architecture, no amount is captured while refundable, so there is nothing to hold back.

**Platform Fee** is collected via `application_fee_amount` on each PaymentIntent. Read from `provider.platform_fee_rate` (default 15%). Do not hard-code.

### 4.1 Settlement currency and launch-country scope

Each Listing is denominated in a single settlement currency, determined at onboarding by the Provider's country of registration; each Booking is processed end-to-end in that currency (checkout, capture, refunds, payout) — consistent with PT §6.8. There is **no platform-side currency conversion** and the contractual documents deliberately do **not** enumerate supported currencies.

This spec is the **canonical operational source** for the supported settlement-currency / country list. The list derives from Stripe's supported settlement currencies for each onboarded country.

- **Launch scope:** four countries — United States, United Kingdom, Eurozone, Switzerland → **USD, GBP, EUR, CHF**.
- **Expansion is gated.** Do **not** enable Provider onboarding for additional countries until the negative-balance-recovery position for that country is confirmed (§9.5). Each new country is a new recovery-risk profile. Any currencies already enabled in the build ahead of this (e.g. release v0.23.0) must be reconciled against this gate before Providers in the corresponding countries are onboarded.

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
  metadata: { booking_request_id: bookingRequest.id, type: 'deposit' },
}, { stripeAccount: provider.stripeAccountId });
```

`setup_future_usage: 'off_session'` saves the payment method for future off-session balance captures. The Customer object must be created on the connected account (not the platform account) for this to work under Direct Charges.

Store `depositPI.id` as `deposit_payment_intent_id` on the Booking record.

Also at this point: resolve absolute capture dates from Provider config per §3.6 and store on the Booking record. Create `booking_scheduled_captures` records (status: `scheduled`). These remain inert until acceptance (§8).

**Grace deadline:** Set `grace_deadline = booking_request_time + 24h` on the Booking record — **except** where the 7-day exclusion applies (§3.5), in which case set `grace_deadline = booking_request_time`. This single timestamp drives deposit capture timing.

**Consent snapshot:** Store a record of the exact cancellation policy shown to the Customer at checkout — the exact policy text displayed, deposit amount, grace-window basis, each future capture date and amount, and refundability — together with a **timestamp and the Customer's IP address**, tied to this Booking record (`booking_consent_snapshots`). This is dispute evidence and satisfies the SCA mandate requirement for off-session charges. Retention: §12 (10 years).

### 5.1A No-deposit Listings — payment-method setup at Booking Request

For a no-deposit Listing there is no deposit PaymentIntent, so the card-saving, SCA mandate, and consent-snapshot anchor that the deposit PI normally provides must be created explicitly. At Booking Request:

```js
const setupIntent = await stripe.setupIntents.create({
  customer: stripeCustomerId,
  payment_method: paymentMethodId,
  usage: 'off_session',
  confirm: true,
  metadata: { booking_request_id: bookingRequest.id, type: 'no_deposit_mandate' },
}, { stripeAccount: provider.stripeAccountId });
```

This (i) validates the card, (ii) saves the payment method for later off-session balance captures, and (iii) captures the SCA mandate. Store the consent snapshot exactly as in §5.1. Store `setupIntent.payment_method` as `saved_payment_method_id` on the Booking.

**Near-term no-deposit bookings.** Where the 7-day exclusion applies (§3.5) to a no-deposit Listing, the full price is captured off-session at the Acceptance Time. The Booking must **not** be marked `confirmed` until that capture **succeeds** — do not commit a Provider's slot on an unsecured card. If the capture fails, run the §7 failure flow and hold the Booking in `payment_review`; it is not a confirmed Booking until funds are secured.

### 5.1B Provider Acceptance Window — 72 Hours

After the booking request is submitted and the auth-hold (or SetupIntent, for no-deposit) is placed, the Provider has up to **72 hours** to accept or decline (CT §5.2 / PT §5.1). The Acceptance Window is the lesser of 72 hours or the period ending 24 hours before programme start.

During this window:
- No funds have been captured; there is no payout risk.
- `booking_scheduled_captures` records exist (status `scheduled`) but the capture engine will not fire any of them until after Acceptance (§8).

**If the Provider declines or the window expires without response:**
- Release the auth-hold by cancelling the deposit PaymentIntent (no action needed for a SetupIntent).
- Cancel all `scheduled` captures for this booking.
- Notify the Customer.

```js
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

### 5.2 Provider Accepts — Deposit Capture or Deferred; re-resolve past-due captures

On the Provider's Accept click, record `acceptance_time` = server UTC timestamp.

**(a) Deposit.** Check whether the grace window has already expired:

```js
const now = new Date();
const graceExpired = now >= booking.grace_deadline; // always true under the 7-day exclusion

if (graceExpired) {
  await stripe.paymentIntents.capture(
    booking.deposit_payment_intent_id, {},
    { stripeAccount: provider.stripeAccountId }
  );
  await db.bookings.update({ where: { id: booking.id },
    data: { status: 'confirmed', deposit_captured_at: now } });
} else {
  await db.booking_scheduled_captures.create({ data: {
      booking_id: booking.id, type: 'deposit',
      scheduled_date: booking.grace_deadline,
      amount_minor_units: booking.deposit_amount_minor_units, status: 'scheduled' } });
  await db.bookings.update({ where: { id: booking.id },
    data: { status: 'accepted_grace_pending' } });
}
```

**(b) Re-resolve past-due balance captures (mandatory).** Because scheduled balance captures were resolved at Booking Request time, a near-term booking may have a balance `capture_date` already in the past at the Acceptance Time. For every balance capture whose `scheduled_date < acceptance_time`, reset `scheduled_date = acceptance_time`. This enforces the §3.5 `max(capture_date, grace_deadline, acceptance_time)` rule and guarantees no capture is dated before the contract existed.

**In practice:** most Providers accept after several hours or days, so the grace deadline has usually already passed and immediate deposit capture is the common path. Deferred capture only triggers when a Provider responds within the grace window.

### 5.3 Grace Period — 24 Hours from Request Submission (with 7-day exclusion)

The grace window runs from `booking_request_time` to `grace_deadline`, regardless of when the Provider accepts. Where the 7-day exclusion applies, there is effectively no grace window (`grace_deadline = booking_request_time`).

**If the Customer cancels before `grace_deadline`** (deposit not yet captured): cancel the auth-hold; cancel all scheduled captures. No refund call, no Stripe fees lost.

```js
await stripe.paymentIntents.cancel(
  booking.deposit_payment_intent_id,
  { cancellation_reason: 'requested_by_customer' },
  { stripeAccount: provider.stripeAccountId }
);
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'grace_period_cancellation' }
});
```

**If `grace_deadline` passes with no cancellation** and a deferred deposit capture was scheduled, the cron engine (§8) fires it. Deposit is permanently non-refundable from that point.

### 5.4 Scheduled Capture — Balance

Executed by the cron engine (§8) when `scheduled_date <= now()` **and the Booking is accepted** (§8 step 1).

```js
const balancePI = await stripe.paymentIntents.create({
  amount: capture.amount_minor_units,
  currency: provider.settlementCurrency.toLowerCase(),
  customer: booking.stripe_customer_id,
  payment_method: booking.saved_payment_method_id,
  off_session: true,
  confirm: true,
  application_fee_amount: Math.round(capture.amount_minor_units * provider.platform_fee_rate),
  metadata: { booking_id: booking.id, capture_id: capture.id, type: 'balance_capture_1' },
}, { stripeAccount: provider.stripeAccountId });
```

On success: mark `capture.status = 'completed'`, store `payment_intent_id`. Amount is immediately non-refundable and available to the Provider. On failure: execute §7.

### 5.5 Scheduled Capture — Balance Capture Date 2 (two-drop schedules)

Same as §5.4 with `type: 'balance_capture_2'`. Custom schedules may add capture 3 and 4 identically.

---

## 6. Provider Payouts

### 6.1 Standard Automatic Payouts — No Platform Intervention

World Camps does not call `stripe.payouts.create` and does not configure or restrict Provider payout schedules (PT §6.4). Under Standard + Direct Charges, Providers manage their own payout schedule. By the time any amount is captured, it is already non-refundable and belongs to the Provider.

- Deposit → captured at `grace_deadline` or acceptance (whichever is later); Provider accesses via their own payout schedule.
- Balance captures → captured on commitment dates; immediately available.
- Platform Fee → deducted at each capture via `application_fee_amount`; flows to the platform account automatically.

No payout webhooks or payout monitoring are required.

---

## 7. Balance Capture Failure Handling

### 7.1 On First Failure
1. Mark `capture.status = 'failed'`; record `failure_reason`.
2. Set `retry_deadline = now() + 48h`.
3. Send Customer notification immediately (email + in-app):
> *"Your payment of [amount] for [camp name] failed on [date]. Please update your payment method before [retry_deadline] to keep your booking."*

Include a direct link to update payment method and retry.

### 7.1A SCA / Authentication Required

Distinct from a card decline. When `payment_intent.last_payment_error.code === 'authentication_required'`:
1. Mark capture `status = 'failed'`, `failure_reason: 'authentication_required'`.
2. Send Customer notification with an **authentication link** (not a generic "update your card" message):
> *"Your payment of [amount] for [camp name] requires additional authentication. Please complete authentication before [retry_deadline] to keep your booking."*

Authentication URL: `paymentIntent.next_action.redirect_to_url.url`.
3. Set `retry_deadline = now() + 48h`.
4. On successful authentication: charge completes → mark `completed`.
5. On non-completion before deadline: escalate per §7.3.

**Stripe position (Christopher, June 2026):** build this flow on Stripe's documented manual-confirmation flow for off-session payments requiring SCA. The authentication-link approach above is consistent with that guidance, and Stripe's automatic card-updater handles expiring cards. This is **buildable now**.

> **[CONFIRM — Stripe, narrow]** Stripe to confirm whether there are any Standard-connected-account-specific constraints on the off-session SCA retry flow. Not a blocker; build against the documented flow pending confirmation.

### 7.2 On Customer Retry (within 48h)
Customer updates payment method and retries. Create a new PaymentIntent (same params as §5.4). On success: mark `completed`.

### 7.3 On Retry Deadline Passing Without Payment
Flag booking `status = 'payment_review'`. Alert admin. Do not auto-cancel. Admin options: grant extension; cancel booking (→ Provider Cancellation refund flow, §9.5 — where the failure is Provider-side) or Customer-cancellation handling as appropriate; escalate to Provider.

### 7.4 Failure Prevention — Pre-Capture Notifications

| Timing | Message |
|---|---|
| 30 days before capture date | "Your balance of [amount] for [camp name] will be charged on [date]. Ensure your card details are up to date." |
| 7 days before capture date | Reminder: same message. |
| If saved card expires before capture date | Dashboard banner at next login. |

---

## 8. Scheduled Capture Cron Engine

Runs **hourly**. For each `booking_scheduled_captures` record where `scheduled_date <= now()` and `status = 'scheduled'`:

1. Load Booking. **Process only if the Booking has been accepted** — i.e. `booking.status` is one of `accepted_grace_pending` or `confirmed`. If the Booking is still pending acceptance, **skip** (do not capture — §1.1 invariant 1). If `booking.status = 'cancelled'`, mark the capture `cancelled` and skip.
2. Mark capture `status = 'processing'`.
3. Fire the off-session PaymentIntent (§5.4 / §5.5), or the deferred deposit capture (§5.2(a)).
4. On success → mark `completed`, store `payment_intent_id`, notify Provider and Customer.
5. On failure → execute §7.1 / §7.1A.

Each execution writes an audit entry (§12).

---

## 9. Cancellation Handling

### 9.1 Customer Cancellation — Within Grace Window
Auth-hold cancelled; all scheduled captures cancelled. No capture, no refund call, no Stripe fees. See §5.3.

### 9.2 Customer Cancellation — After Grace, Before Any Balance Capture
Deposit forfeited. No refund call. Cancel all scheduled future captures.
```js
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'customer_cancellation' }
});
await db.bookings.update({ where: { id: booking.id }, data: { status: 'cancelled' } });
```

### 9.3 Customer Cancellation — After Capture 1, Before Capture 2
Deposit + Capture 1: forfeited (already non-refundable). Cancel remaining scheduled captures. No refund call.

### 9.4 Customer Cancellation — After All Captures
Everything forfeited. Update booking status to `cancelled`. No action needed.

### 9.5 Provider Cancellation

A Provider-initiated cancellation has **two separable consequences**: an automatic refund, and a discretionary suspension decision. Do not conflate them.

**(a) Refund — automatic.** Full refund of all captured amounts (deposit + any balance captures), Platform Fee refunded on all, and all scheduled future captures cancelled.

```js
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: booking.id, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'provider_cancellation' }
});
await stripe.refunds.create({
  payment_intent: booking.deposit_payment_intent_id,
  refund_application_fee: true,
  metadata: { reason: 'provider_cancellation' }
}, { stripeAccount: provider.stripeAccountId });
for (const capture of booking.completed_captures) {
  await stripe.refunds.create({
    payment_intent: capture.payment_intent_id,
    refund_application_fee: true,
    metadata: { reason: 'provider_cancellation', capture_id: capture.id }
  }, { stripeAccount: provider.stripeAccountId });
}
```

**(b) Suspension — discretionary, via admin review queue (NOT automatic in code).** PT §17.2 and §5.4 make suspension discretionary ("World Camps *may* suspend"). Do **not** auto-set the Provider to `suspended` on cancellation. Instead:

- The Provider cancellation **flags the Provider into an admin review queue** with the cancellation context.
- Suspension is a **manual admin decision** captured through the reason-capture modal (Design Brief UI8: reason text required, 2FA, audit-log row written before the action).

**(c) Trigger.** The reviewable trigger is a **Programme cancellation** (PT §5.4 / §17.2 refer to a "Provider-initiated *Programme* cancellation"), and/or a configurable **pattern threshold** of single-booking cancellations. The cancellation of a single Customer's booking for a legitimate reason (capacity, a safeguarding concern specific to that participant) does **not**, by itself, flag for suspension — though the refund in (a) still applies.

**(d) Scope and severity model.** Suspension scope is proportionate and set by the admin, driven by a severity flag on the suspension record:

| Severity | New bookings | Existing confirmed bookings | Scheduled captures on existing bookings | Default scope |
|---|---|---|---|---|
| **Precautionary / administrative** (e.g. pending review of one cancellation) | Blocked | Continue to run (binding Booking Contracts, PT §5.2; obligations survive per PT §17.1) | **Continue** — the Customer is receiving the service | Affected Listing |
| **Safeguarding / fraud / insolvency** | Blocked | Triaged individually (let run / transfer / cancel-with-refund) | **Paused** — do not take further Customer money for programmes we are not confident will run | Account-wide |

Suspension **always** blocks new Bookings. Whether existing fulfilment and existing scheduled captures continue depends on the severity flag above. Charging Customers on behalf of a suspended Provider is permitted **only** under precautionary suspension where the programmes are genuinely expected to proceed.

**(e) Negative balance / recovery.** Where the Provider's Stripe balance is insufficient for a refund, Stripe debits the Provider's linked bank account. **Stripe position (Christopher, June 2026):** under Standard + Direct Charges the connected account is liable for refunds, disputes, and negative balances, and Stripe debits the Provider's bank account directly; **the Platform carries no liability** for these. The Provider's obligation to maintain sufficient funds applies regardless (PT §6.6, §7.5).

> **[CONFIRM — Stripe, narrow]** For the four launch countries (US, UK, Eurozone, Switzerland): (a) confirm direct bank-account debit operates in each; (b) the end state where recovery fails (does the negative balance remain on the Provider's account; is there any residual Platform exposure; what is the Customer-refund-failure path). This gates onboarding-country **expansion** (§4.1); the four launch countries are confirmed workable from the platform-liability standpoint.

### 9.6 Force Majeure — Admin Bulk Action

Required admin tooling (PT v1.7 Annex A §A.4; FM cash-refund architecture PT §7.4 / CT §8.7):

1. Admin selects affected Bookings (filter by programme date range, Provider, region).
2. All scheduled future captures cancelled immediately.
3. All captured amounts refunded to Customers, **excluding Platform Fee** (general rule — PT §7.4(c) / CT §8.7(c)).
4. Admin option: refund Platform Fee too (discretionary, for catastrophic / prolonged / industry-wide events).
5. Audit entry: operator identity, FM event description, affected Booking count, total refunded, Platform Fee disposition.

```js
await db.booking_scheduled_captures.updateMany({
  where: { booking_id: { in: affectedBookingIds }, status: 'scheduled' },
  data: { status: 'cancelled', cancelled_reason: 'force_majeure', fm_event_id: fmEvent.id }
});
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
if (adminElectsPlatformFeeRefund) { /* refund platform fee per capture, refund_application_fee: true */ }
```

Note: in most FM scenarios the event precedes balance captures, so captures are simply cancelled and the only captured amount is the deposit. Refund exposure is small.

### 9.7 Programme Reschedule by Provider

A Provider may **not** unilaterally change Programme dates after the Acceptance Time (PT §5.3); a change requires the affected Customer's prior consent and notification to World Camps. The capture schedule is therefore **not** silently frozen against the old date.

- **Before acceptance:** no Booking exists; new Booking Requests resolve against the Listing's current dates. No action.
- **After acceptance, Customer consents to the new dates:** treat as an agreed variation. **Recompute** the capture schedule and cancellation bands against the new start date (re-resolve absolute dates per §3.6), regenerate the not-yet-fired `booking_scheduled_captures` accordingly, and **re-capture the consent snapshot** (new schedule shown and re-acknowledged). Amounts already captured and non-refundable are unaffected.
- **After acceptance, Customer does not consent:** the Provider must honour the original dates or cancel. A cancellation here is a **Provider cancellation** and follows §9.5 (full refund; admin review queue).

> **Statutory flag (no code impact):** for residential / international programmes that qualify as packages, a *significant* change of dates may give the consumer a statutory right to terminate with a full refund under the Package Travel Directive, regardless of the mechanic above. Tracked on the PTD risk line (PT/CT Annex A.2).

---

## 10. Platform Fee
- Rate: 15% of each captured amount. Read from `provider.platform_fee_rate`; do not hard-code.
- Applied via `application_fee_amount` on every PaymentIntent (deposit and each balance capture).
- Provider-facing: "You receive gross price minus 15% Platform Fee minus Stripe processing fees."

**Refunded (`refund_application_fee: true`):** in-grace Customer cancellation; Provider cancellation; FM with admin election.
**Retained (`refund_application_fee: false`):** Customer cancellations after grace (no refund call fires anyway); FM general rule.

---

## 11. Webhook Subscriptions

| Event | Handler |
|---|---|
| `account.updated` | Sync Provider account state (active / restricted / disabled). Block new Bookings if not active. |
| `payment_intent.payment_failed` | Trigger §7.1 / §7.1A capture failure flow. |
| `charge.dispute.created` | Alert Provider with evidence deadline countdown; alert admin. |
| `charge.refunded` | Update Booking and capture records. |
| `account.application.deauthorized` | Immediately suspend all Provider Listings; alert admin. |

**Removed:** `payout.created` and `payout.failed` monitoring. Under Standard accounts with the capture-when-non-refundable architecture, no amount is captured while refundable, so Provider payouts are always legitimate by the time they occur. There is no grace-window payout check.

---

## 12. Audit Trail

Every payment event writes an append-only entry to `booking_payment_audit`:

| Field | Notes |
|---|---|
| `id` | uuid |
| `timestamp_utc` | server time |
| `actor` | 'system' / operator name / customer ID |
| `event_type` | deposit_captured, grace_refund, capture_scheduled, capture_fired, capture_failed, capture_cancelled, provider_cancellation_refund, reschedule_recompute, fm_action, suspension_flagged, etc. |
| `booking_id` | |
| `capture_id` | null for deposit events |
| `payment_intent_id` | |
| `amount_minor_units` | |
| `currency` | |
| `prior_status` / `new_status` | |
| `reason_text` | required for all admin, suspension, and FM actions |
| `fm_event_id` | null unless FM action |
| `platform_fee_disposition` | 'retained' or 'refunded', for refund events |

**Retention: 10 years**, aligned with the Swiss Code of Obligations Art. 958f business-records requirement. This figure is harmonised across this spec, Provider Terms §23.3 (to be updated to 10 years in PT v1.8), and Privacy Policy v1.5 §7.2. No UPDATE or DELETE on rows — corrections are new entries referencing the original.

The `booking_consent_snapshots` table (§5.1) is retained on the same **10-year** basis as financial-dispute / SCA-mandate evidence.

---

## 13. Data Model

### booking_scheduled_captures

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `booking_id` | uuid | FK → bookings |
| `capture_number` | int | 1–4 for balance captures; 0 for deferred deposit capture |
| `type` | enum | `deposit` / `balance` |
| `scheduled_date` | timestamp | absolute UTC instant, resolved at Booking Request per §3.6; may be reset to `acceptance_time` per §5.2(b) or recomputed on reschedule per §9.7 |
| `amount_minor_units` | int | resolved at Booking Request |
| `currency` | varchar(3) | |
| `status` | enum | `scheduled` / `processing` / `completed` / `failed` / `cancelled` |
| `payment_intent_id` | varchar | null until completed |
| `failure_reason` | varchar | null unless failed |
| `retry_deadline` | timestamp | set on first failure |
| `cancelled_reason` | varchar | |
| `fm_event_id` | varchar | null unless cancelled by FM |
| `created_at` / `updated_at` | timestamp | |

### bookings (additions)

| Field | Notes |
|---|---|
| `deposit_payment_intent_id` | Stripe PI ID for the deposit charge; null for no-deposit Listings |
| `acceptance_time` | UTC timestamp of Provider Accept |
| `grace_deadline` | UTC timestamp = `booking_request_time + 24h`, or `booking_request_time` under the 7-day exclusion |
| `cancellation_policy_tier` | enum: `flexible` / `moderate` / `strict` / `custom` (user-facing tier) |
| `capture_shape` | internal enum: `binary` / `two_stage` / `custom` (derivation descriptor; never displayed) |
| `programme_timezone` | IANA tz of the Programme location (anchor for §3.6); fallback to Provider registered tz |
| `capture_date_1..4` | absolute UTC instants; null beyond the schedule's drop points |
| `capture_1..4_amount_minor_units` | null beyond the schedule's drop points |
| `saved_payment_method_id` | Stripe payment method ID for off-session charges (from deposit PI or §5.1A SetupIntent) |
| `deposit_captured_at` | UTC timestamp; null until deposit captured (always null for no-deposit Listings) |

### booking_consent_snapshots
Exact policy text shown, deposit/grace/capture schedule, refundability, `timestamp_utc`, `customer_ip`, `booking_id`. Append-only. Retain 10 years (§12).

### provider suspension fields
`status` (`active` / `suspended`), `suspension_reason`, `suspension_severity` (`precautionary` / `safeguarding_fraud_insolvency`), `suspension_scope` (`listing` / `account`), set via the admin review-queue action (§9.5(b)).

---

## 14. Build Checklist

### Provider Onboarding
- [ ] Standard connected account onboarding (§4)
- [ ] Camp type selector; pre-populate config per §3.1
- [ ] Deposit: percentage / fixed-amount / no-deposit, Provider-default with per-Listing on/off override, validation (§3.2)
- [ ] Cancellation Policy selector using the **named tiers** Flexible / Moderate / Strict / Custom only (§2.1); Custom policy builder (§3.4A)
- [ ] Internal: compile selected tier → refund schedule → derived capture events (engine; presets pending product lock)
- [ ] Validation rules (§3.5) incl. late-booking `max(capture_date, grace_deadline, acceptance_time)` and 7-day exclusion
- [ ] Day-counting / timezone convention (§3.6) — capture `programme_timezone` on the Listing
- [ ] No payout schedule configuration

### Booking Request
- [ ] Deposit Listings: auth-hold on deposit only, `capture_method: 'manual'` (§5.1)
- [ ] No-deposit Listings: SetupIntent to save method + capture SCA mandate (§5.1A)
- [ ] Set `grace_deadline` (24h, or = request time under 7-day exclusion)
- [ ] Resolve absolute capture dates per §3.6; create `booking_scheduled_captures` (inert until acceptance)
- [ ] Store `saved_payment_method_id` and consent snapshot (text + timestamp + IP)

### Acceptance
- [ ] Record `acceptance_time`; capture deposit immediately if grace expired, else defer (§5.2(a))
- [ ] Re-resolve any past-due balance `scheduled_date` to `acceptance_time` (§5.2(b))
- [ ] Near-term no-deposit: do not mark `confirmed` until the at-acceptance capture succeeds (§5.1A)

### Cron / Captures
- [ ] Hourly engine processes due captures **only for accepted bookings** (§8 step 1)
- [ ] Off-session PaymentIntent; success/failure paths (§5.4, §7)

### Cancellations
- [ ] Customer in-grace: cancel auth-hold + scheduled captures (§9.1)
- [ ] Customer after grace: cancel scheduled captures, no refund call (§9.2/§9.3)
- [ ] Provider: auto-refund (deposit + captures, `refund_application_fee: true`) + cancel future captures; **flag to admin review queue, no auto-suspend** (§9.5)
- [ ] Suspension action via reason-capture modal; severity drives new-booking block / existing-capture continue-or-pause (§9.5(d))
- [ ] Programme reschedule: recompute on consent; Provider-cancellation flow on non-consent (§9.7)

### Force Majeure
- [ ] Bulk selector; cancel future captures + refunds excl. Platform Fee; discretionary fee refund; audit (§9.6)

### Failure Handling
- [ ] Immediate Customer notification + retry link (§7.1); SCA authentication-link flow (§7.1A)
- [ ] 48h retry deadline → `payment_review`; admin alert
- [ ] 30-day / 7-day pre-capture notifications; card-expiry banner (§7.4)

### Webhooks
- [ ] `account.updated`, `payment_intent.payment_failed`, `charge.dispute.created`, `charge.refunded`, `account.application.deauthorized` — `payout.*` removed (§11)

### Customer-Facing
- [ ] Checkout: full charge schedule + acknowledgement checkbox (SCA mandate + consent snapshot) (§5.1, Design Brief UI6a)
- [ ] Confirmation email; 30-day / 7-day pre-capture emails; capture success/failure emails (incl. authentication-link variant)

### Admin
- [ ] Payment audit log viewer (§12); manual capture override; FM bulk panel; `payment_review` queue; **Provider-cancellation review queue** (§9.5)

### Data Model
- [ ] `booking_scheduled_captures`, `bookings` additions, `booking_payment_audit` (append-only, 10yr), `booking_consent_snapshots` (10yr), provider suspension fields (§13)

---

## 15. Cancellation Policy — Customer-Facing Strings

Generated dynamically from the configured tier. All strings use the named tiers; never "Binary/Two-Stage". Examples:

**Single drop point, 30 days before start:**
*"Full refund of your balance if you cancel 30 or more days before the programme starts. Non-refundable within 30 days. Deposit non-refundable 24 hours after your booking request."*

**Two drop points, 60 days (50%) + 30 days (50%):**
*"Full refund of your balance if you cancel 60 or more days before the programme starts. 50% of your balance is non-refundable from 60 days before start; the remaining 50% from 30 days before start. Deposit non-refundable 24 hours after your booking request."*

**Fixed calendar date (1 March):**
*"Full refund of your balance if you cancel before 1 March 2026. Non-refundable from 1 March 2026. Deposit non-refundable 24 hours after your booking request."*

For no-deposit / Flexible (zero deposit), omit the deposit line. Where the 7-day exclusion applies, replace the deposit line with: *"Because this programme starts soon, the 24-hour free-cancellation window does not apply."*

---

## 16. Open Items Summary

| Item | Type | Status |
|---|---|---|
| Standard-tier refund schedules + per-tier deposit (Flexible = zero) | Product/Legal | Pending lock; engine buildable now (§2.1) |
| No-deposit cost-free-until-first-capture commercial appetite | Product | Mechanism buildable now; appetite confirming (§5.1A) |
| SCA retry — Standard-account specifics | Stripe (narrow) | Build on documented flow now (§7.1A) |
| Negative-balance recovery per launch country + recovery-failure end state | Stripe (narrow) | Gates onboarding-country expansion only (§9.5(e), §4.1) |

---

## 17. Revision History

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-05-21 | Initial consolidated spec (superseded) |
| v1.1 | 2026-05-22 | Deposit modes, balance-due date, Tranche algorithm (superseded) |
| v2.0 | 2026-05-27 | Capture-when-non-refundable rewrite; Tranche engine removed |
| v2.1 | 2026-06-01 | Engineering review fixes; consent snapshot; two Stripe [CONFIRM] flags |
| v2.2 | 2026-06-01 | 72-hour acceptance window as explicit payment step |
| v2.3 | 2026-06-03 | Standard accounts; `delay_days` removed; 24h-from-request grace; deferred deposit capture; Custom mode; no-deposit option |
| **v2.4** | **2026-06-12** | **Reconciliation with PT v1.7 / CT v1.4 / PP v1.5 (June 2026 query round). (1) Named tiers Flexible/Moderate/Strict/Custom established as the sole user-facing taxonomy; Binary/Two-Stage/Custom demoted to internal capture-derivation descriptors (§2.1, §3). (2) Acceptance gate added to the cron engine; late-booking rule → `max(capture_date, grace_deadline, acceptance_time)`; past-due captures re-resolved at acceptance (§3.5, §5.2(b), §8). (3) 7-day grace exclusion added (§3.5, §5.1–§5.3). (4) Balance-only refund base affirmed; deposit non-refundable, Flexible = zero deposit (§3.2). (5) New day-counting/timezone convention — calendar days, midnight cutoff, Programme-location tz (§3.6). (6) Deposit model: Provider default + per-Listing on/off override (§3.2). (7) No-deposit SetupIntent / SCA-mandate / consent-snapshot flow; near-term no-deposit confirmation gating (§5.1A). (8) Programme reschedule handling (§9.7). (9) Currency/country config canonicalised; launch USD/GBP/EUR/CHF; expansion gated (§4.1). (10) Audit log + consent snapshot retention set to 10 years (Swiss CO Art. 958f) (§12). (11) Provider-cancellation suspension rewritten: auto-refund retained, suspension moved to discretionary admin review queue with severity/scope model; PT cross-refs updated v1.6→v1.7 (§9.5). (12) Stripe June 2026 answers folded in: negative-balance liability (no platform exposure) and SCA flow guidance; remaining [CONFIRM]s narrowed. (13) `payout.*` webhooks removed (§11).** |

---

*End of specification.*
