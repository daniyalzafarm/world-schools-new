# Booking Deposit Capture & Payment Flow Redesign

## Objective

Replace the existing payout-delay approach with a Stripe Standard Connected Account flow using:

* Standard Connected Accounts
* Direct Charges
* Manual Capture (`capture_method = manual`)
* 24-hour booking grace period

This removes the need for payout restrictions and significantly reduces refund/payout risk.

---

# Stripe Constraints & Assumptions

## Account Type

* Use Stripe Standard Connected Accounts.
* Use Direct Charges.

### Liability Model

Under Standard + Direct Charges:

* Provider is fully liable for:

  * Refunds
  * Disputes
  * Negative balances
* Stripe pursues the Provider directly.
* Platform (World Camps) has no financial exposure.

### Important

Do NOT use Express accounts.

Express accounts would make the platform responsible for negative balances and dispute exposure.

## Authorization Validity Window

Stripe has no native "capture at time X" scheduling — a manual-capture PaymentIntent stays in `requires_capture` until our backend explicitly calls capture. Scheduling is therefore our responsibility (see Scheduled Capture Processing below).

Card authorizations are typically valid for 7 days (less for some payment methods). The 24-hour grace period fits comfortably within this window.

**Assumption:** the grace period must remain well under the authorization validity window. Extending it beyond ~5–6 days would require re-authorization logic, which is out of scope for this redesign.

---

# Payment Architecture

## Booking Creation

When a booking request is submitted:

1. Create a PaymentIntent.
2. Use:

   * `capture_method = manual`
   * `setup_future_usage = off_session`
3. Authorize the deposit amount only.
4. Do not capture immediately.

This allows us to:

* Hold funds securely.
* Cancel without refunds during the grace period.
* Capture later without requiring customer interaction.

---

# Grace Period Rules

## Grace Window

```text
grace_deadline = booking_request_time + 24 hours
```

The grace period begins when the booking request is submitted, not when the provider accepts.

---

# Capture Logic

## Scenario 1: Provider Accepts After Grace Deadline

Condition:

```text
acceptance_time > grace_deadline
```

Action:

* Capture deposit immediately upon acceptance.

Reason:

* Grace period has already expired.
* Funds are now considered non-refundable.

---

## Scenario 2: Provider Accepts Within Grace Period

Condition:

```text
acceptance_time <= grace_deadline
```

Action:

* Keep PaymentIntent authorized.
* Schedule capture at the grace deadline (delayed BullMQ job — see Scheduled Capture Processing).
* Capture automatically when grace deadline is reached.

Reason:

* Customer still has cancellation rights until the end of the grace window.

---

## Scenario 3: Customer Cancels During Grace Period

Condition:

```text
current_time < grace_deadline
```

Action:

* Cancel the PaymentIntent.
* Do not capture funds.
* Do not issue a refund.

Reason:

* Funds were only authorized.
* No Stripe refund fees or payout complications.

---

# Exception: Near-Term Programmes

## Program Starts Within 7 Days

The grace-period logic should not apply.

Condition:

```text
programme_start_date <= booking_request_date + 7 days
```

Action:

* Follow the existing immediate-capture flow.
* Do not defer capture.

Reason:

* Insufficient time window before programme commencement.

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
```

Cancellation path:

```text
REQUESTED
↓
PAYMENT_AUTHORIZED
↓
CUSTOMER_CANCELLED
↓
PAYMENT_INTENT_CANCELLED
```

Late acceptance path:

```text
REQUESTED
↓
PAYMENT_AUTHORIZED
↓
PROVIDER_ACCEPTED_AFTER_GRACE
↓
DEPOSIT_CAPTURED_IMMEDIATELY
```

---

# Scheduled Capture Processing

Stripe cannot schedule the capture for us, so capture timing is owned by the backend using two layers:

## Primary: Delayed BullMQ Job

At provider acceptance (within grace period):

* Enqueue a BullMQ delayed job with `delay = grace_deadline - now`.
* Use the booking ID as the job ID so the job is addressable.
* The job fires once at the deadline and captures the PaymentIntent.

On customer cancellation during the grace period:

* Remove the delayed job by booking ID.
* Cancel the PaymentIntent.

## Backstop: Reconciliation Cron

A low-frequency cron acts as a safety net for lost delayed jobs (Redis data loss, worker crash mid-capture). It derives due captures from booking state, not from remembered schedules:

```text
for each booking:
    if provider_accepted
       and deposit_not_captured
       and current_time >= grace_deadline:
           capture_payment_intent()
```

The cron and the delayed job may race; idempotency rules below make this harmless.

## Capture Safety Rules

Every capture attempt (job or cron) must:

* Use a Stripe idempotency key (derived from the booking ID).
* Treat "PaymentIntent already captured" as success, not an error.
* Treat "PaymentIntent canceled" as a no-op (customer cancelled in time).

---

# Acceptance Flow Changes

Provider acceptance logic must evaluate:

```text
accepted_before_grace_deadline ?
```

If TRUE:

```text
enqueue delayed capture job for grace_deadline
```

If FALSE:

```text
capture immediately
```

This decision should occur at acceptance time.

---

# Cancellation Flow Changes

Customer cancellation logic must evaluate:

```text
current_time < grace_deadline
```

If TRUE:

```text
remove delayed capture job (if scheduled)
cancel payment intent
```

If FALSE:

```text
follow standard cancellation/refund policy
```

---

# Webhook-Driven State Sync

Stripe is the source of truth for payment state. Booking state must be updated from Stripe webhook events, not solely from API call responses — this closes the gap where a capture succeeds but the process dies before persisting the result.

Relevant events:

* `payment_intent.succeeded` → mark deposit captured.
* `payment_intent.canceled` → mark payment intent cancelled.
* `payment_intent.payment_failed` → flag for review / retry handling.

Webhook handlers must be idempotent (events can be delivered more than once) and must tolerate arriving before or after the corresponding API response is processed.

---

# Payout Behaviour

Because funds are only captured after they become non-refundable:

* Remove payout-delay logic.
* Remove payout restriction logic.
* Remove custom payout holding mechanisms.

Use Stripe Standard Account payout behaviour:

* Providers manage payouts directly through Stripe.
* Stripe handles automatic/manual payouts according to account configuration.
* Platform does not interfere with payout timing.

---

# Areas Impacted

This redesign affects:

1. Booking App payment flow
2. Booking request creation flow
3. Provider acceptance flow
4. Customer cancellation flow
5. Booking state management
6. Scheduled payment processing (delayed capture jobs + reconciliation cron)
7. Stripe PaymentIntent lifecycle handling
8. Stripe webhook handlers
9. Existing payout restriction logic

All affected scenarios should be reviewed and fully regression tested before release.
