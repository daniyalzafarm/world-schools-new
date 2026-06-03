# World Camps — Notification System Gap Analysis

> **Audit date:** 2026-06-03 · **Branch:** `feat/all-apps-notifications` · **Spec:** `WorldCamps_Notifications_v28.xlsx` (v28)
> **Companion artifact:** `WorldCamps_Notifications_v28_AUDITED.xlsx` — every spec row with a per-row Status + Implementation Notes column.

This document lists the gaps found while auditing the implemented notification system against the 126-item v28 spec
(55 provider · 52 parent · 19 superadmin). Each spec row was mapped to its code `NotificationType`, then checked on three
layers — **catalog entry** (template + channels + redirect), **emitter** (a `notify()` call in a service or cron), and
**content fidelity** (rendered copy / salutation / placeholders vs the spec's Description) — plus a **channel** check
(spec In-App/Email columns vs the catalog `channels`).

## Coverage summary

| Audience | ✅ Implemented | 🟡 Partial | ❌ Not Implemented | ⏸️ Deferred | Total |
| --- | --- | --- | --- | --- | --- |
| Parent | 18 | 20 | 14 | 0 | 52 |
| Provider | 23 | 20 | 11 | 1 | 55 |
| Superadmin | 17 | 1 | 1 | 0 | 19 |
| **Total** | **58** (46%) | **41** (33%) | **26** (21%) | **1** | **126** |

**Label meaning** — ✅ fires on the correct channel(s) with materially matching copy · 🟡 fires but with a channel gap, a copy
divergence/bug, or thin copy · ❌ no notification type, or built-but-never-triggered, or feature removed · ⏸️ intentionally out
of scope for launch (SaaS-only).

### How to read these results — one important methodology note

The repo's QA matrix (`docs/notifications-qa.md`) renders each entry against a **stub** for in-app-only entries (it cannot run
the async DB `loadProps` at generation time), so several in-app previews show the literal word `undefined`. **That is a
preview-generation artifact, not a production bug** — in production the in-app title/body hydrate from real Prisma queries
(verified in `resolvers/prop-loaders.ts`). This audit treats those as **implemented**, and only flags `undefined`/broken copy
where it is genuinely reachable in production. Email copy, by contrast, renders from each template's `PreviewProps`, so email
content findings below are real.

---

## A. Built but never triggered — 9 notifications (highest-value gaps)

These have a full catalog entry **and** a React Email / in-app template, but **no `notify()` call fires them anywhere** in the
codebase (confirmed: the `NotificationType` is referenced only inside `catalog/` and `prop-loaders.ts`, never in a service or
cron). They are effectively one wired `notify(...)` line away from working. This is the cleanest, highest-leverage backlog.

| Spec | Title | Code type (built, unwired) | Spec channels | Audit note |
| --- | --- | --- | --- | --- |
| Parent #7 | Your booking has been updated | `ParentBookingModified` | in-app + email | NO-EMITTER (no notify call anywhere). Catalog + parent-booking-modified.tsx exist and the catalog defines in_app+email copy, but no notify call fires it anywhere. Built but never triggered = real gap. Spec wants in_app+email. |
| Parent #23 | Price update on a saved camp | `ParentWishlistPriceDrop` | in-app + email | Type exists with catalog/template (parent-wishlist-event.tsx kind=priceDrop, in_app+email) but no notify call= NO-EMITTER — never fired. Built but never triggered = real gap. |
| Parent #24 | Limited spots remaining | `ParentWishlistFillingUp` | in-app + email | Type ParentWishlistFillingUp (kind=fillingUp, in_app+email) matches 'limited spots' intent but NO-EMITTER — never triggered. Built-but-never-fired gap. |
| Parent #37 | Review Removed by Admin | `ParentReviewRemoved` | in-app + email | NO-EMITTER (no notify call). Catalog + parent-review-removed.tsx exist but no notify fires it. Built-but-never-triggered gap. Aside: catalog salutation 'hi' though spec row 37 requires 'Dear'; channels in_app+email match but moot since not fired. |
| Parent #46 | Wishlist — Session Deadline Approaching | `ParentWishlistDeadlineApproaching` | in-app + email | Type exists with catalog/template (catalog deadlineApproaching, in_app+email) but no notify call= NO-EMITTER: never fired. Built but never triggered; spec deadline nudge does not reach parents. |
| Parent #49 | Early Bird — Price Increase Approaching | `ParentWishlistEarlyBirdIncrease` | in-app + email | Type exists with catalog/template (catalog earlyBirdIncrease, in_app+email) but no notify call= NO-EMITTER: never fired. Requires camps to flag price-change dates (not wired). Built but never triggered. |
| Provider #20 | Booking updated by family | `ProviderBookingModified` | in-app + email | NO-EMITTER; catalog+template (channels in_app,email) exist but notify is never called, so never fires. Spec wants in_app+email. Built but never triggered = gap. |
| Provider #41 | A review has been removed | `ProviderReviewRemoved` | in-app only | NO-EMITTER (no notify call): catalog entry + template exist but no notify call ever fires it. Real gap. (Catalog channels in_app+email would also over-specify vs spec in-app-only, but moot since never triggered.) |
| Superadmin #15 | Camp has requested account deletion | `SuperadminCampDeletionRequested` | in-app + email | Type SuperadminCampDeletionRequested exists in catalog + template (catalog renders title/subject), but NO-EMITTER — no notify call anywhere. Built but never fired. Spec Yes/Yes unmet -> not_implemented. |

