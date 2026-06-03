# Notifications — Ops Runbook

> Operational triage for the v28 notification system. Companion to [`notifications-architecture.md`](./notifications-architecture.md) (system design) and [`notifications-qa.md`](./notifications-qa.md) (per-trigger QA).

Use this when:
- A user (or support) reports "I didn't get the email/in-app for X."
- `GET /health/notifications` returns `status: 'degraded'` or queue depths are unusually high.
- A new `NotificationDelivery` row appears with `status='failed'`.
- A scheduled trigger (pre-camp reminder, balance reminder) didn't fire.

---

## First five minutes — health snapshot

```bash
# Live + scheduled queue depths + last-cron heartbeats + counter snapshot.
curl -s "$API_HOST/health/notifications" | jq
```

Expected shape (degraded state surfaces `status: 'degraded'`):

```json
{
  "status": "ok",
  "queues": {
    "live": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0, "completed": ... },
    "scheduled": { "waiting": 0, "active": 0, "delayed": 12345, "failed": 0, "completed": ... }
  },
  "metrics": {
    "enqueuedTotal": ...,
    "sent": { "in_app": ..., "email": ... },
    "failed": { "in_app": ..., "email": ... },
    "terminalFailed": { "in_app": 0, "email": 0 },
    "skipped": { "in_app": ..., "email": ... },
    "lastCronRunAt": { "reconciliation": "2026-05-26T02:00:01.123Z", ... }
  }
}
```

Red flags:
- `queues.live.failed` > 0 — jobs sitting failed in Redis (Phase 14c keeps them with `removeOnFail: false`).
- `metrics.terminalFailed.email` climbing — retries exhausted; user definitely didn't get the email.
- `metrics.lastCronRunAt.reconciliation` more than 26 hours stale — the daily cron didn't run.

---

## "User X didn't get notification Y"

### 1. Was a delivery row written?

```sql
-- Replace template_key + recipient_user_id with the actual values.
SELECT id, channel, status, attempt, job_id, error_message, enqueued_at, sent_at
FROM notification_deliveries
WHERE template_key = 'parent.payment.balanceFailedFirst'
  AND recipient_user_id = '<userId>'
ORDER BY enqueued_at DESC
LIMIT 20;
```

Interpret:
- **No rows** → the dispatcher never enqueued. Either the resolver returned an empty recipient list, the user opted out via `notification_preferences`, or the domain service never called `notify()`. Check `notification_preferences` and the domain commit point.
- **`status='sent'`** → notification was delivered. If the user still claims they didn't see it: check `notifications` table (in-app) or the email provider's send logs (email + `messageId` column).
- **`status='skipped'` with `errorMessage='loadProps returned null'`** → the entity transitioned out of the relevant state by the time the worker ran (e.g. booking moved to `accepted` before the 48h "still pending" reminder fired). This is **correct behaviour** for scheduled reminders.
- **`status='skipped'` with `errorMessage='recipient has no email address'`** → user.email is null/empty. Investigate why.
- **`status='failed'`** — see next section.

### 2. A delivery row is `failed` — what now?

```sql
SELECT error_message, attempt, job_id, enqueued_at
FROM notification_deliveries
WHERE id = '<deliveryId>';
```

- `error_message` is sanitised to the first line of the original error, capped at 500 chars.
- `attempt` shows how many retries we've made. The queue's default is 5 attempts; in-app-only jobs use 3.
- `job_id` lets you find the job in Bull Board.

Common causes:
- `SMTP timeout` / `SMTP connection refused` — email provider down or rate-limiting. Wait, then manually retry.
- `Prisma error: connection pool exhausted` — DB pressure. Retry once DB recovers.
- `No catalog entry for <type>` — code regression, the type was emitted but its catalog entry was removed. Add the catalog entry back or stop emitting.

### 3. Manual retry via Bull Board

Open `/admin/queues` (basic-auth: `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` env vars). Find the job by `job_id`, click **Retry**. The worker will re-enter the same `runNotificationJob` flow; the dedup layers make re-running safe.

If the job no longer exists in Redis (BullMQ removed it after the configured `removeOnComplete`/`removeOnFail` age), see "Force re-emit" below.

### 4. Force re-emit from the domain context

