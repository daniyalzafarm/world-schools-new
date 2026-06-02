# Booking Flow Audit — wc-booking ⇄ wc-provider

**Status:** Launch-blockers remediated · **Branch:** `feat/guardrails-in-booking-flow` · **Date:** 2026-06-01

---

## 1. Executive summary

A strict, production-readiness audit of the camp-booking flow (parent booking on **wc-booking**
↔ provider response on **wc-provider**, backed by **wc-nest-api**) found that the flow relied on
**partial, scattered, and frontend-only guardrails**. The headline finding: **backend
child-eligibility matching did not exist in any form** — a child of any age, gender, or skill
level could be booked into any camp, with the only "checks" being a hardcoded `8–17` age range
on the frontend that is trivially bypassable.

All launch-blocking gaps are now closed on the backend (the authoritative layer) with shared
rule modules consumed by both frontends and mirrored in the UI. Eligibility, dates, the
acceptance window, capacity, the state machine, authorization, and payment linkage are enforced
server-side; the frontends pre-validate using the *same* rules for good UX. Remaining items are
lower-severity UX polish (the backend already rejects the underlying bad states) and one
operational step: applying the migration to each environment.

---

## 2. Methodology & scope

- **Discovery:** 9 parallel read-only agents swept the backend lifecycle, provider response,
  camp/session/eligibility model, child-eligibility matching, state-machine/payment/capacity,
  the wc-booking flow, the wc-provider editor/requests, and the shared packages — followed by
  manual backend verification of the highest-risk paths.
- **Scope (confirmed with stakeholders):** comprehensive (all severities), with four product
  decisions:
  1. **Comprehensive** remediation (not just blockers).
  2. **Registration-window schema fields deferred** — gate only on "session published **and**
     `startDate` in the future" for launch.
  3. **Strict gender** match for boys/girls camps (unmappable/unspecified gender is blocked).
  4. **Hard-block readiness** at submit = `dateOfBirth` present **+** ≥1 emergency contact
     **+** (residential camps only) medical info present. The 75% profile-completion threshold
     is a soft FE hint, not a gate.

---

## 3. Findings → remediation matrix

Legend — **Status:** ✅ Fixed · 🟡 Deferred (tracked in §8) · ⚪️ N/A.

### (A) Date & window validations
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| No check that a session is still bookable (started/past) at draft/submit | High | ✅ | `isSessionBookable` in [date-validation.ts](packages/wc-utils/src/lib/date-validation.ts); enforced in `createDraftForParent`, `updateDraftForParent`, `submitForParentLocked` |
| Camp `status` never checked (draft/archived/suspended bookable) | High | ✅ | `camp.status === 'published'` gate at draft + submit ([booking-groups.service.ts](apps/wc-nest-api/src/modules/booking-groups/booking-groups.service.ts)) |
| Session min/max duration not validated in the editor | Med | ✅ (max) | `sessionDurationDays` ≤ 365 in [sessions.service.ts](apps/wc-nest-api/src/modules/provider/sessions/sessions.service.ts); min covered by existing `end > start` |
| Configurable registration open/close windows | High | 🟡 | Deferred by decision #2 |

### (B) Child eligibility / requirement matching — *the largest gap*
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| **No backend eligibility enforcement at all** | Critical | ✅ | Shared engine `validateChildAgainstCamp` ([booking-eligibility.ts](packages/wc-utils/src/lib/booking-eligibility.ts)) + `EligibilityService` ([eligibility.service.ts](apps/wc-nest-api/src/modules/booking-groups/eligibility.service.ts)); authoritative gate in `submitForParentLocked` |
| Age never matched to `Camp.ageGroups` | Critical | ✅ | `checkAgeEligibility` (age at session start, UTC-safe) |
| Gender never enforced | High | ✅ | `checkGenderEligibility` (strict: boys⇒male, girls⇒female, coed⇒any) |
| GATE-mode `CampEligibilityRequirement` (skill) never enforced | Critical | ✅ | `checkSkillGate` (child level ≥ minimum via `ActivityScaleLevel.order`) |
| Readiness (DOB / emergency contact / residential medical) not required | High | ✅ | `checkReadiness` per decision #4 |
| No pre-booking eligibility feedback to the parent | Med | ✅ | `POST /user/booking-groups/eligibility-check` ([controller](apps/wc-nest-api/src/modules/user/booking-groups/booking-groups.controller.ts)) + ChildrenStep wiring |
| No audit of which rules a booking passed | Med | ✅ | `eligibilityCheckSnapshot` persisted on `BookingGroup` at submit |

