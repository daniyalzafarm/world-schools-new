# Notifications — Architecture

> Living doc, last refreshed 2026-05-26 (Phase 14d). Companion to [`notifications-runbook.md`](./notifications-runbook.md) (operational triage) and [`notifications-qa.md`](./notifications-qa.md) (per-trigger QA checklist).

## What this system delivers

122 distinct notification triggers across 3 audiences (50 parent · 53 provider · 19 superadmin) shipped via **in-app** (persisted in Postgres, fanned over WebSocket) and/or **email** (React Email → SMTP). Every trigger is a tiny catalog entry; the framework owns rendering, retries, dedupe, preferences, observability.

## Flow

```text
                   ┌─────────────────────────────────────────────┐
                   │  Domain service                             │
                   │  • commits DB state                         │
                   │  • emits notify(events, TYPE, ctx, runAt?)  │ ── Phase 14c hardening:
                   │                                             │    notify() never throws
                   └────────────────────┬────────────────────────┘    back to caller
                                        │
                                        │ EventEmitter2.emit
                                        ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │  NotificationDispatcher (@OnEvent 'notification.dispatch')           │
        │                                                                      │
        │   1. getCatalogEntry(type)          // 122-entry registry            │
        │   2. getResolver(entry.resolver)    // 17 resolver keys              │
        │   3. recipients = [...new Set(...)]  // 14b dedup + zero-recipient   │
        │                                       alert for transactional        │
        │   4. for each recipient:                                             │
        │        channels = transactional                                      │
        │          ? entry.channels                                            │
        │          : preferences.filterChannels(userId, templateKey, channels) │
        │        enqueue({ type, recipientUserId, channels, ctx, dedupeKey,    │
        │                  delay = runAt - now })                              │
        └────────────────────┬─────────────────────────────────────────────────┘
                             │
                  delay = 0  │  delay > 0
                ┌────────────┴────────────┐
                ▼                         ▼
       ┌────────────────────┐   ┌─────────────────────┐
       │ notifications       │   │ notifications.       │
       │ (live queue)        │   │  scheduled queue)    │
       │                     │   │                     │
       │ jobId is deterministic — `<type>:<userId>:<dedupeKey>`             │
       │ BullMQ silently rejects duplicate jobIds → first dedup layer.      │
       │                                                                    │
       │ Retry defaults: 5×exp 30s. Phase 14d override: in-app-only jobs    │
       │ get 3×fixed 5s (DB writes don't need 5×30s).                       │
       └─────────────┬──────────────────────┬──────────────────────────────┘
                     │                      │
                     ▼                      ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │  NotificationLiveWorker / NotificationScheduledWorker            │
        │                                                                  │
        │   for each channel in job.data.channels:                         │
        │     a. dedupe check → NotificationDelivery.findUnique(           │
        │          templateKey, channel, dedupeKey                         │
        │        ) — if status='sent', skip.       ← second dedup layer    │
        │     b. props = entry.loadProps(prisma, ctx)                      │
        │        • null → write 'skipped' delivery row                     │
        │        • throw → write 'failed' row, re-throw (Phase 14c fix)    │
        │     c. dispatch:                                                 │
        │        in_app → notificationsService.create(...)                 │
        │        email  → renderEmail() → emailService.sendEmail()         │
        │     d. write 'sent' / 'failed' NotificationDelivery row          │
        │        (errorMessage sanitised: first line, 500 char cap)        │
        └──────────────────────────────────────────────────────────────────┘
                                  │
                                  │ all upserts gated by unique index:
                                  │   (template_key, channel, dedupe_key)
                                  ▼
                       ┌──────────────────────────┐
                       │  NotificationDelivery    │  ← audit log
                       │  status, attempt, jobId, │
                       │  errorMessage, entity*   │
                       └──────────────────────────┘
```

## Components

