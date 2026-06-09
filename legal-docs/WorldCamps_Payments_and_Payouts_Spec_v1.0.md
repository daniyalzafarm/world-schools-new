# Payments and Payouts — Engineering Specification

**Version:** v1.0 · Locked 2026-05-21 · Counsel-engineering handoff
**Owner:** Alex Peipers (Legal)
**Recipient:** Daniyal (Engineering Lead); cc Stephanie (Design)
**Distribution:** Engineering · Design · Legal

---

## 1. Scope and Supersession

### 1.1 Scope

This specification is the single source of truth for the technical implementation of payments, refunds, and Provider payouts on the World Camps Platform. It covers Stripe Connect onboarding, payment authorisation and capture, Platform Fee mechanics, payout Tranche release, refund processing, Force Majeure handling, currency handling, and audit-trail requirements.

### 1.2 Supersession

This specification supersedes in full:

- `/Handoffs/PAYMENT-CANCELLATION-POLICY.md` (Cancellation, Refund & Payout Architecture v1.0) — archived to `/Handoffs/_superseded/` on adoption of this spec.
- `/Handoffs/DEV-HANDOFF-PAYOUT-CALCULATION-LOGIC.md` — deleted 2026-05-21 (contradicted PT v1.6 §6.3 on fee rate, §6.3 on Stripe-fee absorption, §7.1 on tier names; recorded in `WorldCamps_PaymentsHandoff_Alignment_Memo_v1.0.md`).
- `/Handoffs/DEV-HANDOFF-STRIPE-PAYOUTS.md` — deleted 2026-05-21 (contradicted PT v1.6 §6.3, §6.4, §6.8 on fee rate, payout architecture, currency scope).

### 1.3 Authority

Where this specification appears to conflict with Provider Terms v1.6, Customer Terms v1.3, or Provider Terms Annex A v1.6, the contractual documents prevail and this specification must be revised to match. Where this specification contains detail not covered in the contractual documents, this specification is authoritative as between Legal and Engineering.

### 1.4 Cross-references

- Provider Terms v1.6 §6 (Pricing, Payments, and Platform Fee), §7 (Cancellation Policies and Refunds), §8 (Chargebacks).
- Provider Terms Annex A v1.6 §A.4 (Technical Implementation Requirements).
- Customer Terms v1.3 §5.2 (Booking Request, Acceptance, and contract formation), §7 (Payments, Fees, and Financial Terms), §8 (Cancellation, Refunds, and Chargebacks).
- `WorldCamps_PaymentsHandoff_Alignment_Memo_v1.0.md` — counsel-only cross-check log.

---

## 2. Definitions

The defined terms below are lifted from Provider Terms v1.6 §1 and Customer Terms v1.3 §2. They are reproduced here for engineering convenience; the contractual definitions prevail.

- **Acceptance Time** — the Platform-recorded timestamp of the Provider's click of "Accept" in the Provider Dashboard in respect of a Booking Request. The moment of contract formation.
- **Acceptance Window** — the lesser of 72 hours from Booking Request submission or 24 hours before Programme start.
- **Booking** — a confirmed reservation formed at the Acceptance Time.
- **Booking Request** — a Customer's submitted offer to enter into a Booking Contract; pre-acceptance, no payment has been captured.
- **Customer** — the booking party (typically a parent or guardian).
- **Force Majeure Event** — any event beyond a party's reasonable control, including acts of God, pandemic, epidemic, government-mandated closures, war, civil unrest, terrorism, natural disaster, or regulatory action.
- **Platform Fee** — 15% of the gross Booking value, or such other rate as expressly agreed in writing between the parties. Exclusive of Stripe processing fees.
- **Programme** — the camp, school, or educational programme being booked.
- **Provider** — the operator listing the Programme.
- **Settlement currency** — the single currency in which a Listing is denominated end-to-end (checkout, capture, refunds, payout), determined at Provider onboarding from country of registration.
- **Stripe Connect** — Stripe Connect Express, the third-party integration through which Provider payments and payouts are processed.
- **Tranche** — a scheduled release of funds from the Provider's Stripe balance.

---

## 3. Stripe Connect Onboarding

### 3.1 Account type

Stripe Connect Express. Providers complete Stripe's hosted onboarding flow; Stripe handles compliance, tax forms, identity verification. World Camps stores the `stripe_account_id` on the Provider record once onboarding completes.

