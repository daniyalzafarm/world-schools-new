# WORLD CAMPS — Engineering Implementation Brief

**To:** Daniyal (Engineering)
**From:** Alex (Legal)
**Date:** June 2026
**Version:** v1.1 (updated from v1.0 May 2026 — see change note at foot)
**Status:** Implementation brief — expects engineering verification + tier-tagged closure
**Cross-references:** Customer Terms v1.4, Provider Terms v1.7, Privacy Policy v1.4, Cookie Policy v1.1, DPIA v1.0, Product–Legal Audit v1.0, Payments and Payouts Spec v2.3

---

## 1. What this is

A single-page-style brief bringing together (i) what's now locked at the legal layer, (ii) what's already aligned in product, and (iii) the discrete items where legal needs verification or build work from engineering before launch. Tiered by priority so you can plan sprints rather than triage a flat list.

Read flow: skim Sections 2 and 3 for context (no action required), then work through Section 4. The verification column is the only output legal needs back from you — built / partially built / not built, with a date estimate where not built.

---

## 2. What's locked at the legal layer

| Document | Latest | Status |
|---|---|---|
| Customer Terms and Conditions | v1.4 | Substantive drafting closed; pending publication |
| Provider Terms and Conditions | v1.7 | Substantive drafting closed; pending publication |
| Privacy Policy | v1.4 | Substantive drafting closed; pending publication |
| Cookie Policy | v1.1 | Substantive drafting closed; pending publication |
| Data Protection Impact Assessment | v1.0 | Drafted; three-way sign-off pending |
| Payments and Payouts Spec | v2.3 | Locked June 2026 — canonical engineering reference for all payment, refund, payout, and Force Majeure flows |

---

## 3. What's already aligned in product

The following platform mechanics are already in place and now match the documented contractual position. **No build work required** on these — they are listed for verification only (Section 4.4 below).

- Request-to-book flow with 72-hour Provider Acceptance Window
- Provider Dashboard "Accept" click as the constitutive act of acceptance
- Stripe authorisation-at-submission (`capture_method: 'manual'`); deposit capture deferred to grace deadline expiry, not Acceptance Time (see V2 and V3 — **verification updated at v1.1**)
- **24-hour Customer grace period running from Booking Request submission time** (not Acceptance Time — **updated at v1.1 from 48 hours**)
- Provider Dashboard decline-reason capture (content cleanup is a separate item — see T1.7)
- Customer ability to withdraw a Booking Request before acceptance
- Per-Provider dynamic Platform Fee rate sourced from the Provider record (default 15%, Order Form overrides)
- Merchant-of-record architecture with Stripe Direct Charges, Standard connected accounts (**updated at v1.1 — manual payout control removed; Providers manage own payout schedule**)

The bulk of what the current documents describe is, in other words, what you've already built. The documents catch up to product reality on these items rather than imposing new requirements.

---

## 4. Implementation items — tiered

For each item: clause / audit references for context, a one-line gap statement, and the engineering verification ask. Mark each row in the right-hand column as **Built / Partial / Not built**. Where Not built, please add a sprint estimate.

### 4.1 Tier 1 — Must close pre-launch (legal exposure if missing)