**Remediation:** add the `notify(events, NotificationType.X, ctx)` call at the matching domain event — booking-modified in
`booking-groups.service.ts` (both parent + provider), admin review-removal in the moderation flow (`reviews.service.ts`),
the wishlist price/availability/deadline/early-bird signals (price update, low-availability, deadline, and price-increase
detectors), and the camp account-deletion request handler.

---

## B. Removed feature — Invitations (7 spec rows)

The "Invitation to Book" flow was removed (`fix: remove invitations`, commit `98e84e7a`); no invitation `NotificationType`
exists. All invitation spec rows are therefore unimplemented by design. Decide whether to re-introduce the feature or strike
these rows from the spec.

| Spec | Title |
| --- | --- |
| Parent #42 | Invitation to Book — Received |
| Parent #43 | Invitation to Book — Still Open |
| Parent #44 | Invitation to Book — Expired |
| Provider #22 | Your invitation to book has been sent |
| Provider #23 | Invitation accepted — booking confirmed |
| Provider #24 | Invitation declined by family |
| Provider #25 | Invitation expired without a response |

---

## C. No notification type at all — 10 notifications

These spec rows have **no corresponding `NotificationType`** and no emitter — neither inside nor outside the notification
catalog.

| Spec | Title | Why missing / note |
| --- | --- | --- |
| Parent #22 | [Camp Name] hasn't replied yet | No matching enum type. Parent-side 'camp not replied 48h nudge' has no NotificationType (only provider messaging.unanswered24h/48h exist). No emitter. Spec wants in-app only. |
| Parent #25 | A saved camp is no longer listed | No matching enum type for wishlist-camp-deactivated / saved-camp-removed. No emitter. Spec wants in_app+email with alternatives CTA; nothing in catalog covers it. |
| Parent #34 | Review Submitted — Thank You | No matching enum type — no ParentReviewSubmitted/ThankYou (enum has postCamp request/reminder/survey + review responsePublished/removed only). Spec in-app-only confirmation on review submit; nothing emits it. NO type for this trigger. |
| Parent #47 | Inquiry Sent — No Booking After 3 Days | No matching enum type. No inquiry/message-sent post-conversion nudge exists (no Parent*InquiryNoBooking). devNotes not Phase-2/SAAS, so not deferred. Feature absent end-to-end. |
| Parent #50 | Support Ticket Received | No ParentSupportTicketReceived type (only Reply + StatusChanged exist). Confirmed support-tickets.service.ts:187 fires only SuperadminSupportTicketNew on creation; no parent first-touch email inside or outside catalog. Spec wants email-only confirmation; absent. |
| Provider #31 | Your upcoming payout has been adjusted | No type renders the spec's before/after payout breakdown (Original/Refund deducted/Revised payout). ProviderRefundIssued (#26) and ProviderReimbursementOwed (#27/#30) consumed elsewhere; ProviderPayoutDelayed is #36. No distinct emitter for refund-adjusted-payout breakdown. |
| Provider #45 | [Child Name] arrives in 7 days | No per-individual-camper arrival type. Spec wants per-booking '[Child Name] arrives in 7 days' naming child + individual profile link. Closest 7d type ProviderPreCampChecklist is camp/session-level (resolver allProviderUsersForCamp), does not name child — different semantics. No matching emitter. |
| Provider #47 | A participant's balance payment is pending | No provider 'balance overdue/pending' type. ProviderBalanceCollected = collected (opposite); ProviderBookingCancelledNonPayment = post-cancellation (#19). No type fires the day-after-due 'WC is following up' notice. Spec wants in_app+email; nothing emitted. NO-type. |
| Provider #52 | Your profile has been paused | No provider-facing 90d profile-deactivated type. Only SuperadminCampProfileDeactivated (superadmin-engagement.cron.ts:151) exists, which notifies admins not the camp. Spec wants provider in_app+email 'profile paused' notice -> NO-type for provider. |
| Provider #53 | We've received your support request | No *SupportTicketReceived type (only Reply + StatusChanged). support-tickets.service.ts createTicket fires only SuperadminSupportTicketNew (l.187); no first-touch acknowledgement email to requester inside or outside catalog. Spec wants email-only ack -> NO-type. |