### 3.2 Manual payout schedule — mandatory

Every new Provider connected account must have its payout schedule set to manual programmatically during onboarding:

```js
await stripe.accounts.update(stripeAccountId, {
  settings: {
    payouts: {
      schedule: { interval: 'manual' },
    },
  },
})
```

This cannot be left to Stripe's default. Funds must remain in the Provider's Stripe balance until World Camps triggers a Tranche release. (PT v1.6 §6.4 / §6.5; PT Annex A v1.6 §A.4 first bullet.)

### 3.3 Country → settlement currency

Currency is determined at onboarding from the Provider's country of registration. Each Listing is denominated in a single settlement currency. Each Booking is processed end-to-end (checkout, capture, refund, payout) in that currency. (PT v1.6 §6.8.)

**Supported settlement currencies:**

| Settlement currency | Notes                                                          |
| ------------------- | -------------------------------------------------------------- |
| USD                 | Platform external bank account — no platform FX                |
| CHF                 | Platform external bank account (also platform default) — no FX |
| GBP                 | Platform external bank account — no platform FX                |
| EUR                 | Platform external bank account — no platform FX                |
| CAD                 | Settles to platform default (CHF) — platform absorbs FX        |
| AED                 | Settles to platform default (CHF) — platform absorbs FX        |
| AUD                 | Settles to platform default (CHF) — platform absorbs FX        |
| SGD                 | Settles to platform default (CHF) — platform absorbs FX        |
| JPY                 | Settles to platform default (CHF) — platform absorbs FX        |
| CNY                 | Settles to platform default (CHF) — platform absorbs FX        |
| HKD                 | Settles to platform default (CHF) — platform absorbs FX        |
| DKK                 | Settles to platform default (CHF) — platform absorbs FX        |
| SEK                 | Settles to platform default (CHF) — platform absorbs FX        |
| THB                 | Settles to platform default (CHF) — platform absorbs FX        |
| NZD                 | Settles to platform default (CHF) — platform absorbs FX        |

The provider's currency is locked at onboarding and they price/charge only in it (no provider-side FX); the customer pays in that currency, with any conversion applied by their own bank.

The platform holds external bank accounts in CHF/EUR/GBP/USD only. The `application_fee_amount` lands in the platform balance in the provider's currency. For the four bank-account currencies no conversion occurs; for every other supported currency the balance has no matching external account and is converted to the platform's **default (CHF)** account on platform payout, with the platform absorbing that FX. This requires the platform Stripe account to have `default_currency = CHF` and balance currency-conversion-to-default enabled.

The single source of truth for this list in code is `SUPPORTED_CURRENCIES` in `@world-schools/global-utils`. Any expansion of this scope requires a Provider Terms amendment before code change.

### 3.4 Webhooks

Subscribe to: `account.updated`, `account.application.authorized`, `account.application.deauthorized`, `payout.created`, `payout.paid`, `payout.failed`, `transfer.created`, `transfer.failed`, `charge.dispute.created`, `charge.refunded`.

### 3.5 Account states

Track on Provider record: `pending` (onboarding incomplete), `active` (`payouts_enabled` && `charges_enabled`), `restricted` (Stripe requirements outstanding), `disabled` (Stripe `requirements.disabled_reason` set). No Listing may be activated for a Provider in a state other than `active`.

---

## 4. Payment Authorisation and Capture

The Platform operates a request-to-book contract-formation flow. (CT v1.3 §5.2; PT v1.6 §5.1, §6.2; locked architecture memory `request_to_book_architecture.md`.)

### 4.1 Authorisation hold at Booking Request

At Booking Request submission, the Platform places an authorisation hold on the Customer's payment method in the amount payable on formation (the full Booking price, or the deposit portion under a deposit-plus-balance schedule).

```js
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: amountPayableOnFormationInMinorUnits,
    currency: provider.settlementCurrency.toLowerCase(),
    payment_method: paymentMethodId,
    capture_method: 'manual',
    confirm: true,
    application_fee_amount: Math.round(amountPayableOnFormationInMinorUnits * 0.15),
    on_behalf_of: provider.stripeAccountId,
    customer: stripeCustomerId,
    metadata: {
      booking_request_id: bookingRequest.id,
      provider_id: provider.id,
      state: 'authorised',
    },
  },
  { stripeAccount: provider.stripeAccountId }
)
```

