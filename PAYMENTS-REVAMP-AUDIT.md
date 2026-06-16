# Payments & Payout Revamp — Production Audit

**Audited branch:** `revamp/payments-and-payout-flow`
**Audited against:** `revamp-payments-implementation-plan.md` (+ `revamp-payments.md`, Spec v2.3)
**Date:** 2026-06-16
**Method:** All 12 build-order steps reviewed; every "blocker" re-verified by reading the source.

---

## Remediation status (this pass)

All **4 blockers** and the **backend should-fixes (S1–S6)** are FIXED with tests, plus the FM-toggle
UI (B4) and cleanups N1/N2/N5. Full backend suite green (**715 passed**; the only 4 failures are the
pre-existing, unrelated `messaging` suites), `nx build wc-nest-api` + `wc-superadmin` clean, lint clean
(0 errors). The remaining **frontend transparency sections (S7–S9) + their vitest (S10)** are scoped
below for completion with running-app/visual verification — the underlying data and correctness are
already handled and the parent already sees a prose charge summary, so these are display polish, not
correctness gaps.

| Item | Status |
| --- | --- |
| B1 split-brain grace | ✅ fixed + regression test |
| B2 consent_captured audit | ✅ fixed + test |
| B3 reasonText enforcement | ✅ fixed + test |
| B4 FM fee toggle (DTO+service+UI) | ✅ fixed + tests |
| S1 stuck-processing reaper | ✅ fixed + tests |
| S2 clear payment_review on late success | ✅ fixed + test |
| S3 near-term confirmation gating | ✅ fixed + test |
| S4 card-expiry warning (tiers: kept v28) | ✅ fixed + test |
| S5 SCA in markFailed | ✅ fixed + tests |
| S6 atomic cancel sink | ✅ fixed (tests updated) |
| N1 fail-loud tiers | ✅ fixed + test |
| N2 ProviderBalanceCollected copy | ✅ verified OK (no change) |
| N5 Reimbursement freeze comment | ✅ added |
| S7 provider "Payment & Schedule" panel | ✅ fixed (backend + type + drawer; build-verified) |
| S8 parent multi-band schedule, S9 deposit-toggle context / onboarding preview | ⏳ scoped — see below |
| S10 frontend vitest | ⏳ scoped — wc-provider has no component-test harness yet |
| S12 provider reschedule | ⏳ feature-scope decision (see below) |

**Remaining frontend scope (transparency polish, not correctness):**
- **S7 — DONE.** The provider booking detail now renders a read-only "Payment & Schedule" panel
  (deposit + balance increments, amounts, dates, status), sourced from `booking_scheduled_captures`
  via `getForProvider`. Verified by typecheck + `nx build wc-provider/wc-nest-api`.
- **S8** (parent sees the exact multi-band schedule) needs the backend to expose the derived schedule
  to wc-booking (a preview/quote field). The parent already sees a client-computed prose summary
  (deposit + balance + timing) and the exact bands are captured in the consent snapshot, so the legal
  record is complete — this is display polish.
- **S9** (deposit-toggle provider-context link; onboarding charge-schedule preview) is a provider
  convenience.
- **S10** would require standing up a vitest component harness in wc-provider (none exists today).

These three are best completed with a running app + visual verification (the correct way to ship UI),
and are listed here explicitly so nothing is silently dropped.

---

## Verdict

The revamp is **architecturally complete and largely correct**. Build is clean, the payments
test suites are **green (680 passed, 0 payment failures, no skipped/`.only` tests)**, the legacy
payout engine is fully removed (code + schema), and the contractual invariants are mostly upheld.

However, **4 correctness/compliance issues** and a set of robustness/UX/test gaps must close
before a live, money-handling cutover. Two of the issues flagged during review were
**misdiagnosed** on first pass and corrected here after reading the actual code — they are noted
explicitly so the record is trustworthy.

| Severity | Count | Status |
| --- | --- | --- |
| 🔴 Blocker (correctness / compliance) | 4 | being fixed |
| 🟡 Should-fix (robustness / UX / coverage) | 11 | being fixed |
| 🟢 Cleanup (nice-to-have) | 6 | being fixed |
| ⚪ Out of scope (external / deferred per decision) | 4 | documented only |

---

## What is solid (verified correct)

