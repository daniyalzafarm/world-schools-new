# Booking Deposit Capture & Payment Flow Redesign

> Aligned with Payments and Payouts Spec **v2.5** (2026-06-17) — built against v2.3 + Alex's 2026-06-12 reconciliation (≈ v2.4), then conformed to v2.5. v2.5 carries all v2.4 payment mechanics forward unchanged; its net changes are: the standard-tier schedules + 90/60/30 lattice **locked** (§2.2 — matches the `FLEXIBLE/MODERATE/STRICT_POLICY_TIERS` constants exactly), the §3.1 onboarding recast (camp type pre-populates a suggested tier + deposit default — implemented), and §15 customer copy. The §9.7 Programme-reschedule flow is implemented. **Currency:** all 15 `SUPPORTED_CURRENCIES` are supported end-to-end — an approved deviation from v2.5 §4.1's "launch 4 + gate expansion" (deliberate product decision; the FX-to-CHF default-currency config remains an operational prerequisite). Where this doc and the contracts conflict, the contracts (Parent Terms v1.4 / Provider Terms v1.7) prevail.

## Objective

Replace the existing payout-delay approach with a Stripe Standard Connected Account flow using:

* Standard Connected Accounts
* Direct Charges
* Manual Capture (`capture_method = manual`) for the deposit
* Off-session scheduled captures for the balance
* 24-hour booking grace period

Organising principle (Spec v2.3): **capture money only when it is already non-refundable; once captured, it is immediately the Provider's.** This removes the need for payout restrictions and the tranche/payout-delay engine.

---

# Stripe Constraints & Assumptions

## Account Type

* Use Stripe Standard Connected Accounts.
* Use Direct Charges.

### Liability Model

Under Standard + Direct Charges (confirmed by Stripe Support, June 2026):

* Provider is fully liable for refunds, disputes, and negative balances.
* Stripe pursues the Provider directly (debits their linked bank account).
* Platform (World Camps) has no financial exposure.

### Important

Do NOT use Express accounts. Express accounts would make the platform responsible for negative balances and dispute exposure.

## Authorization Validity Window

Stripe has no native "capture at time X" scheduling — a manual-capture PaymentIntent stays in `requires_capture` until our backend explicitly calls capture. Scheduling is therefore our responsibility (see Scheduled Capture Processing below).

Card authorizations are typically valid for 7 days (less for some payment methods). This covers the 24-hour grace period plus the 72-hour provider acceptance window.

**Assumption:** the grace period must remain well under the authorization validity window. Extending it would require re-authorization logic, which is out of scope.

## SCA / Off-Session Charges

Balance captures are off-session charges against a saved payment method. Build against Stripe's documented manual-confirmation flow for off-session SCA: when a capture fails with `authentication_required`, send the customer an authentication link (`next_action.redirect_to_url.url`) with a 48h retry deadline. Stripe auto-updates expiring saved cards. (Confirmed buildable by Stripe Support; any Standard-account-specific caveats pending, non-blocking.)

---

# Payment Architecture

## Booking Creation — Deposit Listings

When a booking request is submitted:

1. Create a PaymentIntent with:

   * `capture_method = manual`
   * `setup_future_usage = off_session`
2. Authorize the deposit amount only. Do not capture.
3. The Stripe Customer (and saved payment method) must live on the **connected account**.
4. Resolve all balance capture dates from the cancellation-policy snapshot (see Capture Schedule Derivation) and store them as scheduled-capture records.
5. Store the consent snapshot (see Compliance & Records).

This allows us to hold funds securely, cancel without refunds during the grace period, and capture later without customer interaction.

## Booking Creation — No-Deposit Listings

No deposit authorization exists, but the card must still be saved and the SCA mandate + consent snapshot anchored. Therefore:

* Create a **SetupIntent** at booking request to save the payment method on the connected account.
* The entire price is treated as balance, captured off-session on the commitment dates derived from the cancellation policy (same engine as deposit listings).
* **Near-term no-deposit bookings** (first capture date already due at acceptance): do not treat the booking as confirmed until the at-acceptance capture succeeds — never commit a slot on an unsecured card.

(The "cost-free until first capture" customer exposure is a commercial call being confirmed by product; it does not change the mechanism.)

---

# Deposit Settings & Camp-Level Override

## Locked Model (Alex, 2026-06-12)

Provider-level deposit default + per-Listing on/off override — mirrors the Cancellation Policy model.

## Existing Provider-Level Settings

Deposit settings are configured per provider (`ProviderSettings`): whether a deposit is required, its type (percentage or fixed), and its value.

## New: Per-Camp Deposit Toggle

### Data Model

* New boolean on the Camp model: `depositEnabled`, default `true`.
* Effective deposit resolution at booking submission:

```text
deposit_applies = provider.depositRequired AND camp.depositEnabled
```

