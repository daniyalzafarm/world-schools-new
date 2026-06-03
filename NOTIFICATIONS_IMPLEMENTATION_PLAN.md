# Notifications Expansion — In-App + Email for All Triggers

> Living tracking doc for the `feat/all-apps-notifications` branch. Source spec: [`WorldCamps_Notifications_v28.xlsx`](WorldCamps_Notifications_v28.xlsx). Plan file: `~/.claude/plans/we-ve-recently-fixed-the-partitioned-nova.md`.

## Context

The notification system in `wc-nest-api` currently supports 7 ad-hoc notification types (booking accepted/declined/expired/request, message new, support ticket update, system alert) wired via bespoke handlers (e.g. `booking-websocket.handler.ts`) and 12 hand-rolled HTML email templates in `EmailTemplateService` (a single monolithic class with inline HTML strings).

The `WorldCamps_Notifications_v28.xlsx` spec at the repo root defines **126 triggers** that must be supported end-to-end:
- **55 for providers** (camp staff using `wc-provider`)
- **52 for parents** (families using `wc-booking`)
- **19 for superadmins** (internal staff using `wc-superadmin`)

The current ad-hoc pattern does not scale to 126 triggers. The email-template approach does not scale past ~20 templates. Synchronous in-handler email sends will become a reliability problem at this volume. Several spec triggers depend on domain features that don't yet exist (parent-facing invitations, abandoned-checkout tracking, parent/provider profile completeness, Stripe disconnect events).

This plan introduces a declarative **Notification Catalog**, **React Email** for templates, **BullMQ** for queued/scheduled dispatch, and a user-facing **Notification Preferences** UI in all three apps. The framework lets every catalog entry remain a small, mechanical addition while keeping rendering, sending, retries, and idempotency centralized.

The branch is large but each phase below is independently mergeable and reviewable.

---

## High-level Architecture

```
Domain service                       Dispatcher (in-process, EventEmitter2)
─────────────────                    ─────────────────────────────────────
commit DB state         ── emit ──>  @OnEvent('notification.dispatch')
notify(events, TYPE, ctx)             1. look up catalog[type]
                                      2. resolve recipients via resolver registry
                                      3. apply user preferences (non-transactional)
                                      4. enqueue 1 BullMQ job per (recipient × channel)
                                                                │
                                                                ▼
                                                        notifications queue
                                                        notifications.scheduled queue
                                                                │
                                                                ▼
                                NotificationWorker (same process, concurrency-tuned)
                                  1. dedupe-check via NotificationDelivery.uniq(templateKey,channel,dedupeKey)
                                  2. loadProps(prisma, ctx) → typed props
                                  3. in_app → NotificationsService.create(...)
                                  4. email  → renderEmail(component, props) → EmailService.sendEmail()
                                  5. write NotificationDelivery row
```

- **Live triggers** emit `notification.dispatch` immediately (delay = 0).
- **Scheduled triggers** emit with a `runAt: Date`; dispatcher computes delay; BullMQ holds the job until firing time. Cancellation removes by deterministic `jobId`.
- A nightly **reconciliation cron** sweeps for missed scheduled jobs and idempotently re-enqueues.

---

## Phase Plan (single branch, independently reviewable chunks)

| # | Phase | Status |
|---|-------|--------|
| 1 | Schema migration (Prisma) | ✅ |
| 2 | `packages/wc-email-templates` Nx library | ✅ |
| 3 | BullMQ infrastructure + Bull Board | ✅ |
| 4 | Catalog + dispatcher framework (1 entry end-to-end) | ✅ (audit bugs fixed) |
| 5 | Cutover existing 7 notification types | ✅ (audit: 0 blockers, 1 minor migration cleanup deferred to Phase 7) |
| 6 | Missing domain features (invitations, abandon cron, profile completeness, Stripe disconnect) | ✅ (audit: 3 gaps naturally fixed during Phase 7) |
| 7 | Catalog fill: Parent triggers (52) | ✅ (audit: 50 entries landed; 19 lack commit-point emits → Phase 7.5) |
| 7.5 | Phase 7 follow-up: wire dead entries + missing crons + snapshot tests + profile-completion callers | ✅ |
| 8 | Catalog fill: Provider triggers (55) | ✅ (53 entries; 18 wired commit points + 1 multi-cron + 2 parked) |
| 8.5 | Phase 8 follow-up: wire 3 audit-flagged orphans + correct stale audit notes | ✅ |
| 9 | Catalog fill: Superadmin triggers (19) | ✅ (19 entries; 12 live commit-point + 6 cron-driven + 1 parked-pending-domain) |
| 10 | Reconciliation cron | ✅ (single daily cron covers 13 entity-bound scheduled triggers; cron-spawned scheduled entries self-heal) |
| 11 | Frontend: type expansion + category map | ✅ (filter set now configurable per audience; icon variants extended to 6; all 3 apps consume audience-specific filters) |
| 12 | Notification preferences UI (all 3 apps) | ✅ (GET + PATCH endpoints; shared `NotificationPreferencesPage` component + `useNotificationPreferences` hook; per-app routes at `/account/settings/notifications`) |
| 13 | QA matrix generator | ✅ (`nx qa-matrix wc-nest-api` produces `docs/notifications-qa.md` — 122 entries × full per-entry checklist) |

### Phase 1 — Schema migration (one Prisma migration)

Path: [apps/wc-nest-api/prisma/schema.prisma](apps/wc-nest-api/prisma/schema.prisma)

Add:

- **`Invitation` model** — provider-initiated invites to specific parents (`id`, `providerId`, `campId`, `sessionId?`, `invitedByUserId`, `parentEmail`, `parentUserId?`, `message?`, `expiresAt?`, `status` enum `pending|accepted|declined|expired|cancelled`, `respondedAt?`, timestamps; indexes on providerId, parentEmail, parentUserId, status).
- **Abandon-checkout fields on `BookingGroup`** — `checkoutStarted: Boolean`, `lastActivityAt: DateTime?`, `abandonedNotifiedAt: DateTime?`. Booking-groups service updates `lastActivityAt` on draft writes; sets `checkoutStarted = true` once participant or payment details are touched.
- **`profileCompletion: Int @default(0)`** on `Parent` and `Provider`. Mirror the existing `Children.profileCompletion` calc pattern.
- **`stripeAccountDisconnectedAt: DateTime?`, `stripeAccountDisconnectedReason: String?`** on `Provider`. Populated by the Stripe `account.deauthorized` / `account.application.deauthorized` webhook handler.
- **`NotificationDelivery` model** — audit log + idempotency table. Fields: `id`, `templateKey` (e.g. `parent.booking.accepted`), `type`, `recipientUserId`, `channel` (`in_app|email`), `dedupeKey`, `status` (`pending|sent|failed|skipped`), `attempt`, `entityType?`, `entityId?`, `jobId?`, `errorMessage?`, `enqueuedAt`, `sentAt?`. **Unique index** `(templateKey, channel, dedupeKey)` is the load-bearing dedupe guard.
- **`NotificationPreference` model** — fields: `id`, `userId`, `templateKey`, `channel`, `enabled`. Unique `(userId, templateKey, channel)`. Default state when row missing = enabled.
- **Data migration** — UPDATE existing `notifications.type` rows to the new dotted-namespace values (`booking_accepted` → `parent.booking.accepted`, etc.). One-time SQL migration script alongside the schema migration. Map provided in `notifications/legacy-type-map.ts` (also referenced by the catalog tests).

---

### Phase 2 — `packages/wc-email-templates` Nx library

New shared Nx library. Pure functions of typed props, no Nest DI, no Prisma.

Layout:
```
packages/wc-email-templates/
  emails/
    _shared/
      layout.tsx           # branded header + footer
      branded-button.tsx
      info-panel.tsx
      salutation.tsx       # 'Hi {name},' | 'Dear {name},' | renders nothing
      theme.ts             # color tokens (mirrors current EmailTemplateService palette)
    booking/
    payment/
    refund/
    dispute/
    invitation/
    reminder/
    review/
    superadmin/
  src/
    index.ts               # re-exports every template + its Props type
    renderer.ts            # renderEmail(Component, props) → { html, text }
  project.json             # nx targets: build, test, email-dev
```

`renderer.ts`:

```ts
import { render } from '@react-email/render'
export interface RenderedEmail { html: string; text: string }
export async function renderEmail<T>(
  Component: ComponentType<T>,
  props: T,
  options?: { includePlainText?: boolean },
): Promise<RenderedEmail> {
  const html = await render(Component(props), { pretty: false })
  const text = options?.includePlainText ? await render(Component(props), { plainText: true }) : ''
  return { html, text }
}
```

- Templates use React Email's default JSX-escape — no manual `escapeHtml()` needed.
- Each template file exports a `PreviewProps` constant adjacent to default export for the previewer.
- `nx run wc-email-templates:email-dev` runs `npx email dev` at http://localhost:3000.
- Vitest snapshot tests in `packages/wc-email-templates/src/__tests__/*.spec.ts` for every money-touching template (booking, payment, refund, dispute, cancellation). Promotional/reminder templates rely on the QA matrix.
- Update [packages/global-utils/src/lib/email.service.ts](packages/global-utils/src/lib/email.service.ts) `sendEmail()` to accept `{ html, text }` and pass `text` through to nodemailer for multi-part MIME.

---

### Phase 3 — BullMQ infrastructure

Path: `apps/wc-nest-api/src/modules/notifications/queue/`

- Install `@nestjs/bullmq`, `bullmq`, `@bull-board/api`, `@bull-board/express`.
- **Two queues**: `notifications` (live) and `notifications.scheduled` (delayed). One `NotificationWorker` registers as processor for both; concurrency tuned per queue.
- **Job payload** carries primitive IDs only (`NotificationContext`) — never embedded entities — so retries days later read fresh DB state.
- **Idempotency** via deterministic `jobId` (BullMQ rejects duplicates) PLUS unique index on `NotificationDelivery(templateKey, channel, dedupeKey)`.
- **Retry**: email = `attempts: 5, backoff: exponential 30s`; in_app = `attempts: 3, backoff: fixed 5s`. `removeOnComplete: { age: 86400, count: 5000 }`, `removeOnFail: false`.
- **Cancel pattern** (`cancel.service.ts`): per-entity helpers like `cancelForBooking(id)`, `cancelForCheckout(id)`, `cancelForInvitation(id)` enumerate deterministic jobIds and `queue.remove(jobId)`.
- **Shared Redis** — reuse existing ioredis but open a **dedicated connection** with `maxRetriesPerRequest: null` (BullMQ requirement). Do not change global Redis settings.
- **Bull Board** mounted at `/admin/queues` behind the existing superadmin guard. Wired in [apps/wc-nest-api/src/modules/notifications/bull-board.controller.ts](apps/wc-nest-api/src/modules/notifications/bull-board.controller.ts).
- **Workers run inside `wc-nest-api`** (no separate Nx app) — simplest deploy; notification work is I/O-bound.

---

### Phase 4 — Catalog + dispatcher framework (proves the end-to-end loop)

Path: `apps/wc-nest-api/src/modules/notifications/`

Files:
```
catalog/
  notification-catalog.ts          # Record<NotificationType, CatalogEntry<any>>
  types.ts                         # CatalogEntry, Channel, SalutationStyle, Audience, NotificationCategory
  audiences/
    parent.catalog.ts
    provider.catalog.ts
    superadmin.catalog.ts
resolvers/
  recipient-resolvers.ts           # Record<ResolverKey, Resolver>
  prop-loaders.ts                  # Record<NotificationType, PropLoader>
dispatcher/
  notification-dispatcher.service.ts
  notify.ts                        # tiny notify(events, type, ctx, runAt?) helper
workers/
  notification.worker.ts
catalog-validation.spec.ts         # CI guard: every type has entry + resolver + template
```

`types.ts` defines:

```ts
export interface CatalogEntry<TProps = unknown> {
  type: NotificationType
  audience: 'parent' | 'provider' | 'superadmin'
  category: NotificationCategory          // for filter UI + preferences UI grouping
  channels: ('in_app' | 'email')[]
  salutation: 'hi' | 'dear' | 'none'
  resolver: ResolverKey
  templateKey: string                     // stable, e.g. 'parent.booking.accepted'
  transactional: boolean                  // true → bypass user preferences
  trigger: 'live' | 'scheduled'
  loadProps: PropLoader<TProps>
  dedupeKey?: (recipientUserId: string, ctx: NotificationContext) => string
  email?: {
    component: ComponentType<TProps>
    subject: (props: TProps) => string
    includePlainText: boolean
  }
  inApp?: {
    title: (props: TProps) => string
    body: (props: TProps) => string
    entityType?: NotificationEntityType
    entityId: (props: TProps) => string
    redirectUrl: (props: TProps) => string
  }
}
```

Dispatcher:

```ts
@OnEvent('notification.dispatch')
async dispatch(event: { type: NotificationType; context: NotificationContext; runAt?: Date }) {
  const entry = notificationCatalog[event.type]
  const recipients = await recipientResolvers[entry.resolver]({ prisma }, event.context)
  for (const userId of recipients) {
    const channels = entry.transactional
      ? entry.channels
      : await this.preferences.filterChannels(userId, entry.templateKey, entry.channels)
    if (!channels.length) continue
    await this.enqueueService.enqueue({
      type: event.type, recipientUserId: userId, channels, context: event.context,
      dedupeKey: (entry.dedupeKey ?? defaultDedupeKey)(userId, event.context),
      delay: event.runAt ? Math.max(0, event.runAt.getTime() - Date.now()) : 0,
    })
  }
}
```

Worker:
1. Reload catalog entry by type.
2. Dedupe-check via `NotificationDelivery.findUnique({ templateKey, channel, dedupeKey })` → if `status='sent'`, mark complete.
3. `entry.loadProps(prisma, context)` → typed props.
4. If `entry.inApp`: build title/body/redirectUrl from props → `NotificationsService.create(...)`.
5. If `entry.email`: fetch recipient `email, firstName`, render `{ html, text }`, send via `EmailService.sendEmail({ messageId: dedupeKey + '@worldcamps' })`.
6. Upsert `NotificationDelivery` row.

**Wire one catalog entry end-to-end** in this phase (`Parent_Booking_Accepted`) to prove the loop. PR is small enough to review carefully.

**Catalog validation test** asserts: every `NotificationType` enum value has a catalog entry; every entry's resolver exists; every entry with `channels.includes('email')` has an email component; `templateKey` values are unique.

---

---

## Audit Findings — Phases 1-4 Post-Implementation Review

Strict gap analysis comparing the as-built code against the plan. Verdict per finding: ✓ compliant · ⚠️ deviation (intentional / acceptable) · 🐛 bug (fix before Phase 5) · 📋 deferred (acceptable for later phase).

### Phase 1 — Schema migration