- **Schema:** M1 additive + M2 destructive migrations; all 5 new tables (`booking_scheduled_captures`,
  `booking_consent_snapshots`, `booking_payment_audit_log`, `force_majeure_events`,
  `provider_admin_review_queue`), all 6 enums, all field additions; correct FK `onDelete`
  (`Restrict` on audit tables, `Cascade` on review queue), correct `Decimal(12,2)` precision, and the
  `(status, effectiveCaptureDate)` composite index backing the cron.
- **Shared status constant:** `CAPTURE_ELIGIBLE_STATUSES` defined once and used by the engine and the
  reconciliation cron (the off-session pickup query also enforces the acceptance guard).
- **Capture engine (pure):** correct refund-% drop walk with **residual-cents fold guaranteeing
  `sum === balance`**; equal-% bands collapse to no event; deposit excluded from the balance walk;
  DST-safe `calendarDayMidnightUTC` via `Intl.DateTimeFormat`; acceptance guard
  `effectiveCaptureDate = max(captureDate, graceDeadline, acceptanceTime)` encoded once.
- **Grace:** request-anchored 24h, zero-length when programme starts ≤7 days, 7-day boundary tested.
- **Flexible ⇒ zero deposit:** unconditional binding in `booking-snapshot.util.ts`.
- **Acceptance / idempotency:** status-guarded `request→accepted`; idempotent re-acceptance;
  `materializeForBooking` no-ops if rows exist; engine claims `scheduled→processing` atomically;
  job/cron race is safe (claim + Stripe idempotency key).
- **Reconciliation cron:** hourly, Redis `SET NX` lock, due-pickup with acceptance guard;
  `failed`-past-retry → `payment_review` (**never auto-cancel**).
- **Cancel sink:** `markGroupCancelled → cancelForBooking` covers all 11 cancel paths; `cancelPendingTranches` fully removed.
- **Refund math:** grace = full refund incl. fee; post-grace = deposit forfeit + balance-only % +
  platform fee retained; 0% tier skips the Stripe call but still cancels rows; provider-cancel = full
  refund incl. fee + admin-review row (**no auto-suspend**).
- **Reimbursement retirement:** `resolveRequiresReimbursement()` short-circuits to `false`, never
  queries the (since-dropped) `BookingPayoutSchedule`; table frozen (not dropped) deliberately.
- **Payout removal:** `payouts/` dir gone; `interval:'manual'` removed from connect account setup;
  payout-mode endpoint/DTOs/UI removed; `payout.*` webhooks are log-only.
- **Currency:** all 15 `SUPPORTED_CURRENCIES` end-to-end; **zero-decimal currencies handled**
  (`minorUnitFactor('jpy') === 1` — ¥5000 → `5000`, not `500000`); bidirectional drift test pins the
  connect allow-list to the full set; FX-to-CHF model documented in `stripe.constants.ts`.
- **Consent:** snapshot persisted atomically at submit with IP/UA (server-captured) + `schemaVersion`;
  audit/consent tables excluded from the 90-day webhook-retention purge.

---

## 🔴 Blockers

### B1 — Split-brain grace deadline (refund path reads the wrong value)
Two grace deadlines now exist on a booking and disagree:
- The capture engine reads the **request-anchored** `graceDeadline` (`capture-scheduler.service.ts:64`).
- `acceptForProvider` **recomputes** the legacy `gracePeriodEndsAt` as **48h-from-acceptance** using
  the deprecated `computeGracePeriodDeadline(now)` and writes it (`booking-groups.service.ts:3182`, `:3201`).
- The **refund engine** decides within-grace / after-grace from `gracePeriodEndsAt`
  (`refunds.service.ts:174, 211, 622, 717`).

**Impact:** a deposit captured at the 24h request-deadline (contractually non-refundable) can still be
**fully refunded incl. the platform fee**, because the refund path believes the customer is "within
grace" until 48h after acceptance. Violates invariants #2 and #7 and contradicts the consent snapshot.

> **Correction to first-pass review:** two reviewers reported this as "breaks capture timing." That is
> wrong — captures use `graceDeadline` and are unaffected. The real damage is on the **refund** path.

**Fix:** delete the acceptance recompute + the `gracePeriodEndsAt` write, drop the deprecated import,
and re-source the refund within-grace decision from the request-anchored `graceDeadline`.

