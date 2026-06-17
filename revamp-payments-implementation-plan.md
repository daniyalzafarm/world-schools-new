# Payments & Payout Revamp — Implementation Plan

## Context

The current engine is a **payout-delay / tranche model**: funds are captured early, held in the provider's Stripe balance, and released in tranches by `PayoutsService` + `payout-release.cron.ts` keyed off the `BookingPayoutSchedule` table. The revamp (authoritative: `revamp-payments.md`, backed by Payments & Payouts Spec v2.3 and Alex's 2026-06-12 reconciliation) inverts the organising principle to **capture money only when it is already non-refundable; once captured it is immediately the provider's** — which deletes the entire payout-restriction apparatus and replaces the single balance-due date with a derived multi-event capture schedule.

Because there are **no production bookings or providers**, this is a **clean replacement, not a dual-engine migration**: old payout code is deleted outright, grace semantics change in place, and there is no prod backfill (verify zero rows once, then drop).

**Scope (user-confirmed):** everything in one effort — backend engine + all three frontends + Force Majeure bulk tooling + admin payment-review queue + full tests. All work lands on the existing `revamp/payments-and-payout-flow` branch. Work is internally sequenced by dependency (below); a staging-only `PAYMENTS_REVAMP_ENABLED` flag is acceptable but production is a hard cutover.

Where this plan and the contracts conflict, the contracts (Parent Terms v1.4 / Provider Terms v1.7) prevail.

> **Spec conformance (2026-06-17): brought to v2.5.** v2.4 (the 2026-06-12 reconciliation this build
> targeted) and v2.5 have landed. v2.5 carries all v2.4 payment mechanics forward unchanged; its net
> changes are the locked standard-tier schedules + 90/60/30 lattice (§2.2 — matches the
> `FLEXIBLE/MODERATE/STRICT_POLICY_TIERS` constants exactly), the §3.1 onboarding recast (camp type
> pre-populates a suggested tier + deposit default — **implemented** via `suggestStandardTier`), and §15
> copy. **§9.7 Programme reschedule is implemented** (see §8). **Currency:** all 15 currencies retained
> end-to-end — an approved deviation from v2.5 §4.1's "launch 4 + gate expansion" (deliberate product
> decision; per item 8 below).

---

## Contractual invariants (must hold everywhere)

These are tested as first-class assertions, not assumed:

1. **No capture before provider acceptance** — `effective_capture_date = max(capture_date, grace_deadline, acceptance_time)`; every capture site (delayed job, reconciliation cron, at-acceptance, near-term sync) independently refuses to fire on a not-yet-accepted or cancelled booking.
2. **Refund % applies to the BALANCE only**; deposit is non-refundable after the 24h grace window.
3. **Flexible tier ⇒ zero deposit** (bound in code, see §3).
4. **No hard-coded provider auto-suspension** — provider cancellation routes to an admin review queue.
5. **Consent snapshot + append-only payment audit log, 10-year retention** (Swiss CO Art. 958f).
6. **Force Majeure** refunds captured amounts **minus the platform fee** (admin toggle to also refund the fee), and cancels future captures.
7. **Post-grace customer cancel**: platform fee non-refundable; balance-% refund still issued when the matched tier > 0% (only skip the Stripe call when it computes to 0).
8. **Currency**: all 15 `SUPPORTED_CURRENCIES` supported end-to-end (per-Listing settlement). **This is an approved deviation from Spec v2.5 §4.1**, which locks launch to USD/GBP/EUR/CHF and gates onboarding-country expansion until per-country negative-balance recovery is confirmed — the platform deliberately enables all 15 (the connect allow-list + drift test pin this). Per-country negative-balance recovery + the platform-account FX-to-CHF config (below) remain operational items to confirm, not code gates.

---

## Build order (dependency-driven)

0. Save this plan to the repo root as `revamp-payments-implementation-plan.md` (committed alongside `revamp-payments.md`) so the executable plan is versioned with the code.
1. Schema additive migration (M1) + enums + status constant
2. Pure engine utils (capture-schedule derivation, grace) — no Nest/Prisma
3. Capture queue + worker + reconciliation cron + capture-engine service
4. Booking REQUEST wiring (deposit auth / no-deposit SetupIntent, schedule rows, consent) — **incl. controller/DTO change**
5. Provider ACCEPTANCE wiring (deposit capture-or-defer, re-resolution, enqueue)
6. Balance capture + SCA retry + `payment_review` + pre-capture notifications
7. Cancellation / reschedule / provider-cancel / FM + admin review queue + refunds changes
8. Reimbursement retirement (pre-M2) + webhook handler edits + payout removal + destructive migration (M2)
9. Audit + consent write services
10. Frontends (wc-booking, wc-provider, wc-superadmin)
11. Tests + fixtures + retention guard