### (C) Provider acceptance window & accept/decline
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| 72h `expiresAt` was cosmetic (only the ~6-day Stripe auth cliff expired requests) | High | ✅ | `BookingResponseExpiryCron` ([response-expiry.cron.ts](apps/wc-nest-api/src/modules/booking-groups/crons/response-expiry.cron.ts)) voids auth + `request→expired`; `acceptForProvider` rejects past `expiresAt` |
| Accept used a non-guarded `update` (double-accept side effects) | Med | ✅ | Status-guarded `updateMany({where:{status:'request'}})` + idempotent re-read |
| Unlimited acceptance-window extensions | Med | ✅ | `extensionCount` cap (3) + `lastExtendedAt` audit |
| `other` decline reason had no meaningful min-length / moderation | Med | ✅ | DTO `MinLength(10)` + service guard + `declineReasonModerationStatus = pending` |

### (D) Capacity / overbooking / concurrency
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| Count-then-write capacity check (TOCTOU race for the last spot) | High | ✅ | `SELECT … FOR UPDATE` on the session row wrapping recount + transition in one tx (`submitForParentLocked`) |
| Per-age-group spots ignored (generic total only) | High | ✅ | `checkCapacityFit` ([session-capacity.ts](packages/wc-utils/src/lib/session-capacity.ts)) tallies by each child's matched age group |
| No capacity re-check at accept time | High | ✅ | `evaluateSessionCapacity` re-run in `acceptForProvider` |
| Same child double-booked into the same session | High | ✅ | `assertNoDuplicateBookings` (app-layer; see §9) |
| Abandoned drafts hold phantom UX spots | Med | ✅ | Row-locked, status-guarded `BookingDraftCleanupCron` ([draft-cleanup.cron.ts](apps/wc-nest-api/src/modules/booking-groups/crons/draft-cleanup.cron.ts)) removes drafts untouched > 48h |

### (E) Booking state-machine integrity
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| No transition guard; status writes scattered | High | ✅ (core flow) | `BOOKING_STATE_TRANSITIONS` / `assertValidTransition` ([booking-state-machine.ts](packages/wc-types/src/lib/booking-state-machine.ts)); asserted on submit/accept/decline |
| Billing services not routed through the guard | Med | 🟡 | Intentionally deferred (see §9) |

### (F) Authorization / ownership
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| Parent/provider ownership checks | — | ✅ (already solid) | Retained; camp-status gate added at draft + submit |

### (G) Payment-to-booking linkage
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| Provider could accept with **no captured/live payment** ("ghost" accept) | High | ✅ | Pre-capture guard requiring a live `Payment` row in `acceptForProvider` (else `412`) |
| Card-auth expiry between submit and accept | Med | ✅ (already) | `PAYMENT_AUTH_EXPIRED` recovery path retained |