* The booking-time deposit snapshot (`depositSnapshot`) must record the camp toggle state, so toggling later never affects existing bookings.

### Booking Flow Impact

Toggle ON (default): provider-level deposit settings apply; deposit authorize/capture flow above.

Toggle OFF: no deposit authorization; the no-deposit flow above applies (SetupIntent at request, full price as balance on commitment dates).

### Provider UI (wc-provider)

Add a card on `/camps/[camp_id]/edit/sessions`:

* Shows a read-only summary of the provider-level deposit settings (type + percentage / fixed amount).
* Toggle ("deposit enabled for this listing"), ON by default; turning it off disables the deposit for this camp only.
* Clear explanation that the provider-level deposit settings apply otherwise.
* If the provider has no deposit configured at provider level: show an explanatory state with a link to the provider deposit settings page; hide/disable the toggle.
* Follows the existing camp-edit toggle-card + autosave pattern; persisted via a camp section PATCH endpoint.

Note (Alex, answer 4): the deposit is non-refundable by design — provider generosity is expressed via a smaller/zero deposit, never a refundable one. The Flexible preset tier should carry **zero deposit** so "fully refundable" means it.

---

# Cancellation Policy & Capture Schedule Derivation

## Authoritative Structure

The **named tiers — Flexible / Moderate / Strict / Custom — are authoritative and user-facing** (PT v1.7 §7.1, CT v1.4 §8.2). Binary / Two-Stage / Custom capture modes from Spec v2.3 are internal capture mechanics only and are never shown to users.

Each named tier compiles to a refund schedule (day-bands → refund % of the **balance only**; the deposit is excluded and separately non-refundable after the grace window).

## Capture Event Derivation

The engine derives capture events from the refund schedule generically (Spec v2.3 §3.4A logic, generalised):

* Walk the bands from furthest-out to closest-to-start.
* Each time the refund % drops, the newly non-refundable portion of the balance is scheduled for capture at that band boundary.
* Consecutive bands with the same refund % produce no event.

## The Acceptance Guard (contractual invariant)

**No capture may ever fire before the Provider accepts the booking** (CT v1.4 §5.2(f), §7.4(d)). Therefore:

```text
effective_capture_date = max(capture_date, grace_deadline, acceptance_time)
```

* The capture cron processes captures only for accepted/confirmed bookings.
* At acceptance, re-resolve any already-past balance capture date to `acceptance_time`.

## Day-Counting Convention (locked)

* Calendar days, midnight cutoff.
* Anchored to the **Programme location's timezone** (fallback: Provider's registered timezone).
* Capture boundaries resolve to 00:00 local on the boundary day, stored as the UTC instant; the hourly cron fires at/after it.

## Open Dependency

The bands/percentages behind the named presets are **LOCKED (Alex, 2026-06-17)** and wired:
**Flexible** 100% until 30d before, 0% after · **Moderate** 100% until 60d, 50% until 30d, 0% after ·
**Strict** 100% until 90d, 50% until 60d, 0% after · **Custom** camp-defined. Strict earns 1 provider
trust point (Flexible 5, Moderate 3, Custom 0).

---

# Grace Period Rules

## Grace Window

```text
grace_deadline = booking_request_time + 24 hours
```

The grace period begins when the booking request is submitted, not when the provider accepts.

## Near-Term Exclusion (programme starts within 7 days)

The grace period does not apply where the programme starts within 7 days of the booking request (CT v1.4 §8.4(b), PT v1.7 §7.3). Implement as:

```text
grace_deadline = booking_request_time   // zero-length grace
```

so the deposit captures at acceptance — never before acceptance (keeps the acceptance guard intact).

---

# Capture Logic — Deposit

## Scenario 1: Provider Accepts After Grace Deadline

```text
acceptance_time > grace_deadline
```

* Capture deposit immediately upon acceptance (grace already expired; funds non-refundable).

## Scenario 2: Provider Accepts Within Grace Period

```text
acceptance_time <= grace_deadline
```

* Keep PaymentIntent authorized.
* Schedule capture at the grace deadline (delayed BullMQ job — see Scheduled Capture Processing).
* Capture automatically when the grace deadline is reached.

## Scenario 3: Customer Cancels During Grace Period

```text
current_time < grace_deadline
```

* Cancel the PaymentIntent; remove any scheduled captures.
* No capture, no refund call, no Stripe fees — the auth-hold simply releases.

## Scenario 4: Decline / Acceptance-Window Expiry / Pre-Acceptance Withdrawal

* Cancel the PaymentIntent (release the hold), cancel all scheduled captures, notify the customer.
* The customer may withdraw a booking request at any time before acceptance with full release, even after the grace window (CT v1.4 §5.2(f)).

---

# Capture Logic — Balance

Executed by the scheduled capture engine at each `effective_capture_date`:

