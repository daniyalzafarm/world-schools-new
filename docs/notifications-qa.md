# Notifications QA Matrix

> Generated 2026-06-02 from `apps/wc-nest-api/scripts/notification-qa-matrix.ts`.
> Re-run after any catalog or template change. Source spec: `WorldCamps_Notifications_v28.xlsx`.

Total entries: **115**.

## Prerequisites — read before testing

If you just ran a real flow and **no notification arrived on either app** (in-app + email both silent), the problem is almost always an environment / config gap, not a catalog regression. Walk this checklist first.

### 1. Services that must be running

- **Postgres** reachable on `DATABASE_URL` (built from `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`; defaults `localhost:5432`, db `world-schools`). Without it, prop-loaders throw and every delivery row writes `status=failed`.
- **Redis** reachable on `REDIS_URL` (default `redis://localhost:6379`). Without it BullMQ can't enqueue → `NotificationsEnqueueService` logs ERROR, **no `NotificationDelivery` row is written**, and the in-app notification never happens. This is the single most common silent-failure mode.
- **SMTP server** reachable on `EMAIL_HOST` / `EMAIL_PORT`. Only required for the email channel — in-app still works without it. Failures land in `notification_deliveries.error_message`.
- **`nx serve wc-nest-api`** actually running. The BullMQ worker (`NotificationLiveWorker` / `NotificationScheduledWorker`) is in-process — if the API isn't up, jobs pile up in Redis and never deliver.

### 2. Environment variables (and the silent-failure mode for each)

| Var | Default | Silent failure if unset / wrong |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Enqueue fails; no audit row; ERROR log `Failed to enqueue notification …`. |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP connect fails; delivery row `failed`; retries 5× then dies. |
| `EMAIL_PORT` | `587` | TLS / port mismatch; same failure path as `EMAIL_HOST`. |
| `EMAIL_USER` | _empty_ | SMTP auth rejects; delivery row `failed`. |
| `EMAIL_PASS` | _empty_ | SMTP auth rejects; delivery row `failed`. |
| `EMAIL_FROM` | `noreply@worldschools.com` | Provider rejects from-address; delivery row `failed`. |
| `BOOKING_PORTAL_URL` | `http://localhost:4303` | In-app + email still send, but click-through links point at the wrong host. Production deploys must set this explicitly. |
| `PROVIDER_PORTAL_URL` | `http://localhost:4302` | Same — provider redirect URLs wrong. |
| `SUPERADMIN_PORTAL_URL` | `http://localhost:4301` | Same — superadmin redirect URLs wrong. |
| `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` | _unset_ | `/admin/queues` returns **503 in every environment** (Phase 14c hardening — no dev fallback). Notifications themselves still work; this only blocks the ops dashboard. |

### 3. Per-user data preconditions

- The recipient `User.email` must be non-null for the email channel to fire. If null: in-app still delivers, but the email delivery row is written with `status=skipped` and `errorMessage='recipient has no email address'`.
- The Parent / Provider relationships must exist. The `parentForBooking` resolver walks `BookingGroup.parent.userId`; if any link is null the resolver returns `[]` and the dispatcher logs WARN `No recipients resolved`, then exits without enqueueing.
- For non-transactional triggers, check `notification_preferences` — a row with `enabled=false` for the user × templateKey × channel will silently drop the channel. Booking lifecycle, payments, refunds, disputes and other transactional entries bypass this filter entirely.

### 4. 30-second diagnostic walk

Run these in order until one of them lights up the problem.

