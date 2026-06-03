# Notifications — Production Hardening Audit (2026-05-25)

## Context

The 13-phase notifications expansion is functionally complete and structurally aligned with [`NOTIFICATIONS_IMPLEMENTATION_PLAN.md`](NOTIFICATIONS_IMPLEMENTATION_PLAN.md) (verified previously in [`NOTIFICATIONS_AUDIT_REPORT.md`](NOTIFICATIONS_AUDIT_REPORT.md)). This is a deeper, "Silicon Valley standards" audit focused on production-readiness — the kind of issues a senior staff engineer at a top-tier company would flag in code review: missing integration tests, zero observability, an auth bypass in non-prod environments, loader exceptions that bypass the audit log, unindexed reconciliation queries, an open-redirect vector, and accessibility / rate-limiting gaps.

Findings come from three parallel deep-review agent passes (reliability, code quality, security/frontend) with the highest-severity items spot-verified directly against code. Agent false positives are excluded.

This document is organised into three sections: (1) verified findings, prioritised P0 → P2; (2) a recommended phased hardening plan (14a → 14d); (3) verification steps per phase.

Legend: P0 = block production · P1 = fix before next major load increase · P2 = polish for craftsmanship.

---

## Status (updated 2026-05-26)

| Phase | Status | Notes |
|---|---|---|
| 14a — Test foundation | ✅ Shipped | 5 spec files, +70 tests covering dispatcher / worker / reconciliation / preferences / resolvers. |
| 14b — Observability | ✅ Shipped | In-house metrics service + `/health/notifications` + BullMQ failed-event listener + structured log context + reconciliation heartbeat. Sentry / Prometheus deferred (no existing observability stack in the codebase). |
| 14c — Reliability + security | ✅ Shipped | Loader try/catch, errorMessage sanitiser, Bull Board dev-fallback removed + timing-safe compare, PATCH-preferences rate limit + allow-list, `validateRedirectUrl`, category exhaustiveness assertion, XSS regression spec, `notify()` helper hardened globally. |
| 14d — Scale + ops polish | ✅ Shipped | Composite indexes (4 new) + Prisma migration; reconciliation cron cursor-paginated with no row cap; `deriveAudience` Redis-cached (5min); `listForUser` filters catalog before Prisma; in-app-only jobs get a tighter retry budget; WS arrivals reset the pagination cursor; `getFiltersFor(audience)` shared in `wc-frontend-utils`; preferences toggles a11y-labelled with non-colour locked-state indicator; profile-completion recomputes serialise through a new `profile-completion` BullMQ queue (jobId-coalesced); `docs/notifications-architecture.md` + `docs/notifications-runbook.md` written. |

Across 14a–d: **~165 new tests** (565 pass in `wc-nest-api` + 63 in `wc-email-templates` + 21 in `wc-frontend-utils` + 6 in `wc-types`); all 4 builds green (`wc-nest-api` + `wc-booking` + `wc-provider` + `wc-superadmin`); same 4 pre-existing failed suites (3 messaging + 1 stripe-webhook, documented as pre-existing since Phase 5). No Phase 14 regressions in any audience.

**All 27 audit findings closed.** Sentry / Prometheus adoption remains a separate org-level decision (the in-house metrics service is the integration point).

---

## Verified findings

### 🔴 P0 — Block production deploy