| # | Item | Files / Screens | Clause / audit reference | Engineering status |
|---|---|---|---|---|
| T1.1 | Cookie banner + Cookie Preference Centre + first-load script blocking (Accept All / Reject All / Manage Preferences; non-essential scripts blocked until consent; per-consent audit row) | New — no current implementation. Banner shown on every Parent / Provider / Public page on first load and on consent reset. Persistent footer link site-wide. | Cookie Policy v1.0 §8 + Implementation Annex; PP §6; audit P0-3 | |
| T1.2 | Booking-flow consent — gold-standard two-checkbox pattern propagated across all 12 step3 variants (medical-data sharing + Terms/PP/Cookie Policy acceptance) | Gold standard: `Parents/booking-flow/Final/step3-review-pay-with-card.html`. Migrate the other 11: `Final/step3-review-pay-no-card.html`, `step3-review-pay-with-card-discounted.html`, `step3-review-pay-no-card-discounted.html`, `step3-payment-failed.html`, `step3-payment-failed-discounted.html`, plus all six in `Final/fx/`. | CT v1.4 §1.4, §5.2; PP §4; audit P0-4 | |
| T1.3 | Persistent on-screen "AI" indicator on every AI-generated output (recommendation cards, AI review summaries, "Compare with AI" outputs, KB Assistant responses) — *only applicable to AI features currently deployed; see §6(0)* | If/where deployed: `Parents/dashboard/parent-home-dashboard.html` + `state-examples/1-fresh-start.html` through `10-returning-user.html` (Inline Prompt / FAB / Chat Panel / Suggestion Chips); Camp profile AI review summary; wishlist `Compare with AI` / `Help me decide` buttons; AI Knowledge Base assistant `Admin/ai-kb/*`. | CT v1.4 §12.6; PP v1.4 §9.5; audit P0-11 | |
| T1.4 | AI Assistant — "I am an AI" first-response identifier in every conversation + output-side moderation refusal-list for refund / contractual / medical / safety / legal queries + escalation-to-human routing — *only applicable if AI Assistant is deployed; see §6(0)* | If/where deployed: `Admin/ai-kb/index.html`, `editor.html`, `import.html`, `DEV-HANDOFF.html`, plus consumer-facing assistant entry points. | CT v1.4 §12.7; PP v1.4 §9.5; audit P0-11 / P0-12 | |
| T1.5 | Child medical-profile data — 30-day post-Programme deletion job (or earlier on Booking cancellation); no cross-Booking persistence (re-entry on each Booking) | Front-end pledge surface: `Parents/Children/child-medical-safety.html`. Back-end: scheduled deletion job against Programme end date and Booking cancellation event. | PP v1.4 §7.2A(a), (c); DPIA v1.0 §6 Op 3 | |
| T1.6 | Incident-record register — separate access-restricted store on 6-year retention; immutable audit-log of admin reads; independent of T1.5 deletion job | New — backend-only. No current screen. Suggest a thin admin read surface under `Admin/incidents/` (TBD) with the access controls described in PP §7.2A(d)–(e). | PP v1.4 §7.2A(d), (e); DPIA v1.0 §6 Op 16 | |
| T1.7 | Provider Decline reason-list content cleanup — replace "Cannot accommodate special needs" with granular operational sub-categories (specific dietary / specific medical / specific accessibility / specific activity-participation); replace halal-food placeholder with neutral non-religious example; require brief specific description on operational-inability declines | `Provider/Booking/camp_2b_booking-action-modals-v3.html` (decline reason list lives in the booking-action modals). | PT v1.7 §5.1(h)(iii), (iia)(D); audit P0-18 | |
| T1.8 | Provider Form Requirements guardrail — platform-side refusal to publish custom forms containing prohibited categories (passport / religion / racial-ethnic / financial / school / social-media) without express "I confirm strict necessity" certification; per-form purpose + retention metadata capture | `Provider/Booking/provider_form-requirements.html` (also: `provider_form-submissions.html`, `provider_form-review-modal.html`, `provider_form-upload-modal.html` for related flows). | PT v1.7 §12.4; audit P0-6 | |

### 4.2 Tier 2 — Should close before broad rollout