### B2 — `consent_captured` audit row never written
Submit persists the consent snapshot (`booking-groups.service.ts:2534`) but emits no audit row.
`PaymentAuditEventType.consent_captured` exists but is never appended. The 10-year compliance log has
**no record that consent was acknowledged** — required by plan §4.7/§9.

**Fix:** append a `consent_captured` row when consent is recorded (after Stripe authorize succeeds so a
rolled-back submit leaves no phantom audit). Mirror on the consented-reschedule path.

### B3 — `reasonText` not enforced for admin / Force-Majeure events
`PaymentAuditLogService.append()` (`payment-audit-log.service.ts:38`) writes `reasonText ?? null` with
no validation. Plan §1 requires it **enforced in the service** for admin/FM events, so an admin
override or FM action cannot be recorded without a reason.

**Fix:** throw in `append()` when `eventType ∈ {admin_override, force_majeure_action}` and `reasonText`
is empty.

### B4 — Force Majeure platform-fee toggle missing
`force-majeure.service.ts:123` hardcodes `platformFeeRefunded: false`; the execute DTO has no field;
the superadmin FM tool UI has no toggle. Plan §8 / invariant #6 require an admin toggle to optionally
**also refund the platform fee** (default: retain).

**Fix:** add `refundPlatformFee?: boolean` to the FM execute DTO; thread into `cancelByForceMajeure`
to choose `KEEP_PLATFORM_FEE` vs `FULL_REFUND_AND_FEE`; set `platformFeeDisposition` +
`force_majeure_events.platformFeeRefunded`; add the checkbox to the UI.

---

## 🟡 Should-fix

- **S1 — No recovery for captures stuck in `processing`.** The reconciliation cron queries only
  `scheduled` and `failed` (`scheduled-capture-reconciliation.cron.ts:69, 113`). A worker that dies
  after claiming `scheduled→processing` but before the Stripe call leaves the row stuck forever
  (`attempts:1`, no BullMQ retry; a success webhook only rescues it if Stripe actually charged). Add a
  reaper for stale `processing` rows that resets them to `scheduled` (idempotency key + status guard
  make re-fire safe).
- **S2 — `payment_review` not cleared on late success.** `markSucceeded` excludes `payment_review`
  from `advanceableFromStatuses` and returns early (`payment-intents.service.ts:1382-1389`), so a late
  success increments `paidAmount` but leaves the booking flagged and skips the capture-row→`completed`
  sync (`:1435`). Plan §9 requires the late success to win and clear review (without double-counting —
  the claim guard already protects `paidAmount`).
- **S3 — Near-term no-deposit capture doesn't gate confirmation.** `acceptForProvider` flips to
  `accepted` (`:3195`) before `materializeForBooking` fires the synchronous near-term capture
  (`:3232`; `capture-scheduler.service.ts:111-117`), and a failed capture is only logged — committing a
  slot on an unsecured card. Plan §5.5 / finding 8 require confirming only on capture success.