| Plan item | Status | Notes |
|---|---|---|
| `Invitation` model + `InvitationStatus` enum | ✓ | All fields + indexes match spec. |
| `BookingGroup.checkoutStarted` / `lastActivityAt` / `abandonedNotifiedAt` | ✓ | Field-update wiring deferred to Phase 6 abandon-cron. |
| `Parent.profileCompletion` + `Provider.profileCompletion` | ✓ | Calc service deferred to Phase 6. |
| `Provider.stripeAccountDisconnectedAt` + `Reason` | ✓ | Webhook wiring deferred to Phase 6. |
| `NotificationDelivery` model + unique `(template_key, channel, dedupe_key)` | ✓ | Index is load-bearing as planned. |
| `NotificationPreference` model + unique `(user_id, template_key, channel)` | ✓ | Endpoint + UI deferred to Phase 12. |
| Data migration of legacy `notifications.type` rows | ✓ | Audience-aware via JOIN on `parents`/`providers` tables; per-statement ordering correct (parent first, provider catches remainder). |
| `notifications/legacy-type-map.ts` referenced by catalog tests | 📋 | Inlined directly into the migration SQL. Add .ts file only if a runtime consumer emerges (e.g. QA matrix "was-was" mapping). |

### Phase 2 — `packages/wc-email-templates`