**Per-step verification gate (mandatory).** Each step above is a checkpoint, not a checklist tick. Do NOT start the next step until the current one passes ALL of the following, and record what was verified:

1. **Build:** `nx build` for affected projects (and `nx prisma:generate wc-nest-api` after any schema change) — compiles clean.
2. **Test:** write and run that step's unit + integration tests (`nx affected -t test`) — green. No step is "done" without its own tests passing; never advance with skipped or failing tests.
3. **Lint:** `nx lint` on touched projects — clean.
4. **Audit against intent:** re-read the diff against this plan and `revamp-payments.md`; confirm the relevant **contractual invariants** still hold (especially the acceptance guard at every capture site and the `markGroupCancelled` cancel-sink wiring); `grep` for dangling references the change introduced (e.g. removed payout symbols, renamed grace helpers).
5. **Stop on failure / regression:** if any check fails or a previously-passing test breaks, fix it within the same step before advancing — no known breakage carried forward. Re-run the prior step's tests to confirm no regression before proceeding.

---

## 1. Data model & migrations (`apps/wc-nest-api/prisma/schema.prisma`)

Regenerate the client (`nx prisma:generate wc-nest-api`); never hand-edit `src/generated/client/`.

**New tables**
- `booking_scheduled_captures` — **sole source of truth for capture timing** (do NOT also add `captureDate1..4` columns to `BookingGroup`). Cols: `id` uuid PK; `bookingGroupId` FK `onDelete: Restrict`; `sequence` Int (0 = deposit, 1–4 = balance); `amount` Decimal(12,2); `applicationFeeAmount` Decimal(12,2); `currency` VarChar(3); `captureDate` DateTime (band boundary, UTC); `effectiveCaptureDate` DateTime (`max(captureDate, graceDeadline, acceptanceTime)`); `status` `ScheduledCaptureStatus @default(scheduled)`; `stripePaymentIntentId`/`paymentId` String?; `failureCode`/`failureMessage`; `retryDeadline` DateTime?; `cancelledReason`/`fmEventId` String?; timestamps. `@@unique([bookingGroupId, sequence])` (idempotency anchor), `@@index([status, effectiveCaptureDate])`, `@@index([bookingGroupId])`.
- `booking_consent_snapshots` — `id`; `bookingGroupId` FK; `policyText @db.Text`; `chargeSchedule` Json; `depositInfo` Json; `gracePeriodHours` Int `@default(24)`; `acknowledgedAt`; `ipAddress` String?; `userAgent @db.Text`; `schemaVersion` Int `@default(1)`; `supersededAt` DateTime? (consented reschedule appends a new row; latest non-superseded is authoritative); `createdAt`. `@@index([bookingGroupId])`.
- `booking_payment_audit_log` — append-only, 10y. `id`; `timestampUtc @default(now())`; `actor` String; `eventType` `PaymentAuditEventType`; `bookingGroupId` FK `onDelete: Restrict`; `scheduledCaptureId`/`paymentIntentId` String?; `amountMinorUnits` BigInt?; `currency` VarChar(3)?; `priorStatus`/`newStatus` String?; `reasonText @db.Text` (required for admin/FM, enforced in service); `fmEventId` String?; `platformFeeDisposition` `PlatformFeeDisposition?`. Indexes on `(bookingGroupId, timestampUtc)`, `eventType`, `actor`, `timestampUtc`.
- `force_majeure_events` — `id`; `administratorUserId` FK; `description` Text; affected date-range/provider/region; `affectedBookingCount`; `totalRefundedAmount`; `platformFeeRefunded` Bool; timestamps. (Resolves the `fmEventId` dangling-FK risk.)
- `provider_admin_review_queue` — `id`; `providerId` FK; `suspensionType` `ProviderSuspensionCategory`; `status` `ProviderReviewStatus`; `affectedListingIds` Json; `affectedBookingCount`; `reasonText` Text; `initiatingRefundId` String?; review audit fields (`reviewedAt`/`reviewedByUserId`/`decision`/`decisionNotes`).

**New enums:** `ScheduledCaptureStatus { scheduled processing completed failed cancelled }`; `CaptureMode { binary two_stage custom }` (internal only); `PaymentAuditEventType { … }`; `PlatformFeeDisposition { retained refunded }`; `ProviderSuspensionCategory { precautionary safeguarding fraud insolvency failed_capture_escalation }`; `ProviderReviewStatus { pending under_review resolved }`.