1. `curl http://localhost:3000/health/notifications` → if `status: 'degraded'` or either queue reports an error, Redis is unreachable. Start there.
2. Check the audit log:

   ```sql
   SELECT template_key, channel, status, error_message, enqueued_at
   FROM notification_deliveries
   WHERE recipient_user_id = '<userId>'
   ORDER BY enqueued_at DESC
   LIMIT 10;
   ```

   - **Zero rows** → dispatcher never enqueued. Tail server logs for `[NotificationDispatcherService]` / `[NotificationsEnqueueService]` — likely Redis down or a missing wiring point.
   - **All `skipped` with `loadProps returned null`** → source entity (BookingGroup, etc.) wasn't found or has transitioned out of the relevant state.
   - **All `skipped` with `recipient has no email address`** → populate `User.email`.
   - **All `failed` with an SMTP error** → fix `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS`. Job will retry 5× automatically once creds are right.
   - **`status: sent` but the UI looks empty** → the row is in `notifications` but the frontend hasn't seen it. Refresh the notifications page (WebSocket may not have reconnected). To rule out the WS path entirely:

     ```sql
     SELECT id, title, type, created_at
     FROM notifications
     WHERE user_id = '<userId>'
     ORDER BY created_at DESC
     LIMIT 5;
     ```

3. Confirm the user has an email set:

   ```sql
   SELECT id, email, first_name FROM users WHERE id = '<userId>';
   ```

### 5. Ops dashboard (Bull Board)

Mounted at `/admin/queues`. Requires **both** `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD` to be set; otherwise the route hard-503s in every environment. With the env vars set, basic-auth in to see live + scheduled queues, retry failed jobs, and inspect job payloads.

---