| # | Finding | Evidence | Why it matters | Status |
|---|---|---|---|---|
| 1 | **Zero integration tests.** Only [catalog-validation.spec.ts](apps/wc-nest-api/src/modules/notifications/catalog/catalog-validation.spec.ts) (6 schema assertions). The plan's `__tests__/` dir with "10-15 per audience" does not exist. | `find apps/wc-nest-api/src/modules/notifications -name '*.spec.ts'` → 1 file. | A 122-entry catalog with one schema-shape test is statistically guaranteed to ship regressions. Every refactor risks silently breaking a trigger that QA only catches days later when a real user reports it. | ✅ 14a |
| 2 | **Zero observability.** No metrics (`prometheus` / `statsd` / `@willsoto/nestjs-prometheus`), no Sentry integration, no `/health/notifications` endpoint, no per-channel counters. | `grep -r "sentry\|prometheus\|metrics" apps/wc-nest-api/src/modules/notifications/` → 0 hits. | When (not if) a queue backs up, an email provider rate-limits us, or a loader regression skips half the traffic, there is no signal anywhere. We'd find out from user complaints. | ✅ 14b |
| 3 | **Bull Board dev-fallback bypasses auth in non-prod environments.** `buildAuthMiddleware()` only enforces credentials when `NODE_ENV === 'production'`; staging / QA / preview deployments with unset `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` serve `/admin/queues` un-authenticated. | [bull-board.module.ts:25-35](apps/wc-nest-api/src/modules/notifications/queue/bull-board.module.ts#L25-L35). | Any staging URL gives an attacker full read access to user IDs, dedupe keys, and the ability to retry / cancel jobs. The docstring at line 13 falsely claims "never exposed unauthenticated"; the implementation contradicts that. | ✅ 14c |

### 🟠 P1 — Fix before next major load increase

| # | Finding | Evidence | Why it matters | Status |
|---|---|---|---|---|
| 4 | **Loader exceptions bypass the audit log.** `entry.loadProps()` runs outside the per-channel try/catch; a Prisma transient (connection pool exhaustion, deadlock) propagates up and BullMQ retries with no `NotificationDelivery` row written. | [notification.worker.ts:105](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts#L105) vs the catch at [:191](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts#L191). | On a real outage, ops can't see what was attempted — only what succeeded — so triage requires reading Redis directly. After 5 retries the job dies silently. | ✅ 14c |
| 5 | **No final-failure escalation.** After 5 retries, `removeOnFail: false` keeps the job in Redis but nothing fires an alert, captures the error, or marks the audit row in a way that's easy to query. | [notifications-queue.module.ts:48-63](apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts#L48-L63); no `failed` listener anywhere. | A user not receiving a payment-failed email for 25 minutes is a refund risk. We need a dead-letter hook or a Sentry capture on the final attempt. | ✅ 14b |
| 6 | **`errorMessage` column leaks stack traces / SMTP secrets.** Catch block stores raw `error.message` (multi-line, including provider error strings that sometimes carry auth tokens). Visible in Bull Board + any DB consumer. | [notification.worker.ts:192-205](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts#L192-L205). | A leaked SMTP auth header or stack trace path is a compliance issue. The text column is queryable by anyone with DB read. | ✅ 14c |
| 7 | **Open-redirect via `metadata.redirectUrl`.** Catalog `inApp.redirectUrl(props)` strings are stored in `Notification.metadata.redirectUrl` and passed to `router.push()` in each app with no validation that the path is relative. A bad catalog entry (typo / supply-chain) could ship an absolute URL to an attacker domain. | [notifications-page-content.tsx](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx) `onNavigate` + per-app `router.push(url)`. | Phishing vector via legitimate in-app notification UI. Trivially mitigated. | ✅ 14c |
| 8 | **Reconciliation cron silently truncates at `BATCH_SIZE=1000`.** Each tier's `findMany({ take: 1000 })` drops anything beyond 1000 candidates with no warning. | [reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts) — all 5 helpers. | At growth, scheduled triggers stop firing without anyone noticing. The cron is the safety net for the safety net. | ✅ 14d |
| 9 | **Reconciliation cron queries hit unindexed columns.** Queries `BookingGroup { status, createdAt: range }`, `Session { startDate: range }`, `Invitation { expiresAt: range }` — none have compound indexes on the range fields. | [prisma/schema.prisma](apps/wc-nest-api/prisma/schema.prisma); verify via `\d+ booking_groups` in psql. | Cron runs at 02:00 UTC; at 100k+ BookingGroups it will scan the whole table. Five minutes today → fifty tomorrow. | ✅ 14d |
| 10 | **No rate limit on `PATCH /notification-preferences`.** A user can spam toggle clicks; each request runs a full `$transaction` of upserts. | [notification-preferences.controller.ts:55-60](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts#L55-L60); no `@Throttle`. | A bored user (or a malicious script) can DoS the preferences endpoint and create lock contention on the `NotificationPreference` table. | ✅ 14c |
| 11 | **DTO `templateKey` not allow-listed.** `@IsString()` accepts anything; service-side filtering silently drops invalid keys but the DB call still runs. | [notification-preferences.controller.ts:8-25](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts#L8-L25). | Garbage-in keys waste DB cycles; valid-but-cross-audience keys are silently dropped without any client feedback (a confused user thinks their toggle saved when it didn't). | ✅ 14c |
| 12 | **Bull Board password comparison not timing-safe.** `express-basic-auth` defaults to string equality on the password. | [bull-board.module.ts:38-42](apps/wc-nest-api/src/modules/notifications/queue/bull-board.module.ts#L38-L42). | Timing-attack vector on the ops console. Low practical risk but trivial to fix (`crypto.timingSafeEqual`). | ✅ 14c |
| 13 | **`notify()` calls are not wrapped in try/catch at domain commit sites.** If `EventEmitter2.emit()` ever throws (custom listener error, etc.), the domain operation fails. | Sampled `booking-groups.service.ts`, `provider-reviews.service.ts`, `application-review.service.ts`. | EventEmitter2 doesn't throw today, but a future listener bug could break booking creation. Defensive pattern is cheap. | ✅ 14c (hardened globally at the helper level — every call site automatically defended) |
| 14 | **Filter chips not memoized at the app layer.** Each render creates a new `filters` array reference, busting `useNotificationsPage`'s internal `useMemo`. | Per-app [notifications/page.tsx](apps/wc-booking/src/app/(dashboard)/notifications/page.tsx). | Mild re-render perf hit. Fix is one `useMemo` line. | ✅ 14d (folded into the filter-helper extraction — the new `getFiltersFor()` returns a stable module-level array) |
| 15 | **A11y gaps on preferences switches.** No `aria-label` per row × channel; locked transactional rows distinguished by color only (color-blind users see them as enabled). | [notification-preferences-page.tsx:343-373](packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx#L343-L373). | Fails WCAG 2.1 AA. Cheap fix. | ✅ 14d |
| 16 | **`categoryFor` fallback maps unknown types to `System`** which renders as the gray `security` icon. A missing `NOTIFICATION_CATEGORY` mapping silently hides as "system alert." | [notification-categories.ts:182-185](packages/wc-types/src/lib/notification-categories.ts#L182-L185); switch in [notifications-page-content.tsx:83-106](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx#L83-L106). | When a new type ships without a category mapping, no error fires — users see a generic shield icon. Add a build-time `NotificationType ↔ NOTIFICATION_CATEGORY` exhaustiveness check. | ✅ 14c |

### 🟡 P2 — Polish for craftsmanship

| # | Finding | Evidence | Why it matters | Status |
|---|---|---|---|---|
| 17 | **Dispatcher does not de-duplicate the resolver's recipient list.** A resolver bug that returns the same userId twice silently triggers BullMQ's duplicate-jobId rejection — looks "fine," masks the bug. | [notification-dispatcher.service.ts](apps/wc-nest-api/src/modules/notifications/dispatcher/notification-dispatcher.service.ts). | `recipients = [...new Set(...)]` + WARN log when the set is smaller than the array. | ✅ 14b |
| 18 | **No alert / log when a transactional notification resolves zero recipients.** A misconfigured resolver could silently drop all "payment failed" emails. | Same file. | Transactional + zero recipients = always a bug; log at ERROR (or Sentry-capture). | ✅ 14b |
| 19 | **`deriveAudience` runs two Prisma queries on every preferences request.** No cache, no JWT-embedded audience claim. | [notification-preferences.service.ts:55-69](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts#L55-L69). | 5min Redis cache (key `audience:${userId}`) or embed in JWT. ~5ms saved per request; useful when the page polls. | ✅ 14d |
| 20 | **`listForUser` filters the catalog after a Prisma `findMany`.** Catalog filter is in-memory after fetching opt-outs for all template keys. Should filter catalog first, then constrain the query. | Same file `:79-107`. | Already O(n) over a small catalog but inefficient ordering. | ✅ 14d |
| 21 | **Filter configs duplicated across 3 app pages.** | `apps/wc-booking/.../notifications/page.tsx` + provider + superadmin variants. | Extract `getFiltersFor(audience)` into `wc-frontend-utils`. | ✅ 14d |
| 22 | **No architecture doc / ops runbook.** `docs/notifications-architecture.md` and `docs/notifications-runbook.md` do not exist. | `find docs -name '*notif*'` → only `notifications-qa.md`. | A new ops engineer cannot debug a stuck queue without reading source. ~1-page diagram + 1-page runbook (query failed deliveries, retry via Bull Board, manually re-emit). | ✅ 14d |
| 23 | **No injection / XSS snapshot test.** React Email escapes by default but nothing guards against a future `dangerouslySetInnerHTML`. | `packages/wc-email-templates/src/__tests__/`. | One spec that renders a template with `<script>alert(1)</script>` in props and asserts the output contains `&lt;script&gt;`. | ✅ 14c |
| 24 | **Per-channel BullMQ retry config still uniform.** Plan already flagged this; revisited because in-app retries 5× with 30s exponential backoff is silly for a DB write. | [notifications-queue.module.ts:48-63](apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts#L48-L63). | Per-job override in `enqueue.service.ts` based on channel. | ✅ 14d |
| 25 | **Profile-completion recompute can race across concurrent endpoints.** Three near-simultaneous Parent updates run three recomputes; last-write-wins on the percentage. | Plan Phase 7.5 wiring. | Move recompute into a BullMQ job with `jobId: profile:${userId}` to serialise. | ✅ 14d |
| 26 | **No structured logger context in worker error logs.** `templateKey` / `jobId` / `recipientUserId` not always present in error logs. | [notification.worker.ts](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts) — inconsistent across call sites. | Single `logCtx` object at job entry, threaded through every log call. | ✅ 14b |
| 27 | **WebSocket-new-notification + pagination cursor race.** Live arrival prepends to state; `nextCursor` still points to the now-shifted offset; next "Load more" skips a row. | [use-notifications-page.ts:113-119](packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts#L113-L119). | Reset cursor when a WS notification arrives. | ✅ 14d |

---

## Recommended phased plan

Three small, independently-mergeable PRs (14a → 14c) and one deferred polish PR (14d). Each phase is internally cohesive (testing | observability | reliability+security | scale-polish) so a reviewer can hold the whole thing in their head.

### Phase 14a — Test foundation (P0 #1) — ✅ shipped

**Goal:** stop being one refactor away from a silent regression.

Created `apps/wc-nest-api/src/modules/notifications/__tests__/`:

- `dispatcher.spec.ts` (14 tests) — catalog/resolver lookup, recipient fan-out, transactional bypass, preference filter, dedupeKey derivation (default + override + global fallback), runAt → delay clamp, resolver-dedup, zero-recipient-transactional metric.
- `worker.spec.ts` (16 tests) — happy path, dedupe hit, loader-null skip, no-recipient-email skip, sendEmail throws, create throws, attempt accounting, metrics integration, **loadProps-throws hardening (14c)**, errorMessage sanitiser + 500-char cap.
- `reconciliation.cron.spec.ts` (11 tests) — Redis-lock acquire/release-on-error/skip-when-not-ready, each of the 5 reconcile helpers against realistic windows, cron-run heartbeat metric.
- `preferences.service.spec.ts` (17 tests) — `deriveAudience` (parent → superadmin → provider priority + null), `listForUser` audience filter + transactional locked + opt-out overlay, `bulkSetPreferences` cross-audience + transactional silent drop + `$transaction` shape, `filterChannels` enabled-by-default + opt-out + error-fallback, `setPreference` upsert shape.
- `audience-resolvers.spec.ts` (23 tests) — 17-key registry coverage, `getResolver()` known + unknown, per-resolver happy/empty/scoped paths (single-recipient finds, filtered finds, pass-through, fan-out dedup, sender-exclusion in conversations).

### Phase 14b — Observability + final-failure handling (P0 #2, P1 #5, P2 #26) — ✅ shipped

**Goal:** be able to answer "why didn't user X get notification Y?" in 30 seconds.

What landed (adapted to the codebase's deliberate no-Sentry/no-Prometheus posture):

- `apps/wc-nest-api/src/modules/notifications/observability/notifications-metrics.service.ts` — in-process counters per channel (enqueued / sent / failed / terminalFailed / skipped) + zero-recipient-transactional counter + last-event timestamps + per-cron heartbeat. Single integration point for future Prometheus/StatsD adoption.
- `apps/wc-nest-api/src/modules/notifications/observability/notifications-health.controller.ts` — `GET /health/notifications` returns live + scheduled queue depths from BullMQ plus the metrics snapshot. Marks `status: 'degraded'` when `getJobCounts` throws.
- `apps/wc-nest-api/src/modules/notifications/observability/notifications-failure.listener.ts` — `QueueEvents` `'failed'` listener on both queues. Bumps per-channel failure metric; on terminal failure (attempts exhausted) bumps a dedicated counter, ERROR-logs with structured context, and writes a defensive `NotificationDelivery {status:'failed'}` row to cover paths that throw before the worker's in-loop catch (e.g. catalog entry missing).
- `notification.worker.ts` — structured `fmt(ctx)` helper prepends `[ctx tpl=… user=… job=… chan=… dedupe=…]` to every log line. No new logger dependency — grep-able by log aggregators as-is.
- `notification-dispatcher.service.ts` — `[...new Set(rawRecipients)]` plus WARN when dedupe shrinks the array; ERROR + counter bump when a transactional notification resolves zero recipients.
- `reconciliation.cron.ts` — `recordCronRun('reconciliation')` heartbeat exposed via `/health/notifications.metrics.lastCronRunAt`.

Sentry / Prometheus adoption deferred — separate org-level decision; the in-house counters are the bridge.

Test coverage: 17 new tests across `notifications-metrics.service.spec.ts`, `notifications-health.controller.spec.ts`, `notifications-failure.listener.spec.ts`.

### Phase 14c — Reliability + security hardening (P0 #3, P1 #4, #6-12; P2 #17, #18, #23) — ✅ shipped

**Goal:** close the auth bypass, audit-log gap, and the open-redirect.

Reliability:

- `notification.worker.ts` — `entry.loadProps(...)` now runs in a try/catch. On throw, the worker writes a `failed` `NotificationDelivery` row per requested channel **before** re-throwing so BullMQ retries; the failed-listener from 14b promotes to terminal on attempt exhaustion.
- New `sanitizeErrorMessage(err)` helper — strips multi-line errors to the first line and caps at 500 chars before persisting. Applied both at the worker's in-loop catch and at the failure-listener's defensive write so neither path leaks stack traces or SMTP auth strings into the DB-queryable column.
- `notify()` helper — `EventEmitter2.emit(...)` wrapped in try/catch at the helper level (one line). Every existing + future call site is automatically defended without touching ~50 service files; never throws back to the domain caller. ERROR-logged so a future listener bug is visible without breaking a booking commit.

Security:

- `bull-board.module.ts` — removed the `NODE_ENV === 'production'` dev-fallback. `/admin/queues` now serves `503 Bull Board credentials not configured` in **every** environment when `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` are unset. Custom basic-auth middleware uses `crypto.timingSafeEqual` for both username and password (with explicit length-mismatch short-circuit so equal-length comparison stays constant-time).
- `notification-preferences.controller.ts` PATCH — per-user Redis rate limiter (`INCR` + `EXPIRE 60`); returns `429 Too Many Requests` after 30 requests / 60s window. Soft-fails to "allow" when Redis is unreachable so a flaky cache doesn't 503 the settings page.
- DTO tightening — new `@IsCatalogTemplateKey()` class-validator decorator backed by a cached `Set<string>` of registered catalog keys. Unregistered keys now return `400 Bad Request` with `isCatalogTemplateKey: 'templateKey is not a registered notification catalog entry'` instead of being silently dropped server-side.
- `validateRedirectUrl(raw): string | null` in `packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx` — rejects non-strings, absolute URLs, protocol-relative `//`, and `..` traversal segments. Applied in both `handleCardClick` and `handleActionClick`. Exported so per-app pages can wrap their own navigation handlers.

Quality:

- `packages/wc-types/src/lib/notification-categories.ts` — new `findUnmappedNotificationTypes()` + `assertNotificationCategoryExhaustiveness()` helpers. A new spec in `wc-types` fails CI when any `NotificationType` enum value lacks a `NOTIFICATION_CATEGORY` mapping (previously such types silently fell through to the gray `System` icon).
- `packages/wc-email-templates/src/__tests__/injection.spec.tsx` — XSS regression: renders 4 representative templates (booking accepted, decline, balance-charged, refund-issued) with hostile props (`<script>alert(1)</script><img src=x onerror=…>`) and asserts no executable `<script>` or `<img onerror=>` elements appear in the rendered HTML.

Test coverage: 31 new tests across `bull-board.middleware.spec.ts` (9), `notification-preferences.controller.spec.ts` (9), `notify.spec.ts` (3), additions to `worker.spec.ts` (+3), `dispatcher.spec.ts` (+4 — Phase 14b), `notification-categories.spec.ts` (5), `validate-redirect-url.spec.ts` (21), `injection.spec.tsx` (5).

### Phase 14d — Scale + ops polish (P1 #8, #9, #14, #15; P2 #19-22, #24, #25, #27) — 🟢 in progress

**Goal:** stop fearing the next 10× of traffic.

Now in scope after 14a–c shipped clean (we don't need to "wait for an incident" — landing scale work pre-emptively is cheaper than rebuilding after one):

- **Composite indexes** on `BookingGroup(status, createdAt)`, `BookingGroup(status, updatedAt)`, `Session(startDate)`, `Invitation(status, expiresAt)`. Single Prisma migration; verify with `EXPLAIN ANALYZE` in staging. (#9)
- **Reconciliation cron — cursor pagination** per tier; remove the hard `BATCH_SIZE` cap (or log loudly when hit and continue paging). (#8)
- **`deriveAudience` Redis cache** — 5-minute TTL keyed by userId; cache invalidation on parent / role mutations is deferred until the audience itself becomes a hot path. (#19)
- **`listForUser`** — filter catalog by audience first, then constrain the `NotificationPreference.findMany` to that subset of templateKeys instead of fetching all opt-outs. (#20)
- **Per-channel BullMQ retry config** — per-job override path in `enqueue.service.ts`: `in_app` channels get `attempts: 3, backoff: fixed 5s`; `email` channels stay at `attempts: 5, backoff: exp 30s`. (#24)
- **WS-arrival cursor reset** in `use-notifications-page.ts` so live-arriving notifications don't cause `Load more` to skip a row. (#27)
- **Extract `getFiltersFor(audience)`** helper into `wc-frontend-utils`; per-app pages collapse to a one-line call. This also satisfies the `useMemo` finding (#14) — module-level `const FILTERS = [...]` returns stable references for free.
- **Profile-completion serialisation via BullMQ** — move `recomputeForParent` / `recomputeForProvider` into a new `profile-completion` queue with `jobId: profile:${userId}` to coalesce concurrent updates. Domain services enqueue instead of calling the recompute synchronously. (#25)
- **A11y on preferences switches** — `aria-label="${row.label} — ${channel}"` per toggle; for locked rows add an inline lock icon + `aria-disabled="true"` so screen readers and color-blind users see the same signal as sighted users. (#15)
- **`docs/notifications-architecture.md`** — 1-page ASCII flow diagram (domain → notify → dispatcher → enqueue → queue → worker → in-app + email + audit row) + a paragraph on idempotency, retries, and observability hooks.
- **`docs/notifications-runbook.md`** — failed-job triage steps (query `NotificationDelivery WHERE status='failed'`, inspect via Bull Board at `/admin/queues`, re-emit via a one-line `notify(…)` call from a script, clear stuck reconciliation lock via `redis-cli DEL cron:lock:notification-reconciliation:daily`).

---

## Critical files

### Tests (Phase 14a — new, all shipped)

- `apps/wc-nest-api/src/modules/notifications/__tests__/dispatcher.spec.ts`
- `apps/wc-nest-api/src/modules/notifications/__tests__/worker.spec.ts`
- `apps/wc-nest-api/src/modules/notifications/__tests__/reconciliation.cron.spec.ts`
- `apps/wc-nest-api/src/modules/notifications/__tests__/preferences.service.spec.ts`
- `apps/wc-nest-api/src/modules/notifications/__tests__/audience-resolvers.spec.ts`
- `packages/wc-email-templates/src/__tests__/injection.spec.tsx` (14c)
- `packages/wc-types/src/lib/notification-categories.spec.ts` (14c)
- `packages/wc-frontend-utils/src/lib/notifications/validate-redirect-url.spec.ts` (14c)
- `apps/wc-nest-api/src/modules/notifications/__tests__/notifications-metrics.service.spec.ts` (14b)
- `apps/wc-nest-api/src/modules/notifications/__tests__/notifications-health.controller.spec.ts` (14b)
- `apps/wc-nest-api/src/modules/notifications/__tests__/notifications-failure.listener.spec.ts` (14b)
- `apps/wc-nest-api/src/modules/notifications/__tests__/notification-preferences.controller.spec.ts` (14c)
- `apps/wc-nest-api/src/modules/notifications/__tests__/bull-board.middleware.spec.ts` (14c)
- `apps/wc-nest-api/src/modules/notifications/__tests__/notify.spec.ts` (14c)

### Observability (Phase 14b — shipped)

- New: `apps/wc-nest-api/src/modules/notifications/observability/notifications-metrics.service.ts`
- New: `apps/wc-nest-api/src/modules/notifications/observability/notifications-health.controller.ts`
- New: `apps/wc-nest-api/src/modules/notifications/observability/notifications-failure.listener.ts`
- Modify: [apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts) — emit metrics + structured logCtx
- Modify: [apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts](apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts) — register metrics service in @Global queue module
- Modify: [apps/wc-nest-api/src/modules/notifications/notifications.module.ts](apps/wc-nest-api/src/modules/notifications/notifications.module.ts) — register health controller + failure listener
- Modify: [apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts) — heartbeat

### Reliability + security (Phase 14c — shipped)

- Modify: [apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts) — loader try/catch + errorMessage sanitiser
- Modify: [apps/wc-nest-api/src/modules/notifications/dispatcher/notification-dispatcher.service.ts](apps/wc-nest-api/src/modules/notifications/dispatcher/notification-dispatcher.service.ts) — dedupe + zero-recipient alert (14b)
- Modify: [apps/wc-nest-api/src/modules/notifications/dispatcher/notify.ts](apps/wc-nest-api/src/modules/notifications/dispatcher/notify.ts) — try/catch wrapper around `emit`
- Modify: [apps/wc-nest-api/src/modules/notifications/queue/bull-board.module.ts](apps/wc-nest-api/src/modules/notifications/queue/bull-board.module.ts) — remove dev-fallback, custom timing-safe middleware
- Modify: [apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts) — rate limit + allow-listed templateKey
- Modify: [packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx) — `validateRedirectUrl`
- Modify: [packages/wc-types/src/lib/notification-categories.ts](packages/wc-types/src/lib/notification-categories.ts) — exhaustiveness assertion

### Scale + ops polish (Phase 14d — in progress)

- Modify: [apps/wc-nest-api/prisma/schema.prisma](apps/wc-nest-api/prisma/schema.prisma) — composite indexes
- Modify: [apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts) — cursor pagination
- Modify: [apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts) — deriveAudience cache + listForUser reorder
- Modify: [apps/wc-nest-api/src/modules/notifications/queue/enqueue.service.ts](apps/wc-nest-api/src/modules/notifications/queue/enqueue.service.ts) — per-channel retry override
- Modify: [packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts](packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts) — WS cursor reset
- New: `packages/wc-frontend-utils/src/lib/notifications/notification-filters.ts` — `getFiltersFor(audience)`
- New: `apps/wc-nest-api/src/modules/common/profile-completion/profile-completion.queue.ts` + processor for serialised recompute
- Modify: [packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx](packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx) — a11y on switch buttons
- New: `docs/notifications-architecture.md`
- New: `docs/notifications-runbook.md`

---

## Verification

End-to-end checks per phase:

### Phase 14a

- `nx test wc-nest-api --testPathPatterns='notifications/__tests__'` returns 117 passing tests.
- CI gate: `nx affected -t test` includes the new specs on any notifications-touching PR.

### Phase 14b

1. Hit `/health/notifications` locally → returns `{ status: 'ok', queues: { live, scheduled }, metrics: {...} }` with `metrics.lastCronRunAt.reconciliation` populated after the 02:00 UTC cron.
2. `metrics.enqueuedTotal` / `metrics.sent.in_app` / `metrics.sent.email` increment on a real dispatch.
3. Force-fail a worker (point `EmailService` at `localhost:1`); `metrics.failed.email` and `metrics.terminalFailed.email` bump after exhaustion, and a `NotificationDelivery {status:'failed'}` row appears.

### Phase 14c

1. With `BULL_BOARD_USER` unset, set `NODE_ENV=staging` and curl `/admin/queues` → 503. Set `NODE_ENV=production` → same 503.
2. Replay a known dispatch with `dedupeKey` matching an existing `sent` row → no duplicate email + DEBUG log shows "dedupe hit."
3. `PATCH /notification-preferences` with `{ templateKey: 'bogus.key', channel: 'in_app', enabled: false }` → 400 with `isCatalogTemplateKey` constraint message.
4. PATCH 31 times in 60s from one user → 31st returns 429.
5. POST a notification with `metadata.redirectUrl = 'https://evil.com'` (via direct DB insert) and click in the UI → `onNavigate` no-ops.
6. Force a loader to throw → see `NotificationDelivery { status: 'failed', errorMessage: '<first line, sanitised>' }`.
7. Add a new `NotificationType` enum value without a `NOTIFICATION_CATEGORY` mapping → `nx test wc-types` fails the `assertNotificationCategoryExhaustiveness` spec.

### Phase 14d

- `EXPLAIN ANALYZE` on reconciliation queries shows index scans, not seq scans.
- Reconciliation cron at 100k+ source rows fully drains via cursor pagination; metric exposes total per tier.
- `GET /notification-preferences` second request within 5min hits the audience cache (verified via Redis `GET audience:<userId>`).
- In-app-only retry config: triggering a notification with `channels: ['in_app']` and forcing the worker to throw shows 3 retry attempts with 5s fixed backoff (not 5 × 30s exponential).
- A WS notification arriving while the user is paginating doesn't cause the "Load more" button to skip a row.
- New ops engineer follows `docs/notifications-runbook.md` to retry a failed payment-failed notification without reading source code.

---

## Out of scope

- Visual-design refresh of the preferences UI (Phase 12 audit was approving of the current look).
- Per-category bulk-disable toggle (deferred to a future UX iteration).
- i18n / localisation (separate workstream; not notifications-specific).
- Push notifications (mobile / web-push channel) — schema already allows it; catalog entries don't use it yet.
- Replacing Bull Board basic-auth with a Nest JWT guard (deferred until someone needs SSO into the ops console).
- Sentry / Prometheus adoption — codebase deliberately has no observability framework; the in-house metrics service is the integration point when the org decides to adopt one.