### (H) Frontend UX guardrails / parity
| Finding | Sev | Status | Where it now lives |
|---|---|---|---|
| Hardcoded 8–17 age range, no real eligibility | High | ✅ | ChildrenStep runs the shared engine (real age groups + gender + readiness) — [camp-booking-flow.tsx](apps/wc-booking/src/components/camp-booking/camp-booking-flow.tsx) |
| Past/closed sessions selectable | High | ✅ | SessionsStep filters via `isSessionBookable` |
| Special-request had no length limit | Low | ✅ | `maxLength=1000` + counter |
| Provider could click Accept on an expired request | High | ✅ | Accept disabled past `expiresAt` ([booking-request-drawer.tsx](apps/wc-provider/src/components/booking-requests/booking-request-drawer.tsx)) |
| No eligibility visibility for the provider | High | ✅ | Eligibility summary from `eligibilityCheck` snapshot in the request drawer |
| Add-on `minAge/maxAge` enforcement | Med | ✅ | BE `assertChildWithinAddOnAge` in `saveAddOnsForParent`; FE disables ineligible children in AddonsStep |
| Pre-submit eligibility re-validation (catches skill gates before payment) | Med | ✅ | `checkEligibility` ([booking-groups.services.ts](apps/wc-booking/src/services/booking-groups.services.ts)) wired into the store's `createDraftBookingGroup` |
| Add-child "complete profile" prompt; Stripe mount timeout + retry | Low-Med | ✅ | [add-child-form-fields.tsx](apps/wc-booking/src/components/children/add-child-form-fields.tsx); [stripe-payment-section.tsx](apps/wc-booking/src/components/camp-booking/stripe-payment-section.tsx) (15s timeout + "Try again") |
| Provider bookings-list eligibility column; camp-editor impact warnings | Low-Med | ✅ | `eligibilityAllMet` column in [booking-requests-view.tsx](apps/wc-provider/src/components/booking-requests/booking-requests-view.tsx); edit notices in SessionForm + AudienceForm |

---

## 4. Top 5 pre-audit risks — how each was closed

1. **No backend eligibility matching.** → Shared `validateChildAgainstCamp` engine + a hard
   gate in `submitForParentLocked` that runs *before* any Stripe intent; ineligible children
   return `422` with structured per-child reasons, and the result is snapshotted for audit.
2. **Capacity TOCTOU + per-age-group blind spot.** → `SELECT … FOR UPDATE` on the session row
   wrapping the recount + draft→request transition, with per-age-group tallying.
3. **Accept with no captured payment.** → Pre-capture guard requiring a live `Payment` row;
   otherwise `412 NO_PAYMENT_AUTHORIZATION`.
4. **Camp-status / acceptance-window not enforced.** → `camp.status === 'published'` gate +
   `expiresAt`-aware accept rejection + a cron that expires + voids auth at the real 72h mark.
5. **No state-machine guard + non-guarded accept.** → Shared transition graph asserted on every
   core transition; accept/decline converted to status-guarded `updateMany`.

---

## 5. Architecture

**Pure, dependency-free rules** live in shared packages so the two frontends (Next.js + Vite)
and the NestJS API enforce *identical* logic — no drift:

```
packages/wc-utils/src/lib/
  date-validation.ts      → calculateAgeAtDate, isSessionBookable, sessionBookabilityIssue
  booking-eligibility.ts  → validateChildAgainstCamp (age / gender / GATE skill / readiness)
  session-capacity.ts     → checkCapacityFit (single + per-age-group)
packages/wc-types/src/lib/
  booking-state-machine.ts → BOOKING_STATE_TRANSITIONS, assertValidTransition
  bookings.types.ts        → BookingDeclineReason (relocated here) + EligibilityResult types
```