---

## D. Channel gaps — 33 notifications (fire, but on the wrong / incomplete channel set)

These **are triggered** but the configured `channels` don't match the spec's In-App/Email columns — most commonly the spec
asks for **both** in-app and email while the code ships only one. The dominant pattern: parent engagement/marketing and
provider engagement reminders are **email-only** (missing the in-app notification), and a few transactional ones
(booking request received/confirmed, request expired) are **in-app-only** (missing the email). Fixing each is usually a
one-line `channels` change plus authoring the missing template.

| Spec | Title | Code type | Channel gap |
| --- | --- | --- | --- |
| Parent #5 | Your booking request has expired | `ParentBookingExpired` | spec in-app + email → service.ts:2488 + reconciliation.cron.ts (72h). CHANNEL GAP: spec wants in_app+email but code is in_app-only — no parent-booking-expired email template. In-app title/body hydrate campName via parentBookingRequestPendingState (QA “undefined” is a preview-stub artifact). Redirect ‘/’ is generic vs spec’s browse-similar CTA. Partial = missing email channel. |
| Parent #26 | Your wishlist is empty — start exploring | `ParentWishlistEmpty` | spec in-app + email → cron.ts:81. CHANNEL MISMATCH: spec in_app+email (Yes/Yes) but catalog channels=email only, empty inAppTitle/Body — missing in-app. 'hi' correct; parent-wishlist-empty.tsx email copy matches intent. |
| Parent #27 | Ready to take the next step? | `ParentWishlistItemsNoBooking7d` | spec in-app + email → cron.ts:50. CHANNEL MISMATCH: spec in_app+email but catalog email only (no in-app). 'hi' correct. parent-wishlist-items-no-booking.tsx is account-level (leadCampName + itemCount), drops spec's '[Wishlist Name]'/[season]; minor '&apos;' literal at L32. |
| Parent #28 | Wishlist Has Camps — No Booking (21 Days) | `ParentWishlistItemsNoBooking21d` | spec in-app + email → cron.ts:54. CHANNEL MISMATCH: spec in_app+email, catalog email only (inApp empty). 'hi' correct. Same template daysSinceSaved=21 'Still thinking about [camp]?' — drops spec '[Wishlist Name]'/[N]/[season]; intent preserved. |
| Parent #29 | Program Starts in 14 Days | `ParentPreCampChecklist14d` | spec in-app + email → service.ts:3040 + reconciliation.cron.ts:144 (offsetDays 14). CHANNEL MISMATCH: spec in_app+email; catalog email only (inApp empty). 'hi' correct. reminder/parent-pre-camp.tsx checklist14d slimmer than spec 3-bullet list; intent matches. |
| Parent #30 | Program Starts in 7 Days | `ParentPreCampPackingReminder7d` | spec in-app + email → service.ts:3041 + reconciliation.cron.ts:145. CHANNEL MISMATCH: spec in_app+email, catalog email only. 'hi' correct. parent-pre-camp.tsx packing7d covers packing/logistics, omits spec camp phone bullet; intent preserved. |
| Parent #31 | Program Starts Tomorrow | `ParentPreCampDayBefore` | spec in-app + email → service.ts:3042 + reconciliation.cron.ts:146. CHANNEL MISMATCH: spec in_app+email, catalog email only. 'hi' correct. parent-pre-camp.tsx dayBefore warm but omits spec arrival time/address/phone block; intent preserved. |
| Parent #32 | Program Ended — Welcome Back & Review Request | `ParentPostCampReviewRequest` | spec in-app + email → cron.ts:19 (daysAfterEnd 1). CHANNEL MISMATCH: spec in_app+email, catalog email only (inApp empty). 'hi' correct. BUG: parent-post-camp-review.tsx:26 body '${child}&apos;s time' renders literal '&apos;'. CTA 'Leave a review' matches. |
| Parent #33 | Review Request — Reminder | `ParentPostCampReviewReminder` | spec in-app + email → cron.ts:20 (daysAfterEnd 7; spec T+5, minor). CHANNEL MISMATCH: spec in_app+email, catalog email only. 'hi' correct. BUG: parent-post-camp-review.tsx:28 reminder body '&apos;' renders literally. CTA 'Leave a review' matches intent. |
| Parent #35 | Platform Experience Survey | `ParentPostCampSurvey` | spec in-app + email → cron.ts:21 (daysAfterEnd 14; spec T+7, timing nuance). CHANNEL MISMATCH: spec in_app+email, catalog email only (inApp empty). 'hi' correct. BUG: parent-post-camp-review.tsx:30 survey body '&apos;' literal. CTA 'Take the survey' matches. |
| Parent #36 | Camp Responded to Your Review | `ParentReviewResponsePublished` | spec in-app only → service.ts:154. CHANNEL MISMATCH: spec in_app ONLY (email No) but email channel present, in_app+email — extra unwanted email. 'hi' correct. In-app copy/CTA ('[Camp] replied to your review', /reviews) matches; surplus email is the divergence. |
| Parent #38 | Abandoned Checkout — 3h Nudge | `ParentCheckoutAbandoned3h` | spec in-app only → cron.ts:101. CHANNEL INVERSION: spec in_app=Yes/email=No; catalog channels=email only, no inApp payload. parent-checkout-abandoned.tsx 3h resume-draft copy matches intent; 'hi' correct. Channel mismatch -> partial. |
| Parent #39 | Abandoned Checkout — 2 Day Reminder | `ParentCheckoutAbandoned2d` | spec in-app + email → cron.ts:106. CHANNEL MISMATCH: spec in_app+email; catalog email only (no in-app). 'hi' correct. Template 2d 'draft still here' thinner than spec persuasive copy but resume intent matches. |
| Parent #40 | Abandoned Checkout — 4 Day Reminder | `ParentCheckoutAbandoned4d` | spec in-app + email → cron.ts:112. CHANNEL MISMATCH: spec in_app+email; catalog email only. 'hi' correct. Template 4d 'places filling, draft saved' matches spec urgency intent. |
| Parent #41 | Abandoned Checkout — Final Reminder | `ParentCheckoutAbandoned6d` | spec in-app + email → cron.ts:118. CHANNEL MISMATCH: spec in_app+email; catalog email only (subject 'Last chance'). 'hi' correct. Template 6d 'last call before draft expires' matches spec 'expires today'. |
| Parent #45 | Wishlist — No Booking After 7 Days | `ParentWishlistItemsNoBooking7d` | spec in-app + email → cron.ts:50. CHANNEL MISMATCH: spec in_app+email; catalog itemsNoBooking7d email only. CONTENT DIVERGES: code account-level ('Still thinking about [leadCamp]? itemCount'), spec per-program ('saved [Camp] 7d ago, spots for [Program] starting [date]'). 'hi' OK. Same type as row 27. |
| Parent #48 | Booking Declined — Similar Camps | `ParentConversionPostDeclineAlternatives` | spec in-app + email → service.ts:3216 + reconciliation.cron.ts:249 (T+24h). CHANNEL MISMATCH: spec in_app+email; catalog postDeclineAlternatives email only (no in_app). parent-post-decline-alternatives.tsx matches intent (sorry [Camp] + similar-camps CTA), 'hi' OK; '&apos;' here is in JSX text so renders fine. |
| Parent #52 | Support Ticket Status Change | `ParentSupportTicketStatusChanged` | spec in-app only → service.ts:564. CHANNEL MISMATCH: spec in_app only (email No); email channel present, in_app+email — extra unwanted email. 'hi' correct. Copy matches (ref + new status). |
| Provider #7 | Your profile is incomplete | `ProviderProfileIncomplete` | spec in-app + email → cron.ts:154 (scheduled). Channel MISMATCH: catalog channels='email' only, spec wants in_app+email. Spec timing T+3d vs code cron. Body '60% complete, fill remaining sections', CTA -> /dashboard. No salutation correct. |
| Provider #12 | New booking request | `ProviderBookingRequestReceived` | spec in-app + email → service.ts:2452. CHANNEL GAP: spec wants in_app+email but code is in_app-only (no email). In-app title “New booking request — {campName}” hydrates via providerBookingInApp (DB); QA “undefined” is a preview-stub artifact, not a bug. In-app body terse — 72h deadline + mandatory decline-reason flow not surfaced. Partial = missing email channel. |
| Provider #16 | Booking confirmed & deposit received | `ProviderBookingAccepted` | spec in-app + email → service.ts:3018. CHANNEL GAP: spec wants in_app+email but code is in_app-only (no provider booking-confirmed email). In-app body “Camp: {campName}” hydrates via providerBookingInApp (QA “undefined” is a preview-stub artifact) but is sparse vs spec (camper, deposit amount, payout date/amount, ‘View booking details’). Partial = missing email + thin copy. |
| Provider #26 | A refund has been issued for booking [ref] | `ProviderRefundIssued` | spec in-app only → service.ts:764. CHANNEL MISMATCH: spec wants in_app only (email No, no action), but catalog channels='in_app, email' and email is sent. Email copy (Direct Charges debited from connected-account balance) also diverges from spec ('World Camps processed on your behalf, no action'). No salutation correct. |
| Provider #32 | Balance payment received from family | `ProviderBalanceCollected` | spec in-app only → service.ts:1411. CHANNEL MISMATCH: catalog channels='in_app, email' but spec wants in-app ONLY (email=No). Copy (provider-payout-event.tsx balanceCollected) matches intent (balance collected, payout follows schedule, Stripe 1-3 days). No salutation correct. |
| Provider #33 | Your funds are being released on [date] | `ProviderPayoutReminder` | spec in-app + email → cron.ts:296. CHANNEL MISMATCH: catalog channels='email' only but spec wants in_app+email (in-app missing). Copy (provider-payout-event.tsx reminder): payout of [amount] scheduled to release on [date], no action. No salutation correct. |
| Provider #38 | [Parent Name] is waiting for your reply | `ProviderMessagingUnanswered24h` | spec in-app + email → cron.ts:122. CHANNEL MISMATCH: spec wants in_app+email but catalog channels='email' only (no in_app). No salutation. Copy names parent, cites 24h SLA + quality metrics ~ spec response rating/search visibility. Reply now CTA. On-spec except missing in-app. |
| Provider #39 | Action required: [Parent Name] has been waiting 48 hours | `ProviderMessagingUnanswered48h` | spec in-app + email → cron.ts:126. CHANNEL MISMATCH: spec wants in_app+email but channels='email' only (no in_app). No salutation. Escalated copy: '48h old...hurt conversion + provider quality metrics' ~ spec search-visibility/response-rating. Reply now CTA. On-spec except missing in-app. |
| Provider #42 | You haven't responded to a recent review | `ProviderReviewNotRespondedReminder` | spec in-app + email → cron.ts:253. CHANNEL MISMATCH: spec wants in_app+email but channels='email' only (no in_app). No salutation. Copy: 'review on {camp} still waiting...reply within 7 days' matches T+7d intent, but uses camp name not '[Parent Name] left a review' — minor divergence. |
| Provider #44 | Program starts in 14 days | `ProviderPreCampRosterReady` | spec in-app + email → service.ts:3056 (offsetDays:14) + reconciliation.cron.ts:147. CHANNEL MISMATCH: spec wants in_app+email but catalog channels='email' only (no in_app). No salutation. Email 'Roster ready' for {camp} ~ spec 'View participant list' at 14d. Email-only is the gap. |
| Provider #48 | Please confirm your session has completed | `ProviderPostCampWrap` | spec in-app + email → Closest is ProviderPostCampWrap (emitter booking-groups.service.ts:3080 + reconciliation.cron.ts:209), but it is an email-only 'Camp wrap' nudge, not the actionable confirm-attendance CTA that triggers final payout/review requests. Channel mismatch (spec in_app+email vs email-only) + missing confirm action. |
| Provider #49 | Your season has ended — update your programs for next year | `ProviderSeasonEnded` | spec in-app + email → cron.ts:235. catalog channels='email' only but spec wants in_app+email -> channel mismatch (no in_app). Email subject 'Season wrapped' + friendly copy match intent. No salutation correct. |
| Provider #50 | Reminder: your programs need updating | `ProviderProgramsNotUpdated30d` | spec in-app + email → cron.ts:53. catalog channels='email' only vs spec in_app+email -> channel mismatch (no in_app). Subject 'Programs not updated 30d' matches nudge intent. No salutation correct. |
| Provider #51 | Your listing needs updating to stay visible | `ProviderProgramsNotUpdated60d` | spec in-app + email → cron.ts:57. catalog channels='email' only vs spec in_app+email -> channel mismatch (no in_app). Subject 'Programs not updated 60d' aligns with listing-hidden nudge. No salutation correct. |
| Provider #55 | Support ticket updated | `ProviderSupportTicketStatusChanged` | spec in-app only → service.ts:567. CHANNEL MISMATCH: spec wants in_app ONLY but catalog sets in_app+email. Copy BUG: title uses props.detail (reply body) not status -> catalog title 'Ticket thanks for reaching out...: <subject>'. No salutation correct. |