| # | Item | Files / Screens | Clause / audit reference | Engineering status |
|---|---|---|---|---|
| T2.1 | Provider Terms acceptance gate at onboarding — render preview of Provider Terms; capture timestamped acceptance + version; checkboxes for Provider Terms, Privacy Policy, Safeguarding Policy (when published), Acceptable Use Policy (when published), Insurance Requirements, DPA | `Provider/Onboarding/` Step 5 (replace narrow single-checkbox). | PT v1.7 (entirety); audit P0-5 | |
| T2.2 | Admin destructive actions — reason-capture modal + 2FA step-up + audit-log row written before action proceeds (across suspend / approve / reject / refund / cancel / edit booking / manual payout / export / API key regenerate / AI KB rule) | Affects every destructive action across `Admin/providers/index.html`, `Admin/providers/provider-detail.html`, `Admin/camps/camp-detail.html`, `Admin/camps/camp-approvals-pending.html`, `Admin/bookings/booking-detail.html`, `Admin/payments/index.html`, `Admin/public-kb/`, `Admin/ai-kb/`. | PP v1.4 §8.3; audit P0-8 | |
| T2.3 | Admin authentication — admin login screen + 2FA enrolment + permission matrix UI + 15-minute idle session timeout | `Admin/auth/` (folder currently empty per audit — needs full design + build). | PP v1.4 §8.3; audit P0-9 | |
| T2.4 | Admin "Reveal medical info" gate — gate child Art. 9 fields (DOB, school grade, medical, allergy, dietary, emergency contact) in booking detail behind a Reveal click with reason capture + audit-log row | `Admin/bookings/booking-detail.html` (currently displays all child Art. 9 fields by default — gate required). | PP v1.4 §7.2A(e), §8.3; audit P0-10 | |
| T2.5 | Safeguarding Nominee capture — add field in Provider Onboarding Step 4 + Provider Settings (name, role, contact, deputy contact); required pre-Listing publication | `Provider/Onboarding/` Step 4 + `Provider/Dashboard/Settings/` (Safeguarding section). | PT v1.7 §10.1; audit P0-19 | |
| T2.6 | Background-check evidence — promote from optional to required; expiry date capture per document; automatic suspension on expiry; renewal cadence per Provider Terms §10.2 | `Provider/Onboarding/` Step 4 (background-check evidence upload) + a renewal-reminder workflow. | PT v1.7 §10.2; audit P0-20 | |
| T2.7 | DSA Statement-of-Reasons template + appeals UI (EU launch only) — for review removal, Listing takedown, account suspension; statement-of-reasons surfaced to affected party + internal appeals workflow | New surface — affects review moderation (`Admin/reviews/`), Listing takedown notifications (Provider Dashboard), and account-suspension notifications (Parent + Provider). | CT v1.4 §11.3; PT v1.7 §14.7; DSA Art. 14–17; audit M-16, N-5, P1-6 | |
| T2.8 | Email mailbox setup — `support@world-camps.org` and `legal@world-camps.org` resolving to monitored mailboxes (or alias initially) | Google Workspace admin (no app file). | CT v1.4 §22.4, §24.5, §24.9; PT v1.7 §22 | |
| T2.9 | Admin Audit Logs screen — replace current `href="#"` with a real list view, filterable by actor / action / target / date, with per-action detail panel | `Admin/dashboard/index.html` sidebar item "Audit Logs" → currently `href="#"`. Target: new `Admin/audit-logs/index.html` + per-action detail. | Audit P0-8 dependency | |

### 4.3 Tier 3 — Longer horizon (post-launch acceptable)

| # | Item | Files / Screens | Clause / audit reference | Engineering status |
|---|---|---|---|---|
| T3.1 | Marketing-withdrawal toggle in Notification Preferences | `Parents/settings/parent_notification-preferences.html` (add marketing-channel row). | PP v1.4 §13; audit P1-1 | |
| T3.2 | Photo-upload purpose/retention micro-copy + parental-consent reminder (parent and provider side) | `child-profile-info.html` (parent side); Provider photo-upload surfaces. | PP v1.4 §10; audit P1-2 | |
| T3.3 | Privacy & data settings — explicit Restriction request + Object-to-profiling actions surfaced in account UI | `Parents/settings/parent_privacy-data.html`. | PP v1.4 §13; audit P1-21 | |
| T3.4 | Provider-authored consumer Terms feature — either remove or restrict to "Camp Rules" only with platform-imposed guardrails | `Provider/Dashboard/Settings/settings-legal-documents.html`. | PT v1.7 §14.8; audit P0-17 | |
| T3.5 | Payments and Payouts implementation — build to `/Legal/Handoffs/WorldCamps_Payments_and_Payouts_Spec_v2.3.md`. This is the single canonical engineering handoff for all payment, refund, payout, and Force Majeure flows. Architecture: Standard connected accounts, Direct Charges, capture-when-non-refundable, 24-hour grace from Booking Request submission, no platform-side payout restrictions. Two items remain marked `[CONFIRM — Stripe]` in the spec (§7.1A SCA retry flow; §9.5 negative balance recovery by country — response pending from Stripe Support). All other open items from prior spec versions are resolved. | PT v1.7 §6 / §7; PT Annex A v1.7 §A.4; CT v1.4 §7–§8; audit P0-16 | |
| T3.6 | AI personalisation opt-in toggle in account settings (bound to AI / Personalisation Cookie Preference Centre category) | `Parents/settings/parent_account-settings.html` or `parent_privacy-data.html`. | PP v1.4 §9.6; audit P1-9 | |
| T3.7 | Server-side guard on `?verified=true` review URL parameter | `Parents/reviews/camp-write-review-UPDATED.html` URL handling. | Audit P1-15 | |
| T3.8 | API-key regenerate gating (2FA + reason capture) | Provider Dashboard API settings (path TBC). | Audit P1-16 | |
| T3.9 | Bank IBAN masking — show last 4 only | Provider Dashboard Stripe/payout settings. | Audit P1-17 | |
| T3.10 | Eligibility-gate appeals UI — human-review request on "Required to book" denial | Booking-flow Step 1 (`Final/step1-children-*`) where eligibility blocks. | Audit P1-10 | |
| T3.11 | Cancel-booking "anonymity" claim — either remove or implement true decoupling | `Parents/bookings/parent_cancel-booking-flow.html`. | Audit P1-11 | |
| T3.12 | Stripe Connected Account Agreement reference link in WC Stripe screens | Provider Stripe-connection screens (path TBC). | Audit P1-12 | |
| T3.13 | Remove legacy `reviews/camp-write-review-booking.html` from production | `Parents/reviews/camp-write-review-booking.html` (legacy — delete). | Audit P1-14 | |

