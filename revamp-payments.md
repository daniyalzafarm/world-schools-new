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
* Schedule capture at the grace deadline.
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

# Scheduled Processing Requirements

Implement a background job that:

1. Finds bookings where:

   * Provider has accepted.
   * Deposit has not been captured.
   * Grace deadline has passed.

2. Captures the associated PaymentIntent.

Pseudo-logic:

```text
for each booking:
    if provider_accepted
       and deposit_not_captured
       and current_time >= grace_deadline:
           capture_payment_intent()
```

---

# Acceptance Flow Changes

Provider acceptance logic must evaluate:

```text
accepted_before_grace_deadline ?
```

If TRUE:

```text
schedule capture for grace_deadline
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
cancel payment intent
```

If FALSE:

```text
follow standard cancellation/refund policy
```

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
6. Scheduled payment processing jobs
7. Stripe PaymentIntent lifecycle handling
8. Existing payout restriction logic

All affected scenarios should be reviewed and fully regression tested before release.