---

## E. Copy / content-fidelity issues — 8 notifications (fire on the right channel, but copy diverges or has a bug)

Channels match the spec, but the rendered copy materially diverges from the spec's Description, or contains a genuine
rendering bug. These are real, production-reachable findings (email content renders from `PreviewProps`).

| Spec | Title | Finding |
| --- | --- | --- |
| Parent #19 | We've received your dispute | Emitter disputes.service.ts:182. in_app+email match; 'dear' correct. Content diverges: spec = platform-managed parent-initiated dispute ack ('investigating, update in 5 days'); parent-dispute-opened.tsx frames bank-initiated Stripe chargeback ('contact your bank'). Different intent. |
| Parent #20 | Your dispute has been resolved | Emitters disputes.service.ts:250/252. in_app+email match; 'dear' correct. BUG confirmed: parent-dispute-resolved.tsx:27 lost body is JS string literal with 'if you&apos;d like to rebook' — renders literal '&apos;'. Chargeback framing vs spec neutral; won=charge-stands, lost=refund (platform-perspective, inverse of parent-facing spec). |
| Provider #1 | We've received your application | Emitter onboarding.service.ts:622 (live). Spec wants email-ONLY (inApp=No) but catalog channels='in_app, email' -> extra in-app channel. Copy: 'response within 3 business days' vs spec '2 business days'; uses companyName not [Camp Name]. Provider no-salutation correct. |
| Provider #8 | Action required: your profile still needs a few things | No dedicated escalated 'final reminder' type — consolidated into single ProviderProfileIncomplete (cron:154), so the 7d-final escalation tone is not distinct. Also email-only channel vs spec in_app+email. Reuses non-escalated copy. |
| Provider #10 | You've received your first booking! | Emitter booking-groups.service.ts:2466. Channels in_app+email match Yes/Yes; no-salutation correct. Copy thinner than spec: 'your first booking request just arrived. Open the dashboard to respond' — omits child name, program, start date, 72h window, deposit/payout. Milestone/celebratory intent preserved. |
| Provider #27 | A payout adjustment is needed for booking [ref] | Emitter refunds.service.ts:770. Channels in_app+email match spec. Email body leaks internal var 'transferDate' into user copy and says 'invoice on next billing cycle' vs spec's 'deduct from next payout / remit within 7 business days' — mechanics diverge. No salutation correct. |
| Provider #30 | A refund requires your attention | Best match ProviderReimbursementOwed; emitter refunds.service.ts:770 (same type as #27). in_app+email match. Copy diverges: provider-refund-event.tsx leaks raw field 'transferDate' and says 'invoice on next billing cycle' vs spec's 'deduct from next payout / remit within 7 business days'. In-app body generic 'Booking WC-...'. Concept present. |
| Superadmin #9 | Camp not responding to booking requests | SuperadminCampUnresponsiveExpiredRequests; emitter notifications/crons/superadmin-engagement.cron.ts:235 (3+ expired/7d, passes extra.expiredRequestCount). Channels match (in_app+email). BUG: rendered inAppBody EMPTY — spec key '[N] requests expired' count dropped from in-app; only title 'Camp unresponsive: <camp>' shown. |