Note: `capture_method: 'manual'` is required. No funds are captured at Booking Request submission. The authorisation hold is not a payment received by the Provider.

### 4.2 Capture at Acceptance Time

On the Provider's "Accept" click in the Provider Dashboard, the Platform captures the authorisation hold. The Acceptance Time is the recorded server timestamp at the moment of capture.

```js
await stripe.paymentIntents.capture(
  paymentIntentId,
  {},
  {
    stripeAccount: provider.stripeAccountId,
  }
)
```

The `application_fee_amount` set at authorisation flows to the World Camps platform account at capture. The Provider's net portion lands in the Provider's Stripe balance (held under the manual payout schedule).

### 4.3 Decline, lapse, withdrawal

If the Provider declines, the Acceptance Window lapses without action, or the Customer withdraws before acceptance:

```js
await stripe.paymentIntents.cancel(
  paymentIntentId,
  {},
  {
    stripeAccount: provider.stripeAccountId,
  }
)
```

No capture. The authorisation hold releases to the Customer per the card network's standard process.

### 4.4 Balance payments

Where the Booking is configured as deposit + balance (see §6 Tranche release for deposit configuration), a second PaymentIntent is created on the configured balance-due date with `off_session: true`, `confirm: true`, using the saved payment method. The 15% `application_fee_amount` is applied identically to the balance payment.

### 4.5 Authorisation lifetime edge case

The 7-day standard card authorisation lifetime is sufficient for the 72-hour Acceptance Window in the ordinary course. Where the Window approaches that lifetime (rare — only for late-window edge cases), the Platform must trigger a Customer-consent payment-method refresh per PT §5.1(e).

---

## 5. Platform Fee Mechanics

### 5.1 Rate

**15%** of the gross Booking value, deducted automatically via Stripe's `application_fee_amount` mechanism at every capture (deposit and balance payments alike). (PT v1.6 §1 definition; §6.3.)

The 15% rate is the standard rate. Where a Provider Order Form records a different rate, that rate must be sourced from the Provider record at charge time. Do not hard-code 15% as a literal in the calculation path; read from the Provider's `platform_fee_rate` field with 15% as the default.

### 5.2 Stripe fees — Provider-borne, in addition

Stripe processing fees are charged directly by Stripe under the Stripe Connected Account Agreement and are borne by the Provider in addition to the Platform Fee. **World Camps does not absorb Stripe processing fees within the Platform Fee.** (PT v1.6 §6.3 third paragraph.)

The Provider's effective net per Booking is therefore: Gross Booking Value − Platform Fee − Stripe processing fees (the latter applied by Stripe to the Provider's Stripe balance, not by the Platform).

Provider-facing displays (earnings calculator, payout dashboard) should make this clear. Do not show "Provider receives exactly 85%" — Stripe fees reduce this. Frame as: "Gross price minus 15% Platform Fee minus Stripe processing fees applied to your Stripe account."

### 5.3 Refund of the Platform Fee

The `refund_application_fee` flag on the refund call must be set per the matrix in §7 below. In summary:

| Scenario                                                      | refund_application_fee                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Customer cancellation within 48h grace (from Acceptance Time) | `true`                                                               |
| Customer cancellation after 48h grace, per tier               | `false`                                                              |
| Provider cancellation                                         | `true`                                                               |
| Force Majeure cancellation                                    | `false` (general rule); admin-discretion override available — see §8 |
| Chargeback                                                    | Stripe auto-reverses; not a code path                                |

---

## 6. Tranche Release Engine

This section replaces the hard-coded 3-tranche schedule of the legacy `PAYMENT-CANCELLATION-POLICY.md`. The number, amount, and timing of Tranches vary per Booking and are derived from the Provider's Cancellation Policy and deposit configuration. (PT v1.6 §6.4.)

### 6.1 Deposit configuration

Deposit is **per-Listing, Provider-configurable**. A Listing may be:

- **Deposit + Balance** — Provider specifies deposit percentage (e.g. 20%, 30%) and balance-due date.
- **No deposit** — full Booking price captured at Acceptance.

The Tranche engine must handle both modes.

### 6.2 Cancellation Policy tiers