### 4.4 Verification (no build expected — please confirm built and matches docs)

| # | Item | Files / Screens | Clause | Engineering status |
|---|---|---|---|---|
| V1 | Request-to-book flow — 72-hour Acceptance Window with shrink-rule to lesser of 72h or 24h-before-Programme-start; Booking Requests for Programmes starting in less than 24h refused | `Parents/booking-flow/Final/step3-*.html` (submission) + `Provider/Booking/camp_2b_booking-action-modals-v3.html` (decision) + booking lifecycle backend. | CT v1.4 §5.2(c); PT v1.7 §5.1(a) | |
| V2 | Stripe payment intents placed with `capture_method: "manual"` at Booking Request submission; `grace_deadline = request_time + 24h` stored on Booking; capture deferred to `grace_deadline` if Provider accepts within 24h, or fires immediately at Acceptance Time if Provider accepts after grace has already expired | Stripe integration backend (payment-intent creation in booking-flow step3 + deferred/immediate capture logic on Provider acceptance). | CT v1.4 §7.4(c); PT v1.7 §6.2(b); Spec v2.3 §5.2 | |
| V3 | 24-hour grace period clock anchored to **Booking Request submission time** (not Acceptance Time); surfaced as countdown in Customer Booking detail; grace-period cancellation releases auth-hold via `paymentIntents.cancel` — no refund call required; grace period does not apply where Programme starts within 7 days | `Parents/bookings/parent_my-bookings-dashboard.html` + `parent_1b_booking-states.html` + booking lifecycle backend. | CT v1.4 §8.4(b); PT v1.7 §7.3; Spec v2.3 §5.3 | |
| V4 | Provider Dashboard "Accept" click as the constitutive act of acceptance; Platform-recorded UTC timestamp = Acceptance Time; contemporaneous automated in-Platform notification + email to Customer | `Provider/Booking/camp_2b_booking-action-modals-v3.html` (Accept action) + notification dispatch backend. | CT v1.4 §5.2(d); PT v1.7 §5.1(b)–(c) | |
| V5 | Provider Dashboard decline reason capture from a controlled list (content cleanup at T1.7 — capture mechanism itself is verified existing) | `Provider/Booking/camp_2b_booking-action-modals-v3.html` (decline modal). | PT v1.7 §5.1(h)(iii) | |
| V6 | Customer can withdraw a Booking Request before acceptance; authorisation hold released; no capture | `Parents/bookings/parent_my-bookings-dashboard.html` + `parent_1a_booking-request-confirmation-flow.html`. | CT v1.4 §5.2(f) | |
| V7 | Authorisation-hold release on Provider decline, Acceptance Window lapse, or Customer withdrawal | Stripe integration backend (auth-release on decline/lapse/withdrawal events). | CT v1.4 §7.4(d); PT v1.7 §6.2(c) | |
| V8 | Per-Provider dynamic Platform Fee rate sourced from Provider record (default 15%, Order Form overrides) — confirm whether any "tiered" rendering exists as a platform-default schema (would be a gap — PT §1 doesn't contemplate tiering as a default) or only as a per-Provider negotiated structure (fine) | `Provider/Dashboard/Settings/` (Pricing & Fees section). | PT v1.7 §1 | |
| V9 | Merchant-of-record architecture — Provider as merchant of record, Stripe Direct Charges, World Camps as payment-collection agent and refund-initiator | Stripe Connect configuration + payment-intent backend. | PT v1.7 §6.4; CT v1.4 §1.3, §8.6 | |
| V10 | Customer-side authorisation-hold refresh workflow when Acceptance Window approaches the card-network authorisation lifetime (with Customer consent) | Stripe integration backend + Customer prompt UI (path TBC if implemented). | CT v1.4 §7.4(e); PT v1.7 §5.1(e) | |

---

## 5. Sub-processor inputs requested (5-minute look-up)

The Privacy Policy v1.3 §5.7 commits to a public Sub-processor list page. The following vendor names are required to finalise that list and the Sub-processor Inventory at DPIA v1.0 Annex A:

- SMS gateway vendor (Twilio? MessageBird? something else?) — phone OTP + call-flow notifications
- IP-derived geolocation vendor — surfaced on `parent_security-settings.html`
- Error-monitoring vendor — assume Sentry; please confirm and flag any others (Datadog / Bugsnag / etc.)
- Hosting provider — name and jurisdiction
- Email-delivery vendor — transactional + notification email

Drop the names in your reply; legal will handle the downstream paperwork (DPAs / SCCs / TIAs).

---

## 6. Verification questions for the DPIA and AI feature scope

A small number of open questions affect the DPIA §6 risk register residual ratings, the §9.2 Article 36 prior-consultation determination, and the AI-related provisions in the Privacy Policy and Customer / Provider Terms. Engineering input needed:

**(0) AI features deployment status (most important — answers below cascade).** Which of the following AI features are currently deployed in production, planned, or not currently planned? For each: **Deployed / Planned (with rough timeline) / Not currently planned.**

- Recommendation engine ("Recommended for Emma" personalisation)
- AI review summary (on Camp profile)
- AI Knowledge Base / conversational assistant (KB-based chatbot for parents)
- "Compare with AI" / "Help me decide" wishlist buttons
- Trust Score calculation / display
- AI-flagged content moderation (reviews, Listings)
- Parent Dashboard AI Inline Prompt / Floating Action Button / Chat Panel
- Any other AI feature not listed above

Several downstream items depend on the answer here. If no AI feature is currently in production, the OpenAI / Anthropic / Pinecone Sub-processors at Privacy Policy v1.4 §5.7 should be removed pending deployment (we don't disclose Sub-processors we're not yet using). The AI-related items at T1.3 and T1.4 of this brief move to a "deferred until AI ships" track. The DPIA risk register Operations 8, 9, 10, 11 narratives soften to forward-looking. Conversely, if any AI feature *is* live, the current treatment stands and questions (a)–(c) below need answering.

(a) **AI recommendation engine input scope.** If the recommendation engine is deployed: does it consume any Child profile data or Sensitive Personal Data as a feature input, or only parent-side preference signals and behavioural data? Affects DPIA Operation 8.

(b) **Joint controller analysis.** Does any Platform-mediated data flow operate on a processor-shaped basis — i.e., a flow where the Provider's purposes and means of processing are determined by the Platform rather than the Provider? Affects DPIA §7.7 and Privacy Policy Implementation Annex §D.9.

(c) **Current operational volume.** MAU; active Providers; Bookings per month. Feeds the DPIA §3.5 "large-scale" assessment.

---

## 7. How to read this

The cleanest path is:

1. Skim §3 (what's already aligned) and §4.4 (verification). These are quick — confirm built, no further action.
2. Work through §4.1 (Tier 1) item by item. Mark status and date for any item not built.
3. Then §4.2 (Tier 2) and §4.3 (Tier 3).
4. Reply to §5 vendor names inline; reply to §6 verification questions inline.

If anything is ambiguous, ping me — happy to walk through a 30-minute call. The underlying documents (Customer Terms v1.4, Provider Terms v1.7, Privacy Policy v1.4, Cookie Policy v1.1, DPIA v1.0, Audit v1.0, Payments Spec v2.3) are in the shared Google Drive folder.

---

## 8. What legal owns

So you can plan around it, the following are tracked by legal and don't need engineering action:

- Sub-processor DPA / SCC / TIA execution (once vendor names confirmed at §5)
- Per-market local counsel review (top 5 EU + UK + AU + US + CA)
- Insurance procurement (World Camps's own E&O / D&O / Cyber)
- Threshold Assessment v1.0 → v1.1 update and DPIA three-way sign-off
- Help Centre — Ranking and Trust Score methodology article (waiting on your §6 input for the ranking algorithm description, then legal drafts)
- Help Centre — Cancellation Policy tiers article (legal drafts; product confirms per-tier refund percentages)
- Drafting Standards refresh

---

*World Schools Sàrl | world-camps.org | Engineering Implementation Brief v1.1 | June 2026*

---

*v1.1 change note (June 2026): Cross-references bumped to current document versions throughout. §3 updated: capture timing corrected to grace deadline (not Acceptance Time); grace period updated to 24 hours from Booking Request submission (not 48 hours from Acceptance Time); manual payout control removed — Standard connected accounts, Providers manage own payout schedule. T3.5 updated to Spec v2.3. V2 and V3 updated to reflect new capture and grace period architecture. All CT/PT/PP clause references updated to current versions.*