**Notable bugs to fix first:**
- **Parent #20 — Dispute Resolved (lost variant):** `packages/wc-email-templates/emails/dispute/parent-dispute-resolved.tsx:27`
  hard-codes `&apos;` inside a JS template literal, so the email renders the literal text `&apos;` instead of an apostrophe.
- **Parent #19 / #20 — Dispute copy:** the templates frame disputes as **bank-initiated chargebacks** ("your bank has closed
  the chargeback"), whereas the spec describes a **platform-managed, parent-initiated dispute** ("we're investigating, update
  within 5 days"). Intent mismatch — re-word or split the flows.
- **Provider #30 — Refund Requires Camp Action:** `provider-refund-event.tsx` leaks a raw field name (`transferDate`) and says
  "invoice on next billing cycle" vs the spec's "deduct from next payout / remit within 7 business days."

---

## F. Deferred (out of scope for launch) — 1

| Spec | Title | Reason |
| --- | --- | --- |
| Provider #46 | Some participants haven't completed their forms | No matching enum type. devNotes flag 'SAAS ONLY — requires forms managed inside the platform, not available for marketplace-only camps.' Per deferral rule (SAAS-only / not wired) -> deferred. No emitter. |

The spec's own **Notes & Conventions** sheet flags these SaaS-only and also notes that the **Payments/Payouts** and
**Refunds/Disputes** sections, and **external/unverified reviews (Phase 2)**, are pending final infrastructure — those are
*implemented* today but should be re-reviewed when payment infrastructure and the Phase-2 review/moderation flow are finalised.

---

## Cross-cutting observations

1. **The system is broadly complete.** 58/126 rows are fully implemented and another 41 fire correctly but need
   a channel or copy fix; the catalog/dispatcher/worker/preferences/observability infrastructure is production-grade
   (115 `NotificationType`s, all cataloged; idempotent delivery; Bull Board; 70+ tests per the hardening audit).
2. **Channel coverage is the single biggest theme** (Category D, 33 rows): a large class of engagement notifications is
   email-only where the spec wants in-app too, and a handful of booking transactions are in-app-only where the spec wants
   email. Consider a sweep that reconciles every catalog entry's `channels` against the spec's In-App/Email columns.
3. **In-app copy is often terser than the spec** even when correct — many in-app bodies are a single line (e.g. `Camp: {name}`).
   The spec's Description is the email-length version; the Notes & Conventions sheet says in-app should be a *condensed* CTA,
   so this is partly by design, but several provider in-app bodies omit key facts the spec lists (deposit amount, payout date).
4. **The 9 built-but-unwired notifications (Category A)** are the fastest wins — templates and catalog entries already exist.

_Generated from the audit result set; counts reconcile to 126 (58 + 41 + 26 + 1)._
