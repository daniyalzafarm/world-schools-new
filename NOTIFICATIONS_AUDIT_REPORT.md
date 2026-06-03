# Notifications Implementation — Final Audit (2026-05-25)

## Context

The 13-phase notifications expansion on the `feat/all-apps-notifications` branch was reported complete in [`NOTIFICATIONS_IMPLEMENTATION_PLAN.md`](NOTIFICATIONS_IMPLEMENTATION_PLAN.md). This audit re-verifies every phase claim against the as-built code with fresh exact-grep counts. Three parallel exploration passes covered (a) backend infra (Phases 1, 3, 4, 6, 10), (b) catalog content + tests + QA matrix (Phases 2, 5, 7/7.5, 8/8.5, 9, 13), and (c) frontend + preferences (Phases 11, 12). Findings were then re-verified directly via `grep -c` for counts the agents flagged.

**Verdict: implementation is substantively aligned with the plan.** All phase-completion claims hold; all previously-audited bugs are confirmed fixed in code. Three documentation-hygiene gaps (off-by-one entry counts) and one false-positive flagged during exploration (re: `SuperadminSupportTicketNew` wiring) are detailed below.

Legend: ✓ compliant · ⚠️ documented / acceptable deviation · 🐛 gap to fix · 📋 deferred (still acceptable).

---

## Phase-by-phase verification

### Phase 1 — Schema ✓ compliant

All planned models / fields / unique indexes present in [apps/wc-nest-api/prisma/schema.prisma](apps/wc-nest-api/prisma/schema.prisma):

- `Invitation` + `InvitationStatus` (`:3137-3165`) with indexes on `providerId`, `parentEmail`, `parentUserId`, `status`, `expiresAt`.
- `BookingGroup.checkoutStarted` / `lastActivityAt` / `abandonedNotifiedAt` (`:1230-1237`).
- `Parent.profileCompletion` (`:338`) + `Provider.profileCompletion` (`:290`).
- `Provider.stripeAccountDisconnectedAt` + `Reason` (`:276-277`).
- `NotificationDelivery` with the load-bearing unique index `(templateKey, channel, dedupeKey)` (`:3185-3218`).
- `NotificationPreference` with unique `(userId, templateKey, channel)` (`:3224-3237`).

Data migration present at [apps/wc-nest-api/prisma/migrations/20260523140000_notifications_v28_foundation/](apps/wc-nest-api/prisma/migrations/).

### Phase 2 — Email templates package ✓ compliant

[packages/wc-email-templates/](packages/wc-email-templates/) has `project.json`, `src/index.ts`, `src/renderer.ts`, `_shared/` (5 files: layout, branded-button, info-panel, salutation, theme), `email-dev` Nx target. **13 per-domain folders** populated under `emails/`: booking, payment, refund, dispute, invitation, reminder, review, superadmin, messaging, support, conversion, wishlist, profile. `EmailService.sendEmail()` in [packages/global-utils/src/lib/email.service.ts](packages/global-utils/src/lib/email.service.ts) accepts `{ html, text }` for multi-part MIME.

### Phase 3 — BullMQ infra ✓ compliant (with documented deviations)

Two queues (live + scheduled), dedicated ioredis with `maxRetriesPerRequest: null`, primitive-IDs-only `NotificationContext` (18 typed FK fields), deterministic `jobId` + `NotificationDelivery` unique-index belt-and-braces, Bull Board at `/admin/queues` behind `express-basic-auth`. Per-channel retry config remains uniform (both queues use email-style retries) — documented deviation; not regressed.

### Phase 4 — Catalog + dispatcher + worker ✓ compliant