Each Booking is governed by the Cancellation Policy in effect at the time of Booking. Canonical tier names are mandatory across all surfaces:

- **Flexible** — 100 / 100 / 100 / 0
- **Moderate** — 100 / 100 / 50 / 0
- **Strict** — 100 / 50 / 0 / 0
- **Custom** — Provider-configured within rails (see §6.4)

**Day-bands (same for all standard tiers):**

| Band       | Days before Programme start                 |
| ---------- | ------------------------------------------- |
| Band 1     | 60+                                         |
| Band 2     | 30–59                                       |
| Band 3     | 7–29                                        |
| Band 4     | 0–6                                         |
| Post-start | After Programme start (0% across all tiers) |

**Refund schedule (refund % applied to balance only; deposit treatment in §6.3):**

| Tier     | Band 1 (60+) | Band 2 (30–59) | Band 3 (7–29) | Band 4 (0–6) |
| -------- | ------------ | -------------- | ------------- | ------------ |
| Flexible | 100%         | 100%           | 100%          | 0%           |
| Moderate | 100%         | 100%           | 50%           | 0%           |
| Strict   | 100%         | 50%            | 0%            | 0%           |

The legacy "Super Strict" tier (100/0/0/0) has been dropped. Providers wanting that schedule configure it as a Custom policy.

### 6.3 Deposit treatment

Across all tiers (Flexible / Moderate / Strict / Custom), deposit treatment is fixed and platform-level, **not Provider-configurable**:

- Within the 48-hour grace period (anchored to Acceptance Time — see §7.1): deposit fully refundable.
- After the 48-hour grace period: deposit non-refundable. (CT v1.3 §8.3(a).)
- On Provider cancellation: deposit fully refunded with the rest of the Booking value. (CT v1.3 §8.6.)
- On Force Majeure cancellation: deposit included in the cash refund. (CT v1.3 §8.7(b); PT v1.6 §7.4(b).)

### 6.4 Custom-tier rails `[CONFIRM — Daniyal; cc Stephanie]`

Proposed rails for the Custom-policy editor:

1. **2 to 5 day-bands.** Below 2 is not a policy; above 5 is unintelligible at checkout.
2. **Each refund percentage 0–100%.** No values outside this range.
3. **Monotonic non-increasing.** Refund percentage cannot rise as days-to-start decreases (no "cliff and recovery"; CRD-friendly, intelligible to Customers).
4. **Deposit treatment fixed** per §6.3 — Provider cannot override.
5. **Same day-counting convention** as standard tiers (per §7.2).
6. **Customer-facing one-liner mandatory.** Provider drafts in the Custom-policy editor; admin reviews before activation. Same content restrictions as Camp Rules under PT §14.8 (no waivers, no indemnities, no consumer-protection overrides).
7. **No "after start" refunds.** Post-start refund position is fixed at 0% across all tiers; Provider cancellation (PT §5.4) and Force Majeure (PT §7.4) remain the only pathways after start.

### 6.5 Tranche release algorithm

A Tranche is released only when the corresponding portion of the Booking value has become non-refundable to the Customer, **plus a 48-hour processing buffer**. (PT v1.6 §6.4 second paragraph; PT Annex A v1.6 §A.4 second bullet.)

```
INPUT:
  booking
    .totalPrice
    .depositPercent          // null if no-deposit Listing
    .balanceDueDate          // null if no-deposit Listing
    .acceptanceTime          // server timestamp at capture
    .programmeStartDate
    .cancellationPolicyTier  // 'flexible' | 'moderate' | 'strict' | 'custom'
    .customPolicyBands       // null unless 'custom'
  PROCESSING_BUFFER_HOURS = 48

OUTPUT:
  Ordered list of Tranches, each: { amount, scheduledReleaseTimestamp, description }

ALGORITHM:
  Tranches = []

  // Deposit Tranche (only if deposit configured)
  IF booking.depositPercent != null:
    depositAmount = booking.totalPrice * booking.depositPercent / 100
    depositReleaseAt = booking.acceptanceTime + 48h
    Tranches.append({
      amount: depositAmount,
      scheduledReleaseTimestamp: depositReleaseAt,
      description: 'Deposit'
    })
    balanceAmount = booking.totalPrice - depositAmount
  ELSE:
    balanceAmount = booking.totalPrice

  // Balance Tranches — one per refund-tier drop
  bands = readBands(booking.cancellationPolicyTier, booking.customPolicyBands)
  previousRefundPercent = 100
  remainingBalance = balanceAmount

  FOR EACH band IN bands (ordered from furthest-out to closest-to-start):
    IF band.refundPercent < previousRefundPercent:
      refundDrop = previousRefundPercent - band.refundPercent
      releaseAmount = balanceAmount * (refundDrop / 100)
      IF releaseAmount > 0:
        bandStartDate = booking.programmeStartDate - band.daysBeforeStart
        releaseAt = max(bandStartDate + 48h, booking.acceptanceTime + 48h)
        Tranches.append({
          amount: releaseAmount,
          scheduledReleaseTimestamp: releaseAt,
          description: `${refundDrop}% of balance at ${band.refundPercent}%-refund tier start`
        })
        remainingBalance -= releaseAmount
      previousRefundPercent = band.refundPercent

  RETURN Tranches
```