**Field additions**
- `Camp`: `depositEnabled Boolean @default(true) @map("deposit_enabled")` — **net-new** (not present today; an earlier branch attempt was reverted by `#144`). Frozen into `depositSnapshot` at request.
- `BookingGroup`: `graceDeadline DateTime?` (new, request-anchored — do not overload the old `gracePeriodEndsAt`); `captureMode CaptureMode?`; `depositPaymentIntentId`/`savedPaymentMethodId` String?; `depositCapturedAt` DateTime?; `paymentReviewStatus`/`paymentReviewFlaggedAt`/`paymentReviewResolvedAt`/`paymentReviewResolvedByAdminId`; relations to the three new tables. Reuse `respondedAt` as acceptance time.
- `ProviderSettings`: `captureSchedule Json?` (Custom builder). Reuse existing deposit + cancellation-policy fields.
- `Provider`: `suspensionCategories` Json, `suspensionReasonText`, review-queue relation. Leave onboarding `approvalStatus` untouched.

**`BookingGroupStatus` extension** — add `payment_authorized`, `waiting_for_grace_deadline`, `provider_accepted`, `deposit_captured`, `payment_review` (keep existing for back-compat). **Define the accepted/confirmed set ONCE as a shared exported constant** and apply it to: reconciliation-cron eligibility, off-session pickup query, and the `payment_failed`/`payment_review` transition guards in `balance-charge.cron.ts` (currently `IN (deposit_paid, accepted, request)`) — see critique finding 6.

**Removals (M2, destructive):** `BookingPayoutSchedule` + `PayoutEvent` models; `BookingGroup.payoutSchedule` relation; enums `PayoutMode`/`PayoutTrancheReason`/`PayoutTrancheStatus`/`PayoutStatus` (confirm last unreferenced); `BookingGroup.{transferDate, payoutMode, payoutOffsetDaysSnapshot, payoutOverrideAgreedAt, payoutOverrideAgreedByAdminId, payoutReleasedAt}` + `@@index([transferDate])`; `ProviderSettings.{payoutMode, earlyPayoutOffsetDays, payoutModeAgreementNote, payoutModeAgreedAt, payoutModeAgreedByAdminId}`.

**Migration ordering:** **M1 additive** (tables/enums/fields/status) first so engine code can land. **M2 destructive** (drop payout models/fields) runs LAST, after all referencing code is removed (§8) so `prisma generate` never breaks mid-stream.

---

## 2. Capture-schedule derivation engine

New module `apps/wc-nest-api/src/modules/billing/captures/`; pure derivation in `billing/shared/capture-schedule.util.ts` (no Nest/Prisma deps, mirroring `cancellation-policy.util.ts`).

- **Inputs:** tiers from `readBookingPolicySnapshot()` → `sortTiersDescending()` (`cancellation-policy.util.ts`); deposit config from `depositSnapshot`; `totalAmount`/`depositAmount`; session start; programme-location timezone (fallback `ProviderSettings.timezone`); `graceDeadline`, `acceptanceTime`.
- **Named tier → refund schedule:** `resolveTiers()` compiles named tiers. **DONE (2026-06-17):** `STRICT_POLICY_TIERS` (100% until 90d, 50% until 60d, 0% after) is defined in `packages/wc-types/src/lib/cancellation-policy.types.ts`, `'strict'` is in `CANCELLATION_POLICY_VALUES`/`CANCELLATION_POLICY_LABELS`, and the `strict` branch is wired in both `resolveTiers` (backend + wc-utils) — Flexible/Moderate already matched. `CaptureMode` is derived for observability only (1 drop → binary, 2 → two_stage, >2/custom → custom); never shown to users.
- **Refund-% drop walk** (`deriveBalanceCaptureEventsFromTiers`): walk bands furthest→closest; `prevPct=100`; on each `tier.refundPercentage < prevPct`, schedule `amount = round2(balance * (prevPct − tier.pct)/100)` at the band-boundary date; equal-% consecutive bands → no event; assign residual cents to the final event so `sum === balance`. Deposit is sequence 0 at `graceDeadline`, excluded from the balance walk.
- **Acceptance guard:** `effectiveCaptureDate = max(captureDate, graceDeadline, acceptanceTime)`; at request `acceptanceTime` is null → `max(captureDate, graceDeadline)`; re-run at acceptance over all `scheduled` rows; already-past `captureDate` collapses to `acceptanceTime`.
- **Day-counting / tz:** add `calendarDayMidnightUTC(date, tz)` + `resolveProgrammeLocationTimezone(camp, provider)`. Calendar days, midnight in programme-location tz via `Intl.DateTimeFormat` IANA zone, stored as the UTC instant; hourly cron fires at/after. DST edges get dedicated unit tests.
- **Reuse:** `cancellation-policy.util.ts`, `payment-plan.ts` (`computeDepositAmountNumber`, `round2`), `money.util.ts`, `idempotency.util.ts`.

---

## 3. Grace period change + Flexible-zero-deposit binding