`CatalogEntry<TProps>` shape matches the plan ([catalog/types.ts:37-97](apps/wc-nest-api/src/modules/notifications/catalog/types.ts#L37-L97)). Worker performs all 5 steps. **Both prior-audit bugs confirmed fixed in code:**

- `entityType` + `entityId` populated on `NotificationDelivery` ([workers/notification.worker.ts:144,168,189,204,294-305,313-316](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts)).
- `inApp.metadata?(props)` merged with `{ redirectUrl }` ([workers/notification.worker.ts:223-231](apps/wc-nest-api/src/modules/notifications/workers/notification.worker.ts#L223-L231)).

[catalog-validation.spec.ts](apps/wc-nest-api/src/modules/notifications/catalog-validation.spec.ts) present with 6 assertions.

### Phase 5 — Cutover ✓ compliant

`booking-notification.service.ts` deleted. [booking-websocket.handler.ts](apps/wc-nest-api/src/modules/booking-groups/booking-websocket.handler.ts) slimmed to 96 lines, WS-only. `email-template.service.ts` and `application-notification.service.ts` intentionally retained for auth-flow templates — matches plan exception.

### Phase 6 — Domain features ✓ compliant

- **Invitations**: shared service + per-audience controllers under [provider/invitations/](apps/wc-nest-api/src/modules/provider/invitations/) and [user/invitations/](apps/wc-nest-api/src/modules/user/invitations/) (cleaner than original per-module plan; explicitly documented).
- **Abandon-detection cron** now emits + stamps `abandonedNotifiedAt` ([booking-groups/crons/abandon-detection.cron.ts:100-122](apps/wc-nest-api/src/modules/booking-groups/crons/abandon-detection.cron.ts#L100-L122)) — Phase 6 audit bug #1 fixed.
- **Profile-completion** has live callers: Parent path via `UserAuthController.updateProfile`, `uploadProfilePhoto`, `deleteProfilePhoto`, `requestPhoneChange`; Provider path via `OnboardingService.updateCompanyDetails`, `saveContactInfo`, `saveCampInfo`, `updateProviderLogoUrl` — Phase 6 audit bug #2 fixed.
- **Stripe disconnect**: `handleAccountDeauthorized` sets both fields and fires notifications ([stripe/webhook/stripe-webhook.service.ts:614-669](apps/wc-nest-api/src/modules/stripe/webhook/stripe-webhook.service.ts#L614-L669)).

### Phase 7 + 7.5 — Parent catalog ⚠️ count discrepancy

**Actual entry count: 50** (verified via `awk '/parentCatalog/,/\]/' | grep -cE '^  [a-z]'` → `50`). Plan Phase 7 audit table and Phase 11 audit table both cite **51**. The 1-entry discrepancy is documentation-only; every catalog member corresponds to a defined enum value and the rest of the wiring (loaders, resolvers, templates) is internally consistent at 50.

All Phase 7.5 follow-ups confirmed:

- Three crons wired: [wishlist-engagement.cron.ts](apps/wc-nest-api/src/modules/user/wishlists/crons/wishlist-engagement.cron.ts), [profile-incomplete.cron.ts](apps/wc-nest-api/src/modules/common/profile-completion/crons/profile-incomplete.cron.ts), [post-camp-review.cron.ts](apps/wc-nest-api/src/modules/booking-groups/crons/post-camp-review.cron.ts).
- 8 commit-point notifies wired across `acceptForProvider`, `createForProvider`, `declineForProvider`, `markGroupCancelled`, `respondToReview`, `cancelForParent`, parent + provider profile-completion call-sites.
- 9 money-touching snapshot specs landed.

### Phase 8 + 8.5 — Provider catalog ✓ compliant

**Actual entry count: 53** (matches plan exactly). `ProviderEngagementCron` with weekly/monthly/daily/hourly methods present. All 3 Phase 8.5 orphans wired:

- `ProviderReviewResponsePublished` at [provider-reviews.service.ts:157](apps/wc-nest-api/src/modules/provider/reviews/provider-reviews.service.ts#L157).
- `ProviderConnectStripeNudge` at [application-review.service.ts:444](apps/wc-nest-api/src/modules/superadmin/application-review/services/application-review.service.ts#L444).
- `ProviderPayoutDelayed` at [provider-engagement.cron.ts:322](apps/wc-nest-api/src/modules/notifications/crons/provider-engagement.cron.ts#L322).

### Phase 9 — Superadmin catalog ✓ exact match

**Actual entry count: 19** (matches plan exactly). `SuperadminEngagementCron` with daily 9 AM + weekly cadences present. 5 shared templates under `emails/superadmin/`.

Note: an exploration pass flagged `SuperadminSupportTicketNew` as unwired — **false positive**; wiring exists at [support-tickets/services/support-tickets.service.ts:187](apps/wc-nest-api/src/modules/support-tickets/services/support-tickets.service.ts#L187).

### Phase 10 — Reconciliation cron ✓ compliant

Single `@Cron('0 2 * * *')` at [notifications/crons/reconciliation.cron.ts](apps/wc-nest-api/src/modules/notifications/crons/reconciliation.cron.ts), Redis-locked, 5 reconcile helpers covering 13 entity-bound scheduled triggers. Registered in `notifications.module.ts`.

### Phase 11 — Frontend types + filters ✓ compliant

- `NotificationType` enum: **122 members** (verified via `awk '/^export enum NotificationType/,/^}/' | grep -cE '^  [A-Z]'`). Plan text variously cites 122 and 123 — 122 is the actual.
- `NotificationEntityType`: all 16 spec-required types present.
- `NotificationCategory`: 14 categories + `NOTIFICATION_CATEGORY` map + `categoryFor()` helper.
- `NotificationFilter` loosened to `string`; `NotificationFilterConfig` carries the strict typing.
- `IconVariant` extended to 6 (`booking | message | payment | review | onboarding | security`).
- All 3 apps wire audience-specific filter sets: parent 7, provider 7, superadmin 8.

### Phase 12 — Preferences UI ✓ compliant (with documented deviations)

- Backend GET + PATCH endpoints with `@ArrayMaxSize(500)` DTO; `deriveAudience` parent → superadmin → provider priority.
- Shared `NotificationPreferencesPage` + `useNotificationPreferences` (~375 lines actual vs ~270 claimed — small docstring drift).
- All 3 apps land at `/account/settings/notifications` (consistent IA placement) instead of the originally-planned mix of `/account/notifications` + `/settings/notifications`.
- Plain Tailwind switches with `role="switch"` + `aria-checked` instead of HeroUI — keeps the shared component peer-dep-free.

### Phase 13 — QA matrix ✓ compliant

Script at [apps/wc-nest-api/scripts/notification-qa-matrix.ts](apps/wc-nest-api/scripts/notification-qa-matrix.ts). Nx target `qa-matrix` defined in [apps/wc-nest-api/project.json](apps/wc-nest-api/project.json). [docs/notifications-qa.md](docs/notifications-qa.md) has **exactly 122 `####` entry headers** — matches actual catalog total.

---

## Material findings

### 🐛 None — implementation is feature-complete against the plan

Every phase claim is supported by code. Every previously-audited bug is confirmed fixed.

### ⚠️ Doc-hygiene drift in `NOTIFICATIONS_IMPLEMENTATION_PLAN.md`

Three places say `123 enum / 51 parent` when the actual is `122 enum / 50 parent`. The "3-entry deficit from the 126-spec target" is really a 4-entry deficit. None of this affects runtime behaviour — just makes the plan harder to reason about on re-read. Optional cleanup:

1. Phase 7 audit table — change `Total parent (target 52): 51` → `50`.
2. Phase 11 audit table — change `123 entries (51 parent + 53 provider + 19 superadmin)` → `122 entries (50 parent + 53 provider + 19 superadmin)`.
3. Implementation Complete summary table — same correction; the deficit becomes `4-entry deficit` instead of `3-entry deficit`.

### 📋 Open items inherited from prior audits (still acceptable to defer)

- **Per-channel BullMQ retry config still uniform** — per-job override in `enqueue.service.ts` is the documented fix path; harmless until in-app retries surface as a real problem.
- **Per-entity cancel helpers** (`cancelForBooking/cancelForCheckout/cancelForInvitation`) — loader's null-skip pattern makes scheduled jobs "noisy, not broken." Land alongside the next preferences-UI tweak.
- **Bull Board behind a Nest guard instead of basic-auth** — Bull Board mounts at the express layer; custom middleware deferred.
- **CI invocation of `nx qa-matrix wc-nest-api`** with diff-check against `docs/notifications-qa.md` — mechanical addition once cadence is agreed.
- **Parked entries needing domain features**: `ParentBookingModified`, 4 wishlist event-driven (`PriceDrop`/`FillingUp`/`DeadlineApproaching`/`EarlyBirdIncrease`), `ParentReviewRemoved`, `ProviderBookingModified`, `ProviderReviewRemoved`, `SuperadminCampDeletionRequested`. All registered in catalogs; fire when the underlying domain commit points land.

---

## Verification commands

Re-run any of these to spot-check this audit independently:

```bash
# Catalog entry counts (the load-bearing numbers)
awk '/^export const parentCatalog/,/^\]/' apps/wc-nest-api/src/modules/notifications/catalog/audiences/parent.catalog.ts | grep -cE '^  [a-z]'
awk '/^export const providerCatalog/,/^\]/' apps/wc-nest-api/src/modules/notifications/catalog/audiences/provider.catalog.ts | grep -cE '^  [a-z]'
awk '/^export const superadminCatalog/,/^\]/' apps/wc-nest-api/src/modules/notifications/catalog/audiences/superadmin.catalog.ts | grep -cE '^  [a-z]'

# NotificationType enum members
awk '/^export enum NotificationType/,/^}/' packages/wc-types/src/lib/websocket.types.ts | grep -cE '^  [A-Z]'

# QA matrix entry sections
grep -c '^#### ' docs/notifications-qa.md

# Phase 8.5 orphan wirings
grep -n "NotificationType.ProviderReviewResponsePublished" apps/wc-nest-api/src/modules/provider/reviews/provider-reviews.service.ts
grep -n "NotificationType.ProviderConnectStripeNudge" apps/wc-nest-api/src/modules/superadmin/application-review/services/application-review.service.ts
grep -n "ProviderPayoutDelayed" apps/wc-nest-api/src/modules/notifications/crons/provider-engagement.cron.ts

# SuperadminSupportTicketNew wiring (false-positive check)
grep -n "NotificationType.SuperadminSupportTicketNew" apps/wc-nest-api/src/modules/support-tickets/services/support-tickets.service.ts

# Build / test suite
npx nx build wc-nest-api
npx nx test wc-nest-api --testPathPatterns=catalog-validation
npx nx test wc-email-templates
npx nx qa-matrix wc-nest-api
```

---

## Summary

| Phase | Plan claim | Verified | Status |
|---|---|---|---|
| 1 | Schema migration + Invitation/NotificationDelivery/NotificationPreference + load-bearing unique index | ✓ | ✓ |
| 2 | `wc-email-templates` library, renderer, `_shared/`, per-domain folders, `email-dev` target | ✓ | ✓ |
| 3 | Two queues, dedicated ioredis, Bull Board basic-auth, idempotency belt+braces | ✓ (uniform retry is documented deviation) | ✓ |
| 4 | Catalog + dispatcher + worker + 2 audit-bug fixes (`entityType`/`entityId`, `metadata` merger) | ✓ both fixes in code | ✓ |
| 5 | Cutover existing 7 types, slim websocket handler, keep auth-flow templates | ✓ | ✓ |
| 6 | Invitations module, abandon cron emit+stamp, profile-completion callers, Stripe disconnect | ✓ all 3 prior bugs fixed | ✓ |
| 7 + 7.5 | 51 parent entries, 3 new crons, 8 wirings, 9 snapshot specs | **50 entries** + everything else ✓ | ⚠️ doc-only |
| 8 + 8.5 | 53 provider entries + ProviderEngagementCron + 3 orphans wired | ✓ all 3 orphans verified | ✓ |
| 9 | 19 superadmin entries + SuperadminEngagementCron + 5 templates | ✓ exact match | ✓ |
| 10 | Single daily reconciliation cron, 13 entity-bound triggers | ✓ | ✓ |
| 11 | Type expansion, category map, `NotificationFilterConfig`, 6 icon variants, 3 audience filter sets | ✓ (122 enum members, not 123) | ⚠️ doc-only |
| 12 | GET+PATCH endpoints, shared component+hook, 3 per-app pages | ✓ (route + HeroUI deviations documented) | ✓ |
| 13 | QA matrix script + Nx target + `docs/notifications-qa.md` with 122 entries | ✓ exact match | ✓ |

**No code changes required.** The only follow-up is the optional 3-line doc patch to `NOTIFICATIONS_IMPLEMENTATION_PLAN.md` to correct the off-by-one entry counts.