Notes:

- The `max(bandStartDate + 48h, acceptanceTime + 48h)` clamp handles late-window Bookings made inside an already-non-refundable band — the corresponding portion releases once the 48-hour buffer from Acceptance has elapsed, not retroactively. (PT v1.6 §6.4 final paragraph.)
- Each Tranche execution must check Booking status before executing — no Tranche may fire on a cancelled Booking.
- Tranche execution uses `stripe.payouts.create` against the Provider's connected account (not `stripe.transfers.create` — funds are already on the connected account from the captured PaymentIntent).

```js
await stripe.payouts.create(
  {
    amount: tranche.amountInMinorUnits,
    currency: provider.settlementCurrency.toLowerCase(),
    description: `Booking ${booking.reference} — ${tranche.description}`,
    metadata: {
      booking_id: booking.id,
      tranche_id: tranche.id,
    },
  },
  { stripeAccount: provider.stripeAccountId }
)
```

### 6.6 Cron-job execution

Scheduled-payout cron runs hourly. For each `scheduled` Tranche where `scheduled_release_timestamp <= now()`:

1. Load Booking; if `booking.status === 'cancelled'`, mark Tranche `cancelled` and skip.
2. Mark Tranche `processing`.
3. Call `stripe.payouts.create` (above).
4. On success, mark Tranche `completed`, write `stripe_payout_id`, send Provider notification.
5. On failure, mark Tranche `failed` with reason; alert admin; do not auto-retry without operator review.

### 6.7 Audit-log entries

Every Tranche calculation, scheduling, release, cancellation, and manual override must write to `booking_payout_audit` with: timestamp UTC, actor identity (system or operator), event type, prior state, new state, reason text (required for manual overrides), and reference IDs. Retention per PT §23.3. (PT Annex A v1.6 §A.3 fourth bullet.)

---

## 7. Refund Engine

### 7.1 48-hour grace period — anchored to Acceptance Time

A Customer who cancels within 48 hours of the Acceptance Time receives a full refund of all amounts captured, including the deposit and the Platform Fee, irrespective of the Cancellation Policy. (CT v1.3 §8.4(b) — "runs from the Acceptance Time and not from the time at which you submitted the Booking Request"; PT v1.6 §7.3.)

**Critical:** The 48-hour window is anchored to the Acceptance Time, not to the Booking Request submission. Pre-acceptance there is only an authorisation hold; the grace clock cannot start until the Booking is formed.

```js
await stripe.refunds.create(
  {
    payment_intent: paymentIntentId,
    amount: capturedAmount,
    refund_application_fee: true,
    metadata: { reason: 'grace_period' },
  },
  { stripeAccount: provider.stripeAccountId }
)
```

Any pending Tranches for the Booking are immediately cancelled.

### 7.2 Customer cancellation after grace — per-tier

After the 48-hour grace period, refund entitlement is calculated by reference to the Cancellation Policy in effect at the time of Booking and the days-to-start at the moment the cancellation request is submitted.

**Day-counting convention `[CONFIRM — Daniyal; cc Stephanie]`:** Calendar days, Provider's local timezone, midnight (00:00) cutoff. So a Programme starting Monday 10 August in Geneva: a cancellation submitted at 23:59 Sunday 9 August Europe/Zurich falls in the "0–6 days" band; a cancellation at 00:00 Sunday 9 August falls in the "1 day before start" position (still in 0–6). Standard marketplace convention (Airbnb, Booking.com).

