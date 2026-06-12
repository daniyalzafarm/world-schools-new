# WORLD CAMPS — Design UI Spec Brief

**To:** Stephanie (Design)
**From:** Alex (Legal)
**Date:** June 2026
**Version:** v1.1 (updated from v1.0 May 2026 — see change note at foot)
**Status:** UI-specification brief — expects wireframe-level design output
**Cross-references:** Customer Terms v1.4, Provider Terms v1.7, Privacy Policy v1.4, Cookie Policy v1.1, Product–Legal Audit v1.0, Payments and Payouts Spec v2.3

---

## 1. What this is

A list of the UI surfaces where the legal documents impose specific design requirements. Each item has: the screen or feature, the legal anchor (so you can look up the exact wording if useful), and the design ask (what the wireframe needs to deliver). Tiered by ship priority.

You don't need to read the underlying legal documents end-to-end. The anchor references are there so you can drill into specifics where it would help your wireframing.

---

## 2. How to read this

- **Anchor** = clause or document reference for the legal requirement driving the design
- **Design ask** = the substantive UI requirement (the *what*, not the *how* — visual treatment is your call)
- **Status** = please mark "in design", "in build", "shipped", or "not started"

Most of the items below are either new (Tier 1 / Tier 2) or refresh of an existing screen flagged by the recent Product–Legal Audit. Where the audit flagged an existing problem, the design ask describes the fix.

---

## 3. UI items — tiered by ship priority

### 3.1 Tier 1 — Must ship pre-launch