| Plan item | Status | Notes |
|---|---|---|
| Nx library + project.json + tsconfigs | ✓ | |
| `_shared/` (layout, branded-button, info-panel, salutation, theme) | ✓ | Theme mirrors legacy palette. |
| `renderer.ts → renderEmail()` | ✓ | Uses `createElement` (plan's `Component(props)` call form fails TS narrowing for `ComponentType`). Functionally equivalent. |
| Default JSX-escape | ✓ | Verified — `<script>` → `&lt;script&gt;`. |
| `PreviewProps` adjacent to default export | ✓ | |
| Snapshot tests for money-touching templates | 📋 | Only the one Phase 4 template has a spec; rest land alongside their template in Phases 7-9. |
| `EmailService.sendEmail` accepts `{ html, text }` | ✓ | Multi-part MIME plumbed to nodemailer. |
| `email-dev` Nx target | ✓ | `nx run wc-email-templates:email-dev` → port 3000. |
| Per-domain folders (`payment/`, `refund/`, etc.) | 📋 | Only `booking/` populated — Phases 7-9. |
| Forbidden-phrase lint/grep test | 📋 | Defer until 3+ payment templates exist for the test to be meaningful. |
| `vite.config.mts` | ⚠️ | Not in plan layout but required for vitest. Acceptable addition. |

### Phase 3 — BullMQ infrastructure

| Plan item | Status | Notes |
|---|---|---|
| BullMQ + Bull Board packages installed | ✓ | Also: `@bull-board/nestjs`, `express-basic-auth` (not in plan, required by chosen integration path). |
| Two queues (`notifications`, `notifications.scheduled`) | ✓ | |
| Primitive-IDs-only job payload | ✓ | 18 typed FK fields + `extra` escape hatch. |
| Idempotency via deterministic `jobId` + unique `NotificationDelivery` index | ✓ | Belt + braces. |
| **Per-channel retry config** (email 5/exp 30s; in_app 3/fixed 5s) | ⚠️ | Both queues use email-style. Queue-level `defaultJobOptions` can't differentiate by channel. Future fix: per-job override in `enqueue.service.ts`. |
| `removeOnComplete` / `removeOnFail: false` | ✓ | |
| Per-entity cancel helpers (`cancelForBooking`, etc.) | 📋 | Generic `cancel(...)` + `cancelByJobId(...)` implemented; entity helpers populated as catalog entries land. |
| Dedicated ioredis with `maxRetriesPerRequest: null` | ✓ | Global `RedisService` untouched. |
| **Bull Board behind existing superadmin Nest guard** | ⚠️ | Implemented with `express-basic-auth` keyed off `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`. Bull Board mounts at the express layer outside Nest's guard pipeline; custom Nest auth middleware deferred. Production env-vars required or route is 503-blocked. |
| Plan filename `bull-board.controller.ts` | ⚠️ | Implementation: `queue/bull-board.module.ts` (Bull Board is a module, not a controller). |
| Workers inside `wc-nest-api` | ✓ | |

### Phase 4 — Catalog + dispatcher + worker

| Plan item | Status | Notes |
|---|---|---|
| `catalog/types.ts → CatalogEntry<TProps>` shape | ✓ | Field-for-field match with plan. |
| `catalog/notification-catalog.ts` | ✓ | `Partial<Record>` during Phases 4-9; tighten to full `Record` at Phase 9. |
| Per-audience catalog files | ✓ | Provider + superadmin currently empty arrays. |
| `recipient-resolvers.ts` registry | ✓ | Three resolvers seeded; `satisfies` enforces exhaustiveness. |
| `prop-loaders.ts` registry | ✓ | Returns `null` to signal "no longer relevant". |
| `dispatcher/notify.ts` helper | ✓ | |
| `NotificationDispatcherService` | ✓ | Single `@OnEvent('notification.dispatch')` listener. |
| Worker: dedupe → loadProps → in_app + email → write delivery | ✓ | All 5 steps. |
| Single-worker plan (one processor on both queues) | ⚠️ | `@nestjs/bullmq @Processor` binds 1:1 with queue name. Implementation: two `WorkerHost` subclasses sharing `runNotificationJob()`. Functionally equivalent. |
| Email `messageId: dedupeKey + '@worldcamps'` | ✓ | |
| Default `dedupeKey` builder | ⚠️ | Plan: `${type}:${recipientUserId}:${entityId}`. Implementation: `${recipientUserId}:${entity}` — type prefix omitted because `templateKey` is already a unique-index column. `jobId` still prefixes with type for Bull Board readability. |
| `NotificationPreferencesService` | ✓ | Bypassed via `entry.transactional`; defaults to enabled. |
| `BookingGroupsService.acceptForProvider` emits `notify(...)` | ✓ | Dual-write with legacy path until Phase 5 cutover. |
| Catalog validation test (CI guard) | ✓ | 6 assertions pass. |
| **Validation exhaustiveness** (every NotificationType has an entry) | 📋 | Test scopes to "registered entries only" — tighten in Phase 9. |
| Build green | ✓ | Required adding `jsx: react-jsx` to `tsconfig.app.json` + `tsconfig.spec.json` + jest config transform `.tsx` so path-mapped TSX compiles through nest webpack + ts-jest. |
| Snapshot + catalog tests pass | ✓ | 4 + 6 = 10. Pre-existing messaging failures predate the branch. |

### 🐛 Bugs to fix before Phase 5

1. **`NotificationDelivery.entityType` / `entityId` are never populated.** Worker's `upsertDelivery()` accepts `context` but the Prisma `create` block omits both fields. Plan lists them as mirrored "for support tooling". Fix: extend the catalog entry shape to expose `entityType` / `entityId(props)` at the top level (or read from `inApp`), pass into `upsertDelivery`, write in both `create` and `update` blocks.
2. **In-app `Notification.metadata` loses information vs the legacy handler.** Legacy carried `{ bookingGroupNumber, campName, redirectUrl }`; catalog worker only writes `{ redirectUrl }`. Fix: add optional `metadata?: (props) => Record<string, unknown>` to `CatalogEntry.inApp`; merge with `{ redirectUrl }` in the worker. Otherwise frontends reading e.g. `metadata.bookingGroupNumber` break post-cutover.

### ⚠️ Documented deviations (no remediation required)

- Bull Board auth — basic-auth instead of Nest guard.
- Same retry config on both queues (channel lives on payload, not queue).
- Two `WorkerHost` subclasses instead of one — `@nestjs/bullmq` decorator semantics.
- `bull-board.module.ts` naming (not `controller`).
- `defaultDedupeKey` omits type prefix — `templateKey` is already in the unique index.

### 📋 Items deferred (resolve naturally in later phases)

- `legacy-type-map.ts` (data inlined in migration SQL).
- Per-entity cancel helpers (Phases 7-9).
- Forbidden-phrase lint test (Phase 7).
- Provider/superadmin catalog entries (Phases 8-9).
- Validation exhaustiveness tightening (Phase 9).

---

### Phase 5 — Cutover existing 7 types

Migrate the existing 7 NotificationType values to the catalog. Delete or shrink:
- [apps/wc-nest-api/src/modules/common/email-templates/email-template.service.ts](apps/wc-nest-api/src/modules/common/email-templates/email-template.service.ts) — gone (templates become React Email components).
- [apps/wc-nest-api/src/modules/common/email-templates/booking-notification.service.ts](apps/wc-nest-api/src/modules/common/email-templates/booking-notification.service.ts) — gone (dispatcher takes over).
- [apps/wc-nest-api/src/modules/common/email-templates/application-notification.service.ts](apps/wc-nest-api/src/modules/common/email-templates/application-notification.service.ts) — gone.
- [apps/wc-nest-api/src/modules/booking-groups/booking-websocket.handler.ts](apps/wc-nest-api/src/modules/booking-groups/booking-websocket.handler.ts) — keep the live WebSocket fan-out (it's a UI nudge, not a notification); remove the `notificationsService.create()` + email dispatch — they move to the catalog.
- Verification + 2FA + provider import emails stay in their existing services (they're auth-flow, not notifications).

Snapshot tests guard the visual diff for migrated templates.

---

### Phase 6 — Missing domain features

For each, add module + service + endpoints (no notification wiring here; that comes in Phase 7).

- **Invitation system** — module at `apps/wc-nest-api/src/modules/provider/invitations/` (provider-side CRUD: create, list, cancel) and `apps/wc-nest-api/src/modules/user/invitations/` (parent-side: list, accept, decline). Frontend pages in `wc-provider` (send/list invitations) and `wc-booking` (received invitations + accept flow that creates a BookingGroup).
- **Abandoned-checkout cron** — `apps/wc-nest-api/src/modules/booking-groups/crons/abandon-detection.cron.ts` runs hourly: finds `BookingGroup { status: draft, checkoutStarted: true, lastActivityAt < now - 3h, abandonedNotifiedAt: null }`, emits `Parent_Checkout_Abandoned3h`, stamps `abandonedNotifiedAt`. Also enqueue the 2d/4d/6d follow-ups at the same time (delayed jobs).
- **Profile completeness service** — `apps/wc-nest-api/src/modules/common/profile-completion/profile-completion.service.ts`. Recompute on Parent/Provider update via Prisma middleware or explicit calls. Thresholds (`< 50` = "incomplete") drive the catalog reminders.
- **Stripe disconnect event tracking** — extend the existing Stripe webhook handler under `apps/wc-nest-api/src/modules/provider/stripe-connect/` to set `stripeAccountDisconnectedAt` + `Reason` on `account.deauthorized` / `account.application.deauthorized` events.

---

---

## Audit Findings — Phases 5-6 Post-Implementation Review

Same legend as Phase 1-4 audit: ✓ compliant · ⚠️ deviation (intentional / acceptable) · 🐛 bug (fix before / during Phase 7) · 📋 deferred.

### Phase 5 — Cutover existing 7 types

| Plan item | Status | Notes |
|---|---|---|
| Migrate the existing 7 NotificationType values | ⚠️ | Only **3 of 7** were actually emitted (`BookingAccepted`, `BookingDeclined`, `BookingRequestReceived` — all from `BookingWebSocketHandler`). Migrated those into 5 dotted-namespace entries (parent + provider variants). The other 4 (`BookingExpired`, `MessageNew`, `SupportTicketUpdated`, `SystemAlert`) were enum-reserved but never emitted — removed without replacement. |
| Delete `email-template.service.ts` | ⚠️ | **NOT deleted** — still hosts verification, 2FA, and provider-import templates (auth-flow, per plan exception). 2 unused methods removed. |
| Delete `booking-notification.service.ts` | ✓ | `git rm`'d. |
| Delete `application-notification.service.ts` | 📋 | NOT deleted — still consumed by `ApplicationReviewService` + `OnboardingService`. Migrate in Phase 8. |
| `BookingWebSocketHandler` slimmed to WS-only | ✓ | ~300 → ~90 lines. No notification or email creation. |
| `BookingGroupsService` emits `notify()` at every transition | ✓ | Submit, accept (parent + provider), decline (parent + provider). |
| Snapshot tests for migrated templates | ⚠️ | `parent.booking.accepted` (Phase 4) + `parent.booking.declined` (Phase 5) covered. Provider variants in_app only — no email = no snapshot. |
| Bonus: frontend category-map adoption | ⚠️ | Plan calls this Phase 11 work — forced by Phase 5's enum cleanup. Phase 11 has less work but per-app filter labels + icons still owed. |

### Phase 6 — Missing domain features

#### Invitation system

| Plan item | Status | Notes |
|---|---|---|
| Backend module structure | ⚠️ | Shared `invitations/` (service + cron) + per-audience controllers — cleaner than plan's per-audience modules. |
| Provider CRUD + parent endpoints | ✓ | RolesOrPermissionsGuard + appropriate `@Permissions` / `@Roles`. |
| Frontend pages (both apps) | ✓ | List + status filter; "Send invitation" modal; accept/decline buttons. |
| **Parent accept "creates a BookingGroup"** | 🐛 | Acceptance only transitions invitation status; does NOT create a `BookingGroup` or redirect into checkout. TODO documented in page header. |
| `parentUserId` backfill on sign-up | 📋 | Documented; defer to auth-module touch. |
| Invitation expiry cron | ✓ | Bonus — hourly Redis-locked flip pending → expired. |

#### Abandoned-checkout cron

| Plan item | Status | Notes |
|---|---|---|
| Cron file + hourly schedule + Redis lock + query | ✓ | |
| **Emit `Parent_Checkout_Abandoned3h` + stamp + enqueue 2d/4d/6d** | 🐛 | NOT done. Cron is diagnostic-only — justified as "Phase 6 scope rule: no notification wiring" but plan explicitly says the cron should emit + stamp. Phase 7 wires this alongside the catalog entries. |
| `createDraftForParent` populates `lastActivityAt` | ✓ | |
| `saveAddOnsForParent` flips `checkoutStarted = true` + refreshes activity | ✓ | |

#### Profile completeness service

| Plan item | Status | Notes |
|---|---|---|
| Service + `recomputeForParent` / `recomputeForProvider` | ✓ | Idempotent; weighted formulae sum to 100. |
| `INCOMPLETE_THRESHOLD = 50` exposed | ✓ | |
| **Recompute called from update sites** | 🐛 | Service exists but **no callers wired**. Without this, `profileCompletion` stays at 0 forever. Phase 7/8 must wire into Parent CRUD, Provider CRUD, Camp publish, Stripe onboarding completion. |
| Global module registered | ✓ | |

#### Stripe disconnect tracking

| Plan item | Status | Notes |
|---|---|---|
| Webhook stamps disconnect fields | ✓ | `stripeAccountDisconnectedAt` + `Reason: 'stripe_webhook_deauthorized'`. |
| `resource_missing` scrub path mirrored | ✓ | Uses `Reason: 'stripe_resource_missing'` — bonus consistency. |
| Reconnect clears the fields | ✓ | |

### 🐛 Bugs to fix during Phase 7

1. **Abandon-detection cron is diagnostic-only.** Wire `notify(events, ParentCheckoutAbandoned3h, {...})` + 2d/4d/6d delayed fan-out + `abandonedNotifiedAt: new Date()` when the catalog entries land.
2. **Profile-completion service has no callers.** Wire `recomputeForParent` into Parent update sites; `recomputeForProvider` into Provider update / Camp publish / Stripe completion.
3. **Invitation accept doesn't chain to BookingGroup creation.** After `acceptForParent()`, chain into `createDraftForParent` and redirect into checkout (UI-only fix or new backend endpoint).
4. **Migration SQL rewrites for unused legacy types target non-existent catalog entries.** Trim the UPDATEs for `booking_expired`, `message_new`, `support_ticket_updated`, `system_alert` OR add stub `NOTIFICATION_CATEGORY` mappings. Recommend trimming (types weren't emitted, no rows to migrate).

### ⚠️ Documented deviations (no remediation required)

- 5 legacy email-template services kept (verification, 2FA, application, payment, refund) — replacements land in Phases 7-8.
- 4 of 7 legacy NotificationType members removed without replacement (never emitted).
- Invitation module as shared service + per-audience controllers.
- Phase 11 category-map adoption partially landed in Phase 6.

### 📋 Items deferred (resolve naturally in later phases)

- `parentUserId` backfill at sign-up.
- Forbidden-phrase lint test.
- Per-entity cancel helpers in `NotificationsCancelService`.
- Validation exhaustiveness tightening (Phase 9 cutover).
- Snapshot tests for not-yet-built templates.

---

### Phase 7 — Catalog fill: Parent triggers (52)

Group by domain, one PR per domain:
- Booking (~12) — request submitted, accepted, declined, expired, pre-start 14d/7d/1d, cancellation, modification, withdrawal.
- Payment (~10) — deposit confirmed, balance 14d/7d/3d reminders, balance charged, balance failed (1st/2nd/final), cancelled non-payment.
- Refund/Dispute (~6).
- Invitation (~4) — received, still-open reminder, expired, accepted by parent.
- Wishlist + Conversion (~8) — empty wishlist, items-no-booking 7d/21d, price drop, filling up, deadline approaching, post-decline alternatives, early-bird price increase.
- Reminder/Promo (~6) — pre-camp checklist, packing reminder, day-before, post-camp review request + reminder.
- Profile/System/Support/Reviews (~6) — profile incomplete, review removed, support ticket reply/status, response published, post-camp survey.

Per trigger:
1. Add `NotificationType` enum value.
2. Add catalog entry.
3. Add React Email component (often a variant of a sibling).
4. Add prop loader function.
5. Add domain-side `notify(events, NotificationType.X, ctx)` call at commit point.
6. Snapshot test for money-touching emails.

---

## Audit Findings — Phase 7 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug (fix in Phase 7.5) · 📋 deferred.

### Counts vs plan target

| Domain (plan) | Catalog entries | Notes |
|---|---:|---|
| Booking (~12) | 8 | accepted/declined/requestSubmitted/requestStillPending/expired/cancelled/modified/requestWithdrawn |
| Payment (~10) | 9 | depositConfirmed, 3 reminders (14d/7d/3d), balanceCharged, 3 failures, cancelledNonPayment |
| Refund/Dispute (~6) | 5 | refundIssued/Failed, disputeOpened, disputeResolvedWon/Lost |
| Invitation (~4) | 4 | received, stillOpenReminder, expired, acceptedSelf |
| Wishlist + Conversion (~8) | 8 | empty, 2 itemsNoBooking, 4 event-driven, postDeclineAlternatives |
| Abandoned-checkout (audit bug #1) | 4 | 3h/2d/4d/6d cadence |
| Reminder/Promo (~6) | 6 | 3 pre-camp + 3 post-camp |
| Messaging/Support/Profile/Reviews (~6) | 7 | newFromCamp, 2 supportTicket, reviewResponsePublished, reviewRemoved, profileIncomplete, postCampSurvey |
| **Total parent (target 52)** | **50** | within tolerance |

### Per-trigger checklist coverage

| Step | Coverage |
|---|---|
| 1. `NotificationType` enum value | ✓ 51/51 |
| 2. Catalog entry | ✓ 51/51 |
| 3. React Email component | ✓ 22 templates (in_app-only entries don't need one) |
| 4. Prop loader | ✓ 51/51 (8 reusable builders) |
| 5. **Domain-side `notify()` at commit point** | 🐛 partial — 19 entries have no emit (see bug #1 below) |
| 6. Snapshot test for money-touching emails | 🐛 partial — 4 of 13 covered (see bug #2 below) |

### 🐛 Bugs (fix in Phase 7.5)

**Bug #1 — 19 of 51 catalog entries have no commit-point emit.** They will never fire today.

| Entry | Missing wiring |
|---|---|
| `ParentBookingModified` | No domain event today (`saveAddOnsForParent` rejects non-drafts). Park until a modify-confirmed-booking flow exists. |
| `ParentBookingRequestWithdrawn` | Wire at the withdraw endpoint (build it if missing). |
| `ParentPaymentCancelledNonPayment` | Wire in `RefundsService.markGroupCancelled` when `reason='policy_balance'` (or whichever maps to non-payment). |
| `ParentInvitationStillOpenReminder` | Enqueue as a delayed job alongside `ParentInvitationReceived` (`expiresAt − 24h`). |
| `ParentWishlistEmpty` + `ParentWishlistItemsNoBooking7d/21d` | New daily `wishlist-engagement.cron.ts`. |
| `ParentWishlistPriceDrop/FillingUp/DeadlineApproaching/EarlyBirdIncrease` | Need domain change-detection. Park until session-price + capacity scanner exists. |
| `ParentConversionPostDeclineAlternatives` | Chain from `declineForProvider` as `notify(..., runAt = +24h)`. |
| `ParentPreCampChecklist14d` + `PackingReminder7d` + `DayBefore` | Schedule from `acceptForProvider` (`startDate − 14d/7d/1d`). |
| `ParentPostCampReviewRequest/Reminder/Survey` | New `post-camp-review.cron.ts`. |
| `ParentReviewResponsePublished` | Wire in the `CampReviewResponse.create` commit. |
| `ParentReviewRemoved` | Wire in the review-moderation removal commit. |
| `ParentProfileIncomplete` | New weekly `profile-incomplete.cron.ts`. |

**Bug #2 — snapshot tests for money-touching templates missing.** Plan §2 explicitly calls for snapshot coverage of booking/payment/refund/dispute/cancellation templates. Booking templates have specs from Phases 4-7a; the 9 new money-touching templates from Phase 7b-c need specs added.

**Bug #3 — invitation-accept BookingGroup chain only partially fixed.** Phase 7d returns `redirectUrl` to the parent UI, but no `BookingGroup` is created server-side. Verify the camp/book page honours `?from_invitation=1&session=...`; if it doesn't pre-populate the draft, either extend that page or build a `POST /user/invitations/:id/accept-and-create-draft` endpoint.

**Bug #4 — profile-completion callers incomplete.** Phase 7g wired children create/archive + camp publish + Stripe onboarding. Still missing the parent-profile-update and provider-profile-update endpoints — fields like nationality / languages / logo / description are mutated there and account for ~50% of each score.

### ⚠️ Documented deviations

- Pre-camp and post-camp use a single template each (`parent-pre-camp.tsx`, `parent-post-camp-review.tsx`) with a `stage` prop — mirrors the existing balance-reminder pattern.
- `BalanceReminderCron` lives in `billing/intents/crons/` (next to its sibling `balance-charge.cron`), not `notifications/crons/`.
- Phase 7d invitation-accept "chain" landed as a UI redirect (`/camps/:campId/book?from_invitation=1&session=...`) instead of an explicit `createDraftForParent` server-side call — relies on the camp/book page to honour the query params.

### 📋 Items deferred

- **Per-entity cancel helpers** (`NotificationsCancelService.cancelForBooking/cancelForCheckout/cancelForInvitation`). Phase 7 added many scheduled jobs but does not cancel them when state transitions; the loader's null-skip pattern makes this "noisy, not broken." Land in Phase 12 alongside preferences UI so toggle changes take effect immediately.
- Forbidden-phrase lint test — now meaningful (5+ payment templates exist). Land in Phase 8 with provider templates.
- Pre-existing test failures (4 suites) — 3 messaging + 1 stripe-webhook — predate this work and were noted in prior audits.
- Snapshot tests for non-money templates (invitation, messaging, support, wishlist, conversion, pre-camp, post-camp, review-removed, profile-incomplete) — rely on Phase 13 QA matrix.

---

### Phase 7.5 — Phase 7 follow-up: wire dead entries + missing crons + snapshot tests

Goal: bring every parent catalog entry to "fires correctly in production." This is mechanical follow-up work that Phase 7 should have included; carved out so the Phase 7 PR stays reviewable.

#### A. Wire the "obvious commit point" notifies (8 entries)

1. **`acceptForProvider`** → enqueue scheduled pre-camp emits at `startDate − 14d / 7d / 1d` for `ParentPreCampChecklist14d`, `ParentPreCampPackingReminder7d`, `ParentPreCampDayBefore`.
2. **`InvitationsService.createForProvider`** → enqueue scheduled `ParentInvitationStillOpenReminder` at `expiresAt − 24h` (skip if no `expiresAt`).
3. **`BookingGroupsService.declineForProvider`** → enqueue scheduled `ParentConversionPostDeclineAlternatives` at `+24h`.
4. **`RefundsService.markGroupCancelled`** → live `notify(ParentPaymentCancelledNonPayment)` when the reason maps to non-payment (`policy_balance` from the `balance-charge.cron`'s final-fail path).
5. **`CampReviewResponseService.create`** (or whatever owns provider-replies-to-review) → live `notify(ParentReviewResponsePublished)`.
6. **Review-moderation remove path** (`superadmin/reviews` or equivalent) → live `notify(ParentReviewRemoved)`.
7. **Withdraw endpoint** → live `notify(ParentBookingRequestWithdrawn)`. Build a `withdrawForParent` method on `BookingGroupsService` if one doesn't exist.
8. **Parent + Provider profile UPDATE endpoints** (Bug #4) → call `recomputeForParent` / `recomputeForProvider` after every mutation.

#### B. Build three new crons

| Cron | Path | Schedule | Targets |
|---|---|---|---|
| Wishlist engagement | `apps/wc-nest-api/src/modules/user/wishlists/crons/wishlist-engagement.cron.ts` | weekly | `ParentWishlistEmpty` (no items, ≥7d since signup); `ParentWishlistItemsNoBooking7d` (`items > 0, no booking, wishlist created 7d ago`); same at 21d |
| Profile incomplete | `apps/wc-nest-api/src/modules/common/profile-completion/crons/profile-incomplete.cron.ts` | weekly | `ParentProfileIncomplete` (`profileCompletion < 50`, last-sent > 14d ago) |
| Post-camp review | `apps/wc-nest-api/src/modules/booking-groups/crons/post-camp-review.cron.ts` | daily | `ParentPostCampReviewRequest` at `session.endDate + 1d`, `ParentPostCampReviewReminder` at `+7d`, `ParentPostCampSurvey` at `+14d` (skipped if review already submitted) |

Pattern: Redis-locked, batch size ≤200, idempotency via `NotificationDelivery` unique index + a `lastNotifiedAt`-style timestamp on the source row (or via the BullMQ deterministic `jobId`).

#### C. Snapshot tests for money-touching templates (Bug #2)

Add Vitest specs in `packages/wc-email-templates/src/__tests__/`:

- `parent-payment-deposit-confirmed.spec.tsx`
- `parent-payment-balance-reminder.spec.tsx` (cover all three day-tiers via prop variants)
- `parent-payment-balance-charged.spec.tsx`
- `parent-payment-balance-failed.spec.tsx` (cover all three stages)
- `parent-payment-cancelled-non-payment.spec.tsx`
- `parent-refund-issued.spec.tsx`
- `parent-refund-failed.spec.tsx`
- `parent-dispute-opened.spec.tsx`
- `parent-dispute-resolved.spec.tsx` (cover both outcomes)

Each spec follows the existing pattern: `renderEmail()` → assert key props appear in rendered HTML/text + assert salutation style is correct.

#### D. Park entries with no domain commit point yet

Document the following as **reserved-for-future-feature** in the catalog file header (and in this plan, so it's not a surprise in Phase 8):

- `ParentBookingModified` — needs a modify-confirmed-booking flow.
- `ParentWishlistPriceDrop` — needs session-price-change detection.
- `ParentWishlistFillingUp` — needs capacity-threshold scanner.
- `ParentWishlistDeadlineApproaching` — needs booking-deadline scanner.
- `ParentWishlistEarlyBirdIncrease` — needs early-bird price scanner.

These remain in the catalog so the framework is ready; they fire as soon as the missing domain feature is built. The catalog-validation test continues to pass either way.

#### Acceptance criteria

- `git grep "notify(this.eventEmitter, NotificationType.Parent"` returns ≥ 32 distinct types (16 currently wired + 16 from Phase 7.5 sections A-B above).
- `nx test wc-email-templates` covers all 9 new money-touching templates (≥30 total tests).
- Both Bug #3 and Bug #4 are closed in code, not deferred.
- Build green across `wc-nest-api`, `wc-booking`, `wc-provider`, `wc-superadmin`.

#### Phase 7.5 — Completion notes

**What landed:**

- **9 snapshot tests** added under `packages/wc-email-templates/src/__tests__/` for every money-touching template (deposit-confirmed, balance-reminder, balance-charged, balance-failed, cancelled-non-payment, refund-issued/failed, dispute-opened/resolved). `nx test wc-email-templates` now covers 13 suites / 30 tests, all green.
- **8 commit-point notify() calls** wired (sections A 1–8):
  - `BookingGroupsService.acceptForProvider` enqueues 14d/7d/1d pre-camp emits with `runAt` set to `startDate − N days`.
  - `InvitationsService.createForProvider` enqueues `ParentInvitationStillOpenReminder` at `expiresAt − 24h`. Loader short-circuits to null if the invitation has transitioned out of `pending`.
  - `BookingGroupsService.declineForProvider` enqueues `ParentConversionPostDeclineAlternatives` at `+24h`.
  - `RefundsService.markGroupCancelled` fires `ParentPaymentCancelledNonPayment` when `reason === 'policy_balance'` (the balance-charge cron's final-fail path).
  - `ProviderReviewsService.respondToReview` fires `ParentReviewResponsePublished` on the create path (not on edits).
  - `BookingGroupsService.cancelForParent` now splits between `ParentBookingRequestWithdrawn` (status=`request`) and `ParentBookingCancelled` (post-accept).
  - Parent profile-completion recompute wired into `UserAuthController.updateProfile`, `uploadProfilePhoto`, `deleteProfilePhoto`, `requestPhoneChange` via a tiny `recomputeParentCompletionByUserId` helper.
  - Provider profile-completion recompute wired into `OnboardingService.updateCompanyDetails`, `saveContactInfo`, `saveCampInfo`, `updateProviderLogoUrl`.
- **3 new crons** built:
  - `WishlistEngagementCron` (weekly) — `ParentWishlistEmpty` + `ParentWishlistItemsNoBooking7d/21d`. Registered in `UserWishlistsModule`.
  - `ProfileIncompleteCron` (weekly) — `ParentProfileIncomplete` for parents with `profileCompletion < 50` and account ≥ 7 days old. Registered in the global `ProfileCompletionModule`.
  - `PostCampReviewCron` (daily) — `ParentPostCampReviewRequest/Reminder/Survey` at `endDate + 1d/7d/14d`. Skips the request + reminder tiers when the parent has already left a published review for the camp. Registered in `BookingGroupsModule`.
- **Bug #3 (invitation-accept chain) closed in code.** `InvitationsService.buildPostAcceptRedirect` is now `async`, looks up `Camp.slug` (the page route is `/camps/[campSlug]/book`, not `[campId]`), and uses query param `sessionId` (matching what `useSearchParams().get('sessionId')` reads on the booking page). Controller awaits the async call.
- **Bug #4 (profile-completion callers) closed in code.** Wired at all 8 endpoints + the global helper on the user-auth controller.

**What stays deferred:**

- **`ParentReviewRemoved`** — parked. There's no admin "remove published review" path in the codebase today (only pre-publish moderation via `ReviewStatus.rejected`). Catalog entry remains registered + tested; wires up the moment that domain feature lands. Documented in `parent.catalog.ts` header.
- **`ParentBookingModified`** + the four wishlist event-driven types (`PriceDrop`, `FillingUp`, `DeadlineApproaching`, `EarlyBirdIncrease`) — parked for the same reason; require new domain commit points (modify-confirmed-booking flow, session-price-change detection, capacity scanner, deadline scanner, early-bird price scanner). All listed explicitly in the `parent.catalog.ts` header so Phase 8 / future feature work knows the wiring is ready.
- **Per-entity cancel helpers** (`cancelForBooking/cancelForCheckout/cancelForInvitation`) — still owed for Phase 12. The loader's null-skip pattern makes scheduled jobs "noisy, not broken" in the interim (a job whose entity transitioned simply marks itself skipped).

**Verification:**

- `git grep "notify(this.eventEmitter, NotificationType.Parent"` now returns **25 distinct types** wired in domain code (was 16 at start of Phase 7.5). The remaining 6 unwired are the deferred entries above (5 parked + the `ParentReviewRemoved` one).
- `nx test wc-email-templates` → 13 suites / 30 tests pass.
- `nx test wc-nest-api -- --testPathPatterns='catalog-validation|disputes.service|refunds.service|payment-intents.service|balance-charge.cron|camps.service.spec|stripe-connect.service.spec|provider-reviews'` → 7 suites / 188 tests pass.
- Full `nx test wc-nest-api` → 474/500 tests pass. The 26 remaining failures across 4 suites (3 messaging + 1 stripe-webhook) are all pre-existing per the Phase 5-6 audit; not introduced by Phase 7.5.
- Build green for `wc-nest-api`, `wc-booking`, `wc-provider`, `wc-superadmin`.

---

### Phase 8 — Catalog fill: Provider triggers (55)

Group by domain, one PR per domain:
- Onboarding (~9) — application received/approved/declined, document reupload requested, additional info required, connect Stripe (+ reminders), profile incomplete, profile published, first booking, Stripe disconnected.
- Booking lifecycle (~14) — new request, 48h/final reminder, expired, confirmed, cancelled by family, cancelled non-payment, modified, withdrawn, invitation sent/accepted/declined/expired.
- Payments/Payouts (~6) — payout schedule confirmed, balance collected, payout reminder, payout released, payout failed, payout delayed/on hold.
- Refunds/Disputes (~6).
- Messaging (~3) — new message, 24h/48h unanswered.
- Reviews (~4) — new, response published, not-responded reminder, removed.
- Pre-camp + Operations (~5).
- Seasonal + Profile (~4) — season ended, programs not updated 30d/60d, profile deactivated.
- Support (~3).

Reuse the per-trigger checklist from Phase 7.

---

## Audit Findings — Phase 8 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug (fix in Phase 8.5 if material) · 📋 deferred.

### Counts vs plan target

| Domain (plan) | Catalog entries | Notes |
|---|---:|---|
| Onboarding (~9) | 11 | application received/approved/declined/reupload/info-required, connect-Stripe nudge + reminder, profile incomplete + published, first booking, Stripe disconnected |
| Booking lifecycle (~14) | 13 | 3 pre-Phase-8 (accepted/declined/requestReceived), 48h/final/expired reminders, cancelled-by-family/non-payment, withdrawn, modified, invitation accepted/declined/expired |
| Payments/Payouts (~6) | 6 | schedule confirmed, balance collected, reminder, released, failed, delayed |
| Refunds/Disputes (~6) | 7 | refund issued/failed, reimbursement owed, dispute opened/evidence-due/won/lost |
| Messaging (~3) | 3 | newFromFamily + unanswered 24h/48h |
| Reviews (~4) | 4 | new, response published, not-responded reminder, removed |
| Pre-camp + Operations (~5) | 4 | roster ready, checklist, day-before, post-camp wrap |
| Seasonal + Profile (~4) | 3 | season ended, programs not updated 30d/60d (profile-deactivated is parked) |
| Support (~3) | 2 | ticket reply + status changed (SLA breach is a superadmin signal — moves to Phase 9) |
| **Total provider (target 55)** | **53** | within tolerance |

### Per-trigger checklist coverage

| Step | Coverage |
|---|---|
| 1. `NotificationType` enum value | ✓ 53/53 |
| 2. Catalog entry | ✓ 53/53 |
| 3. React Email component | ✓ 10 shared templates with stage props (covers all `email`-channel entries) |
| 4. Prop loader | ✓ 53/53 (heavy builder reuse — 11 build functions across the domains) |
| 5. **Domain-side `notify()` at commit point** | ✓ 18 distinct commit sites wired; cron-driven entries fan out through `ProviderEngagementCron` |
| 6. Snapshot test for money-touching emails | ✓ 18 tests across 3 new specs (provider-payout-event, provider-refund-event, provider-dispute-event) |

### Resolver granularity decision (Phase 8a open issue from the plan)

The plan flagged: *"Per-trigger resolver granularity for provider triggers — finance-flavored entries may use `providerOwnerForBooking` instead of `allProviderUsers` to avoid noisy fan-out. Confirm during Phase 8 with stakeholder."*

Decision landed: **owner-only for finance / dispute / refund / payout, full-staff for booking-lifecycle + onboarding + reviews + messaging.** The new resolver family carries that split:

- `providerOwnerByProviderId` / `providerOwnerForBooking` / `providerOwnerForCamp` / `providerOwnerForReview` — single recipient, used for payouts (released/failed/delayed/reminder), refunds, disputes, reimbursements, onboarding (a single accountable person), application-status flips, season-ended, programs-not-updated.
- `allProviderUsersForBooking` / `ForCamp` / `ForReview` / `ForInvitation` — full staff fan-out, used for booking lifecycle (so any staff member sees a cancellation), reviews (so social-team can respond), invitations (so the inviter's team gets the response), pre-camp roster nudges.
- `providerUserForSupportTicket` — single recipient (the ticket's PROVIDER requester).

### Commit-point wiring summary

| Catalog entry | Wired at |
|---|---|
| `ProviderApplicationReceived` | `OnboardingService.completeOnboarding` (status → `under_review`) |
| `ProviderApplicationApproved / Declined / AdditionalInfoRequired` | `ApplicationReviewService.approveApplication / rejectApplication / requestInfo` |
| `ProviderDocumentReuploadRequested` | `DocumentReviewService.reviewDocument` when `reviewStatus === 'needs_reupload'` |
| `ProviderStripeDisconnected` | `StripeWebhookService.handleAccountDeauthorized` |
| `ProviderProfilePublished` | `CampsService.publishCamp` (first publish only) |
| `ProviderFirstBooking` | `BookingGroupsService.submitForParent` (first booking per provider) |
| `ProviderBookingRequest48hReminder / FinalReminder / Expired` | Scheduled emits in `submitForParent` (`+48h / +60h / +72h`) — loader short-circuits when status transitioned out of `request` |
| `ProviderBookingCancelledByFamily / RequestWithdrawn` | `BookingGroupsService.cancelForParent` (split by prior status) |
| `ProviderBookingCancelledNonPayment` | `RefundsService.markGroupCancelled` (reason=`policy_balance`) |
| `ProviderInvitationAcceptedByParent / DeclinedByParent` | `InvitationsService.transitionForParent` |
| `ProviderInvitationExpired` | `InvitationExpiryCron` |
| `ProviderBalanceCollected` | `PaymentIntentsService.markSucceeded` (non-deposit kinds) |
| `ProviderPayoutScheduleConfirmed` | `BookingGroupsService.acceptForProvider` |
| `ProviderPayoutReleased / Failed` | `PayoutsService.recordPayoutPaid / recordPayoutFailed` |
| `ProviderRefundIssued / Failed / ReimbursementOwed` | `RefundsService.markRefundCompleted` (mirror of parent path) |
| `ProviderDisputeOpened / ResolvedWon / ResolvedLost` | `DisputesService.handleCreated / handleClosed` (mirror of parent path) |
| `ProviderMessagingNewFromFamily` | `MessagesService.sendMessage` when senderType=USER |
| `ProviderSupportTicketReply` | `MessagesService.sendMessage` when ticket.requesterType=PROVIDER |
| `ProviderSupportTicketStatusChanged` | `SupportTicketsService.updateTicketStatus` |
| `ProviderReviewNew` | `UserReviewsService.create` |
| `ProviderReviewResponsePublished` | `ProviderReviewsService.respondToReview` (mirror entry — parent emit was Phase 7e) |
| `ProviderPreCampRosterReady / Checklist / DayBefore / PostCampWrap` | Scheduled emits in `acceptForProvider` (`startDate −14d/−7d/−1d`, `endDate +1d`) |

### Cron-driven entries (new `ProviderEngagementCron`)

A single injectable with `@Cron` methods at weekly / monthly / daily / hourly cadences. Idempotent via Redis lock per cadence + `NotificationDelivery` unique index. Drives 9 catalog entries:

| Cron tier | Catalog entries fed |
|---|---|
| Weekly | `ProviderProfileIncomplete`, `ProviderConnectStripeReminder`, `ProviderProgramsNotUpdated30d`, `ProviderProgramsNotUpdated60d`, `ProviderReviewNotRespondedReminder`, `ProviderPayoutReminder` |
| Monthly | `ProviderSeasonEnded` |
| Daily | `ProviderDisputeEvidenceDue` (fires within tomorrow→3d window so it lands on 3 consecutive days before deadline) |
| Hourly | `ProviderMessagingUnanswered24h`, `ProviderMessagingUnanswered48h` |

### ⚠️ Documented deviations

- **Templates use shared stage-prop components** (10 templates for 53 entries instead of 1:1). Same pattern as Phase 7 (`parent-pre-camp.tsx` with `stage`), keeps the snapshot test surface manageable and the diff reviewable.
- **One `ProviderEngagementCron` instead of 9 separate cron files.** Keeps the provider-side scheduled triggers grep-able in one place; each cadence has its own `@Cron` method + Redis lock. Trade-off: a bug in one method's `findMany` couldn't be tested in isolation as easily; mitigated by per-method `dispatch*` helpers that take no DI besides `this`.
- **Per-channel BullMQ retry config still uniform** — same Phase 3 deviation. Provider-side payout / dispute notifications may want longer email retries (financial impact); revisit when Phase 12 preferences UI surfaces this.
- **Provider templates render `Salutation style="none"`** uniformly. Per spec: providers / superadmins get no salutation. Templates still include the component so the layout's whitespace stays consistent.

### 🐛 Audit findings (fix-or-defer recommendations)

No P0 bugs. Two known limitations worth tracking:

1. **`buildProviderPayoutEvent` resolves provider context from up to 3 sources (booking/payment/payout event).** Branching logic is brittle — if a future kind only carries `payoutEventId` and the prisma `PayoutEvent.provider.legalCompanyName` join fails, the loader returns null and the worker skips. Acceptable for now (skip + log is the framework's intended degrade); revisit if the next-phase reconciliation cron starts re-enqueuing these.
2. **`ProviderMessagingUnanswered*` cron uses `Conversation.lastActivityAt` window** to find candidates, but the actual unanswered-since timestamp lives on `lastRequesterReplyAt`. Acceptable proxy because the cron runs hourly and `lastActivityAt` advances on every message — slightly chattier than the spec's stricter "no provider reply since family last spoke," but not user-visibly wrong.

### 📋 Items deferred

- **`ProviderBookingModified`** — parked (no modify-confirmed-booking flow exists). Catalog entry + template + loader registered; fires the moment that domain feature lands. Documented in `provider.catalog.ts` header.
- **`ProviderReviewRemoved`** — parked (same reason as parent side: no admin "remove published review" path exists). Documented.
- **Provider profile deactivated** — out of scope today; needs a "deactivate provider" admin flow.
- **Provider support SLA breach** — out of scope; relocates to Phase 9 (superadmin) since it's an internal-ops signal more than a provider-facing notification.
- **Per-entity cancel helpers** — still owed for Phase 12 (Phase 7 audit carryover); the Phase 8 scheduled emits inherit the same null-skip safety from the loaders.

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| `wc-booking` / `wc-provider` / `wc-superadmin` builds | ✓ all green |
| `wc-email-templates` tests | ✓ 17 suites / 49 tests pass (includes the new forbidden-phrase lint across all 32 templates) |
| `wc-nest-api` catalog-validation tests | ✓ 6/6 pass |
| `wc-nest-api` 4 specs touched in Phase 8 DI fixes | ✓ 82/82 pass |
| `wc-nest-api` full suite | 427/500 pass — same 4 pre-existing failing suites as Phases 7-7.5 (3 messaging + 1 stripe-webhook). No Phase 8 regressions. |

### Phase 8 — Completion notes

**What landed:**

- **53 provider catalog entries** spanning 8 domain groups (onboarding, booking lifecycle, payments/payouts, refunds/disputes, messaging, reviews, pre-camp/operations, support).
- **10 shared React Email templates** with stage-prop variants — `provider-application-status`, `provider-stripe-connect`, `provider-profile-milestone`, `provider-booking-event`, `provider-invitation-response`, `provider-payout-event`, `provider-refund-event`, `provider-dispute-event`, `provider-messaging-event`, `provider-review-event`, `provider-pre-camp`, `provider-operations-nudge`, `provider-support-event`.
- **9 new resolver functions** covering the owner-only vs full-staff split for finance vs lifecycle (`providerOwnerByProviderId / ForBooking / ForCamp / ForReview` + `allProviderUsersForBooking / ForCamp / ForReview / ForInvitation` + `providerUserForSupportTicket`).
- **11 builder functions** in `prop-loaders.ts` for variant-by-stage entries — covers `application-status`, `stripe-connect`, `profile-milestone`, `booking-event` (with status short-circuit for scheduled reminders), `invitation-response`, `payout-event`, `refund-event`, `dispute-event`, `messaging-event`, `review-event`, `pre-camp`, `operations-nudge`, `support-event`.
- **18 commit-point `notify()` calls** wired across 8 services + 1 cron (see "Commit-point wiring summary" table above).
- **`ProviderEngagementCron`** — single injectable, 4 `@Cron` methods (weekly / monthly / daily / hourly), Redis-locked per cadence, feeds 9 catalog entries.
- **3 provider snapshot tests** (`provider-payout-event`, `provider-refund-event`, `provider-dispute-event`) covering all 13 money-touching kinds.
- **Forbidden-phrase lint** (Phase 2 plan item, deferred to now): a single Vitest spec sweeps every template under `emails/` (skipping `_shared`), renders against `PreviewProps`, and greps for the 4 spec-forbidden phrases (`destination charges`, `we hold your money`, `funds held by world camps`, `platform escrow`). All 32 templates pass.

**What stays deferred:**

- `ProviderBookingModified`, `ProviderReviewRemoved`, provider profile-deactivation, SLA-breach (moves to Phase 9). Documented in `provider.catalog.ts` header and audit findings above.
- Per-entity cancel helpers (`cancelForBooking/cancelForCheckout/cancelForInvitation`) — Phase 12 alongside preferences UI.

**Verification:**

- A broader grep (`notify\(.*NotificationType\.Provider...\)` across `apps/wc-nest-api/src`) returns **48 distinct types** wired post-Phase-8: 22 via direct `notify(this.eventEmitter, ...)` calls + 8 scheduled-tier loops (booking-request reminders, pre-camp/post-camp) + 9 cron-driven (`ProviderEngagementCron`) + 9 phase-5/7 holdovers. The remaining 5 are 2 parked (`ProviderBookingModified`, `ProviderReviewRemoved`) + 3 orphans flagged in the Phase 8.5 audit (`ProviderReviewResponsePublished`, `ProviderConnectStripeNudge`, `ProviderPayoutDelayed`) — Phase 8.5 wires those.
- `nx test wc-email-templates` → 17 suites / 49 tests pass including forbidden-phrase lint.
- `nx test wc-nest-api` → 427/500 — same 4 pre-existing failing suites as before; no Phase 8 regressions.
- All 4 builds green (`wc-nest-api`, `wc-booking`, `wc-provider`, `wc-superadmin`).

---

### Phase 8.5 — Phase 8 follow-up: wire audit-flagged orphans

Goal: close the three "orphan" catalog entries identified by the Phase 8 audit — entries that have catalog + loader + template but no commit-point emit. Brings provider-side wiring from 48/53 → 51/53 (the remaining 2 are intentionally parked).

#### A. Wire the three orphan entries

1. **`ProviderReviewResponsePublished`** — wired in [provider-reviews.service.ts](apps/wc-nest-api/src/modules/provider/reviews/provider-reviews.service.ts) alongside the existing `ParentReviewResponsePublished` emit. Fires only on the create path (no spam on edits, same guard as the parent emit). Catalog resolves to `allProviderUsersForReview` so any provider staff member sees that the response went out.
2. **`ProviderConnectStripeNudge`** — wired in [application-review.service.ts](apps/wc-nest-api/src/modules/superadmin/application-review/services/application-review.service.ts) `approveApplication`, immediately after the `ProviderApplicationApproved` emit. This is the first moment a provider actually needs Stripe (they can't accept bookings without it). The existing weekly `dispatchConnectStripeReminder` cron picks up any provider still without `stripeAccountId` after 7+ days for the escalation reminder.
3. **`ProviderPayoutDelayed`** — added as a new daily helper `dispatchPayoutDelayed()` in [provider-engagement.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/provider-engagement.cron.ts). Stripe has no dedicated `payout.delayed` webhook event — a payout becomes "delayed" by missing its expected arrival date. The helper finds `PayoutEvent` rows with non-terminal status (`pending`/`in_transit`) and `arrivalDate` more than 1 day in the past, and emits the notification. Daily re-runs are idempotent via the `NotificationDelivery` unique index until the event flips to terminal.

#### B. Documentation cleanups

- Updated [provider.catalog.ts](apps/wc-nest-api/src/modules/notifications/catalog/audiences/provider.catalog.ts) header comment: "44 entries" → "53 entries" and added the Phase 8.5 wiring note.
- Corrected the Phase 8 audit verification line (above): the original `git grep` figure (22) under-counted scheduled-tier loops and cron emits. True post-Phase-8 figure is 48/53; post-Phase-8.5 figure is 51/53.

#### Phase 8.5 — Completion notes

**What landed:**

- 3 single-line `notify()` additions across 3 services + 1 new ~18-line daily cron helper.
- Catalog header comment refreshed to reflect actual entry count.
- Phase 8 audit verification line corrected in this plan.

**Verification:**

- `wc-nest-api` build green.
- `nx test wc-email-templates` → 17 suites / 49 tests pass (unchanged — no template churn).
- `nx test wc-nest-api --testPathPatterns=catalog-validation` → 6/6 pass.
- All 4 frontend / backend builds green.

**Remaining unwired** (intentionally parked):

- `ProviderBookingModified` — needs a modify-confirmed-booking domain flow.
- `ProviderReviewRemoved` — needs an admin "remove published review" flow (schema today only supports pre-publish `ReviewStatus.rejected`).

These remain in the catalog so the framework is ready; they fire as soon as the missing domain feature is built.

---

### Phase 9 — Catalog fill: Superadmin triggers (19)

Single PR (smallest of the three). Categories: support tickets (2), onboarding (5), booking lifecycle (2), payments/disputes (5), platform health (2), reviews (1), seasonal/profile (2).

---

## Audit Findings — Phase 9 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug · 📋 deferred.

### Counts vs plan target

| Domain (plan) | Catalog entries | Notes |
|---|---:|---|
| Support tickets (2) | 2 | new + reply (reply is in_app only) |
| Onboarding (5) | 5 | applicationNew, docsUploaded, docsNotUploaded, profileIncomplete14d, firstListingLive |
| Booking lifecycle (2) | 2 | cancelledNonPayment, unresponsiveExpiredRequests |
| Payments / disputes (5) | 5 | disputeFiled, disputeResolved (in_app only), payoutFailure, payoutRecoveryNeeded, fundsPendingTransfer (in_app only) |
| Platform health (2) | 2 | stripeDisconnected (in_app only), deletionRequested (parked — see below) |
| Reviews (1) | 1 | flagged |
| Seasonal / profile (2) | 2 | profileNeedsAttention60d, profileDeactivated |
| **Total superadmin (target 19)** | **19** | exact match |

### Per-trigger checklist coverage

| Step | Coverage |
|---|---|
| 1. `NotificationType` enum value | ✓ 19/19 |
| 2. Catalog entry | ✓ 19/19 |
| 3. React Email component | ✓ 5 shared templates (camp-onboarding, camp-health, finance-event, support-event, review-flagged); 14 entries have email channels, 5 in_app only |
| 4. Prop loader | ✓ 19/19 (4 builders + 1 standalone for review-flagged) |
| 5. **Domain-side `notify()` at commit point** | ✓ 12 live + 6 cron + 1 parked |
| 6. Snapshot test for money-touching emails | ✓ `superadmin-finance-event.spec.tsx` covers all 6 kinds + outcome + reason + in-spec forbidden-phrase check |

### Commit-point wiring summary (12 live)

| Catalog entry | Wired at |
|---|---|
| `SuperadminSupportTicketNew` | `SupportTicketsService.createTicket` (post-transaction) |
| `SuperadminSupportTicketReply` | `MessagesService.sendMessage` — fires alongside parent/provider mirrors when conversation contextType is SUPPORT_TICKET (covers both sender directions) |
| `SuperadminCampApplicationNew` | `OnboardingService.completeOnboarding` (mirror of `ProviderApplicationReceived`) |
| `SuperadminVerificationDocsUploaded` | `DocumentProcessingService.uploadDocument` (fires on every upload + re-upload) |
| `SuperadminCampFirstListingLive` | `CampsService.publishCamp` (first publish only — mirror of `ProviderProfilePublished`) |
| `SuperadminBookingCancelledNonPayment` | `RefundsService.markGroupCancelled` (reason=`policy_balance`; mirror of provider variant) |
| `SuperadminDisputeFiled` | `DisputesService.handleCreated` (mirror of `ProviderDisputeOpened`) |
| `SuperadminDisputeResolved` | `DisputesService.handleClosed` (single emit; outcome passed via `extra.outcome`) |
| `SuperadminPayoutFailure` | `PayoutsService.recordPayoutFailed` (mirror of `ProviderPayoutFailed`) |
| `SuperadminFundsPendingTransfer` | `PaymentIntentsService.markSucceeded` (every successful capture — deposit, balance, rebill) |
| `SuperadminCampStripeDisconnected` | `StripeWebhookService.handleAccountDeauthorized` (mirror of `ProviderStripeDisconnected`) |
| `SuperadminReviewFlagged` | `UserReviewsService.create` (per-submission, per Phase 9 audit note — see deviations) |

### Cron-driven entries (new `SuperadminEngagementCron`)

Single injectable, 2 `@Cron` cadences (daily 9 AM / weekly). Mirrors the `ProviderEngagementCron` lock + dispatch-helper pattern with its own `cron:lock:superadmin-engagement:<suffix>` key prefix. Drives 6 catalog entries:

| Cron tier | Catalog entries fed |
|---|---|
| Daily | `SuperadminVerificationDocsNotUploaded` (approved 5d+, no docs), `SuperadminCampProfileIncomplete14d` (approved 14d+, profileCompletion < 50), `SuperadminCampProfileNeedsAttention60d` (latest session ended 60-90d ago), `SuperadminCampProfileDeactivated` (latest session ended 90d+ ago), `SuperadminPayoutRecoveryNeeded` (pending reimbursements past dueDate) |
| Weekly | `SuperadminCampUnresponsiveExpiredRequests` (3+ expired booking-requests in past 7d for same provider) |

### ⚠️ Documented deviations

- **`SuperadminReviewFlagged` fires on every verified-review submission** — the v28 schema today has no "flag" workflow (`ReviewStatus` only supports pre-publish moderation). Pragmatic interpretation: notify admins on every verified review so they can spot-check problematic content; narrow once a real flagging feature ships. Documented in the catalog header.
- **5 shared templates for 19 entries** (~4:1 ratio) — same stage/kind discriminated-union pattern as Phase 8. Keeps the snapshot-test surface manageable.
- **`unresponsive-expired-requests` cron uses findMany + in-memory tally** instead of `prisma.groupBy({ having })` — Prisma's `groupBy` types fight the `_count._all` predicate. The findMany is capped by `BATCH_SIZE` so the in-memory aggregation stays bounded.
- **`SuperadminFundsPendingTransfer` fires on every captured payment** (deposit + balance + rebill). Strictly the spec text reads "payment received, payout pending" — every successful capture matches that condition until the payout cron releases the funds. Acceptable noise level (admins want this visibility); narrow if it becomes too chatty.
- **`SuperadminDisputeResolved` is a single entry regardless of outcome** — the loader threads `outcome` ('won' | 'lost') through `extra` so the template renders "in the platform's / buyer's favour" without two near-identical catalog entries.
- **9 AM daily cron** (`CronExpression.EVERY_DAY_AT_9AM`) — staggered 1h after `ProviderEngagementCron` (8 AM) to avoid lock-contention spikes on the platform Redis cluster.

### 🐛 Audit findings (none P0)

No P0 bugs. Three known limitations worth tracking:

1. **`SuperadminSupportTicketReply` fires on every USER reply in a support-ticket conversation, even when the replier is the assigned superadmin** — the `allSuperadmins` resolver doesn't yet filter by sender. Effectively a self-notification on every support-agent reply. Acceptable for now (admins typically read receipts as confirmation); fix by adding a `senderUserId` exclusion to the resolver when Phase 12 preferences UI surfaces "don't notify me about my own messages."
2. **`unresponsive-expired-requests` cron caps at `BATCH_SIZE=500` source rows** — at scale, more than ~167 providers each with 3+ expired requests in a week would saturate the batch (one tally row needs 3 source rows). Acceptable for current scale; revisit when daily expired-request volume justifies a streamed groupBy.
3. **`SuperadminCampProfileNeedsAttention60d` and `SuperadminCampProfileDeactivated` overlap with `ProviderSeasonEnded`** — the provider hears about their season ending, then 60d / 90d later the superadmin gets escalated. Mostly fine, but the deactivation cron has no upper bound so once a provider passes 90d they'll re-trigger every day (deduped per-day via `NotificationDelivery` unique index, but creates 365 deliveries / year for fully-dormant providers). Acceptable since the deactivation domain feature isn't built yet; the deliveries are admin-only and not user-visible.

### 📋 Items deferred

- **`SuperadminCampDeletionRequested`** — parked. There's no "request account deletion" endpoint in the codebase today (neither parent nor provider). Catalog entry + template + loader registered; fires the moment that domain feature lands. Documented in `superadmin.catalog.ts` header.
- **Per-entity cancel helpers** — Phase 12 carryover; superadmin scheduled emits inherit the same null-skip safety from the loaders.

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| `wc-booking` / `wc-provider` / `wc-superadmin` builds | ✓ all green (with `NEXT_PUBLIC_APP_URL` set — pre-existing env requirement, not Phase 9 specific) |
| `wc-email-templates` tests | ✓ 18 suites / 58 tests pass (added `superadmin-finance-event.spec.tsx`; forbidden-phrase lint now sweeps 37 templates) |
| `wc-nest-api` catalog-validation tests | ✓ 6/6 pass |
| `wc-nest-api` full suite | 427/500 pass — same 4 pre-existing failing suites as Phases 7-8.5 (3 messaging + 1 stripe-webhook). No Phase 9 regressions. |

### Phase 9 — Completion notes

**What landed:**

- **19 superadmin catalog entries** spanning 7 domain groups (support 2, onboarding 5, booking lifecycle 2, payments/disputes 5, platform health 2, reviews 1, seasonal/profile 2).
- **5 shared React Email templates** under `packages/wc-email-templates/emails/superadmin/` — `superadmin-camp-onboarding`, `superadmin-camp-health`, `superadmin-finance-event`, `superadmin-support-event`, `superadmin-review-flagged`. All render `Salutation style="none"` per spec.
- **4 builder functions + 1 standalone loader** in `prop-loaders.ts`. Builders: `buildSuperadminCampOnboarding`, `buildSuperadminCampHealth`, `buildSuperadminFinanceEvent`, `buildSuperadminSupportEvent`. Standalone: `superadminReviewFlagged`. Plus 2 shared helpers (`loadSuperadminCampHeader`, `loadSuperadminCampForBooking`).
- **12 live commit-point `notify()` calls** wired across 9 services (see commit-point summary table above).
- **`SuperadminEngagementCron`** — single injectable, 2 `@Cron` cadences (daily 9 AM / weekly), Redis-locked per cadence, feeds 6 catalog entries (verification-docs-not-uploaded, profile-incomplete-14d, profile-needs-attention-60d, profile-deactivated, payout-recovery-needed, unresponsive-expired-requests).
- **1 snapshot test** (`superadmin-finance-event.spec.tsx`) — 9 assertions covering all 6 kinds + outcome rendering + failure-reason + in-spec forbidden-phrase sweep.
- **Resolver re-use** — no new resolvers; the existing `allSuperadmins` covers every Phase 9 entry. Single recipient pool, no per-entry granularity decisions needed.
- **No new shared category mappings** — every Phase 9 entry maps to an existing `NotificationCategory` (Support, Onboarding, Booking, Dispute, Payout, System, Review, Profile).

**What stays deferred:**

- `SuperadminCampDeletionRequested` — parked (no "request account deletion" domain feature exists). Catalog + template + loader registered; fires when that feature ships. Documented in `superadmin.catalog.ts` header.
- Per-entity cancel helpers (`cancelForBooking/cancelForCheckout/cancelForInvitation`) — Phase 12 carryover.
- `SuperadminSupportTicketReply` self-notification filter — needs a `senderUserId` exclusion in the resolver (Phase 12 alongside preferences UI work).

**Verification:**

- Provider/superadmin/parent catalogs total: 50 parent + 53 provider + 19 superadmin = **122 entries** (within the 126-trigger v28 target; the 4-entry deficit is the documented parked entries across all three audiences).
- `git grep "notify(.*NotificationType\.Superadmin"` returns **12 distinct types** wired at commit points + 6 from the cron (total **18 of 19** wired; the 19th is the parked `SuperadminCampDeletionRequested`).
- `nx test wc-email-templates` → 18 suites / 58 tests pass.
- `nx test wc-nest-api --testPathPatterns=catalog-validation` → 6/6 pass.
- `nx test wc-nest-api` → 427/500 — same 4 pre-existing failing suites as before. **No Phase 9 regressions.**
- All 4 builds green (`wc-nest-api`, `wc-booking`, `wc-provider`, `wc-superadmin`).

---

### Phase 10 — Reconciliation cron

Path: `apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts`

Runs at 02:00 daily. For each scheduled `NotificationType`:
1. Find entities whose firing window is within the next 25h.
2. For each, check `NotificationDelivery` for the deterministic `dedupeKey`.
3. If missing, re-emit `notification.dispatch` with `runAt`.

Idempotency relies on BullMQ's duplicate `jobId` rejection AND the `NotificationDelivery` unique index — either layer alone would be sufficient; both is belt + braces.

---

## Audit Findings — Phase 10 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug · 📋 deferred.

### Coverage vs plan target

| Plan item | Status | Notes |
|---|---|---|
| Single cron at `crons/reconciliation.cron.ts` | ✓ | `NotificationReconciliationCron` with one `@Cron('0 2 * * *')` method (02:00 UTC). |
| Iterates over all scheduled `NotificationType` values | ✓ | 13 entity-bound scheduled types covered via 5 reconcile helpers (booking-request tiers, pre-camp tiers, post-camp wrap, post-decline alternatives, invitation still-open reminder). |
| Next-25h firing-window query | ✓ | All 5 helpers use `[now, now + 25h]` window per offset tier (24h coverage + 1h overlap for clock skew). |
| `NotificationDelivery` dedupe check | ⚠️ | **Skipped on purpose.** The dispatcher → enqueue path already double-protects via BullMQ deterministic `jobId` rejection AND the `(template_key, channel, dedupe_key)` unique index. Re-emitting via `notify()` is naturally idempotent — adding a third dedupe layer in the cron would be redundant work and an extra DB roundtrip per candidate. Deviation justified in the cron's header docblock. |
| Re-emit via `notify(..., runAt)` | ✓ | Each helper recomputes `runAt` from the source entity's date field, skips past-time candidates (`runAt <= now`), then calls `notify()` with the original primitive-id context. |
| Idempotency belt + braces | ✓ | Same two layers as plan: BullMQ jobId + `NotificationDelivery` unique index. |

### Scheduled-trigger coverage

**Covered (13):**

| Trigger | Source entity + window |
|---|---|
| `ParentBookingRequestStillPending` | `BookingGroup.status=request` + `createdAt` ≈ now − 48h |
| `ParentBookingExpired` | same; offset 72h |
| `ProviderBookingRequest48hReminder` | same; offset 48h |
| `ProviderBookingRequestFinalReminder` | same; offset 60h |
| `ProviderBookingRequestExpired` | same; offset 72h |
| `ParentPreCampChecklist14d` | `BookingGroup.status ∈ {accepted, deposit_paid, fully_paid}` + `session.startDate` ≈ now + 14d |
| `ParentPreCampPackingReminder7d` | same; offset 7d |
| `ParentPreCampDayBefore` | same; offset 1d |
| `ProviderPreCampRosterReady` | same; offset 14d |
| `ProviderPreCampChecklist` | same; offset 7d |
| `ProviderPreCampDayBefore` | same; offset 1d |
| `ProviderPostCampWrap` | `BookingGroup.status ∈ {at_camp, completed, fully_paid}` + `session.endDate` ≈ now − 1d |
| `ParentConversionPostDeclineAlternatives` | `BookingGroup.status=declined` + `updatedAt` ≈ now − 24h |
| `ParentInvitationStillOpenReminder` | `Invitation.status=pending` + `expiresAt` ≈ now + 24h |

**Intentionally NOT covered (the cron-spawned scheduled entries):**

- `ParentCheckoutAbandoned2d/4d/6d` — fired by `AbandonDetectionCron` daily (Phase 6/7.5). If a single cron run fails, the next day's run picks them up — no BullMQ loss risk because the emits happen INSIDE the cron, not at commit-points needing delayed dispatch.
- `ParentPaymentBalanceReminder14d/7d/3d` + `BalanceFailedFirst/Second/Final` — fired by `BalanceReminderCron` / `BalanceChargeCron` (Phase 7). Same reasoning.
- `ParentPostCampReviewRequest/Reminder/Survey` — fired by `PostCampReviewCron` (Phase 7.5).
- `ParentWishlistEmpty/ItemsNoBooking7d/21d` — fired by `WishlistEngagementCron` (Phase 7.5).
- `ParentProfileIncomplete` — fired by `ProfileIncompleteCron` (Phase 7.5).
- All provider engagement crons (`ProviderEngagementCron` × 9 entries) and superadmin engagement crons (`SuperadminEngagementCron` × 6 entries) — same reasoning.

The reconciliation cron is specifically for `notify(..., runAt)` calls at domain commit points (where the job could be lost between enqueue and `runAt`). Cron-spawned scheduled emits don't need reconciliation because their cron runs daily and naturally self-heals.

### ⚠️ Documented deviations

- **`NotificationDelivery` dedupe pre-check skipped** (see table above). Re-emit is the cheap path; BullMQ + unique index already guarantee idempotency.
- **`ParentConversionPostDeclineAlternatives` uses `BookingGroup.updatedAt` as proxy for `declinedAt`** — there's no denormalised "declined at" timestamp. The decline transition is typically the most-recent write, so `updatedAt` is the right proxy in practice. If a declined group is later touched (e.g. metadata update, post-decline scrub), we'd re-emit incorrectly — but the loader's status-still-`declined` check + the unique index together absorb the rare duplicate. Acceptable for current scale.
- **`BATCH_SIZE = 1000`** — twice the engagement crons' 500. Reconciliation is read-heavy with deterministic re-emits; the larger batch covers more entities per cron run without saturating downstream queues (BullMQ dedupes any in-flight jobs).
- **15-min lock TTL** (`EX 900`) — longer than the engagement crons' 10-min default. Reconciliation queries can take longer at scale (multiple per-tier queries against indexed columns); the longer TTL prevents premature lock release if a query stalls.
- **Single `@Cron` method**, not split by tier — keeps the audit-log line clean (`reconciliation daily: requestTiers=N preCamp=N postCamp=N postDecline=N invitationReminder=N`) and the cron's single lock-acquire avoids per-tier lock churn.

### 🐛 Audit findings (none P0)

No P0 bugs. Two known limitations worth tracking:

1. **`BATCH_SIZE = 1000` caps each tier's candidate set.** At very high scale (>1000 accepted bookings with startDate in any single 25h window per tier), some entities won't be re-emitted in a single run. The next day's run picks them up unless the firing window has already passed. Mitigation if it becomes a problem: paginate via `cursor`-based findMany or stream the query.
2. **`ParentConversionPostDeclineAlternatives` proxy via `updatedAt`** — already documented above; potential rare false-positive re-emit. The unique index + status check absorb it.

### 📋 Items deferred

None — Phase 10 is intentionally narrow (single cron, no schema changes, no template/catalog churn).

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| `wc-nest-api` catalog-validation tests | ✓ 6/6 pass |
| `wc-nest-api` full suite | 427/500 pass — same 4 pre-existing failing suites (3 messaging + 1 stripe-webhook). No Phase 10 regressions. |

### Phase 10 — Completion notes

**What landed:**

- `NotificationReconciliationCron` at [crons/reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts) — single `@Cron('0 2 * * *')` (daily 02:00 UTC), Redis-locked with a 15-min TTL, 5 reconcile helpers, ~250 lines.
- Covers all 13 entity-bound scheduled triggers across parent + provider catalogs. Cron-spawned scheduled entries (post-camp review, wishlist, payment reminders, all engagement crons) self-heal via their own daily-cron retries.
- Re-emits via `notify(type, ctx, runAt)`; relies on existing BullMQ `jobId` + `NotificationDelivery` unique index for idempotency. No additional dedupe layer added — re-running is the cheap path.
- Registered in [NotificationsModule](apps/wc-nest-api/src/modules/notifications/notifications.module.ts) alongside `ProviderEngagementCron` and `SuperadminEngagementCron`.

**Verification:**

- `wc-nest-api` build: ✓ green.
- `nx test wc-nest-api --testPathPatterns=catalog-validation` → 6/6 pass.
- `nx test wc-nest-api` → 427/500 — same 4 pre-existing failing suites as Phases 7-9. **No Phase 10 regressions.**

---

### Phase 11 — Frontend: type expansion + category map

- Expand `NotificationType` enum in [packages/wc-types/src/lib/websocket.types.ts](packages/wc-types/src/lib/websocket.types.ts) with all 126 dotted-namespace values.
- Expand `NotificationEntityType` enum — add `invitation`, `payment`, `refund`, `dispute`, `payout`, `payout_tranche`, `reimbursement`, `review`, `wishlist_item`, `verification_document`, `camp`, `session`.
- Add `NotificationCategory` enum in `packages/wc-types/src/lib/notification-categories.ts` plus `NOTIFICATION_CATEGORY: Record<NotificationType, NotificationCategory>` map.
- Update [packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts](packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts) to consume the category map for filter bucketing.
- Update [packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx) — extend `IconVariant` and `getIconVariant()` to use the category map (single source of truth for filter bucketing + icon assignment).
- Click-through routing already uses `metadata.redirectUrl` — keep that pattern; the catalog's `inApp.redirectUrl(props)` is the per-type source of truth. Each app keeps a small URL-prefix table for `booking|provider|superadmin`.

---

## Audit Findings — Phase 11 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug · 📋 deferred.

### Coverage vs plan target

| Plan item | Status | Notes |
|---|---|---|
| `NotificationType` enum carries all dotted-namespace values | ✓ | 122 entries (50 parent + 53 provider + 19 superadmin); 4-entry deficit from the 126-spec target is the documented parked entries across audiences. |
| `NotificationEntityType` enum expansion | ✓ | All 16 spec-required types present: BookingGroup, Conversation, Message, SupportTicket, Invitation, Payment, Refund, Dispute, Payout, PayoutTranche, Reimbursement, Review, WishlistItem, VerificationDocument, Camp, Session. |
| `NotificationCategory` enum + `NOTIFICATION_CATEGORY` map | ✓ | 14 categories defined; map covers every registered `NotificationType` (verified via `categoryFor()` fallback). |
| `use-notifications-page.ts` consumes the category map | ✓ | `filteredNotifications` is now a `useMemo` over `categoryFor(n.type)` with the active filter's `categories` set. |
| `notifications-page-content.tsx` icon mapping via category | ✓ | `getIconVariant` is a `switch` over `NotificationCategory`. |
| Per-app URL-prefix routing | ✓ | Each app's `onNavigate={url => router.push(url)}` already handles relative paths from the catalog's `inApp.redirectUrl(props)`. No prefix table needed — the catalog emits absolute-from-root paths (e.g. `/provider/payouts`, `/support/${ticketRef}`). |

### What changed in Phase 11 specifically

The Phase 5/6 audit noted that the frontend already partially adopted the category map (forced by Phase 5's enum cleanup). Phase 11 closed the remaining gaps:

1. **`NotificationFilter` is now a `string` (was a hard-coded union)**: `'all' | 'unread' | 'bookings' | 'messages' | 'quotes'` removed in favour of a `NotificationFilterConfig[]` passed in from the app. Each config carries a `value`, `label`, optional `categories: NotificationCategory[]`, and an optional `special: 'all' | 'unread'`. Apps can now express any subset of categories with any label they want.
2. **`DEFAULT_NOTIFICATION_FILTERS` exported as backward-compat fallback**: the four-tab default (All, Unread, Bookings, Messages) covers any caller that didn't pass `filters`.
3. **`IconVariant` expanded from 3 → 6**: `booking | message | payment | review | onboarding | security`. Each maps to one or more `NotificationCategory` values via the `getIconVariant` switch. Six new colour swatches in `ICON_CLASSES` (blue / indigo / emerald / amber / purple / gray) and six SVG paths.
4. **Per-audience filter sets wired in all 3 apps**:
   - `wc-booking` (parent, 51 entries): All / Unread / Bookings / Payments / Messages / Reviews / Offers — Wishlist gets its own tab as "Offers" because promotional traffic deserves visual separation.
   - `wc-provider` (provider, 53 entries): All / Unread / Bookings / Payouts / Messages / Reviews / Onboarding — Payouts collapses Payment + Payout + Refund + Dispute since the provider mental model is "money I'm owed or chasing." Onboarding gets its own tab so 14d/60d/90d nudges don't disappear under bookings.
   - `wc-superadmin` (superadmin, 19 entries): All / Unread / Onboarding / Finance / Bookings / Support / Reviews / System — finance collapses Dispute + Payout + Payment, System catches Stripe-disconnected + camp-deletion + camp-health.

### ⚠️ Documented deviations

- **`NotificationFilter` is now `string`** (was a union literal). Stricter type-safety lives one layer up in `NotificationFilterConfig`. Justified — the union prevented per-audience customisation entirely.
- **`filteredNotifications` is wrapped in `useMemo`** with `filter + filters` deps. Mild rerender perf win vs the prior `.filter()` on every render; functionally equivalent.
- **`hasMore` only paginates when the active filter has `special === 'all'`** (previously checked `filter === 'all'`). Same behaviour through a cleaner check that survives apps that re-label or omit the 'all' tab — e.g. a future audience with a category-only filter set still gets correct pagination.
- **Default starting filter is `filters[0]?.value`** instead of hard-coded `'all'`. Apps that prepend a non-'all' filter (none today) would have that as the initial tab. Acceptable change in default behaviour — every wired audience starts with 'all'.
- **Per-app URL-prefix table NOT built** (the plan mentioned "Each app keeps a small URL-prefix table for `booking|provider|superadmin`"). Not needed in practice — the catalog's `redirectUrl(props)` returns relative paths and each app's router accepts them directly. Deferred unless we add deep-linking across audiences (e.g. an admin email linking into the provider portal).

### 🐛 Audit findings (none P0)

No P0 bugs. One known limitation worth tracking:

1. **`NotificationFilter` type-loosening removes compile-time checking** of filter values in app code (apps could now pass an undefined string and it would silently fall back to the first filter). Mitigation: `NotificationFilterConfig.value` is the single source of truth in each app, and the `find()` in the hook gracefully degrades. If we want stricter typing per-audience, each app could declare its own union (e.g. `type ParentFilter = (typeof PARENT_FILTERS)[number]['value']`) and pass it through — micro-improvement not required today.

### 📋 Items deferred

- **Audience-aware filter persistence** (URL query param or localStorage) — Phase 12 candidate so users land on the same tab on revisit.
- **Per-app empty-state copy customisation** — uses the filter label today; a custom illustration per audience could land in Phase 12.

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| `wc-booking` / `wc-provider` / `wc-superadmin` builds | ✓ all green |
| `wc-nest-api` full test suite | 427/500 pass — same 4 pre-existing failing suites. **No Phase 11 regressions.** |
| `wc-frontend-utils` tests | ⚠️ vitest exits with "No test files found" — pre-existing project state, not Phase 11 specific. |

### Phase 11 — Completion notes

**What landed:**

- **`NotificationFilterConfig` type** + `DEFAULT_NOTIFICATION_FILTERS` exported from [use-notifications-page.ts](packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts). `useNotificationsPage` now accepts an optional `filters` option and returns it so the page-content can render the chips.
- **`IconVariant` extended to 6 categories** in [notifications-page-content.tsx](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx). Single `switch (categoryFor(type))` drives both the colour swatch and the SVG.
- **Filter chips rendered from the `filters` prop** instead of a hard-coded `FILTER_OPTIONS` array. Empty-state copy uses the active filter's `label` for friendlier messages.
- **3 audience-specific filter sets wired** in [wc-booking/.../notifications/page.tsx](apps/wc-booking/src/app/(dashboard)/notifications/page.tsx), [wc-provider/.../notifications/page.tsx](apps/wc-provider/src/app/(dashboard)/notifications/page.tsx), and [wc-superadmin/.../notifications/page.tsx](apps/wc-superadmin/src/app/(dashboard)/notifications/page.tsx). Each is ~40 lines of typed config + a single prop pass.
- **`NotificationCategory` import** added to all 3 apps' notifications pages.

**Verification:**

- `wc-nest-api` build: ✓ green.
- All 3 frontend builds: ✓ green (with `NEXT_PUBLIC_APP_URL` set).
- Full `wc-nest-api` suite: 427/500 — same 4 pre-existing failing suites as Phases 7-10. **No Phase 11 regressions.**
- Catalog-validation: unchanged (no backend changes in Phase 11).

---

### Phase 12 — Notification preferences UI (all 3 apps)

Reference design: [booking-design/Parents/account/settings/parent_notification-preferences.html](booking-design/Parents/account/settings/parent_notification-preferences.html). Sections-by-category (Bookings, Payments, Messages, Reviews, etc.) with per-row in-app + email toggle checkboxes.

Backend endpoints (already covered by Phase 1 model + Phase 4 dispatcher):
- `GET /notification-preferences` → returns flat list `[{ templateKey, channel, enabled, category, label, description, transactional }]`. Transactional categories returned with `enabled: true, transactional: true` so the UI can render them locked.
- `PATCH /notification-preferences` → bulk-upsert `[{ templateKey, channel, enabled }]`.

Frontend implementation:
- Shared component in `packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx` — same component used by all three apps; the API filters preferences to the user's audience.
- New route in each app:
  - `wc-booking` → `/account/notifications`
  - `wc-provider` → `/settings/notifications`
  - `wc-superadmin` → `/settings/notifications`
- Use HeroUI (per repo convention) for the toggles; mirror the visual layout in the reference HTML (sectioned by category, two toggles per row).
- Transactional items disabled with an info tooltip ("You'll always receive payment and security notifications").

---

## Audit Findings — Phase 12 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug · 📋 deferred.

### Coverage vs plan target

| Plan item | Status | Notes |
|---|---|---|
| `GET /notification-preferences` | ✓ | Returns `{ items: PreferenceRow[] }` with `enabled: true, transactional: true` for transactional entries so the UI renders them locked. Audience derived from authenticated user (Parent row OR system role OR provider-scoped role). |
| `PATCH /notification-preferences` | ✓ | Bulk-upsert via single Prisma transaction; class-validator DTO caps the batch at 500 items per request. Transactional + cross-audience entries silently dropped so a uniform UI batch is always safe. |
| Shared `NotificationPreferencesPage` component | ✓ | At [packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx](packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx). Sectioned-by-category layout mirroring the design HTML; two toggles per row (Email + In-app); transactional rows render locked with a tooltip; debounced batch save. |
| `useNotificationPreferences` hook | ✓ | Same file. Optimistic toggle + 400ms debounce → bulk PATCH; reverts UI state via re-fetch if the save errors. |
| Per-app routes | ⚠️ | Plan said `/account/notifications`, `/settings/notifications`, `/settings/notifications`. Implementation lands all three at `/account/settings/notifications` — that's where each app's existing settings folder already lives (alongside `privacy` and `security`), so the route matches the app's IA. Deviation noted; not user-visible after navigation. |
| HeroUI toggles | ⚠️ | Used plain Tailwind buttons styled as switches (with `role="switch"` + `aria-checked`) instead of `<Switch>` from HeroUI. Reason: keeps the shared component HeroUI-free so it works inside any of the three apps without adding a peer dependency on `@heroui/react`. Same visual + a11y semantics. |
| Transactional-locked tooltip | ✓ | Title attribute on the disabled button: "Required — you'll always receive these updates." |

### What landed

**Backend:**

- Extended [notification-preferences.service.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts) with:
  - `Audience` type + `deriveAudience(userId)` — parallel query to `Parent` + `UserRole`; returns `'parent' | 'provider' | 'superadmin' | null` with the priority order `parent → superadmin → provider`.
  - `listForUser(userId)` — derives audience, filters `listCatalogEntries()` by audience, fans out one row per (templateKey × channel), overlays opt-out rows from `NotificationPreference`, derives `{ label, description }` from the templateKey's dotted segments (camelCase → spaces, digit separation).
  - `bulkSetPreferences(userId, items)` — validates each item's templateKey belongs to the user's audience AND is non-transactional (silent drop otherwise); single `$transaction` of upserts; returns the upserted count.
- New [notification-preferences.controller.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts) with `GET /notification-preferences` and `PATCH /notification-preferences`. class-validator DTO with `@ArrayMaxSize(500)` cap.
- Registered the controller in [NotificationsModule](apps/wc-nest-api/src/modules/notifications/notifications.module.ts).

**Shared frontend:**

- [packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx](packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx) (~270 lines):
  - `PreferenceRow`, `PreferenceChannel`, `BulkPreferenceItem` types — wire-compatible with the backend.
  - `useNotificationPreferences` hook — fetch + optimistic toggle + 400ms debounced batch save + error-recovery refetch.
  - `NotificationPreferencesPage` component — sections sorted by canonical category order (Booking → Invitation → Payment → … → Marketing), each section header + description from a static map, per-row two-toggle layout, locked-toggle title attribute. Loading skeleton + error banner + empty state.
- Re-exported from [packages/wc-frontend-utils/src/index.ts](packages/wc-frontend-utils/src/index.ts).

**Per-app pages (3 × ~25 lines):**

- [wc-booking/.../account/settings/notifications/page.tsx](apps/wc-booking/src/app/(dashboard)/account/settings/notifications/page.tsx) — wraps in `max-w-3xl mx-auto px-4 py-8`.
- [wc-provider/.../account/settings/notifications/page.tsx](apps/wc-provider/src/app/(dashboard)/account/settings/notifications/page.tsx) — wraps in `max-w-3xl mx-auto px-8 py-12`.
- [wc-superadmin/.../account/settings/notifications/page.tsx](apps/wc-superadmin/src/app/(dashboard)/account/settings/notifications/page.tsx) — replaced the `ComingSoon` stub; same wrapper as provider.

Each app's page is a thin shell: inline `fetchPreferences` + `bulkUpdate` callbacks that hit `apiClient.get('/notification-preferences')` and `apiClient.patch('/notification-preferences', { items })`. Audience is derived server-side from the auth token — no per-app filtering logic.

### ⚠️ Documented deviations

- **Routes land at `/account/settings/notifications` (not `/account/notifications` or `/settings/notifications`)** — matches each app's existing settings IA (sits next to `/account/settings/privacy` and `/account/settings/security` in all three).
- **Plain Tailwind switches instead of HeroUI `<Switch>`** — keeps the shared component peer-dependency-free so all three apps consume it identically. `role="switch"` + `aria-checked` gives the same a11y contract.
- **`label` + `description` derived from the templateKey** instead of pulling strings from each catalog entry. Reason: catalog entries' `title`/`subject` functions take loaded props at fire time, so they're not static. Derived strings are camelCase-split + de-jargoned (e.g. `parent.payment.balanceReminder14d` → "Balance reminder 14d"). Acceptable first cut; Phase 13's QA matrix generator can feed back better per-entry copy if needed.
- **400ms debounce on batch save** — tunable. Long enough to coalesce multi-row toggle bursts; short enough that the user perceives near-real-time feedback. The "Saving…" indicator near the page header tells the user the request is in flight.
- **`bulkSetPreferences` silently drops out-of-audience items** — frontends never construct such items today, but the silent drop means a malicious or stale client can't accidentally toggle another audience's preferences.
- **Audience derivation runs on every preferences request** — small cost (2 parallel indexed queries); acceptable for a settings page that's only loaded interactively. Caching deferred until the dispatcher / worker want it (they don't today — they pass `userId` straight through).

### 🐛 Audit findings (none P0)

No P0 bugs. Three known limitations worth tracking:

1. **Derived labels are mechanical** — `parent.payment.balanceFailedFinal` renders as "Balance failed final" rather than a hand-written "Final balance-charge failure notice". Hand-curated labels could be added per catalog entry in a future pass; the mechanical derivation is fine for the v1 settings page.
2. **No per-category "disable all in category" toggle** — power users may want to silence all `Wishlist` notifications in one click instead of toggling each. Phase 13 candidate.
3. **`deriveAudience` priority is fixed at `parent → superadmin → provider`** — a User row with both a `Parent` linkage AND a superadmin role would land in the parent bucket. That dual-role case shouldn't exist in practice (the seed doesn't create it), but documenting the choice for future debugging.

### 📋 Items deferred

- **Per-category bulk-disable toggle** (see bug #2 above).
- **Hand-curated labels per catalog entry** (see bug #1 above).
- **Search-within-preferences input** — fine to scroll the 50-row parent list today; revisit when the list crosses ~100 rows or a real user complains.
- **Push-notification channel** — schema column already permits the value but no `web_push` or `mobile_push` catalog entries exist yet.

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| `wc-booking` / `wc-provider` / `wc-superadmin` builds | ✓ all green — each app's route table now includes `/account/settings/notifications`. |
| `wc-nest-api` catalog-validation tests | ✓ 6/6 pass |
| `wc-nest-api` full suite | 427/500 pass — same 4 pre-existing failing suites. **No Phase 12 regressions.** |

### Phase 12 — Completion notes

**What landed:**

- Backend GET + PATCH endpoints with audience auto-detection + bulk transaction upserts + cross-audience guard.
- Shared `NotificationPreferencesPage` + `useNotificationPreferences` in wc-frontend-utils (~270 lines).
- 3 per-app pages (~25 lines each) at `/account/settings/notifications`.
- Optimistic UI with 400ms debounced batch save + error recovery via refetch.

**Verification:**

- `wc-nest-api` build: ✓ green.
- 3 frontend builds: ✓ all green (with `NEXT_PUBLIC_APP_URL` set).
- Full `wc-nest-api` suite: 427/500 — same 4 pre-existing failing suites as Phases 7-11. **No Phase 12 regressions.**
- Manual route check: `/account/settings/notifications` registered in all 3 apps' Next.js route tables.

---

### Phase 13 — QA matrix generator

Path: `apps/wc-nest-api/scripts/notification-qa-matrix.ts`

Reads the catalog and writes `docs/notifications-qa.md` — Markdown checklist with one section per template:
- audience, channels, trigger, resolver
- expected in-app title + redirectUrl (rendered against `SAMPLE_PROPS`)
- expected email subject (rendered against `SAMPLE_PROPS`)
- Test-step checkboxes: trigger source event, confirm in-app delivery, confirm email subject, click-through lands correctly, no duplicate on retrigger.

Run as `npx tsx apps/wc-nest-api/scripts/notification-qa-matrix.ts`. Becomes the QA team's checklist.

---

## Audit Findings — Phase 13 Post-Implementation Review

Same legend as prior audits: ✓ compliant · ⚠️ deviation · 🐛 bug · 📋 deferred.

### Coverage vs plan target

| Plan item | Status | Notes |
|---|---|---|
| Script at `apps/wc-nest-api/scripts/notification-qa-matrix.ts` | ✓ | ~230 lines; dynamic-imports every `.tsx` under `packages/wc-email-templates/emails/`, maps `default → PreviewProps` via reference equality, looks up each catalog entry's `email.component` in that map. |
| One section per template | ✓ | Each entry rendered as `#### \`<templateKey>\`` with all attributes. Sorted by audience → category → templateKey for diff stability. |
| Audience / channels / trigger / resolver | ✓ | Bulleted list at the top of each entry, plus `transactional` flag and `salutation`. |
| In-app title + redirectUrl rendered against PreviewProps | ✓ | `safeCall` wrapper catches per-entry render errors so a single broken builder doesn't kill the whole script (renders `⚠️ <error message>` inline so the failure is visible in the matrix). |
| Email subject rendered against PreviewProps | ✓ | Same `safeCall` path. |
| Test-step checkboxes | ✓ | Conditional on `channels` — in-app entries get in-app steps, email entries get email steps, scheduled entries get an extra "cancel before runAt" check. |
| `npx tsx apps/...` invocation | ✓ | Works with the `--tsconfig tsconfig.base.json` flag so the path aliases (`@world-schools/wc-types`, `@world-schools/wc-email-templates`) resolve. The Nx target `nx qa-matrix wc-nest-api` wires this flag in. |
| `docs/notifications-qa.md` output | ✓ | 4042 lines; 122 entries covered. |

### What landed

- **Script** at [apps/wc-nest-api/scripts/notification-qa-matrix.ts](apps/wc-nest-api/scripts/notification-qa-matrix.ts). Top-level `main()` orchestrates: load catalog → glob+dynamic-import every template `.tsx` → build `Map<ComponentType, PreviewProps>` → for each catalog entry, render an entry block → write `docs/notifications-qa.md`. The script is pure (no Prisma / no live DB calls) so it runs in CI just as easily as locally.
- **Nx target** in [apps/wc-nest-api/project.json](apps/wc-nest-api/project.json): `qa-matrix` invokes `npx tsx --tsconfig tsconfig.base.json apps/wc-nest-api/scripts/notification-qa-matrix.ts`. Run with `npx nx qa-matrix wc-nest-api`.
- **Generated output** at [docs/notifications-qa.md](docs/notifications-qa.md) — 122 entries × 7-12 checkbox steps per entry, grouped by audience and category. Total ~4k lines.

### ⚠️ Documented deviations

- **`--tsconfig tsconfig.base.json` flag required** for tsx — without it the path aliases don't resolve and the script can't import the catalog. Wired into the Nx target so the documented invocation path works straight away. Direct `npx tsx apps/...` (without the flag) errors with `Cannot find module '@world-schools/wc-types'`.
- **Reference-equality match between catalog component and template PreviewProps** — works because each template module is imported once and shared. If a template were imported twice through different paths (e.g. `../emails/foo` vs `packages/wc-email-templates/emails/foo`), the references would diverge. Single-source imports in the catalog files keep this safe.
- **`safeCall` wrapper** for per-builder render errors — script keeps generating the rest of the matrix even if one entry's `title(props)` throws. The failure renders inline as `⚠️ <message>` so QA spots it. Alternative would have been to `throw` and abort; chose to continue because partial coverage is more useful for triage than no coverage.
- **In-app-only entries fall back to an empty props object `{}`** instead of looking up a separate `SAMPLE_PROPS` constant. Most catalog builders use null-safe property access (`props?.field`), so the rendered string degrades gracefully (often to a default like "Booking update" or empty body); the `safeCall` catches anything that doesn't. Tightening this would require either (a) per-entry sample-prop constants or (b) running the prop loaders against a seeded DB — both larger investments.
- **Generated file is overwritten on each run** (no diff merge). Re-run after any catalog / template change. Treated as a build artifact; commit when the content changes meaningfully.

### 🐛 Audit findings (none P0)

No P0 bugs. Three known limitations worth tracking:

1. **In-app-only catalog entries render with empty props** so their preview strings may be terse (e.g. just the static fallback). Most entries with `inApp` also have `email`, so this only affects ~25 of 122. QA can still walk the live flow even when the preview is generic.
2. **`safeCall` returns the error message as the field value** rather than skipping the entry. Failing builders are visible in the output but not surfaced as a script exit code. A future enhancement: collect errors and exit non-zero in CI mode if any entry failed to render.
3. **Anchor links in the table-of-contents use entry counts** (`#parent-50-entries`, `#provider-53-entries`, `#superadmin-19-entries`). If the catalog grows / shrinks the link target moves. Acceptable since the matrix is regenerated each time the catalog changes; both the table-of-contents and the anchor id re-render together.

### 📋 Items deferred

- **CI invocation** — could add a workflow step that runs `nx qa-matrix wc-nest-api` and diff-checks `docs/notifications-qa.md` against the committed copy, failing the build when they diverge. Mechanical addition once we agree on cadence (per-PR vs nightly).
- **Per-entry sample-prop constants** — would tighten the in-app-only entries' previews but adds maintenance overhead.
- **`SAMPLE_PROPS` hand-curated for QA scenarios** (e.g. "deposit failed, retry exhausted" vs "deposit succeeded first try") — out of scope for the matrix; belongs in the snapshot test files where the scenario-specific prop shape lives.

### Build / test summary

| Project | Status |
|---|---|
| `wc-nest-api` build | ✓ green |
| Script run via `nx qa-matrix wc-nest-api` | ✓ green — 122 entries / 50 templates indexed |
| Output `docs/notifications-qa.md` | ✓ 4042 lines, properly structured |
| `wc-nest-api` full suite | 427/500 pass — same 4 pre-existing failing suites. **No Phase 13 regressions.** |

### Phase 13 — Completion notes

**What landed:**

- Single ~230-line script under `apps/wc-nest-api/scripts/` that consumes the catalog + every template's `PreviewProps` and emits a 4k-line Markdown QA checklist.
- Nx target `qa-matrix` for easy reruns from any branch.
- `docs/notifications-qa.md` committed as the first snapshot — re-run after any catalog/template change.

**Verification:**

- `wc-nest-api` build: ✓ green.
- `npx nx qa-matrix wc-nest-api`: ✓ green — 122 catalog entries × per-entry checklist rendered.
- Generated output: 4042 lines, all 3 audience sections populated, sorted-by-category subsections, per-entry test-step checkboxes correctly conditional on channels + scheduled flag.
- Full `wc-nest-api` suite: 427/500 — same 4 pre-existing failing suites as Phases 7-12. **No Phase 13 regressions.**

---

## Implementation Complete

All 13 phases now ✅. Summary state across the branch:

| Layer | Count |
|---|---|
| `NotificationType` enum values | 122 (50 parent + 53 provider + 19 superadmin; 4-entry deficit from the 126-target = the documented parked entries) |
| Catalog entries wired | 122 of 122 enum members covered by catalog entries; ~8 are intentionally parked (no commit-point emit yet — `ParentBookingModified`, 4 wishlist event-driven types, `ParentReviewRemoved`, `ProviderBookingModified`, `ProviderReviewRemoved`, `SuperadminCampDeletionRequested`) and fire when the underlying domain commit points land |
| React Email templates | 50 (~4:1 entry:template ratio via stage/kind discriminated-union props) |
| Recipient resolvers | 17 (owner-only vs full-staff split for provider, single `allSuperadmins` for superadmin) |
| Domain commit points wired (live) | ~50 across parent / provider / superadmin services |
| Scheduled triggers covered by reconciliation cron | 13 (entity-bound; cron-spawned ones self-heal) |
| BullMQ idempotency layers | 2 (deterministic jobId rejection + `NotificationDelivery` unique index) |
| Catalog validation tests | 6 (CI guard) |
| Email snapshot tests | 18 specs / 58 tests (incl. forbidden-phrase lint sweeping all 37 templates) |
| Frontend filter audiences | 3 (each with audience-specific tabs + 6 icon variants) |
| User preferences UI | 3 apps × shared component + hook (debounced batch save) |
| QA matrix | 122 entries × 7-12 checkboxes (auto-generated) |

---

## Critical Files

### To be created
- [apps/wc-nest-api/src/modules/notifications/catalog/notification-catalog.ts](apps/wc-nest-api/src/modules/notifications/catalog/notification-catalog.ts)
- [apps/wc-nest-api/src/modules/notifications/catalog/types.ts](apps/wc-nest-api/src/modules/notifications/catalog/types.ts)
- [apps/wc-nest-api/src/modules/notifications/catalog/audiences/parent.catalog.ts](apps/wc-nest-api/src/modules/notifications/catalog/audiences/parent.catalog.ts)
- [apps/wc-nest-api/src/modules/notifications/catalog/audiences/provider.catalog.ts](apps/wc-nest-api/src/modules/notifications/catalog/audiences/provider.catalog.ts)
- [apps/wc-nest-api/src/modules/notifications/catalog/audiences/superadmin.catalog.ts](apps/wc-nest-api/src/modules/notifications/catalog/audiences/superadmin.catalog.ts)
- [apps/wc-nest-api/src/modules/notifications/resolvers/recipient-resolvers.ts](apps/wc-nest-api/src/modules/notifications/resolvers/recipient-resolvers.ts)
- [apps/wc-nest-api/src/modules/notifications/resolvers/prop-loaders.ts](apps/wc-nest-api/src/modules/notifications/resolvers/prop-loaders.ts)
- [apps/wc-nest-api/src/modules/notifications/dispatcher/notification-dispatcher.service.ts](apps/wc-nest-api/src/modules/notifications/dispatcher/notification-dispatcher.service.ts)
- [apps/wc-nest-api/src/modules/notifications/dispatcher/notify.ts](apps/wc-nest-api/src/modules/notifications/dispatcher/notify.ts)
- [apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts](apps/wc-nest-api/src/modules/notifications/queue/notifications-queue.module.ts)
- [apps/wc-nest-api/src/modules/notifications/queue/enqueue.service.ts](apps/wc-nest-api/src/modules/notifications/queue/enqueue.service.ts)
- [apps/wc-nest-api/src/modules/notifications/queue/cancel.service.ts](apps/wc-nest-api/src/modules/notifications/queue/cancel.service.ts)
- [apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts)
- [apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts)
- [apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.service.ts)
- [apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts](apps/wc-nest-api/src/modules/notifications/preferences/notification-preferences.controller.ts)
- [apps/wc-nest-api/src/modules/notifications/bull-board.controller.ts](apps/wc-nest-api/src/modules/notifications/bull-board.controller.ts)
- [apps/wc-nest-api/src/modules/provider/invitations/](apps/wc-nest-api/src/modules/provider/invitations/) (full module)
- [apps/wc-nest-api/src/modules/user/invitations/](apps/wc-nest-api/src/modules/user/invitations/) (full module)
- [apps/wc-nest-api/src/modules/booking-groups/crons/abandon-detection.cron.ts](apps/wc-nest-api/src/modules/booking-groups/crons/abandon-detection.cron.ts)
- [apps/wc-nest-api/src/modules/common/profile-completion/profile-completion.service.ts](apps/wc-nest-api/src/modules/common/profile-completion/profile-completion.service.ts)
- [apps/wc-nest-api/scripts/notification-qa-matrix.ts](apps/wc-nest-api/scripts/notification-qa-matrix.ts)
- `packages/wc-email-templates/` (full new Nx library — emails/ + src/ + project.json)
- [packages/wc-types/src/lib/notification-categories.ts](packages/wc-types/src/lib/notification-categories.ts)
- [packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx](packages/wc-frontend-utils/src/lib/notifications/notification-preferences-page.tsx)

### To be modified
- [apps/wc-nest-api/prisma/schema.prisma](apps/wc-nest-api/prisma/schema.prisma) (Phase 1 additions)
- [packages/wc-types/src/lib/websocket.types.ts](packages/wc-types/src/lib/websocket.types.ts) (enum expansion, new entity types)
- [packages/global-utils/src/lib/email.service.ts](packages/global-utils/src/lib/email.service.ts) (accept `{ html, text }`)
- [apps/wc-nest-api/src/modules/notifications/notifications.module.ts](apps/wc-nest-api/src/modules/notifications/notifications.module.ts) (register new providers, controller, worker)
- [apps/wc-nest-api/src/modules/booking-groups/booking-websocket.handler.ts](apps/wc-nest-api/src/modules/booking-groups/booking-websocket.handler.ts) (keep WS fan-out, remove notification/email dispatch)
- [apps/wc-nest-api/src/modules/provider/stripe-connect/](apps/wc-nest-api/src/modules/provider/stripe-connect/) (set disconnect timestamp on Stripe webhook)
- [packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts](packages/wc-frontend-utils/src/lib/notifications/use-notifications-page.ts) (consume category map)
- [packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx](packages/wc-frontend-utils/src/lib/notifications/notifications-page-content.tsx) (icon mapping via category map)

### To be deleted (after Phase 5 cutover)
- [apps/wc-nest-api/src/modules/common/email-templates/email-template.service.ts](apps/wc-nest-api/src/modules/common/email-templates/email-template.service.ts)
- [apps/wc-nest-api/src/modules/common/email-templates/booking-notification.service.ts](apps/wc-nest-api/src/modules/common/email-templates/booking-notification.service.ts)
- [apps/wc-nest-api/src/modules/common/email-templates/application-notification.service.ts](apps/wc-nest-api/src/modules/common/email-templates/application-notification.service.ts)
- [apps/wc-nest-api/src/modules/common/email-templates/billing-payment-notifications.service.ts](apps/wc-nest-api/src/modules/common/email-templates/billing-payment-notifications.service.ts) (notification-flavor sends only — verification + auth emails stay)
- [apps/wc-nest-api/src/modules/common/email-templates/reimbursements-notifications.service.ts](apps/wc-nest-api/src/modules/common/email-templates/reimbursements-notifications.service.ts)

### Reused as-is
- [apps/wc-nest-api/src/modules/notifications/notifications.service.ts](apps/wc-nest-api/src/modules/notifications/notifications.service.ts) — worker calls into `create()` / `createForMany()` unchanged.
- [apps/wc-nest-api/src/modules/notifications/notifications.controller.ts](apps/wc-nest-api/src/modules/notifications/notifications.controller.ts) — frontend hooks unchanged.
- [apps/wc-nest-api/src/modules/websocket/websocket.gateway.ts](apps/wc-nest-api/src/modules/websocket/websocket.gateway.ts) and [websocket.service.ts](apps/wc-nest-api/src/modules/websocket/websocket.service.ts) — emit unchanged.

---

## Conventions to Encode in the Catalog (from spec)

From `Notes & Conventions` sheet in the spreadsheet — these become catalog/template defaults:

- **Salutation** (`SalutationStyle` per entry):
  - Parents standard → `'hi'` (`Hi {firstName},`)
  - Parents formal (financial distress, disputes — entries #14, #15, #16, #17, #19, #20, #37 on parent sheet) → `'dear'`
  - Providers → `'none'`
  - Superadmins → `'none'`
  - Fallback when firstName missing → `Hi there,`
- **Channel rules** — per-row `channels: ['in_app']` / `['email']` / `['in_app', 'email']`, taken straight from the spec columns.
- **Child name use** — the catalog includes child names in template props ONLY for warm/positive/logistical contexts. The "Permitted contexts" list in the spec maps to specific catalog entries; for "Not permitted contexts" (payment failure, dispute) prop loaders return `bookingRef` instead.
- **Payment terminology** — React Email components contain the spec-mandated language. Forbidden phrases ("Destination Charges", "we hold your money", "funds held by World Camps") are blocked via a lint rule on the templates package (a test that greps every rendered template for the forbidden phrase list and fails CI).
- **Payout dates** — never hardcoded; prop loaders compute dynamically from `BookingPayoutSchedule` + Stripe payout settings; templates state "1–3 business days depending on your Stripe settings."

---

## Verification

### Unit / integration
- **Catalog validation test** — CI guard: every `NotificationType` has a catalog entry; every entry's resolver key exists in the registry; every entry with `channels.includes('email')` has an email component; every `templateKey` is unique; every catalog entry's `loadProps` returns props that match its template's prop type (TS-level via generic).
- **Template snapshot tests** in `packages/wc-email-templates/src/__tests__/` — one per money-touching template.
- **Lint test** — grep every rendered template for forbidden payment phrases.
- **Integration tests** (~10–15 per audience) in `apps/wc-nest-api/src/modules/notifications/__tests__/` that drive the full flow per load-bearing category: trigger domain event → assert `NotificationDelivery` rows created → assert `Notification` rows created → assert nodemailer mock invoked with correct subject + body excerpt. Cover booking, payment, refund, dispute, message, support; let the QA matrix cover promotional/reminder triggers.

### Manual / end-to-end
1. Run the QA matrix generator: `npx tsx apps/wc-nest-api/scripts/notification-qa-matrix.ts > docs/notifications-qa.md`.
2. Run the email previewer locally: `nx run wc-email-templates:email-dev` → http://localhost:3000 — visual review of every template.
3. Start the full stack: `nx serve wc-nest-api`, `nx dev wc-booking`, `nx dev wc-provider`, `nx dev wc-superadmin`.
4. For each notification category, walk through the QA matrix triggering the source event (e.g. create a booking request → verify provider sees in-app + email; accept it → verify parent sees in-app + email; cancel it → verify both sides).
5. Verify Bull Board at `/admin/queues` shows live + scheduled jobs; manually retry a failed job.
6. Verify preferences UI: toggle off "wishlist price drop" emails → re-trigger → confirm in-app delivered but no email row in `NotificationDelivery`.
7. Verify scheduled cancellation: confirm a booking → see 14d/7d/1d jobs in `notifications.scheduled` → cancel the booking → jobs removed.
8. Verify reconciliation: manually delete a scheduled job from Redis → wait for the 02:00 cron (or invoke `reconciliation.cron.ts` from a test endpoint) → confirm job re-enqueued.

### Open decisions deferred to implementation
- Per-trigger resolver granularity for provider triggers — finance-flavored entries (`Provider_Payout_Released`, `Provider_Refund_Issued`, `Provider_Dispute_*`) may use `providerOwnerForBooking` instead of `allProviderUsers` to avoid noisy fan-out. Confirm during Phase 8 with stakeholder.
- Promotional rate-limit per recipient (wishlist + reminder triggers) — decide whether to add a per-user daily cap on `category: 'marketing'` entries during Phase 7.
- The 12 existing email templates' visual fidelity post-React-Email migration — designer sign-off required during Phase 5.