* Create an off-session PaymentIntent (`off_session: true`, `confirm: true`) against the saved payment method on the connected account, with `application_fee_amount` applied.
* On success: mark capture completed; the amount is immediately non-refundable and the Provider's.
* On failure: mark failed, set `retry_deadline = now + 48h`, notify the customer with a retry link — or an **authentication link** when the failure is `authentication_required` (SCA).
* On retry-deadline expiry: flag the booking for admin review (`payment_review`); do not auto-cancel.

Pre-capture customer notifications: 30 days and 7 days before each scheduled capture; card-expiry warning banner when the saved card expires before a scheduled capture.

---

# Booking State Flow

Suggested states:

```text
REQUESTED
↓
PAYMENT_AUTHORIZED
↓
PROVIDER_ACCEPTED
↓
WAITING_FOR_GRACE_DEADLINE (if accepted within grace period)
↓
DEPOSIT_CAPTURED
↓
BALANCE_CAPTURE(S) per schedule → FULLY_PAID
```

Cancellation path:

```text
REQUESTED → PAYMENT_AUTHORIZED → CUSTOMER_CANCELLED → PAYMENT_INTENT_CANCELLED
```

Late acceptance path:

```text
REQUESTED → PAYMENT_AUTHORIZED → PROVIDER_ACCEPTED_AFTER_GRACE → DEPOSIT_CAPTURED_IMMEDIATELY
```

---

# Scheduled Capture Processing

Stripe cannot schedule captures for us, so capture timing is owned by the backend using two layers. This engine covers the deferred deposit capture and all balance captures.

## Scheduled-Captures Data Model

A scheduled-captures table (one row per capture event, up to deposit + 4 balance events per booking): booking ID, sequence, amount, `scheduled_date` (resolved per the day-counting convention), status (`scheduled / processing / completed / failed / cancelled`), payment intent ID, failure/retry fields.

## Primary: Delayed BullMQ Job

* At provider acceptance: enqueue delayed jobs for each due capture (`delay = effective_capture_date - now`), job ID derived from booking + sequence so jobs are addressable/removable.
* On customer cancellation: remove the delayed jobs and cancel/skip the corresponding captures.

## Backstop: Reconciliation Cron

A low-frequency cron derives due captures from state, not remembered schedules:

```text
for each scheduled capture:
    if booking is accepted/confirmed        // acceptance guard — never fire pre-acceptance
       and capture.status == 'scheduled'
       and current_time >= effective_capture_date:
           fire_capture()
```

The cron and delayed jobs may race; idempotency rules make this harmless.

## Capture Safety Rules

Every capture attempt (job or cron) must:

* Use a Stripe idempotency key (derived from booking ID + capture sequence).
* Treat "already captured/succeeded" as success, not an error.
* Treat "PaymentIntent canceled" as a no-op (customer cancelled in time).
* Verify booking status before firing — no capture on a cancelled or not-yet-accepted booking.

---

# Acceptance Flow Changes

At provider acceptance:

1. Record `acceptance_time`.
2. Deposit: if `acceptance_time > grace_deadline` → capture immediately; else schedule capture at `grace_deadline`.
3. Balance: re-resolve every capture date through `max(capture_date, grace_deadline, acceptance_time)`; enqueue jobs.
4. Near-term no-deposit bookings: hold confirmation until the at-acceptance capture succeeds.

---

# Cancellation & Reschedule Flows

## Customer Cancellation

* **Within grace**: remove delayed jobs, cancel the deposit PaymentIntent (auth release, no refund call), cancel all scheduled captures.
* **After grace, before/between captures**: cancel all remaining scheduled captures; captured amounts (deposit + fired captures) are forfeited; **no refund call**.
* **After all captures**: everything forfeited; status update only.

## Provider Cancellation (locked model — Alex, answer 12)

* Trigger = **Programme cancellation**, not a single family's booking.
* Auto-fire the full refund: all captured amounts (deposit + balance captures) refunded with `refund_application_fee: true` per payment; cancel all scheduled captures.
* **No hard-coded auto-suspension** (PT v1.7 §17.2/§5.4 are discretionary). Instead, flag the Provider into an admin review queue for a manual, reason-captured suspension decision.
* Suspension scope default = the affected Listing; escalate to account-wide for safeguarding/fraud/pattern.
* Existing confirmed bookings: suspension always blocks new bookings; under precautionary suspension camps run and captures continue; under safeguarding/fraud/insolvency, pause captures and triage each booking.

## Provider Reschedule (Spec v2.5 §9.7 — implemented)