The refund percentage applies to the **balance only**; the deposit is non-refundable (per §6.3 after grace).

```js
// Example: Moderate tier, cancellation 20 days before start → 50% band
const refundOfBalance = balanceAmount * 0.5
await stripe.refunds.create(
  {
    payment_intent: paymentIntentId,
    amount: refundOfBalance,
    refund_application_fee: false,
    metadata: { reason: 'customer_cancellation', tier: 'moderate', band: '7-29' },
  },
  { stripeAccount: provider.stripeAccountId }
)
```

Any pending Tranches in respect of the refunded portion of the balance are cancelled. Tranches already paid out to the Provider remain with the Provider (the corresponding portion was non-refundable at the time of cancellation).

### 7.3 Provider cancellation

When the Provider cancels a confirmed Booking, the Customer is entitled to a full refund of all amounts including the deposit and the Platform Fee. (CT v1.3 §8.6; PT v1.6 §5.4.)

```js
await stripe.refunds.create(
  {
    payment_intent: paymentIntentId,
    amount: totalCapturedAmount,
    refund_application_fee: true,
    metadata: { reason: 'provider_cancellation' },
  },
  { stripeAccount: provider.stripeAccountId }
)
```

All pending Tranches cancelled. If insufficient funds in the Provider's Stripe balance (because earlier Tranches have already paid out to the Provider's bank), Stripe will debit the Provider's linked bank account. The Provider has 7 days to clear any resulting negative Stripe balance. (PT v1.6 §6.6.) The Provider does not have discretion over this refund — the contract obligation is unilateral.

### 7.4 Provider must be suspended on Provider cancellation

Per PT v1.6 §17.2, Provider-initiated Programme cancellations trigger immediate suspension pending review. The Tranche-cancellation flow above must be paired with an `account.suspended` flag on the Provider record; new Bookings cannot be accepted while suspension is active.

### 7.5 Customer-facing one-liners — for checkout display `[CONFIRM — Daniyal; cc Stephanie]`

Proposed customer-facing strings, to display at checkout, in the Listing detail, and in the Booking confirmation:

- **Flexible** — _"Full refund of the balance up to 7 days before Programme start; non-refundable in the final 7 days. Deposit non-refundable after the 48-hour grace period."_
- **Moderate** — _"Full refund of the balance up to 30 days before Programme start; 50% refund 7–29 days before; non-refundable in the final 7 days. Deposit non-refundable after the 48-hour grace period."_
- **Strict** — _"Full refund of the balance up to 60 days before Programme start; 50% refund 30–59 days before; non-refundable from 30 days. Deposit non-refundable after the 48-hour grace period."_

The same wording feeds the Help Centre Cancellation Policy article (TASKS.md §B.4) and the Booking confirmation email.

---

## 8. Force Majeure Pathway

Force Majeure is contractually a **cash-refund-only** mechanism. Credit notes and vouchers are not a substitute (limited carve-outs only). (PT v1.6 §7.4(a)–(b); CT v1.3 §8.7(a)–(b); locked memory `parent_terms_fm_architecture.md`.)

### 8.1 Bulk operation — required tooling

The Platform must support a bulk Force Majeure pathway capable of, in a single admin action:

1. Identifying all affected Bookings (filter by Programme date range, Provider, region, etc.).
2. Immediately suspending all pending Tranche payouts for those Bookings.
3. Issuing cash refunds for the captured Customer amounts, **excluding the Platform Fee** (general rule per §8.3).
4. Optionally — at admin discretion — refunding the Platform Fee directly to the Customer (catastrophic / prolonged / industry-wide events).
5. Writing a complete audit entry with operator identity, trigger event description, affected-Booking count, total refunded, Platform Fee disposition.

(PT Annex A v1.6 §A.4 third bullet.)

### 8.2 Refund call