| Component | Path | Responsibility |
|---|---|---|
| Catalog | `apps/wc-nest-api/src/modules/notifications/catalog/` | Single source of truth — 122 entries split across `parent.catalog.ts`, `provider.catalog.ts`, `superadmin.catalog.ts`. Each entry binds a `NotificationType` → audience, category, channels, salutation, resolver key, prop loader, optional in-app + email renderers. |
| Resolvers | `apps/wc-nest-api/src/modules/notifications/resolvers/recipient-resolvers.ts` | 17 functions that turn a `NotificationContext` into a `userId[]`. Owner-only vs full-staff split for provider triggers (finance flavor → owner; lifecycle → full staff). |
| Prop loaders | `apps/wc-nest-api/src/modules/notifications/resolvers/prop-loaders.ts` | Per-type async functions reading fresh DB state at fire time. Returning `null` is the "no longer relevant" signal — worker writes a `skipped` row and moves on. |
| Templates | `packages/wc-email-templates/emails/` | React Email components grouped by domain. Default JSX escape blocks XSS. Money-touching templates have snapshot specs. |
| Dispatcher | `dispatcher/notification-dispatcher.service.ts` | One `@OnEvent` listener — catalog lookup → resolver → preference filter → enqueue fan-out. |
| Queue | `queue/` (live + scheduled BullMQ queues) | Deterministic jobId; per-channel retry override; metrics counters; `QueueEvents 'failed'` listener for terminal-failure escalation. |
| Worker | `workers/notification.worker.ts` | Two `WorkerHost` subclasses share `runNotificationJob`. Dedupe → loadProps (try/catch) → dispatch → upsert audit row. |
| Preferences | `preferences/notification-preferences.service.ts` + controller | `deriveAudience()` (Redis-cached, 5min), `listForUser()`, `bulkSetPreferences()`. Transactional entries bypass preferences entirely. |
| Reconciliation cron | `crons/reconciliation.cron.ts` | Daily 02:00 UTC. Cursor-paginated sweep over 13 scheduled-trigger types whose firing window falls in the next 25h. Re-emits via `notify(..., runAt)` — dedup layers make it safe. |
| Engagement crons | `crons/provider-engagement.cron.ts`, `crons/superadmin-engagement.cron.ts`, plus per-domain crons (wishlist, post-camp review, profile-incomplete, abandon-detection, balance reminders) | Cron-spawned scheduled emits — self-healing because each cron re-runs daily / hourly / weekly. |
| Observability | `observability/notifications-metrics.service.ts` + `notifications-health.controller.ts` + `notifications-failure.listener.ts` | In-house counters (no Sentry/Prometheus). `GET /health/notifications` exposes queue depths + metric snapshot + last-cron heartbeats. Failed-event listener writes defensive audit rows + bumps terminal-failure counter. |
| Bull Board | `queue/bull-board.module.ts` | Ops console at `/admin/queues`. Custom timing-safe basic-auth middleware; serves `503` in **every** environment when `BULL_BOARD_USER`/`PASSWORD` are unset (no dev-fallback). |

## Idempotency model

Three layers, designed to make any re-emit safe:

1. **BullMQ deterministic jobId** — `<type>:<recipientUserId>:<dedupeKey>`. Silently rejects duplicate enqueues while a job is in the queue.
2. **NotificationDelivery unique index** — `(template_key, channel, dedupe_key)`. The worker's dedupe pre-check + the upsert at the end both rely on this.
3. **Resolver dedup** — `[...new Set(recipients)]` in the dispatcher catches a buggy resolver returning the same userId twice (Phase 14b — logs WARN when it shrinks the list).

A domain service emitting the same `notify(...)` twice is therefore guaranteed to deliver at most once per channel. The reconciliation cron exploits this — it re-emits every entity in its 25h window unconditionally and relies on the layers above to discard duplicates.

## Observability

- **In-house metrics** (`NotificationsMetricsService`) — per-channel counters: enqueued, sent, failed, terminalFailed, skipped. Plus zero-recipient-transactional counter. Plus last-event timestamps. Plus per-cron heartbeats. Exposed via `GET /health/notifications`.
- **Structured worker logs** — every log line carries `[ctx tpl=… user=… job=… chan=… dedupe=…]`. Grep-friendly without a new logger library.
- **Failed-event listener** — terminal failures bump the dedicated counter, ERROR-log with structured context, and write a defensive `NotificationDelivery {status:'failed'}` row even when the worker's in-loop catch was bypassed (e.g. fatal "no catalog entry").
- Sentry / Prometheus adoption is a separate org-level decision; the metrics service is the integration point.

## Where to add a new trigger

1. Add a `NotificationType` enum value in `packages/wc-types/src/lib/websocket.types.ts`.
2. Add a `NOTIFICATION_CATEGORY` mapping in `packages/wc-types/src/lib/notification-categories.ts` (CI fails without this).
3. Add a catalog entry in the audience's `*.catalog.ts`. Reuse an existing resolver key when possible.
4. Add the prop loader in `resolvers/prop-loaders.ts`.
5. Add or extend a React Email template in `packages/wc-email-templates/emails/`. Money-touching templates get a snapshot spec.
6. At the domain commit point, call `notify(events, NotificationType.X, { ...primitiveIds })`. For scheduled, pass `runAt: Date`.
7. If the trigger is scheduled and entity-bound, consider adding it to the reconciliation cron's covered list.