**DB-touching orchestration stays in wc-nest-api** — `EligibilityService` (Prisma I/O + shape
mapping), the `SELECT … FOR UPDATE` capacity transaction, ownership scoping, HTTP errors, and
the `BookingResponseExpiryCron`. Skill GATEs are evaluated authoritatively on the backend (the
FE lacks each child's skill levels), so the FE intentionally evaluates only age/gender/readiness
for instant feedback.

**Audit trail:** `BookingGroup.eligibilityCheckSnapshot` (`{ checkedAt, results }`) freezes the
gate result at submit, surfaced in the provider request drawer.

---

## 6. Verification status

- **Shared unit tests:** 98 passing (`nx run-many -t test -p wc-utils wc-types`) — date/age
  math, eligibility (age/gender/skill/readiness/combined), capacity (single + age-group),
  state-machine transitions.
- **Backend service tests:** 29 passing (`booking-groups.service.spec`), including 5 new gate
  tests (ineligible-child `422`, camp-not-published, session-started, accept-expired,
  no-payment-authorization).
- **Static checks:** `tsc --noEmit` clean for wc-nest-api / wc-booking / wc-provider /
  wc-types / wc-utils / wc-frontend-utils; `nx lint` 0 errors across all changed projects.
- **Note:** the 3 failing `messaging/*` suites are **pre-existing and unrelated** — reproduced
  with this branch's changes stashed (no messaging files were touched).

---

## 7. Manual end-to-end test plan

Seed a published camp with: a **GATE** skill requirement, **boys-only**, **age 10–12**, and a
published session with **capacity = 1**.

1. **Eligibility blocks at submit** — attempt each and confirm a `422` with the specific reason
   surfaced in ChildrenStep: under/over age; a girl; a child below the GATE skill level; a
   child with no DOB; a child with no emergency contact; (residential camp) no medical info.
2. **Happy path** — an eligible boy aged 11 with a complete profile → request created, card
   authorized.
3. **Capacity race** — with capacity = 1 already taken, a second parent submitting gets a clean
   `409` ("session is now full"), not an oversell.
4. **Acceptance window** — provider accepts within 72h → captured + accepted; let a request
   pass `expiresAt` → the `BookingResponseExpiryCron` flips it to `expired` and voids the auth;
   confirm a late accept is rejected and the drawer's Accept button is disabled.
5. **Idempotency / stale auth** — double-accept is idempotent; accepting with an expired card
   hold returns `PAYMENT_AUTH_EXPIRED`.
6. **Provider visibility** — the request drawer shows the eligibility summary from the snapshot.

Run alongside `npx nx affected -t test lint` and `npx nx prisma:generate wc-nest-api`.

---

## 8. Open items / next steps

**Required before production launch**
- **Apply the migration** to each environment:
  `npx nx prisma:migrate:deploy wc-nest-api`. The migration
  ([20260601120000_booking_guardrails](apps/wc-nest-api/prisma/migrations/20260601120000_booking_guardrails/migration.sql))
  is authored and the Prisma client is regenerated, but it has **not** been run against a live DB.
- **Execute the manual E2E plan** (§7) on staging.

**FE polish — ✅ now complete** (delivered after the initial launch-blocker pass)
- Add-on `minAge`/`maxAge` enforcement (FE + BE); pre-submit eligibility re-validation via the
  `eligibility-check` endpoint; add-child "complete profile" prompt; Stripe-Elements mount
  timeout + "Try again"; provider bookings-list eligibility column; camp-editor impact warnings
  (SessionForm + AudienceForm).

**Optional hardening (still open / by decision)**
- **Billing state-machine wiring — intentionally NOT done.** Routing live money-movement paths
  (payment-intents / refunds / balance-charge / disputes / payouts) through a throwing
  `assertValidTransition` risks breaking payments if any real transition is missed; these
  writes are already individually status-guarded and the state machine is enforced in the
  booking flow + crons. Do as a separate, carefully-tested change if desired.
- Review `normalizeChildGender` token map with product/legal; consider a controlled child
  gender enum to remove free-text ambiguity.
- Registration/booking-window fields (`registrationOpenAt` / `registrationCloseAt`).

---

## 9. Deviations from the implementation plan

1. **Duplicate-booking is enforced at the application layer**, not via a DB partial-unique
   index — the booking status lives on `booking_groups`, not `bookings`, so a partial unique
   index on `bookings(child_id, session_id)` cannot reference status. Enforced inside the
   capacity transaction (`assertNoDuplicateBookings`); noted in the migration.
2. **State-machine guard is enforced in the core booking flow only** (submit/accept/decline),
   not wired into the billing services — to avoid destabilizing live payment paths. The
   transition map is a faithful superset, so billing can be routed through it later safely.
3. **Half-day "same-day" session rule skipped** — it conflicts with the existing `end > start`
   invariant; the unambiguous max-duration guard (≤ 365 days) was added instead.