```js
// Step 1 — Suspend pending Tranches for affected Bookings
await db.tranches.updateMany({
  where: { booking_id: { in: affectedBookingIds }, status: 'scheduled' },
  data: { status: 'cancelled', cancellation_reason: 'force_majeure' }
});

// Step 2 — Issue cash refund, retaining Platform Fee by default
await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: capturedAmountMinusPlatformFee,
  refund_application_fee: false,
  metadata: { reason: 'force_majeure', fm_event_id: fmEvent.id }
}, { stripeAccount: provider.stripeAccountId });

// Step 3 (optional, admin discretion) — Refund Platform Fee directly to Customer
//        without affecting the Provider's side
IF adminElectsPlatformFeeRefund:
  await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: platformFeeAmount,
    refund_application_fee: true,
    metadata: { reason: 'force_majeure_platform_fee_discretionary', fm_event_id: fmEvent.id }
  }, { stripeAccount: provider.stripeAccountId });
```

### 8.3 Platform Fee — general rule and discretionary refund

General rule: World Camps retains the Platform Fee on FM-cancelled Bookings (platform service has been delivered). Discretionary refund available for catastrophic / prolonged / industry-wide events (e.g. pandemic-scale). The discretionary refund flows directly to the Customer; it does not increase the amount payable by the Provider. (PT v1.6 §7.4(c); CT v1.3 §8.7(c).)

### 8.4 Non-compliant Provider

A Provider that purports to issue a credit note or voucher in lieu of a cash refund, in circumstances not permitted by PT v1.6 §7.4(a) (i.e. without the Customer's express written election and outside any mandatory consumer-law carve-out), commits a material breach. The bulk FM tooling must not allow Provider override of the cash-refund path.

---

## 9. Chargebacks

### 9.1 Provider is merchant of record

The Provider is the merchant of record for all Bookings. Chargebacks initiated by Customers with their card issuer flow to the Provider's connected account. The Provider bears any Stripe dispute fee. (PT v1.6 §8.1 / §8.4.)

### 9.2 Application fee reversal

When a chargeback succeeds, Stripe automatically reverses the Platform Fee from the World Camps platform account. The Platform absorbs this loss; we do not seek recovery from the Provider. (PT v1.6 §8.4.)

### 9.3 Evidence provision

The Provider must cooperate and supply evidence within Stripe / card-network deadlines. Platform tooling should surface chargeback notifications to the Provider with a deadline countdown.

### 9.4 Customer pre-dispute resolution

Per CT v1.3 §8.9, Customers are contractually required to submit a formal complaint to World Camps and allow 14 days for resolution before initiating a chargeback. Surface this at the cancellation request UI when a Customer's situation falls outside policy entitlement, to reduce chargeback rate.

---

## 10. Negative Balance Handling

Where a Provider's Stripe balance is insufficient to cover a required refund (e.g. earlier Tranches already paid out to the Provider's bank), Stripe debits the Provider's linked bank account. (PT v1.6 §6.6.)

The Provider has 7 days to clear any negative Stripe balance. Failure to clear triggers:

1. Listing suspension (all active Listings).
2. Admin alert.
3. Recovery action per PT §17 / §18.

Provider Dashboard must surface negative-balance state prominently with a "clear balance" payment flow.

---

## 11. Audit Trail

Every payment, refund, Tranche scheduling, Tranche release, manual override, Force Majeure action, and chargeback event must be audit-logged with:

- Timestamp UTC
- Actor identity (system, operator name, or Customer ID)
- Event type
- Prior state and new state
- Reason text (required for manual overrides and FM actions)
- Reference IDs (Booking ID, PaymentIntent ID, Stripe transfer ID, Stripe payout ID)
- For FM actions: trigger-event ID, Platform Fee disposition (retained / refunded)

Records retained per PT v1.6 §23.3 (7 years from the date of the event giving rise to the record).

The audit log is the evidentiary record for any chargeback defence, regulator query, or internal review. It must be append-only (no UPDATE / DELETE on rows; corrections written as new entries referencing the original).

---

## 12. Test Scenarios

Test matrix: every standard tier × deposit-configured / no-deposit × pre-grace / in-grace / post-grace cancellation × Force Majeure × Provider cancellation, in each of the four launch currencies (USD / CHF / GBP / EUR).

The matrix yields ~120 test cases. Worked examples below illustrate the expected refund and Tranche behaviour. Engineering should generate the full matrix from the spec.

### 12.1 Worked example — Moderate, deposit-configured, post-grace customer cancellation