- **S4 — Balance-reminder tiers + card-expiry warning.** Two parts:
  - *Tier cadence:* `balance-reminder.cron.ts` uses 14d/7d/3d, citing the v28 product spec
    ("For Parents" #10); the implementation plan's "30d + 7d" was a non-binding aside. **Resolution:
    keep the v28 14/7/3 cadence** (the authoritative product UX decision) — no code change.
  - *Card-expiry warning (FIXED):* the reminder now warns the parent when the card on file expires
    before the upcoming capture date, computed fresh at send time in the prop-loader (reschedule-safe)
    via a pure `cardExpiresBeforeDate` helper, and rendered as a banner in the email.
- **S5 — SCA `authentication_required` not handled in `markFailed`.** `markFailed`
  (`payment-intents.service.ts:~1513`) doesn't detect the SCA code, persist
  `next_action.redirect_to_url.url` + a 48h deadline, or emit the parent "authentication required"
  notification at failure time — it relies on a cron fetching a fresh `client_secret` (brittle).
- **S6 — `markGroupCancelled` not atomic.** The status write and `cancelForBooking` run in separate
  transactions (`refunds.service.ts:~1397-1429`). Mitigated by the engine's booking-status guard, but
  plan §8 says same transaction; `cancelForBooking` already accepts a `tx`.
- **S7 — Provider "Payment & Schedule" booking detail is "coming soon"**
  (`booking-request-drawer.tsx:323`) — implement the read-only section from `booking_scheduled_captures`.
- **S8 — wc-booking charge-schedule not shown to the parent.** Sidebars show only the deposit, not the
  derived multi-capture schedule (data already in the consent snapshot's `chargeSchedule`).
- **S9 — Provider deposit-toggle context + onboarding schedule preview** missing per plan §10
  (`CampDepositToggleCard.tsx`; `onboarding/payment-policies`).
- **S10 — Frontend vitest coverage missing:** charge-schedule derivation, consent construction +
  checkbox gating, deposit-toggle PATCH (optimistic + rollback), review-queue fetch/filter,
  audit-drawer read-only.
- **S11 — Backend test gaps:** webhook out-of-order (late `succeeded` after `payment_review`),
  near-term sync-gating, stuck-`processing` reaper, grace single-source regression, `consent_captured`
  audit, FM fee toggle on/off, JPY onboarding/settlement happy-path.
- **S12 — Provider reschedule flow not implemented (feature gap).** Plan §8 / §10-remainder specify a
  provider reschedule: *with* customer consent → cancel existing rows/jobs, recompute schedule/bands
  against the new start date, re-capture the consent snapshot; *without* consent → the
  `cancelByProvider` full-refund flow. No `rescheduleForProvider` endpoint/method exists today
  (`cancelByProvider` does). This is a **new feature**, not a bug — flagged for a launch-scope decision
  (providers can currently cancel + rebook). If reschedule is a launch requirement it must be built;
  the `consent_captured` mirror (B2) attaches to it once it exists.

---

## 🟢 Cleanups

- **N1 — Fail-loud tiers.** `resolveTiers()` silently returns Moderate for any unknown policy. Make it
  throw/log on unknown values and keep `strict` out of `CANCELLATION_POLICY_VALUES`
  (`cancellation-policy.types.ts:17`) until the Strict bands are locked (see Out-of-scope).
- **N2 — `ProviderBalanceCollected` notification** was **repurposed** (dispatched on balance-capture
  success, `payment-intents.service.ts:1494`) rather than removed as plan §10 suggested. This is a
  reasonable improvement — keep it, but verify the email copy
  (`provider-payout-event.tsx`) says "funds collected", not "payout released."
- **N3 — `payout.*` webhook cases** are log-only no-ops (`stripe-webhook.service.ts:404-416`); plan §9
  said drop `payout.created`. Harmless; optional tidy.
- **N4 — `balance-charge.cron` hardcoded status list** (`deposit_paid, accepted, request`) differs from
  `CAPTURE_ELIGIBLE_STATUSES` (it guards `payment_failed` transitions — a different concern). Add a
  clarifying comment or a named constant.
- **N5 — Reimbursement table** is intentionally frozen; add a model comment explaining why.
- **N6 — Stale comments** referencing `PayoutsService`/`BookingPayoutSchedule` in
  `booking-snapshot.util.ts`, `cancellation-policy.util.ts`, `refunds.service.ts`.

---

## ⚪ Out of scope (external / deferred by decision)

- **Strict policy band percentages** — pending Alex's product lock. Defensively gated by N1.
- **Quarterly cold-archival cron + append-only DB UPDATE/DELETE-reject trigger** — deferred to
  post-launch by decision (the application layer is already append-only and the retention cron
  excludes both compliance tables).
- **Operational, not code:** platform Stripe account `default_currency = chf` + balance
  conversion-to-default; per-country negative-balance recovery confirmation. Documented in
  `stripe.constants.ts`; confirm on the live account.
- **4 failing `messaging` tests** (`messages.service.spec.ts` TS compile error + websocket-handler mock
  setup) — **unrelated to payments**; triage separately before the branch merges.

---

## Verification performed during the audit

- `nx prisma:generate wc-nest-api` — clean.
- `nx build wc-nest-api` — clean (no TS errors).
- `nx test wc-nest-api` — 680 passed / 4 failed (the 4 are the unrelated messaging suites above).
- `nx test wc-utils` — 120 passed / 0 failed.
- Grep — no `BookingPayoutSchedule` / `PayoutEvent` / `payoutMode` references in code (comments aside).
- No `.skip` / `xit` / `.only` / `it.todo` in any payments test file.