- `packages/wc-utils/src/lib/payment-plan.ts`: `GRACE_PERIOD_HOURS=48` → request-anchored 24h; add `NEAR_TERM_THRESHOLD_DAYS=7`. **Add** `computeGracePeriodDeadlineFromRequest(requestTime, sessionStart, tz)` returning the request time itself (zero-length grace) when the programme starts **within 7 calendar days** (`daysUntilStart <= 7`, per the contract's "≤ request_date + 7 days"), else `requestTime + 24h`. **Keep the old export deprecated** until all importers are migrated (grep `computeGracePeriodDeadline`/`GRACE_PERIOD_HOURS`/`computePaymentPlan` first; `apps/wc-booking/src/utils/payment-plan.ts` is a re-export shim — there is no wc-provider mirror).
- Move grace computation from acceptance to **request time** in `booking-groups.service.ts` (`submitForParentLocked`); persist `graceDeadline`; remove the acceptance recompute.
- **Flexible ⇒ zero deposit (critique finding 4):** in deposit resolution (`booking-snapshot.util.ts`), when the resolved named tier is `flexible`, force `deposit_applies = false` regardless of provider/camp settings, and record it in `depositSnapshot`. Unit test: Flexible ⇒ deposit 0 ⇒ 100% releasable.

---

## 4. Booking REQUEST creation (+ consent transport — BLOCKER)

Entry `submitForParentLocked` → `computeBookingFinancialSnapshot` → `authorizeForPaymentMode`.

1. **Consent transport (critique blocker 1):** extend `@Post(':id/submit')` in `user/booking-groups/booking-groups.controller.ts` to accept a `SubmitBookingGroupDto` (`consentAcknowledged`, `policyTextShown`, `chargeSchedule`, `schemaVersion`) plus `@Ip() ip` and `@Headers('user-agent') ua`; thread these through `submitForParent`/`submitForParentLocked` to the consent insert. **Reject submit if `consentAcknowledged !== true`.** Mirror on the consented-reschedule path.
2. **Camp deposit override:** fetch `camp.depositEnabled`; `deposit_applies = provider.depositRequired AND camp.depositEnabled` (and §3 Flexible override); record in `depositSnapshot`.
3. **Grace deadline** computed + persisted (§3).
4. **Deposit listing:** reuse `authorizeDeposit` (already `capture_method=manual` + `setup_future_usage=off_session` + `ensureProviderConnectCustomer`); store `depositPaymentIntentId`.
5. **No-deposit listing:** reuse `createSetupIntent` (save PM on connected account); whole price is balance.
6. **Schedule rows:** derive schedule (§2); INSERT rows (seq 0 deposit at `graceDeadline`; seq 1..n balance), `status=scheduled`, `effectiveCaptureDate = max(captureDate, graceDeadline)`. Do NOT enqueue jobs yet.
7. **Consent + audit:** insert one `booking_consent_snapshots` row; emit `consent_captured` audit.
8. All inserts in the same `$transaction` as the status write.

---

## 5. Provider ACCEPTANCE flow

Entry `acceptForProvider`:

1. Record `acceptanceTime = now` (reuse `respondedAt`).
2. **Deposit capture-or-defer:** `acceptanceTime > graceDeadline` → immediate capture via `captureForBookingGroup` + `markSucceeded` + set `depositCapturedAt`; else keep authorized, set seq-0 `effectiveCaptureDate=graceDeadline`, status `waiting_for_grace_deadline`, enqueue delayed job.
3. **Re-resolve** all `scheduled` balance rows through `max(captureDate, graceDeadline, acceptanceTime)`; UPDATE rows.
4. **Enqueue** delayed jobs for each `scheduled` capture (`delay = effectiveCaptureDate − now`, jobId `capture_<bg>_<seq>`). Enqueue **after commit**.
5. **Near-term no-deposit hold:** if the first balance capture is due at/under acceptance, capture **synchronously** and only confirm the booking on success (never commit a slot on an unsecured card). The reconciliation cron treats a not-yet-confirmed near-term booking as ineligible (critique finding 8).
6. **Replace** `payoutsService.generateScheduleForBooking` with this re-resolution+enqueue; keep the try/catch (reconciliation cron is the recovery path).

---

## 6. Scheduled capture engine (BullMQ + reconciliation cron)

New files under `billing/captures/`, mirroring existing patterns exactly:

- `scheduled-captures.queue.ts` — copy `common/profile-completion/profile-completion.queue.ts` (dedicated `IORedis`, `maxRetriesPerRequest:null`); `defaultJobOptions: { attempts:1, removeOnComplete:{age:604800}, removeOnFail:false }`.
- `enqueue-capture.service.ts` — jobId `capture_${bg}_${seq}`, `delay = max(0, effectiveCaptureDate − now)`, never-throws.
- `cancel-capture.service.ts` — `cancelForBooking(bgId)` removes jobs by deterministic jobId (mirror `notifications/queue/cancel.service.ts`) **and** marks all non-terminal `scheduled_captures` rows `cancelled`.
- `scheduled-captures.worker.ts` — `@Processor` extends `WorkerHost` (mirror `profile-completion.worker.ts`).
- `crons/scheduled-capture-reconciliation.cron.ts` — `@Cron('0 * * * *')` hourly; Redis `SET NX` lock (mirror `balance-charge.cron.ts`); query `status='scheduled' AND effectiveCaptureDate<=now AND bookingGroup.status IN <accepted/confirmed set> AND acceptanceTime IS NOT NULL`; **exclude rows already `processing`**; batch with metrics.
- `capture-engine.service.ts` — `executeCapture(bg, seq)`: atomic status-guard claim `scheduled→processing`; verify accepted & not-cancelled; deposit → `paymentIntents.capture`; balance → reuse `chargeOffSession`; on success → `markSucceeded` + row `completed` + audit; on failure → row `failed`, `retryDeadline=now+48h`, audit + SCA (§7).
- `captures.module.ts` — imports `PaymentIntentsModule`; register in `app.module.ts`.

**Idempotency (resolve spec vs amount caveat — critique finding 9):** key = `buildIdempotencyKey('cap:<bg>:<seq>', { amountMinor, attempt })` — booking+sequence as the readable prefix (satisfies the spec wording), amount+attempt as content params so a refund-reduced amount forks to a new key. "Already captured/succeeded" = success; "PI canceled" = no-op; verify booking status before firing. `@@unique([bg,seq])` + status-guard + Stripe key make job/cron/webhook races harmless. Keep `balance-charge.cron.ts` and `auth-expiry-monitor.cron.ts` complementary (don't merge).

---

## 7. Balance capture, SCA retry, pre-capture notifications

- Off-session via `chargeOffSession` (already connected-account + `application_fee_amount` + `requires_action` handling).
- Failure → row `failed`, `retryDeadline=now+48h`; `balance-charge.cron.ts` retry pickup re-attempts.
- **SCA `authentication_required`:** in `markFailed`, detect the code, extract `next_action.redirect_to_url.url`, store the auth link + 48h deadline, emit a parent "authentication required" notification (follow `notifyOffSessionRequiresAction`).
- **Retry-deadline expiry → `payment_review`** (never auto-cancel): flag `paymentReviewStatus` + status `payment_review`; emit superadmin + provider notifications.
- **Pre-capture reminders:** generalise `balance-reminder.cron.ts` to query `booking_scheduled_captures` (30-day + 7-day); card-expiry warning compares `SavedPaymentMethod` expiry to the next `effectiveCaptureDate`. Add catalog entries + `packages/wc-email-templates/emails/payment/` templates; PropLoaders re-hydrate fresh DB state at execution (reschedule-safe).

---

## 8. Cancellation / reschedule / provider-cancel / FM + payout removal

**Capture-cancellation at the shared sink (critique blocker 2):** replace the `cancelPendingTranches` call **inside `markGroupCancelled`** (`refunds.service.ts`, the single exit for all 11 cancel paths) with `cancelCaptureService.cancelForBooking(bgId)` + mark all non-terminal rows `cancelled`, in the same transaction. This one change covers parent/camp/provider-declined/fraud/expiry/FM.

- **Customer cancel within grace:** cancel jobs + rows + the deposit PI (existing `voidAuthFn`/`cancelForBookingGroup`); **no refund call**; audit.
- **Customer cancel after grace (critique finding 10):** run `evaluatePolicy` on the **balance**; if matched tier % > 0, issue a balance-only refund with `KEEP_PLATFORM_FEE` (deposit + platform fee non-refundable); skip the Stripe call only when computed refund is 0. Cancel remaining rows/jobs.
- **Provider cancel (programme cancellation):** new `cancelByProvider()`; full refund of all captures (`refund_application_fee:true`); cancel all rows; **no auto-suspend** → insert `provider_admin_review_queue` row (default `precautionary`) + notify.
- **Provider reschedule (Spec v2.5 §9.7 — ✅ IMPLEMENTED):** provider PROPOSES a new start (`POST /provider/booking-groups/:id/reschedule` → pending `RescheduleProposal`); the customer consents (`/user/booking-groups/:id/reschedule/consent`) or declines. On consent, ONE transaction: `CaptureSchedulerService.planReschedule` → `writeRescheduleRows` cancels the not-yet-fired rows + inserts the recomputed remainder against the new start with **sequences above the current max** (collision/jobId-reuse safe), sets `bookingGroup.rescheduledStartDate`, supersedes + re-inserts the consent snapshot, closes the proposal; post-commit dispatches jobs + appends a `reschedule_recompute` audit row. Refund-band evaluation now prices on `rescheduledStartDate ?? session.startDate`. Recompute is guarded against in-flight/failed captures. Without consent → original dates stand; provider separately honours or cancels (§9.5).
- **Force Majeure bulk:** superadmin endpoint selects by date/provider/region, creates `force_majeure_events`, **calls `cancelForBooking` per affected booking** AND refunds captured **minus platform fee** (`KEEP_PLATFORM_FEE`, default `retained`), with an admin toggle to also refund the fee; run via BullMQ for scale; full audit with `platformFeeDisposition` (critique finding 5).

**Reimbursement retirement (critique blocker 3 — pre-M2):** under capture-when-non-refundable, captured funds are immediately the provider's, so `requiresReimbursement` is always false. In the same PR that removes payout code, short-circuit `resolveRequiresReimbursement` to `false` and stop creating `Reimbursement` rows **before** M2 drops `BookingPayoutSchedule` (it currently queries that table on every refund). Decide explicitly: drop or freeze the `Reimbursement` table.

**Payout removal:** delete `payouts/payouts.service.ts`, `payouts/crons/payout-release.cron.ts`, their specs, and the payout-mode DTOs; edit `payouts.module.ts`, `booking-groups.service.ts` (drop injection + swap `generateScheduleForBooking`), `refunds.service.ts` (drop tranche coupling), `providers.controller.ts`/`providers.service.ts` (remove `payout-mode` endpoint + `setPayoutMode`), `stripe-connect.service.ts` (**remove `settings.payouts.schedule={interval:'manual'}`** — providers manage their own payouts), and remove payout notification types/loaders + frontend payout UI.

---

## 9. Webhooks, audit, consent

- **Webhooks (`stripe-webhook.service.ts`):** no new event types. `payment_intent.succeeded` → `markSucceeded` + row `completed` + audit; `payment_intent.payment_failed` → `markFailed` + SCA + row `failed`+`retryDeadline`; `payment_intent.canceled` → rows cancelled; `charge.refunded`/`charge.dispute.created`/`account.updated`/`deauthorized` → existing handlers; **remove `payout.created`**, and rewrite `payout.paid/failed` to log-only **in the same PR that drops `PayoutEvent`** (critique finding 11). Add the same `updateMany WHERE status IN (allowed_prior)` status-guard to `scheduled_captures` so a webhook and the cron can't double-transition a row (coverage gap 5). Out-of-order tolerance: a late `succeeded` after `payment_review` must win, clear `payment_review`, and not double-count `paidAmount`.
- **Audit:** replace logger-only `billingAudit()` at capture/refund sites with `PaymentAuditLogService.append(...)` writing `booking_payment_audit_log` (append-only service; keep the log line). Every schedule/fire/fail/cancel/refund/FM/override writes a row.
- **Consent:** written in the submit/reschedule transaction (§4).
- **Retention:** **exclude `booking_payment_audit_log` and `booking_consent_snapshots` from the 90-day `webhook-event-retention.cron.ts`**; assert no purge deletes them under 10 years; add a quarterly archival cron (move-to-cold, not delete) as a non-blocking follow-up; UPDATE/DELETE-reject DB trigger as defense-in-depth follow-up (coverage gap 3).

---

## 10. Frontends

- **wc-booking:** consent checkbox gating `confirmPayment`/`confirmSetup` in `stripe-payment-section.tsx` (capture the snapshot in `beforeConfirm`); charge-schedule section in `desktop-review-sidebar.tsx`/`mobile-booking-footer.tsx`; `submitBookingGroup` sends the consent payload (ack + policyText + schedule + schemaVersion); IP/UA captured server-side from the request (§4). No-deposit "no charge today" copy.
- **wc-provider:** deposit-toggle card on `camps/[campId]/edit/sessions` (autosave PATCH; explanatory state + link when no provider-level deposit); `onboarding/payment-policies` renders a derived charge-schedule preview (named tiers only; internal capture mode hidden); read-only "Payment & Schedule" on the provider booking detail.
- **wc-superadmin:** new payment-review page (`PaymentReviewQueueTable`, `PaymentAuditLogDrawer`, `PaymentReviewResolutionModal`); FM bulk tool (date/provider/region + fee toggle); provider admin-review surface; remove `PayoutModeModal`/`transferDate` UI.

### Step 8 remainder — payout schema M2 + financial-display re-sourcing (folded into step 10)

The payout **engine** is deleted (service/module/cron/DTOs, webhook log-only, no
manual schedule, Reimbursement retired). What remains is schema-coupled and ties
to the superadmin financial UI, so it lands with step 10:

- **Re-source the financial displays** that still read `PayoutEvent` /
  `BookingPayoutSchedule`: provider earnings (`camps.service.ts`), superadmin
  financial (`financial.service.ts`), application-review (`application-review.service.ts`),
  and the `ProviderPayout*` notification prop-loaders (`prop-loaders.ts`) +
  `provider-engagement.cron.ts`. Earnings now derive from **captured Payments**
  (the provider's automatic Stripe payouts are no longer platform-tracked).
- **Remove the `ProviderPayout*` `NotificationType`s** (wc-types + catalogs +
  prop-loaders + settings copy) — dormant since the dispatch site was removed.
- **Schema M2 (destructive):** once the reads above are gone, drop the
  `BookingPayoutSchedule` + `PayoutEvent` models, the `PayoutMode`/`PayoutTrancheReason`/
  `PayoutTrancheStatus`/`PayoutStatus` enums, and the payout fields on
  `BookingGroup`/`ProviderSettings`; then
  `npx nx prisma:migrate wc-nest-api --name payments_revamp_payout_engine_removal`.

### Step 7 remainder — provider-cancel + reschedule (folded into step 10)

Net-new backend flows that surface in the wc-superadmin review-queue UI, so built
alongside step 10. The shared cancel sink (`markGroupCancelled → cancelForBooking`)
and Force Majeure already cancel scheduled captures; these add the provider-driven
paths on top:

- **`cancelByProvider`:** provider-initiated programme cancellation → full refund of
  all captures (`refund_application_fee: true`) via the existing refund path + the
  cancel sink; inserts a `provider_admin_review_queue` row (default `precautionary`,
  escalating to account-wide for safeguarding/fraud) — **no auto-suspend**; notify.
- **Provider reschedule:** with customer consent → cancel existing rows/jobs, recompute
  the schedule/bands against the new start date, re-capture the consent snapshot;
  without consent → the `cancelByProvider` full-refund flow.

### Step 6b — notification layer (folded into step 10)

The customer/admin alerting for the capture engine, deferred from step 6 (the
state is already persisted; this is the messaging on top). Do it alongside the
step-10 frontends since it shares the notification catalog + email surfaces:

- **Pre-capture reminders (30-day / 7-day):** generalise `balance-reminder.cron.ts`
  to query `booking_scheduled_captures`; new catalog entries + `packages/wc-email-templates`
  templates; card-expiry warning when the saved card expires before a capture.
- **`payment_review` alerts:** catalog entries for the superadmin + provider when
  a booking is escalated (the reconciliation cron sets the DB state; this adds the
  notification dispatch from the escalation site).
- **SCA auth-link email:** ensure the off-session `authentication_required` notification
  surfaces the `next_action.redirect_to_url.url` so the customer can complete 3DS.

---

## 11. Currency

**Support all 15 `SUPPORTED_CURRENCIES`** (the single source of truth in `@world-schools/global-utils/currency`). `SUPPORTED_CONNECT_CURRENCIES` already derives from it and validates at account creation; onboarding DTOs and the two frontend pickers already derive from it (done in the currency task). No gate to relax.

- **Drift test (not a hold):** pin the connect allow-list to the full `SUPPORTED_CURRENCIES` set so the four surfaces (global-utils list → connect allow-list → onboarding DTO → frontend pickers) can never silently diverge — the test fails if any one drops out of sync, in either direction.
- **Operational prerequisite (not code):** for the 11 non-bank-account currencies (everything beyond CHF/EUR/GBP/USD), the platform Stripe account must have `default_currency = chf` with balance conversion-to-default enabled (the platform absorbs that FX) — documented in `stripe.constants.ts`. Confirm this is configured in the live Stripe account.
- **Operational confirmation (not a code gate):** per-country negative-balance recovery (Stripe direct-debits the provider's bank; platform carries no liability under Standard + Direct Charges) should be confirmed with Stripe for the onboarding countries, but does not block the build.

---

## Test strategy

Follow existing patterns (NestJS `Test` + `jest.fn()` mocks; crons via `runBatch()` + query-driven time; BullMQ via `getQueueToken`; `Prisma.Decimal`). Add shared builders `billing/testing/{stripe,prisma}-fixtures.builder.ts`.

- **Engine math:** Flexible→1 capture (and zero deposit); Moderate 60/30/0→multi with correct fractional amounts; equal-% bands→no event; residual cents to final (`sum===balance`); deposit excluded from balance walk and refund base.
- **Grace:** 24h-from-request; zero-length when ≤7 days; the 7-day boundary (fixed dates).
- **Acceptance guard at every site:** delayed job, reconciliation cron, at-acceptance deposit, near-term sync — each refuses to fire on a not-yet-accepted or cancelled booking.
- **Tz/day-counting:** `calendarDayMidnightUTC` for EST/PST/London incl. a DST transition; fallback-to-provider-tz when the camp lacks an IANA zone.
- **Idempotency:** same `(bg,seq,amount)`→identical key; changed amount→different key.
- **Integration (mocked Stripe + query time):** accept-within-grace→deferred capture→succeeded; accept-after-grace→immediate; near-term no-deposit→sync capture gates confirmation; cancel-within-grace→PI cancel + jobs removed + rows cancelled (no refund); cancel-after-grace→balance-only refund when tier>0; provider-cancel→full refund + review row + no auto-suspend; FM bulk→cancel captures + refund minus fee.
- **Cancel-sink coverage:** `markGroupCancelled` removes jobs/rows for **all** paths (parent within/after grace, camp-cancel, provider-declined, fraud, FM).
- **Cron:** due-pickup + acceptance-guard filter; lock acquire/skip; state machine; job/cron race converges; lost-job recovery.
- **Webhook:** succeeded/payment_failed(auth_required)/canceled; out-of-order no-rollback; duplicate dedup; SCA-success-after-`payment_review` wins and doesn't double-count.
- **Refund:** grace 100% no-fee; post-grace deposit forfeit + balance-only %; provider-cancel fee:true; FM fee:false + toggle.
- **Reimbursement-retirement regression:** post-capture refund succeeds with `requiresReimbursement=false`, no `Reimbursement` row.
- **Audit/consent:** every event appends a row (actor + prior/new + reason); consent one-active-per-booking with IP/UA/schemaVersion; append-only.
- **Removal regression:** submit creates no `BookingPayoutSchedule`; accept no longer calls `generateScheduleForBooking`; payout notification types gone.
- **Currency:** drift test asserting the connect allow-list equals the full 15-entry `SUPPORTED_CURRENCIES`; an onboarding/settlement happy-path for a non-bank currency (e.g. JPY) exercising the CHF FX-to-default path.
- **Frontend vitest:** charge-schedule derivation; consent construction + checkbox gating; deposit-toggle PATCH; review-queue fetch/filter; audit-drawer read-only.

---

## Verification (end-to-end)

1. `nx prisma:generate wc-nest-api && nx prisma:migrate wc-nest-api` (M1) — client compiles.
2. `nx run-many -t build --all` after each phase; `nx affected -t test` green.
3. `nx test wc-nest-api` for billing/booking suites; `nx test wc-booking wc-provider wc-superadmin` (vitest).
4. Manual happy-path with Stripe test mode: create deposit booking → accept within grace → confirm deferred capture fires at `graceDeadline` (advance time / trigger cron) → reach a balance band → confirm off-session capture + `application_fee_amount`; verify a consent row (with IP/UA) and audit rows exist.
5. Cancel paths: within-grace (PI canceled, no refund, jobs gone), after-grace (balance-only refund), provider-cancel (full refund + review-queue row, provider NOT auto-suspended), FM bulk (captures cancelled + refund minus fee).
6. SCA: force `authentication_required` (Stripe test card) → auth link emailed → completing 3DS after `payment_review` clears it without double-charging.
7. Post-M2: grep confirms zero references to `BookingPayoutSchedule`/`PayoutEvent`/`payoutMode`; refunds still succeed (`requiresReimbursement=false`).
8. `lint` clean across affected projects.

---

## Critical files

- `apps/wc-nest-api/prisma/schema.prisma`
- `apps/wc-nest-api/src/modules/billing/shared/cancellation-policy.util.ts` + new `capture-schedule.util.ts`
- `apps/wc-nest-api/src/modules/billing/intents/payment-intents.service.ts`
- `apps/wc-nest-api/src/modules/billing/refunds/refunds.service.ts` (`markGroupCancelled` ~1325/1351, `resolveRequiresReimbursement` ~1227)
- `apps/wc-nest-api/src/modules/booking-groups/booking-groups.service.ts` + `user/booking-groups/booking-groups.controller.ts` (submit endpoint)
- `apps/wc-nest-api/src/modules/billing/payouts/**` (removal) + `crons/balance-charge.cron.ts`, `crons/balance-reminder.cron.ts`
- `apps/wc-nest-api/src/modules/common/profile-completion/**` (BullMQ pattern), `notifications/queue/**`
- `apps/wc-nest-api/src/modules/stripe/{stripe-webhook.service.ts,stripe.constants.ts}` + `provider/stripe-connect/stripe-connect.service.ts`
- `packages/wc-utils/src/lib/payment-plan.ts`, `packages/wc-types/src/lib/cancellation-policy.types.ts`
- Frontends: `apps/wc-booking/.../stripe-payment-section.tsx` + review sidebar; `apps/wc-provider/.../camps/[campId]/edit/sessions` + `onboarding/payment-policies`; `apps/wc-superadmin` financial/payment-review surfaces

---

## Residual external dependencies (do not block the build)

1. Flexible/Moderate/Strict preset bands & percentages — **LOCKED 2026-06-17 (Alex):** Flexible 100%→30d→0%, Moderate 100%→60d/50%→30d/0%, Strict 100%→90d/50%→60d/0%, Custom = camp-defined. All wired as named-tier constants in `cancellation-policy.types.ts` (kept the existing TS-constant pattern; no config/migration seed needed). Strict earns 1 provider trust point. Flexible remains bound to zero deposit.
2. No-deposit "cost-free until first capture" exposure — commercial confirmation pending.
3. Per-country negative-balance recovery + platform-account FX config (`default_currency=chf` + balance conversion) — operational confirmations for the non-bank currencies; not code gates (all 15 currencies supported in code per your decision).