| # | Screen / Feature | Files / Mockups | Anchor | Design ask | Status |
|---|---|---|---|---|---|
| UI1 | **Cookie banner — first-load** | New — no current file. Banner shown site-wide on first load and on consent reset. | Cookie Policy v1.1 §8 + Implementation Annex | Three buttons of equal visual prominence: **Accept All / Reject All / Manage Preferences**. No visual bias toward Accept (no dark patterns — e.g., do not present Accept as the only highlighted CTA). Banner shown on first load and any time consent state resets. Non-essential scripts blocked until a decision is recorded. | |
| UI2 | **Cookie Preference Centre** | New — no current file. Accessible from banner Manage button + persistent footer link site-wide. | Cookie Policy v1.1 §8 + Implementation Annex | Modal accessible from the banner Manage Preferences button **and** from a persistent "Cookie Preferences" footer link on every page. Per-category toggles for six categories: Strictly Necessary (always on, non-toggleable); Functional; Analytics; Marketing; AI / Personalisation; Third-Party Embeds. Defaults off for all non-essential categories. Save / Cancel actions; consent decision recorded on save. | |
| UI3 | **Booking-flow consent — gold-standard pattern** | Gold: `Parents/booking-flow/Final/step3-review-pay-with-card.html`. Migrate to: `step3-review-pay-no-card.html`, `step3-review-pay-with-card-discounted.html`, `step3-review-pay-no-card-discounted.html`, `step3-payment-failed.html`, `step3-payment-failed-discounted.html`, plus six in `Final/fx/`. | CT v1.4 §1.4, §5.2; PP §4; Cookie Policy §8; audit P0-4 | Apply the gold-standard pattern across all 12 step3 variants. Two distinct consent rows: (a) medical-data sharing with the relevant Provider; (b) acceptance of Customer Terms, Privacy Policy, Cookie Policy, and the applicable Cancellation Policy at checkout. Each consent row clearly identifies what is being consented to and links to the relevant document. | |
| UI4 | **AI label render pattern** *(contingent on AI features being deployed)* | If/where deployed: `Parents/dashboard/parent-home-dashboard.html` + `state-examples/1-fresh-start.html` through `10-returning-user.html`; Camp profile AI review summary; wishlist `Compare with AI` / `Help me decide` buttons; `Admin/ai-kb/*`. | CT v1.4 §12.6; PP v1.4 §9.5; audit P0-11 | A persistent visual "AI" indicator on every card or surface displaying AI-generated content (recommendation cards, AI review summaries, search-ranking "AI Sort" indicator, KB Assistant responses, "Compare with AI" outputs, "Help me decide" outputs). Component-level so it can be reused. The conversational AI Assistant identifies itself as an AI in its first response of any conversation and remains identifiable throughout the interaction. — *Apply only where the corresponding AI feature is actually deployed; engineering verification of which AI features are live is pending.* | |
| UI5 | **Provider Decline reason list — content redesign** | `Provider/Booking/camp_2b_booking-action-modals-v3.html` (decline reason list within the booking-action modals). | PT v1.7 §5.1(h)(iii), (iia); audit P0-18 | Replace the single "Cannot accommodate special needs" reason category with four granular operational sub-categories: (i) specific dietary requirement cannot be met; (ii) specific medical requirement cannot be met; (iii) specific accessibility requirement cannot be met; (iv) specific activity-participation limitation. Replace the halal-food placeholder example with a neutral non-religious example (e.g., "gluten-free preparation requires a dedicated kitchen we don't have"). For sub-categories (i)–(iv), require a brief specific free-text description of the operational limitation. Other top-level categories (capacity full, scheduling conflict, age-band mismatch, safeguarding concern, other) remain. | |
| UI6 | **Child medical-safety screen — disclosure reconciliation** | `Parents/Children/child-medical-safety.html`. | PP v1.4 §7.2A; audit P0-7 | Resolve the on-screen contradiction the audit flagged at P0-7: align the "shared with camps before booking" alert with the "Camps will never see this information before a confirmed booking" privacy note. Align the on-screen 30-day deletion pledge with Privacy Policy §7.2A (30 days after Programme end, or earlier on Booking cancellation). Expand the explicit-consent text to enumerate categories collected, retention period, and recipients (the Customer's chosen Provider on Acceptance). | |

| UI6a | **Checkout — charge schedule display + consent acknowledgement** *(new v1.1)* | `Parents/booking-flow/Final/step3-review-pay-with-card.html` + all step3 variants. | CT v1.4 §7.3, §7.4(c); Spec v2.3 §5.1, §15 | At checkout, before submission, display the full charge schedule clearly: (1) deposit amount — "held now, charged in 24 hours"; (2) each future balance capture date and amount derived from the Provider's Cancellation Policy. Add an explicit acknowledgement checkbox: *"I understand the payment schedule above and the applicable cancellation policy."* This checkbox is required for SCA mandate compliance and is the consent snapshot trigger — the exact policy text shown, timestamp, and IP must be stored on the Booking record at submission. Distinct from the existing Terms/PP consent checkbox at UI3 — these are two separate rows. | |
| UI6b | **Provider onboarding Step 5 — payment framing copy** *(new v1.1)* | `Provider/Onboarding/Step5` — Cancellation Policy sub-step. | PT v1.7 §6.4; Spec v2.3 §3 | Three copy changes to the existing screen (no structural redesign needed): (1) Change subtitle from *"Define your refund policy for the balance amount (excluding deposit)"* to *"Set when you receive payments and when parents can cancel for a refund"*; (2) Add one line under each policy card showing the Provider-facing payment date (e.g., Flexible: *"You receive the balance 30 days before start"*; Moderate: *"You receive 50% at 60 days, remainder at 30 days before start"*); (3) Add a prompt near the earnings calculator: *"The Payment Schedule panel shows exactly when each payment reaches your account."* These are copy-only changes — layout unchanged. | |
| UI6c | **Provider onboarding Step 5 — special circumstances framing** *(new v1.1)* | `Provider/Onboarding/Step5` — Special Circumstances section. | PT v1.7 §7; Spec v2.3 §3 | Remove or replace the "escrow warning" currently shown when special circumstances are active ("Up to X% of balance may be held until session starts"). Under the new payment architecture there is no escrow or hold — special circumstances are refunds issued from already-captured funds when a valid claim is made. Replace with: *"If a parent makes a valid [medical/FM/weather] claim, you'll refund [X]% of the balance from your account. World Camps will guide you through the process."* | |

### 3.2 Tier 2 — Should ship pre- or shortly post-launch

| # | Screen / Feature | Files / Mockups | Anchor | Design ask | Status |
|---|---|---|---|---|---|
| UI7 | **Admin "Reveal medical info" gate** | `Admin/bookings/booking-detail.html`. | PP v1.4 §7.2A(e); CT v1.4 §5.6(e); audit P0-10 | In the admin Booking detail view, replace the default-visible display of child medical fields with a "Reveal medical info" click-through. Required modal: reason field (free-text, required); confirm; reveal. Each Reveal action writes an audit-log row (actor, timestamp, reason, booking reference). | |
| UI8 | **Admin reason-capture modal pattern (reusable)** | Used across `Admin/providers/`, `Admin/camps/`, `Admin/bookings/`, `Admin/payments/`, `Admin/public-kb/`, `Admin/ai-kb/` — design one component, reuse everywhere. | Audit P0-8 | Reusable modal for every destructive admin action (suspend / approve / reject / refund / cancel / edit booking / manual payout / export / API key regenerate / AI KB rule). Reason field (required, non-empty); 2FA prompt; Confirm. Audit-log row written before the action proceeds. Visual treatment should make destructive actions clearly distinct from routine ones. | |
| UI9 | **Admin Audit Logs screen** | New — replaces the current `href="#"` on the sidebar item "Audit Logs" in `Admin/dashboard/index.html`. Target: new `Admin/audit-logs/index.html` + detail. | Audit P0-8 (replaces current `href="#"`) | List view: filterable by actor, action type, target, date range. Per-action detail panel: prior value, new value, reason, IP, user agent. Export to CSV. Read-only — admins cannot modify or delete log entries from the UI. | |
| UI10 | **Booking Request status UI** | `Parents/bookings/parent_my-bookings-dashboard.html` + `parent_1a_booking-request-confirmation-flow.html` + `parent_1b_booking-states.html`. | CT v1.4 §5.2 | Customer-facing status display on the Booking detail and dashboard for an in-flight Booking Request: state pill (Pending / Accepted / Declined / Lapsed); countdown to Acceptance Window expiry; surface the Customer's withdraw-before-acceptance control (per §5.2(f)). | |
| UI11 | **Acceptance Time confirmation UI** | `Parents/bookings/parent_1a_booking-request-confirmation-flow.html` (treat as the surface fired at Acceptance Time). | CT v1.4 §5.4 | Customer-facing Booking confirmation page surfaced contemporaneously with the in-Platform notification fired at the Acceptance Time. Records and displays the Acceptance Time stamp. Confirmation email follows the same pattern. | |
| UI12 | **24h grace countdown** *(updated v1.1)* | `Parents/bookings/parent_1b_booking-states.html` + `parent_my-bookings-dashboard.html` + booking request confirmation screen. | CT v1.4 §8.4(b); Spec v2.3 §5.3 | Surface in the Customer Booking detail: countdown to "free cancellation by [Booking Request submission time + 24h]". The clock starts at **Booking Request submission**, not at Acceptance Time. On submission confirmation, show immediately: *"You can cancel free of charge until [grace deadline time]."* When the window expires (whether or not the Provider has accepted), the surface transitions to the applicable Cancellation Policy's display. Note: grace period does not apply where Programme starts within 7 days. | |
| UI13 | **Batch-enquiry submission UI — recipient-count disclosure** | `Parents/quotes/parent_request-quotes-batch-modal.html` (+ `parent_request-quote-modal.html`). | CT v1.4 §16.7(c) | Before final submission of a batch enquiry or batch quote-request, display a clear summary: "You are sending this enquiry to **N** Providers" with the list of recipient Provider names. Customer must confirm to submit. | |
| UI14 | **Wishlist-share UI — invitee disclosure + withdraw mechanism** | `Parents/wishlists/wishlist-detail.html` (+ `wishlist-create-modal.html`, `wishlist-add-to-list-modal.html`). | CT v1.4 §16.7(b), (d) | Pre-share: invitee-consent reminder (Customer represents they have the invitee's consent — surfaced as a checkbox or attestation). Post-share: a "Shared with" list in the wishlist UI with a per-invitee Withdraw control that revokes the share. | |
| UI15 | **Notification Preferences — marketing-withdrawal toggle row** | `Parents/settings/parent_notification-preferences.html`. | Audit P1-1; PP v1.4 §13 | Toggle row in account settings: "Marketing emails". Off = the Customer has withdrawn marketing consent. State stored as a granted/withdrawn timestamp pair, not a Boolean. | |
| UI16 | **Provider Onboarding Step 4 — Safeguarding Nominee capture** | `Provider/Onboarding/` Step 4 + `Provider/Dashboard/Settings/` (Safeguarding section). | PT v1.7 §10.1; audit P0-19 | Fields: Safeguarding Nominee name, role, contact (email + phone), deputy contact. Required before Listing publication. Mirror form in Provider Settings for ongoing updates. | |
| UI17 | **Provider Onboarding Step 4 — Background-check evidence required** | `Provider/Onboarding/` Step 4 (background-check upload section). | PT v1.7 §10.2; audit P0-20 | Background-check evidence promoted from optional to required. Document upload with expiry date capture. Automatic suspension warning when expiry approaches. | |
| UI18 | **Provider Terms acceptance gate at onboarding** | `Provider/Onboarding/` Step 5 (currently single checkbox — needs full flow). | PT v1.7; audit P0-5 | Replace narrow Step-5 single-checkbox with a full acceptance flow: render Provider Terms preview pane; capture timestamped acceptance + version; separate checkboxes for Provider Terms, Privacy Policy, Safeguarding Policy (when published), Acceptable Use Policy (when published), Insurance Requirements (when published), DPA (if any). | |
| UI19 | **Provider Form Requirements editor — prohibited-data warning** | `Provider/Booking/provider_form-requirements.html` (+ `provider_form-upload-modal.html`). | PT v1.7 §12.4; audit P0-6 | Inline warning when a Provider attempts to add a custom form field within a prohibited category (passport / religion / racial-ethnic / financial / school / social-media). Certification modal: "I confirm strict necessity" with reason text capture. Without certification, the field cannot be added to the published form. | |

### 3.3 Tier 3 — Stage 2 / longer horizon

| # | Screen / Feature | Files / Mockups | Anchor | Design ask | Status |
|---|---|---|---|---|---|
| UI20 | **DSA Statement-of-Reasons template + appeals UI** | New — affects review moderation (`Admin/reviews/`), Listing takedown notifications (Provider Dashboard), account suspension notifications (Parent + Provider). | CT v1.4 §11.3; PT v1.7 §14.7; DSA Art. 14–17; audit M-16, P1-6 | EU-launch-only. Statement-of-Reasons surfaced to the affected party (reviewer / Provider) when a content-moderation action is taken (review removal, Listing takedown, account suspension). In-platform appeals workflow with status updates. | |
| UI21 | **Eligibility-gate appeals UI** | Booking-flow Step 1 (`Parents/booking-flow/Final/step1-children-*`). | Audit P1-10 | Where an automated check (e.g., "Required to book" criterion such as swimming ability or language) denies an action, surface an explanation and a "request human review" route. | |
| UI22 | **Cancel-booking "anonymity" surface** | `Parents/bookings/parent_cancel-booking-flow.html`. | Audit P1-11 | Either remove the "anonymity" claim from the cancel-booking flow or redesign so that the cancellation reason captured is genuinely decoupled from the Customer identity. | |
| UI23 | **Stripe Connected Account Agreement reference link** | Provider Stripe-connection screens (path TBC — somewhere in `Provider/Onboarding/` Stripe step + `Provider/Dashboard/Settings/`). | Audit P1-12 | In the Provider's Stripe-related screens, link to the Stripe Connected Account Agreement at the point of connection. | |
| UI24 | **Provider Pricing & Fees — per-Provider rate display** | `Provider/Dashboard/Settings/` Pricing & Fees section. | PT v1.7 §1 (per-Provider dynamic, already in product) | Confirm with engineering whether the "tiered" rendering verification (Engineering brief V8) is a per-Provider negotiated structure (fine) or a platform-default schema (would be a gap). If platform-default, redesign to single per-Provider canonical rate display. | |
| UI25 | **Parent SAR-export modal — disclose scope** | `Parents/settings/parent_privacy-data.html` (SAR-export action). | Audit §1.1.2 | When a Customer requests an export of their data, surface the scope (what's included / excluded) and the download-link lifetime. | |
| UI26 | **Help Centre — Cancellation Policy tiers article** | `Parents/Help/articles/booking/*.html` (or new article). | CT v1.4 §8.2 | Plain-language consumer-facing description of each tier (Flexible / Moderate / Strict / Custom) with the refund schedule. Legal will draft copy; design owns layout. | |
| UI27 | **Help Centre — Ranking and Trust Score methodology** | `Parents/Help/articles/` (new article) — accessible from search results and any Trust Score surface. | CT v1.4 §12.5 | Plain-language consumer-facing description of ranking parameters and Trust Score methodology. Accessible from each surface presenting a ranking or Trust Score. Legal will draft copy after engineering provides algorithm description; design owns layout. | |

---

## 4. Component-level patterns worth a single design pass

A handful of the items above share patterns. If we run a single design pass on these patterns, all instances inherit consistently:

- **AI label badge** — used at UI4, applies to every AI-generated card or response across the platform (only where the underlying AI feature is deployed — see note at UI4)
- **Reason-capture modal** — used at UI5 (decline), UI7 (Reveal medical info), UI8 (admin destructive actions); same underlying component
- **Audit-log row format** — used at UI9, and visible in any future trail-of-actions UI
- **Consent row** — used at UI3 (booking-flow consent) and UI14 (wishlist invitee), and could be the basis of any future explicit-consent capture

**Note on AI features.** Legal is awaiting engineering confirmation of which AI features are currently deployed in production versus planned for later. UI4 and any related component work should be staged accordingly. Other surfaces in this brief that mention AI (e.g., the search-ranking "AI Sort" indicator) are similarly contingent.

---

## 5. Cross-references

All documents are in the shared Google Drive folder.

- Customer Terms v1.4 — `WorldCamps_Customer_Terms_v1.4.md`
- Provider Terms v1.7 — `WorldCamps_Provider_Terms_v1.7.md`
- Privacy Policy v1.4 — `WorldCamps_Privacy_Policy_v1.4.md`
- Cookie Policy v1.1 — `WorldCamps_Cookie_Policy_v1.1.md`
- Payments and Payouts Spec v2.3 — `WorldCamps_Payments_and_Payouts_Spec_v2.3.md`
- Product–Legal Audit v1.0 — `WorldCamps_ProductLegal_Audit_v1.0.md`

If anything is ambiguous, ping me — happy to walk through it on a 30-minute call.

---

*World Schools Sàrl | world-camps.org | Design UI Spec Brief v1.1 | June 2026*

---

*v1.1 change note (June 2026): Version references updated throughout. UI12 corrected: grace period now 24 hours from Booking Request submission (not 48 hours from Acceptance Time). Three new Tier 1 payment items added: UI6a (checkout charge schedule + consent acknowledgement checkbox), UI6b (Provider onboarding Step 5 payment framing copy), UI6c (special circumstances framing — escrow warning removed). §5 cross-references updated to current document versions and Google Drive paths.*