For any trigger, you can re-emit by re-running the domain action that originally fires it (e.g. cancel a booking again to re-fire the cancellation notify — except: dedup means it'll just hit the existing `sent` row and skip). To actually re-deliver:

1. Delete the existing `NotificationDelivery` row for that `(template_key, channel, dedupe_key)`.
2. Call `notify(events, NotificationType.X, { ...primitiveIds })` from a one-off script (NestJS console or a temporary admin endpoint).

The dispatcher will re-run resolver + enqueue; the unique index dedup is now clear so the worker will fully process.

---

## Scheduled trigger didn't fire

Scheduled triggers (pre-camp reminders, balance reminders, post-decline alternatives) live in the `notifications.scheduled` BullMQ queue and / or are re-emitted nightly by the reconciliation cron.

### Was the scheduled job ever enqueued?

Check Bull Board → `notifications.scheduled` queue → look for the job by `<type>:<recipientUserId>:<dedupeKey>`. If present with a future `delayedUntil` timestamp, it's waiting correctly.

If absent:
- Was the domain commit point hit? (e.g. `acceptForProvider` schedules pre-camp reminders at `startDate − 14d/7d/1d`.) Check the relevant domain service's log.
- Did the reconciliation cron run? Check `metrics.lastCronRunAt.reconciliation` from `/health/notifications`. If stale, manually trigger by deleting the Redis lock + re-running the cron:

```bash
redis-cli DEL cron:lock:notification-reconciliation:daily
# Then on the API, call the cron's run() method manually (via a one-off
# script or temporary admin endpoint), or wait for the next 02:00 UTC tick.
```

### Reconciliation cron stuck

Symptoms: `metrics.lastCronRunAt.reconciliation` more than 26 hours stale, or `cron:lock:notification-reconciliation:daily` exists in Redis but no worker is running.

```bash
# Clear stale lock — 15-min TTL means a real running cron has the lock,
# stale lock means a crashed cron left it behind.
redis-cli DEL cron:lock:notification-reconciliation:daily

# Inspect Redis lock TTL first to confirm staleness:
redis-cli TTL cron:lock:notification-reconciliation:daily   # -1 / -2 = stale, otherwise running
```

---

## Profile-completion stuck at 0

Phase 14d moved the profile-completion recompute into a `profile-completion` BullMQ queue (`jobId: profile:<kind>:<id>`).

If a user reports their profile score isn't updating after they edited fields:

1. Look at the `profile-completion` queue in Bull Board — is the user's job in `failed`?
2. Run the sync method manually (one-off script): `await profileCompletion.recomputeForParent(parentId)`.
3. If the score is still wrong after a successful recompute, check the formula in `profile-completion.service.ts` against the user's actual field values.

---

## "Bull Board returns 503"

Means `BULL_BOARD_USER` or `BULL_BOARD_PASSWORD` env vars are unset. Phase 14c removed the dev-fallback that allowed auth bypass in non-production environments — `/admin/queues` is now always 503'd if creds aren't set.

Fix: set the env vars and restart. There is no override.

---

## "PATCH /notification-preferences returns 429"

User is being rate-limited (Phase 14c — 30 requests / 60s per user via Redis `INCR + EXPIRE`). Wait 60s, then retry.

To investigate: check the per-user counter in Redis:

```bash
redis-cli GET rate:notif-prefs:<userId>
```

---

## Bulk re-emit (e.g. backfilling a new trigger)

When a new trigger ships and you want to fire it for entities created before the deploy:

1. Write a one-off script that iterates the source entities and calls `notify(events, NotificationType.X, ctx)` for each.
2. Run during off-peak hours — the dispatcher fans out one BullMQ job per (recipient × channel), so a 10k-entity backfill produces ~10k jobs.
3. Watch `queue.live.delayed` + `queue.live.waiting` in `/health/notifications` to confirm drain rate.

---

## Useful Prisma queries

```sql
-- Failed deliveries in the last hour
SELECT template_key, channel, error_message, COUNT(*)
FROM notification_deliveries
WHERE status = 'failed' AND enqueued_at > now() - INTERVAL '1 hour'
GROUP BY template_key, channel, error_message
ORDER BY COUNT(*) DESC;

-- Skipped deliveries by reason (most common are "loadProps returned null"
-- and "recipient has no email address" — both expected)
SELECT error_message, COUNT(*)
FROM notification_deliveries
WHERE status = 'skipped' AND enqueued_at > now() - INTERVAL '1 day'
GROUP BY error_message;

-- Per-template send volume (sanity check before a new template ships)
SELECT template_key, channel, COUNT(*)
FROM notification_deliveries
WHERE sent_at > now() - INTERVAL '1 day' AND status = 'sent'
GROUP BY template_key, channel
ORDER BY COUNT(*) DESC;

-- Users who have opted out of email for a specific trigger
SELECT user_id
FROM notification_preferences
WHERE template_key = 'parent.wishlist.priceDrop'
  AND channel = 'email'
  AND enabled = false;
```

---

## When to escalate

- `metrics.terminalFailed.email` climbing rapidly during business hours → ping the on-call. Email provider is likely the root cause.
- Reconciliation cron stale > 48h after manual lock clear → ping the on-call. Something is preventing the cron from completing.
- Multiple unrelated trigger types failing simultaneously → ping the on-call. Likely a Prisma / Redis / event-emitter regression, not a per-trigger issue.