- [Parent](#parent-46-entries): 46
- [Provider](#provider-50-entries): 50
- [Superadmin](#superadmin-19-entries): 19

---

## Parent (46 entries) <a id="parent-46-entries"></a>

### Parent — booking

#### `parent.booking.accepted`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Booking confirmed — Alpine Adventure Camp
- Body: Your booking for Emma at Alpine Adventure Camp is confirmed. Deposit of $650.00 received; balance of $1,950.00 due on 12 May 2026.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Your booking at Alpine Adventure Camp is confirmed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.booking.cancelled`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Booking cancelled — Alpine Adventure Camp
- Body: Your booking for Emma at Alpine Adventure Camp has been cancelled. A refund of $650.00 arrives within 5–10 business days.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Cancellation confirmed — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.booking.declined`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Booking declined — Alpine Adventure Camp
- Body: Your booking request for Alpine Adventure Camp on 12–26 Jul 2026 was declined. No charge has been made. Reason: Capacity or scheduling conflict.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Your booking request for Alpine Adventure Camp wasn't confirmed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.booking.expired`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Request expired — undefined
- Body: Your booking request for undefined expired without a response. You have not been charged.
- Redirect URL: `/camps`
- Entity type: `booking_group`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.booking.modified`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Booking updated — Alpine Adventure Camp
- Body: Your booking for Emma at Alpine Adventure Camp was updated: Add-on selections updated · 2 add-ons changed
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Your booking at Alpine Adventure Camp has been updated
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.booking.requestStillPending`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Still waiting — undefined
- Body: Your booking request for undefined is still awaiting a response. The camp has 24 more hours to confirm.
- Redirect URL: `/bookings/undefined`
- Entity type: `booking_group`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.booking.requestSubmitted`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Request sent — Alpine Adventure Camp
- Body: Your booking request for Emma at Alpine Adventure Camp is awaiting confirmation. The camp has 72 hours to respond.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Your booking request for Alpine Adventure Camp has been sent
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.booking.requestWithdrawn`

- **Audience**: parent
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Request withdrawn — Alpine Adventure Camp
- Body: Your booking request for Two-Week Mountain Discovery — Session 3 at Alpine Adventure Camp has been withdrawn. You have not been charged.
- Redirect URL: `/bookings`
- Entity type: `booking_group`

**Email preview:**

- Subject: Your booking request for Alpine Adventure Camp has been withdrawn
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.checkout.abandoned2d`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Pick up where you left off — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.checkout.abandoned3h`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Pick up where you left off — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.checkout.abandoned4d`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Pick up where you left off — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.checkout.abandoned6d`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Last chance — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.preCamp.checklist14d`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Two weeks to go — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.preCamp.dayBefore`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Tomorrow's the day! — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.preCamp.packingReminder7d`

- **Audience**: parent
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Packing time — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Parent — dispute

#### `parent.dispute.opened`

- **Audience**: parent
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Chargeback opened — Alpine Adventure Camp
- Body: Your bank has opened a chargeback for $2,600.00. Contact your bank for more.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback opened — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.dispute.resolvedLost`

- **Audience**: parent
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Chargeback resolved (refunded) — Alpine Adventure Camp
- Body: Chargeback for $2,600.00 on Alpine Adventure Camp closed (lost).
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback resolved — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.dispute.resolvedWon`

- **Audience**: parent
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Chargeback closed (charge stands) — Alpine Adventure Camp
- Body: Chargeback for $2,600.00 on Alpine Adventure Camp closed (won).
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback resolved — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — marketing

#### `parent.conversion.postDeclineAlternatives`

- **Audience**: parent
- **Category**: marketing
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Alternatives to Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Parent — message

#### `parent.messaging.newFromCamp`

- **Audience**: parent
- **Category**: message
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForConversation`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: New message from Camp Director Jana
- Body: Hi Sarah — just wanted to share the packing list for Emma's session...
- Redirect URL: `/messages`
- Entity type: `message`

**Email preview:**

- Subject: New message from Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — payment

#### `parent.payment.balanceCharged`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Balance paid — Alpine Adventure Camp
- Body: Your balance of $1,950.00 was collected successfully. Booking WC-2026-A8K3LM.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payment`

**Email preview:**

- Subject: Balance paid for Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.payment.balanceFailedFinal`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Final payment attempt failed — Alpine Adventure Camp
- Body: $1,950.00 payment failed. Please update your payment method to avoid cancellation.
- Redirect URL: `/bookings/WC-2026-A8K3LM/payment/update`
- Entity type: `payment`

**Email preview:**

- Subject: Final attempt failed — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.payment.balanceFailedFirst`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Payment failed — Alpine Adventure Camp
- Body: $1,950.00 payment failed. Please update your payment method to avoid cancellation.
- Redirect URL: `/bookings/WC-2026-A8K3LM/payment/update`
- Entity type: `payment`

**Email preview:**

- Subject: Payment issue — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.payment.balanceFailedSecond`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Payment failed — Alpine Adventure Camp
- Body: $1,950.00 payment failed. Please update your payment method to avoid cancellation.
- Redirect URL: `/bookings/WC-2026-A8K3LM/payment/update`
- Entity type: `payment`

**Email preview:**

- Subject: Payment issue — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.payment.balanceReminder14d`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Balance due in 14 days — Alpine Adventure Camp
- Body: $1,950.00 will be charged on 12 May 2026. Booking WC-2026-A8K3LM.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payment`

**Email preview:**

- Subject: Balance due in 14 days — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.payment.balanceReminder3d`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Balance due in 3 days — Alpine Adventure Camp
- Body: $1,950.00 will be charged on 12 May 2026. Booking WC-2026-A8K3LM.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payment`

**Email preview:**

- Subject: Balance due in 3 days — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.payment.balanceReminder7d`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Balance due in 7 days — Alpine Adventure Camp
- Body: $1,950.00 will be charged on 12 May 2026. Booking WC-2026-A8K3LM.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payment`

**Email preview:**

- Subject: Balance due in 7 days — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.payment.cancelledNonPayment`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Booking cancelled (non-payment) — Alpine Adventure Camp
- Body: We weren't able to collect the balance for Alpine Adventure Camp. Booking WC-2026-A8K3LM has been cancelled.
- Redirect URL: `/camps`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking cancelled — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.payment.depositConfirmed`

- **Audience**: parent
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Deposit received — Alpine Adventure Camp
- Body: Deposit of $650.00 received. Balance of $1,950.00 due on 12 May 2026.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payment`

**Email preview:**

- Subject: Deposit received for Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — profile

#### `parent.profile.incomplete`

- **Audience**: parent
- **Category**: profile
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Finish setting up your World Camps profile
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Parent — refund

#### `parent.refund.failed`

- **Audience**: parent
- **Category**: refund
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: dear

**In-app preview:**

- Title: Refund failed — Alpine Adventure Camp
- Body: Refund of $650.00 for Alpine Adventure Camp could not be processed. We'll be in touch.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `refund`

**Email preview:**

- Subject: Refund issue — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.refund.issued`

- **Audience**: parent
- **Category**: refund
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Refund processed — $650.00
- Body: Refund of $650.00 for Alpine Adventure Camp will appear within 5–10 business days.
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `refund`

**Email preview:**

- Subject: Refund processed — $650.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — review

#### `parent.postCamp.reviewReminder`

- **Audience**: parent
- **Category**: review
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Reminder — share your Alpine Adventure Camp review
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.postCamp.reviewRequest`

- **Audience**: parent
- **Category**: review
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: How was your Alpine Adventure Camp experience?
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.postCamp.survey`

- **Audience**: parent
- **Category**: review
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentForBooking`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: A quick survey about Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.review.removed`

- **Audience**: parent
- **Category**: review
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForReview`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Review removed — Alpine Adventure Camp
- Body: Content violated our review guidelines on personal attacks.
- Redirect URL: `/reviews`
- Entity type: `review`

**Email preview:**

- Subject: Your review of Alpine Adventure Camp was removed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.review.responsePublished`

- **Audience**: parent
- **Category**: review
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForReview`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: Alpine Adventure Camp replied to your review
- Body: Thank you for the lovely review, Sarah — Emma was a joy to have...
- Redirect URL: `/reviews`
- Entity type: `review`

**Email preview:**

- Subject: Alpine Adventure Camp replied to your review
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — support

#### `parent.support.ticketReply`

- **Audience**: parent
- **Category**: support
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForSupportTicket`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Support reply — Question about session start time
- Body: Thanks for reaching out — drop-off opens at 8:30am on Sunday...
- Redirect URL: `/support/WC-TKT-2026-A1B2`
- Entity type: `support_ticket`

**Email preview:**

- Subject: Support reply — Question about session start time
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.support.ticketStatusChanged`

- **Audience**: parent
- **Category**: support
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentForSupportTicket`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: hi

**In-app preview:**

- Title: Ticket resolved — Question about session start time
- Body: Your support ticket is now resolved. Reference WC-TKT-2026-A1B2.
- Redirect URL: `/support/WC-TKT-2026-A1B2`
- Entity type: `support_ticket`

**Email preview:**

- Subject: Ticket resolved — Question about session start time
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Parent — wishlist

#### `parent.wishlist.deadlineApproaching`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: Deadline approaching — Alpine Adventure Camp
- Body: Was $2,600 — now $2,200 through 15 June.
- Redirect URL: `/wishlist`
- Entity type: `wishlist_item`

**Email preview:**

- Subject: Deadline approaching — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.wishlist.earlyBirdIncrease`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: Early-bird ending — Alpine Adventure Camp
- Body: Was $2,600 — now $2,200 through 15 June.
- Redirect URL: `/wishlist`
- Entity type: `wishlist_item`

**Email preview:**

- Subject: Early-bird ending — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.wishlist.empty`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Discover camps your family will love
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.wishlist.fillingUp`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: Filling up — Alpine Adventure Camp
- Body: Was $2,600 — now $2,200 through 15 June.
- Redirect URL: `/wishlist`
- Entity type: `wishlist_item`

**Email preview:**

- Subject: Alpine Adventure Camp is filling up
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `parent.wishlist.itemsNoBooking21d`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Still thinking about Alpine Adventure Camp?
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.wishlist.itemsNoBooking7d`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**Email preview:**

- Subject: Still thinking about Alpine Adventure Camp?
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `parent.wishlist.priceDrop`

- **Audience**: parent
- **Category**: wishlist
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `parentByUserId`
- **Transactional**: no
- **Salutation**: hi

**In-app preview:**

- Title: Price drop — Alpine Adventure Camp
- Body: Was $2,600 — now $2,200 through 15 June.
- Redirect URL: `/wishlist`
- Entity type: `wishlist_item`

**Email preview:**

- Subject: Price drop on Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

## Provider (50 entries) <a id="provider-50-entries"></a>

### Provider — booking

#### `provider.booking.accepted`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allProviderUsers`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: You accepted booking undefined
- Body: Camp: undefined
- Redirect URL: `/provider/bookings/undefined`
- Entity type: `booking_group`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.cancelledByFamily`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — cancelled by family
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.cancelledNonPayment`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — cancelled — non-payment
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.declined`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allProviderUsers`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: You declined booking undefined
- Body: Camp: undefined
- Redirect URL: `/provider/bookings/undefined`
- Entity type: `booking_group`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.firstBooking`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: First booking request — Alpine Adventure Camp Ltd
- Body: Congratulations — your first booking request just arrived. Open the dashboard to respond.
- Redirect URL: `/dashboard`

**Email preview:**

- Subject: First booking request — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.modified`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — updated
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.request48hReminder`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — 48h response window
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.booking.requestExpired`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — request expired
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.booking.requestFinalReminder`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — final reminder
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.booking.requestReceived`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allProviderUsers`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: New booking request — undefined
- Body: Booking undefined requires your response.
- Redirect URL: `/provider/bookings/undefined`
- Entity type: `booking_group`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.booking.requestWithdrawn`

- **Audience**: provider
- **Category**: booking
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allProviderUsersForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Booking WC-2026-A8K3LM — request withdrawn
- Body: Program: Two-Week Mountain Discovery — Session 3
- Redirect URL: `/provider/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.postCamp.wrap`

- **Audience**: provider
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForCamp`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Camp wrap — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.preCamp.checklist`

- **Audience**: provider
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForCamp`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Two weeks to go — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.preCamp.dayBefore`

- **Audience**: provider
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForCamp`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Camp starts tomorrow — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.preCamp.rosterReady`

- **Audience**: provider
- **Category**: booking
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForCamp`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Roster ready — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Provider — dispute

#### `provider.dispute.evidenceDue`

- **Audience**: provider
- **Category**: dispute
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Evidence due: 5 June 2026
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/disputes`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback evidence due 5 June 2026
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.dispute.opened`

- **Audience**: provider
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Chargeback opened: $2,600.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/disputes`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback opened — $2,600.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.dispute.resolvedLost`

- **Audience**: provider
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Chargeback lost: booking WC-2026-A8K3LM
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/disputes`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback lost — booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.dispute.resolvedWon`

- **Audience**: provider
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Chargeback won: booking WC-2026-A8K3LM
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/disputes`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback won — booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — message

#### `provider.messaging.newFromFamily`

- **Audience**: provider
- **Category**: message
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsers`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: New message from Sarah Bennett
- Body: Hi — quick question about drop-off times…
- Redirect URL: `/provider/messages`
- Entity type: `message`

**Email preview:**

- Subject: New message from Sarah Bennett
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.messaging.unanswered24h`

- **Audience**: provider
- **Category**: message
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsers`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Reply pending: Sarah Bennett
- Body: Hi — quick question about drop-off times…
- Redirect URL: `/provider/messages`
- Entity type: `message`

**Email preview:**

- Subject: Message unanswered 24h — Sarah Bennett
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.messaging.unanswered48h`

- **Audience**: provider
- **Category**: message
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsers`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Reply overdue: Sarah Bennett
- Body: Hi — quick question about drop-off times…
- Redirect URL: `/provider/messages`
- Entity type: `message`

**Email preview:**

- Subject: Message unanswered 48h — Sarah Bennett
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Provider — onboarding

#### `provider.application.additionalInfoRequired`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Action needed: additional information
- Body: We need more information to finish review.
- Redirect URL: `/onboarding/status`

**Email preview:**

- Subject: Action needed: additional information
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.application.approved`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Application approved — Alpine Adventure Camp Ltd
- Body: Your application is approved. Continue onboarding (Stripe Connect, payment policies) to publish camps.
- Redirect URL: `/onboarding/status`

**Email preview:**

- Subject: Application approved — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.application.declined`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Application not approved
- Body: Your application was not approved.
- Redirect URL: `/onboarding/status`

**Email preview:**

- Subject: Application not approved
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.application.documentReuploadRequested`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Action needed: reupload a document
- Body: Please reupload the requested document.
- Redirect URL: `/onboarding/status`

**Email preview:**

- Subject: Action needed: reupload a document
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.application.received`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Application received — Alpine Adventure Camp Ltd
- Body: We received your provider application. Expect a response within 3 business days.
- Redirect URL: `/onboarding/status`

**Email preview:**

- Subject: Application received — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.onboarding.connectStripeNudge`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Connect Stripe to publish — Alpine Adventure Camp Ltd
- Body: Your camp is approved but bookings stay blocked until Stripe is connected.
- Redirect URL: `/onboarding/stripe-connect`

**Email preview:**

- Subject: Connect Stripe to publish — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.onboarding.connectStripeReminder`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Reminder: connect Stripe — Alpine Adventure Camp Ltd
- Body: Just a nudge — Stripe isn't connected yet. Connecting takes about 5 minutes.
- Redirect URL: `/onboarding/stripe-connect`

**Email preview:**

- Subject: Reminder: connect Stripe — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.onboarding.stripeDisconnected`

- **Audience**: provider
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Stripe disconnected — Alpine Adventure Camp Ltd
- Body: Your Stripe account has been disconnected. New bookings will be blocked until you reconnect.
- Redirect URL: `/onboarding/stripe-connect`

**Email preview:**

- Subject: Stripe disconnected — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — payment

#### `provider.payments.balanceCollected`

- **Audience**: provider
- **Category**: payment
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Balance collected: $2,340.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Balance collected — $2,340.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — payout

#### `provider.payouts.delayed`

- **Audience**: provider
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Payout delayed: $2,340.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Payout delayed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.payouts.failed`

- **Audience**: provider
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Payout failed: $2,340.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Payout failed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.payouts.released`

- **Audience**: provider
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Payout released: $2,340.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Payout released — $2,340.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.payouts.reminder`

- **Audience**: provider
- **Category**: payout
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Upcoming payout: $2,340.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Upcoming payout — $2,340.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.payouts.scheduleConfirmed`

- **Audience**: provider
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Payout schedule confirmed
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/payouts`
- Entity type: `payout`

**Email preview:**

- Subject: Payout schedule confirmed
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — profile

#### `provider.profile.incomplete`

- **Audience**: provider
- **Category**: profile
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Finish your profile — Alpine Adventure Camp Ltd
- Body: Your profile is 60% complete. Filling the remaining sections helps families find and trust your camp.
- Redirect URL: `/dashboard`

**Email preview:**

- Subject: Finish your profile — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.profile.published`

- **Audience**: provider
- **Category**: profile
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Your profile is live — Alpine Adventure Camp Ltd
- Body: Families can now discover, wishlist, and request bookings.
- Redirect URL: `/dashboard`

**Email preview:**

- Subject: Your profile is live — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — refund

#### `provider.refund.failed`

- **Audience**: provider
- **Category**: refund
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Refund failed: WC-2026-A8K3LM
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/refunds`
- Entity type: `refund`

**Email preview:**

- Subject: Refund failed — booking WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.refund.issued`

- **Audience**: provider
- **Category**: refund
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Refund issued: $1,950.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/refunds`
- Entity type: `refund`

**Email preview:**

- Subject: Refund issued — $1,950.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.reimbursement.owed`

- **Audience**: provider
- **Category**: refund
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerOwnerForBooking`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Reimbursement owed: $1,950.00
- Body: Booking WC-2026-A8K3LM.
- Redirect URL: `/provider/refunds`
- Entity type: `refund`

**Email preview:**

- Subject: Reimbursement owed — $1,950.00
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — review

#### `provider.review.new`

- **Audience**: provider
- **Category**: review
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsersForReview`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: New review: Alpine Adventure Camp
- Body: Emma had an incredible week — the staff were amazing…
- Redirect URL: `/provider/reviews`
- Entity type: `review`

**Email preview:**

- Subject: New review for Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.review.notRespondedReminder`

- **Audience**: provider
- **Category**: review
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `allProviderUsersForReview`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Respond to a review: Alpine Adventure Camp
- Body: Emma had an incredible week — the staff were amazing…
- Redirect URL: `/provider/reviews`
- Entity type: `review`

**Email preview:**

- Subject: Respond to a review — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.review.removed`

- **Audience**: provider
- **Category**: review
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allProviderUsersForReview`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Review removed: Alpine Adventure Camp
- Body: Emma had an incredible week — the staff were amazing…
- Redirect URL: `/provider/reviews`
- Entity type: `review`

**Email preview:**

- Subject: Review removed — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.review.responsePublished`

- **Audience**: provider
- **Category**: review
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allProviderUsersForReview`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Reply published: Alpine Adventure Camp
- Body: Emma had an incredible week — the staff were amazing…
- Redirect URL: `/provider/reviews`
- Entity type: `review`

**Email preview:**

- Subject: Your reply is live — Alpine Adventure Camp
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — support

#### `provider.support.ticketReply`

- **Audience**: provider
- **Category**: support
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerUserForSupportTicket`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Support reply: Payout schedule clarification
- Body: Thanks for reaching out — the payout schedule is configured per...
- Redirect URL: `/provider/support/WC-TKT-2026-P1Q2`
- Entity type: `support_ticket`

**Email preview:**

- Subject: Support reply — Payout schedule clarification
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `provider.support.ticketStatusChanged`

- **Audience**: provider
- **Category**: support
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `providerUserForSupportTicket`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Ticket thanks for reaching out — the payout schedule is configured per...: Payout schedule clarification
- Body: Thanks for reaching out — the payout schedule is configured per...
- Redirect URL: `/provider/support/WC-TKT-2026-P1Q2`
- Entity type: `support_ticket`

**Email preview:**

- Subject: Ticket thanks for reaching out — the payout schedule is configured per... — Payout schedule clarification
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Provider — system

#### `provider.programs.notUpdated30d`

- **Audience**: provider
- **Category**: system
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Programs not updated 30d — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.programs.notUpdated60d`

- **Audience**: provider
- **Category**: system
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Programs not updated 60d — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `provider.season.ended`

- **Audience**: provider
- **Category**: system
- **Channels**: email
- **Trigger**: scheduled
- **Resolver**: `providerOwnerByProviderId`
- **Transactional**: no
- **Salutation**: none

**Email preview:**

- Subject: Season wrapped — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

## Superadmin (19 entries) <a id="superadmin-19-entries"></a>

### Superadmin — booking

#### `superadmin.booking.cancelledNonPayment`

- **Audience**: superadmin
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Cancelled (non-payment): WC-2026-A8K3LM
- Body: Alpine Adventure Camp Ltd · $2,340.00
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `booking_group`

**Email preview:**

- Subject: Booking cancelled (non-payment) — WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.camp.unresponsiveExpiredRequests`

- **Audience**: superadmin
- **Category**: booking
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Camp unresponsive: Alpine Adventure Camp Ltd
- Body: 
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Camp unresponsive — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Superadmin — dispute

#### `superadmin.dispute.filed`

- **Audience**: superadmin
- **Category**: dispute
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Chargeback: WC-2026-A8K3LM
- Body: Alpine Adventure Camp Ltd · $2,340.00
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `dispute`

**Email preview:**

- Subject: Chargeback received — WC-2026-A8K3LM
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.dispute.resolved`

- **Audience**: superadmin
- **Category**: dispute
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Dispute resolved: 
- Body: undefined
- Redirect URL: `⚠️ Cannot read properties of undefined (reading 'replace')`
- Entity type: `dispute`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Superadmin — onboarding

#### `superadmin.camp.applicationNew`

- **Audience**: superadmin
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: New application: Alpine Adventure Camp Ltd
- Body: Switzerland
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: New camp application — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.camp.firstListingLive`

- **Audience**: superadmin
- **Category**: onboarding
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: New listing live: undefined
- Body: 
- Redirect URL: `⚠️ Cannot read properties of undefined (reading 'replace')`
- Entity type: `camp`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.camp.profileIncomplete14d`

- **Audience**: superadmin
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Profile incomplete (14d): Alpine Adventure Camp Ltd
- Body: Switzerland
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Profile still incomplete (14d) — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `superadmin.camp.verificationDocsNotUploaded`

- **Audience**: superadmin
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Docs not uploaded: Alpine Adventure Camp Ltd
- Body: Switzerland
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Docs not uploaded — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `superadmin.camp.verificationDocsUploaded`

- **Audience**: superadmin
- **Category**: onboarding
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Verification docs uploaded: Alpine Adventure Camp Ltd
- Body: Switzerland
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Verification docs ready — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Superadmin — payout

#### `superadmin.payout.failure`

- **Audience**: superadmin
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Payout failure: Alpine Adventure Camp Ltd
- Body: Alpine Adventure Camp Ltd · $2,340.00
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `payout`

**Email preview:**

- Subject: Payout failure — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.payout.fundsPendingTransfer`

- **Audience**: superadmin
- **Category**: payout
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Funds pending: 
- Body: undefined
- Redirect URL: `⚠️ Cannot read properties of undefined (reading 'replace')`
- Entity type: `payout`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.payout.recoveryNeeded`

- **Audience**: superadmin
- **Category**: payout
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: yes (bypasses user preferences)
- **Salutation**: none

**In-app preview:**

- Title: Clawback recovery: Alpine Adventure Camp Ltd
- Body: Alpine Adventure Camp Ltd · $2,340.00
- Redirect URL: `/bookings/WC-2026-A8K3LM`
- Entity type: `reimbursement`

**Email preview:**

- Subject: Clawback needs recovery — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Superadmin — profile

#### `superadmin.camp.profileDeactivated`

- **Audience**: superadmin
- **Category**: profile
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Profile deactivated: Alpine Adventure Camp Ltd
- Body: 
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Profile deactivated (90d) — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

#### `superadmin.camp.profileNeedsAttention60d`

- **Audience**: superadmin
- **Category**: profile
- **Channels**: in_app, email
- **Trigger**: scheduled
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Profile needs attention: Alpine Adventure Camp Ltd
- Body: 
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Profile needs attention (60d) — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification
- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)

---

### Superadmin — review

#### `superadmin.review.flagged`

- **Audience**: superadmin
- **Category**: review
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Review flagged: Alpine Adventure Camp Ltd
- Body: From Sarah Johnson · 2/5
- Redirect URL: `/reviews/wc-rev-abc`
- Entity type: `review`

**Email preview:**

- Subject: Review flagged — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Superadmin — support

#### `superadmin.support.ticketNew`

- **Audience**: superadmin
- **Category**: support
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: New support ticket: ST-2026-001
- Body: Sarah Johnson: Cannot complete payment
- Redirect URL: `/support/ST-2026-001`
- Entity type: `support_ticket`

**Email preview:**

- Subject: New support ticket — ST-2026-001
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.support.ticketReply`

- **Audience**: superadmin
- **Category**: support
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Reply on undefined
- Body: undefined: undefined
- Redirect URL: `/support/`
- Entity type: `support_ticket`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---

### Superadmin — system

#### `superadmin.camp.deletionRequested`

- **Audience**: superadmin
- **Category**: system
- **Channels**: in_app, email
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Deletion requested: Alpine Adventure Camp Ltd
- Body: 
- Redirect URL: `/providers/wc-prov-abc`
- Entity type: `camp`

**Email preview:**

- Subject: Deletion requested — Alpine Adventure Camp Ltd
- Plain-text alt: yes

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Confirm email delivered (recipient inbox)
- [ ] Confirm email subject matches the preview above
- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)
- [ ] Re-trigger the source event — confirm no duplicate notification

---

#### `superadmin.camp.stripeDisconnected`

- **Audience**: superadmin
- **Category**: system
- **Channels**: in_app
- **Trigger**: live
- **Resolver**: `allSuperadmins`
- **Transactional**: no
- **Salutation**: none

**In-app preview:**

- Title: Stripe disconnected: undefined
- Body: 
- Redirect URL: `⚠️ Cannot read properties of undefined (reading 'replace')`
- Entity type: `camp`

**Test steps:**

- [ ] Trigger the source event in a test environment
- [ ] Confirm in-app delivery (appears in notifications page, badge increments)
- [ ] Confirm in-app title + body match the preview above
- [ ] Click-through navigates to the expected URL
- [ ] Re-trigger the source event — confirm no duplicate notification

---