* No unilateral reschedule post-acceptance (PT v1.7 §5.3). The provider PROPOSES a new start (`POST /provider/booking-groups/:id/reschedule` → a pending `RescheduleProposal`); the customer reviews it on their booking and consents or declines.
* **With customer consent** (`POST /user/booking-groups/:id/reschedule/consent`): in one transaction, recompute the capture schedule + bands against the new start (`rescheduledStartDate`), regenerate the not-yet-fired captures (old scheduled rows cancelled; new rows take sequences above the current max), supersede + re-capture the consent snapshot, and append a `reschedule_recompute` audit row. Amounts already captured are untouched. (Recompute is blocked while a capture is in-flight/failed — resolve it first.)
* **Without consent** (decline or no response): the original dates + schedule stand; the provider separately honours them or cancels via the §9.5 provider-cancellation full-refund flow.

## Force Majeure (admin bulk action)

* Cancel all scheduled future captures for affected bookings.
* Refund all captured amounts **excluding the Platform Fee** (general rule); admin-discretion toggle to refund the fee for catastrophic/industry-wide events.
* Full audit entry (operator, event, affected bookings, totals, fee disposition).

---

# Webhook-Driven State Sync

Stripe is the source of truth for payment state. Booking state must be updated from Stripe webhook events, not solely from API call responses.

Relevant events:

* `payment_intent.succeeded` → mark capture completed.
* `payment_intent.canceled` → mark payment intent cancelled.
* `payment_intent.payment_failed` → trigger the capture-failure/retry flow (incl. SCA authentication-required path).
* `charge.refunded` → sync refund records.
* `charge.dispute.created` → alert provider with evidence deadline; alert admin.
* `account.updated` / `account.application.deauthorized` → provider account state sync / listing suspension.

Webhook handlers must be idempotent and tolerate out-of-order arrival relative to API responses. (`payout.created` monitoring is not required — by design nothing refundable ever sits in the provider balance.)

---

# Payout Behaviour

Because funds are only captured after they become non-refundable:

* Remove payout-delay logic, payout restriction logic, custom payout holding mechanisms, and the manual payout schedule (`interval: 'manual'`) on connected accounts.
* Providers manage payouts directly through Stripe (automatic/manual per their own account configuration). Platform does not interfere with payout timing.

---

# Compliance & Records

* **Consent snapshot** at checkout: exact cancellation policy + charge schedule shown, acknowledgement checkbox, timestamp, IP — stored on the booking record (SCA mandate evidence + dispute defence). Re-captured on consented reschedules.
* **Append-only payment audit log**: every capture scheduling/firing/failure/cancellation, refund, FM action, and manual override, with actor, prior/new state, reason text.
* **Retention: 10 years** (Swiss CO Art. 958f) — harmonised across Spec §12 / PT §23.3 / Privacy Policy v1.5 (consent snapshot + audit log rows included).

---

# Currency Scope

* Launch scope: US / UK / EU / CH → **USD / GBP / EUR / CHF**. Canonical operational currency/country list lives in the spec (config), not the contracts (PT §6.8 is deliberately currency-agnostic).
* **Hold onboarding-country expansion (including the v0.23.0 currency expansion)** until Alex's Stripe follow-up on negative-balance recovery per country (does direct bank debit work in each of US/UK/EU/CH; end state if recovery fails) lands.

---

# Open Dependencies (non-blocking for the engine build)

1. Flexible / Moderate / Strict preset bands & percentages — **LOCKED 2026-06-17 (Alex)** and wired (Flexible 100%→30d, Moderate 100%→60d/50%→30d, Strict 100%→90d/50%→60d; Custom camp-defined). No longer an open dependency.
2. Commercial confirmation of the no-deposit "cost-free until first capture" exposure.
3. Stripe follow-up: negative-balance recovery mechanics per launch country (gates country expansion only); Standard-account-specific SCA caveats (non-blocking).

---

# Areas Impacted

This redesign affects:

1. Booking App payment flow
2. Booking request creation flow (deposit auth / no-deposit SetupIntent, capture-date resolution, consent snapshot)
3. Provider acceptance flow (capture-date re-resolution, acceptance guard)
4. Customer cancellation flow
5. Provider cancellation flow + admin review queue (no auto-suspend)
6. Provider reschedule flow
7. Booking state management
8. Scheduled capture engine (scheduled-captures model, delayed jobs + reconciliation cron)
9. Balance capture failure/retry + SCA authentication-link flow
10. Stripe PaymentIntent / SetupIntent lifecycle handling
11. Stripe webhook handlers
12. Existing payout restriction logic (removal, incl. manual payout schedule on connected accounts)
13. Camp data model (new `depositEnabled` field)
14. Camp edit UI in wc-provider (sessions page deposit card)
15. Booking financial snapshot / deposit + policy resolution
16. Cancellation policy model (named tiers compile to refund schedules; Custom builder)
17. Force Majeure admin bulk tooling
18. Consent snapshot + payment audit log tables (10-year retention)
19. Pre-capture customer notification emails

All affected scenarios should be reviewed and fully regression tested before release.