```
Booking:
  totalPrice: 2000 (settlement currency: EUR)
  depositPercent: 22
  cancellationPolicyTier: 'moderate'
  acceptanceTime: 2025-12-03 14:00 Europe/Zurich
  programmeStartDate: 2026-08-03
  bookingReference: WC-2026-00123

Computed:
  depositAmount: 440
  balanceAmount: 1560
  Tranches:
    T1 Deposit: 440 at 2025-12-05 14:00 Europe/Zurich (acceptance + 48h)
    T2 Balance 50%: 780 at 2026-07-07 (30-day boundary; 50% drop) + 48h
    T3 Balance 50%: 780 at 2026-07-30 (7-day boundary; 50% → 0%) + 48h

Cancellation at 2026-07-14 (20 days before start, "7–29 days" band):
  Refund entitlement: 50% of balance = 780
  Stripe refund call: amount 780, refund_application_fee: false
  T3 (780 scheduled for 2026-07-30) cancelled
  T1 (440) and T2 (780) remain — already non-refundable at time of cancellation
  Audit entry written
```

### 12.2 Worked example — Strict, no-deposit, in-grace cancellation

```
Booking:
  totalPrice: 1500 (settlement currency: GBP)
  depositPercent: null
  cancellationPolicyTier: 'strict'
  acceptanceTime: 2026-05-21 10:00 Europe/London
  programmeStartDate: 2026-07-15

Computed:
  No deposit Tranche
  Single balance Tranche split per Strict tier drops:
    T1 Balance 50%: 750 at 2026-05-16 (60-day boundary; 100% → 50%) +48h
                    [actually past — clamped to acceptanceTime + 48h]
                    Released at 2026-05-23 10:00
    T2 Balance 50%: 750 at 2026-06-15 (30-day boundary; 50% → 0%) +48h

Cancellation at 2026-05-22 12:00 (26 hours after acceptance, within 48h grace):
  Refund entitlement: full 1500 + Platform Fee
  Stripe refund call: amount 1500, refund_application_fee: true
  All Tranches cancelled
  Audit entry written
```

### 12.3 Worked example — Force Majeure on bulk programmes

```
FM event: regional flooding cancels all programmes in CH-VS region for July 2026
Affected: 47 Bookings across 6 Providers, total captured 124,500 CHF
Platform Fee component (15%): 18,675 CHF

Admin triggers bulk FM action:
  - 89 pending Tranches across the 47 Bookings → all cancelled
  - 47 Stripe refunds issued at totalCaptured − platformFee per Booking
    = 105,825 CHF returned to Customers
  - Admin elects not to refund Platform Fee (event localised, not industry-wide)
  - Platform Fee 18,675 CHF retained
  - Audit entry written with fm_event_id, operator identity, affected Booking IDs

Result:
  - Customers receive cash refund excluding Platform Fee
  - Providers: no payout for affected Bookings, no liability to Customer beyond what Platform has refunded on their behalf (Provider remains primary obligor under PT §7.4(a), but Platform action satisfies the obligation as agent)
  - World Camps retains Platform Fee per general rule (PT §7.4(c))
```

---

## 13. Open Items — `[CONFIRM — Daniyal; cc Stephanie]`

Three items remain pending recipient confirmation. None block implementation of the engine; all require sign-off before customer-facing surfaces go live.

1. **§6.4 Custom-tier rails** — confirm the seven proposed rails (or amend) and lock the Custom-policy editor UX. Stephanie likely has a view on the band-builder UI.
2. **§7.2 Day-counting convention** — confirm calendar days, Provider's local timezone, midnight cutoff. If different (e.g. Customer's timezone, or business days), code change required at the Tranche scheduler and the refund calculator.
3. **§7.5 Customer-facing one-liners** — confirm the three proposed strings or amend. Same strings feed the Help Centre Cancellation Policy article and the Booking confirmation email. Stephanie input on tone and length appreciated.

Please reply on Slack (thread on this spec) with confirmations or proposed amendments. Once all three are resolved, this spec moves to v1.1 with the locked text inline and the `[CONFIRM]` markers removed.

---

## 14. Revision History

| Version | Date       | Change                                                                                                                                             | Author               |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| v1.0    | 2026-05-21 | Initial consolidated spec. Supersedes the three legacy Payments handoffs. Three items pending Daniyal / Stephanie confirmation (§6.4, §7.2, §7.5). | Alex Peipers (Legal) |

End of specification.
