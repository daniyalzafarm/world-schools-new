# Low-Hanging Fruit — Non-Critical "To Fix" Issues

> **Source:** Notion **Issues & Feedback** board — [open board](https://app.notion.com/p/3280237d3dee8007a735c863ed68c977)
> **Generated:** 2026-06-03
> **Scope:** Every issue in **To fix** status that is **not** Critical/safeguarding and **not** an architectural rewrite. Effort is tagged **LHF** (trivial: copy/styling/small) or **MED** (moderate, self-contained). Items are grouped by app → **one commit per app**.
>
> **Caveats:**
> - The Notion MCP only allows semantic search (no full row dump), so this list is compiled from board searches + the existing [notion-tasks.md](../notion-tasks.md) index. **Each item's status will be re-verified via `notion-fetch` immediately before it is fixed** — a few search hits were already `Done`/`Won't fix` and are listed under *Already done*.
> - `CLAUDE.md` calls `wc-provider`/`wc-superadmin` Vite/React; they are in fact **Next.js App Router**. Build/lint/test go through `nx`, so commands are unchanged.

---

## ✅ Implementation outcome (statuses re-verified via `notion-fetch`, 2026-06-04)

Re-verifying each row against the live board showed **~half were already `Done`** (the source index over-counted). Net result per app — each app a single commit, all `nx lint --fix` + `nx build` green:

### Parent — `wc-booking` (commit `c73900ee`)
**Fixed (6):** P2 compare icon (clear ArrowLeftRight on card + compare bar) · P4 BUG-005 compare empty columns (render only filled slots + one) · P12 country dropdown → searchable `react-select` · P14 child-profile Languages list expanded to ~60 (real list: `LANGUAGE_OPTIONS_WITH_FLAGS` in `types/child.ts`) · P18 consent quotes "Request to book" · P19 Submit Report → navy `#1E2A4A`.
**Already Done on board (skipped):** P1, P3, P5, P6, P7, P8, P11, P13, P15, P16, P17, P23, P26.
**Excluded (Critical):** P9 sidebar. **Reclassified:** P10 heating → Provider (fixed there).
**Deferred (larger / design / backend):** P20 topbar Model B (full nav + drawer redesign) · P21 messages camp-identity + P22 thread-creation (need conversation payload to carry camp data — backend) · P24 booking confirmation screen (inside Stripe-mount-sensitive flow). P25 "World-Schools" typo: not found in user-facing strings.

### Provider — `wc-provider` (commit `31c3593a`)
**Fixed (5):** PR1 Spots Available helper text · PR3 char-limit error → shared `ui-web` Textarea now shows "Maximum N characters reached" (also covers BUG-009) · PR4 Getting There transport description required + inline error · PR8 Submit Report → navy · P10 heating amenity icon 🔥 → 🌡️.
**Already Done (skipped):** PR2 (also a Parent item), PR6, What's-Included maxLength, decline-modal existence (BUG-112).
**Deferred:** PR5 decline-reason options (needs legal review per Provider Terms §5.1(h)(iii) + backend enum change) · PR7 dashboard date-range (post-launch, needs windowed-KPI backend). Provider Bookings `BUG-BK-*` gated on the 20/26-screens build.

### Admin — `wc-superadmin` (commit `139456b9`)
**Fixed (5):** A1 BUG-125 donut legend paired by name · A2 BUG-126 donut tooltip GMV · A3 BUG-127 KPI previous-period value · A4 BUG-130 KPI divide-by-zero → neutral "New" badge (solved frontend-side via `previousValue`; no backend change) · A7 BUG-120 operational-status tooltip + definition fallback.
**Already Done (skipped):** A6 KB save.
**Deferred:** A5 BUG-129 custom date-range picker (needs date-picker UI + backend custom-range support) · A8 booking-accepted notification copy (**no** superadmin booking-accepted catalog entry exists — it's a dispatch/routing fix, not a copy edit). **Decision-pending:** Revenue chart bar→line (awaiting product call).

---

## Phase 1 — Parent (`apps/wc-booking`)

### Ready to implement

| # | Issue | Bug ID | Pri | Effort | Notion | Target file(s) | Fix |
|---|---|---|---|---|---|---|---|
| P1 | Wishlist action buttons icon-only → text labels (Book/Message/Compare) | — | Med | LHF | [link](https://app.notion.com/p/34c0237d3dee81779021d4f0d5b1bedf) | `src/components/wishlists/wishlist-camp-card.tsx` | Ensure visible text labels + styling on the three action buttons |
| P2 | Compare button icon unclear | — | Low | LHF | [link](https://app.notion.com/p/3560237d3dee818cb078d62742f042b2) | `src/components/wishlists/compare-bar.tsx` | Clearer icon + label ("Compare") |
| P3 | Compare button visibility logic by camp count (0–1 none, 2–4 footer) | — | Med | MED | [link](https://app.notion.com/p/3440237d3dee81e38121d180eb42c8ac) | `src/components/wishlists/compare-bar.tsx` | Gate footer compare CTA on count |
| P4 | Compare view shows 2 empty placeholder columns | BUG-005 | Med | MED | [link](https://app.notion.com/p/3480237d3dee81be8662c39a2c8d201c) | `src/components/wishlists/wishlist-compare-table.tsx` (`SLOT_COUNT`) | Render only populated slots (+1 empty) |
| P5 | Wishlist card visuals (aspect ratio, border/shadow, price "Change >", duration) | — | Med | MED | [link](https://app.notion.com/p/3440237d3dee81d5801ec77caeced1e1) | `src/components/wishlists/wishlist-camp-card.tsx` | Match design tokens; add Change link + duration |
| P6 | Camp profile header visuals (star color, review-count parens, trust score, "Verified", "Show on map") | — | Med | MED | [link](https://app.notion.com/p/3440237d3dee8183a25dc73b8407bcb5) | `src/app/camps/[campSlug]/page.tsx` | Align header to design |
| P7 | Camp profile FAQ (hover bg, question weight, chevron direction) | — | Low | LHF | [link](https://app.notion.com/p/3440237d3dee8179a1d8f5b4ae654879) | `src/components/camp/FaqSection.tsx` | Hover bg + down-chevron |
| P8 | "Read more" link too large / too far from text | — | Low | LHF | [link](https://app.notion.com/p/3440237d3dee819d9f1ac8156378cc59) | `src/components/camp/ExpandableText.tsx` | Smaller link, tighter margin |
| P9 | Camp sidebar "CHOOSE A SESSION" label position | — | Med | MED | [link](https://app.notion.com/p/3440237d3dee81b1b184d55c68b6dfab) | `src/components/camp/CampSidebar.tsx` | Move label above month pills |
| P10 | Heating amenity flame emoji → neutral icon | — | Med | LHF | [link](https://app.notion.com/p/3560237d3dee81c3bfe8fbd5ae4a80ab) | `src/components/camp/IncludedGrid.tsx` + amenity icon map | Swap flame for radiator/sun icon |
| P11 | Age validation message wording | UX-03 | Low | LHF | [link](https://app.notion.com/p/3280237d3dee810983b7f2c3d71f87e0) | `src/components/children/add-child-form-fields.tsx:145` | Reword to "Child must be at most 18 years old" |
| P12 | Country dropdown not searchable (200+ entries) | — | Med | MED | [link](https://app.notion.com/p/3560237d3dee81229b1be69bdfa57caf) | `src/components/account/modals/address-modal.tsx` | Reuse `react-select` pattern from `nationality-modal.tsx` |
| P13 | Camp-preferences location should be searchable | UX-01 | Low | MED | [link](https://app.notion.com/p/3280237d3dee81eca5d6f42f1e61bc91) | *locate (camp preferences form)* | Searchable location field |
| P14 | Languages Spoken list too short (only ~10) | — | Med | LHF | [link](https://app.notion.com/p/3560237d3dee81388812f2f053153de9) | `src/components/account/modals/languages-modal.tsx:25` | Expand to full language list |
| P15 | Medical & Safety checkboxes/radios wrong green | — | Low | LHF | [link](https://app.notion.com/p/33d0237d3dee81b880a9daf7768673b8) | *locate (children medical-safety form)* | Use design green / dark fill |
| P16 | Info box (child profiles) needs dismiss X | — | Low | LHF | [link](https://app.notion.com/p/33d0237d3dee812fa2dfd14f13c9e4ca) | *locate in child profile page* | Add closable X (persist dismissal) |
| P17 | Profile completion banner (100%) needs dismiss X | — | Low | LHF | [link](https://app.notion.com/p/33d0237d3dee8137bc03c411404c5896) | *locate (dashboard/account banner)* | Add closable X (persist dismissal) |
| P18 | Booking step-4 consent wording should name the button | — | Low | LHF | [link](https://app.notion.com/p/3560237d3dee8194bcb9ea8af882e55c) | `src/components/camp-booking/booking-terms-modal.tsx` | Reference "Request to book" |
| P19 | "Submit Report" button maroon → navy `#1E2A4A` | — | Low | LHF | [link](https://app.notion.com/p/3450237d3dee8161b3a9f51c7ac26739) | `src/app/messages/page.tsx:653` | Replace `color="danger"` with navy |
| P20 | Public topbar nav doesn't match design (logged-out/in states) | — | Med | MED | [link](https://app.notion.com/p/3500237d3dee817b9770ecc9b40ef84c) | `src/components/layout/main-layout.tsx`, `camp/CampPageTopbar.tsx` | Match Model B |
| P21 | Messages show provider name+"Provider" → camp name + location | — | Med | MED | [link](https://app.notion.com/p/3500237d3dee8161a5bcc4ebfd8cbeef) | `src/components/layout/messages-sidebar.tsx` | Show camp name + location |
| P22 | Message from camp profile doesn't create thread | — | Med | MED | [link](https://app.notion.com/p/3500237d3dee8161a5bcc4ebfd8cbeef) | `src/components/camp/ProviderSection.tsx` | Create conversation, not just draft |
| P23 | Booking flow (mobile) back-arrow vs X behavior | — | Low | MED | [link](https://app.notion.com/p/3430237d3dee81eeb69bf723475abedc) | *locate (booking flow mobile header)* | Back = prev step, X = exit to profile |
| P24 | Booking submit skips pending-confirmation screen | — | Med | MED | [link](https://app.notion.com/p/3500237d3dee81ae8dbfeefd1a44e580) | `src/components/camp-booking/camp-booking-flow.tsx:~1713` | Add "request pending" screen before redirect |
| P25 | "World-Schools" typo (wishlist / user-facing copy) | — | Low | LHF | [link](https://app.notion.com/p/3560237d3dee818cb078d62742f042b2) | *grep "World-Schools" / "World Schools"* | Correct brand string |
| P26 | Camp price displays as CHF 1 on wishlist card | BUG-003 | — | MED | [link](https://app.notion.com/p/3480237d3dee8112b7b8e72229d7fb64) | `src/components/wishlists/wishlist-camp-card.tsx` (+ data) | Investigate placeholder vs formatting |

### Already done (verify, then drop)
- Nationality dropdown is **already** searchable — `src/components/account/modals/nationality-modal.tsx` ([UX-02](https://app.notion.com/p/3280237d3dee818f9cd9ecd619fd170c)).

---

## Phase 2 — Provider (`apps/wc-provider`)

### Ready to implement

| # | Issue | Bug ID | Pri | Effort | Notion | Target file(s) | Fix |
|---|---|---|---|---|---|---|---|
| PR1 | "Spots Available" field ambiguous — add helper text | — | Med | LHF | [link](https://app.notion.com/p/3560237d3dee81238c43de112bab7ee6) | `src/components/sessions/SessionForm.tsx:654` | Add `description` clarifying marketplace allocation |
| PR2 | Save/action buttons inconsistent — remove Preview `Eye` icon | — | Low | LHF | [link](https://app.notion.com/p/33d0237d3dee81bdac49e6ee70f28963) | `src/components/camps/CampEditorTopBar.tsx:89` | Make buttons text-only/consistent |
| PR3 | Short Description: no error on 500-char overflow | — | Med | LHF | [link](https://app.notion.com/p/3560237d3dee8144ad33d0ec6fba1936) | `src/components/camp-forms/BasicInfoForm.tsx:601` + `packages/ui-web/src/components/textarea.tsx` | Show error message when over limit |
| PR4 | Transport options selectable without required description | — | Med | MED | [link](https://app.notion.com/p/3560237d3dee816e8f1dc5488bdc5b07) | `src/app/camps/[campId]/edit/getting-there/page.tsx` | `isRequired` + block save when empty |
| PR5 | Decline-reason dropdown: optimised options + contextual text | — | Med | LHF/MED | [link](https://app.notion.com/p/36c0237d3dee812494eec8c6e1134bd2) | `src/components/booking-requests/decline-booking-modal.tsx` | Replace option list per spec |
| PR6 | Camp editor: standardize nav/save/exit buttons across sections | — | Med | MED | [link](https://app.notion.com/p/3440237d3dee81e18dd6c8c8315003cc) | `src/components/camps/CampEditorTopBar.tsx`, `CampEditorFooter.tsx`, `CampWizardFooter.tsx` | One "Save & Continue" pattern; Publish on final only |
| PR7 | Provider dashboard date-range filter (7D/30D/90D/1Y) | — | Med | MED | [link](https://app.notion.com/p/3730237d3dee81d692e5e714edff6573) | `src/app/(dashboard)/dashboard/page.tsx`, `src/hooks/use-provider-dashboard-data.ts` | Add range control; keep lifetime metrics separate |
| PR8 | "Submit Report" button maroon → navy `#1E2A4A` | — | Low | LHF | [link](https://app.notion.com/p/3450237d3dee8161b3a9f51c7ac26739) | `src/app/(dashboard)/messages/page.tsx:564` | Replace `color="danger"` with navy |

### Already done (verify, then drop)
- "What's Included" `maxLength={40}` + character counter — `src/app/camps/[campId]/edit/whats-included/page.tsx` ([DEV item](https://app.notion.com/p/3290237d3dee81289c2ee6826797a587)).
- Decline modal reason dropdown existence — resolved v0.20.0, BUG-112 ([link](https://app.notion.com/p/36c0237d3dee816ead51cfc9cf1adcaf)); only the **options optimisation** (PR5) remains.

### To classify during implementation
- **Provider Bookings BUG-BK-** cluster (e.g. BUG-BK-06 panel kebab dropdown [link](https://app.notion.com/p/3480237d3dee812d80d0ec4398acdcee), detail-panel gaps, sticky footer, payout progress, Export no-op, BUG-114/115/118). Most are gated on the *"20/26 booking screens 404"* build → **deferred** (see below). Any standalone small ones surfaced during Phase 2 get pulled in.

---

## Phase 3 — Admin (`apps/wc-superadmin`, + `apps/wc-nest-api`)

### Ready to implement

| # | Issue | Bug ID | Pri | Effort | Notion | Target file(s) | Fix |
|---|---|---|---|---|---|---|---|
| A1 | Booking Status donut — legend % misaligned with labels | BUG-125 | High | LHF | [link](https://app.notion.com/p/3740237d3dee8102857cd44272ccc2d8) | `src/components/dashboard/charts/donut-chart.tsx:60`, `analytics/booking-status-donut.tsx` | Fix legend index→slice pairing |
| A2 | Booking Status donut — tooltip missing GMV per status | BUG-126 | Med | LHF | [link](https://app.notion.com/p/3740237d3dee818ebd0dc6e17b0a11ae) | `donut-chart.tsx:48`, `booking-status-donut.tsx:14` | Pass `amount` to slice + render in tooltip |
| A3 | KPI cards — previous-period value not shown | BUG-127 | Med | LHF | [link](https://app.notion.com/p/3740237d3dee817aabfdfdbabb845a3b) | `src/components/dashboard/shared/kpi-card.tsx`, `analytics/overview-kpis.tsx` | Render `previousValue` (footer/tooltip) |
| A4 | KPI trend "↑100%" divide-by-zero when prior=0 | BUG-130 | Low | MED | [link](https://app.notion.com/p/3740237d3dee81d99b32e56e13ec8f84) | `apps/wc-nest-api/src/modules/superadmin/analytics/analytics.service.ts` + `kpi-card.tsx:51-77` | Guard prior=0 → neutral "—" |
| A5 | No custom date-range picker (only presets) | BUG-129 | Med | MED | [link](https://app.notion.com/p/3740237d3dee81a1bf0ff67d61d3c2cf) | `src/components/dashboard/shared/date-range-picker.tsx` | Add custom from/to popover (type already supports it) |
| A6 | KB article save fails silently with empty SEO meta | — | High | LHF | [link](https://app.notion.com/p/3430237d3dee81339663e441acc3acac) | `src/components/kb/article-form.tsx:271` | Surface backend error in toast / validate |
| A7 | Operational status labels have no tooltip/detail | BUG-120 | Med | LHF | [link](https://app.notion.com/p/36c0237d3dee810d8b11f2f15869af36) | `src/components/providers/providers-view.tsx:478` | Wrap badge in HeroUI `Tooltip` with reasons |
| A8 | Booking-accepted notification shows parent copy to Admin | — | Med | MED | [link](https://app.notion.com/p/3560237d3dee81e0bad9fd19f0f8a5a7) | `apps/wc-nest-api/src/modules/notifications/catalog/audiences/parent.catalog.ts` (+ dispatcher context) | Admin-appropriate copy / context check |

### Decision pending (flag, don't auto-fix)
- **Revenue & GMV chart: bar → two-line time series** ([link](https://app.notion.com/p/3740237d3dee81ef9cd1c52c78086923)). Board note says the bar version may be kept by design (Daniyal/Stephanie). **Awaiting product decision** before implementing (`analytics/revenue-chart.tsx`, `charts/column-chart.tsx`).

---

## Deferred — architectural (listed, not implemented)

- **Parent:** Login/Sign-up as in-page modal instead of separate page ([link](https://app.notion.com/p/3500237d3dee81ec98cfc0b275188209)); Booking "Review & pay" page full redesign ([link](https://app.notion.com/p/3430237d3dee81fa8adaf33bc7fcd4cf)).
- **Provider:** "Getting There" → Google Places integration ([link](https://app.notion.com/p/3500237d3dee8169be95dd77a77f393d)); Provider Bookings 20/26-screens-404 build.
- **Admin:** Geographic Distribution UK-missing — backend data audit of `provider.legal_country` ([link](https://app.notion.com/p/3730237d3dee81d48443f8499a0c384f)) (BUG-123); Support 4-stage workflow refactor ([link](https://app.notion.com/p/34c0237d3dee81f89a20db21f0593347)).

## Excluded — Critical / safeguarding (listed only)

Guardianship confirmation; GDPR child-photo; server-side 75% profile enforcement; consent spec v1.0 (4 checkboxes); accept-expired-booking card capture; chat/messages rework; cancel-booking-missing; merged-conversation threads; reported-conversations not actionable (DSA/NetzDG).

### ⚠️ Critical but copy-only — BUG-011
- **BUG-011** — consent text says **10% service fee**, should be **12.5%** (legal). One-line copy fix but *Critical*-priority. **Decision (2026-06-03): left excluded** — to be handled separately, not in the Parent commit.

---

## Per-phase exit gate
Before each app's commit: `npx nx lint <project> --fix` · `npx nx build <project>` · `npx nx test <project>` (plus `wc-nest-api` for A4/A8). Report fixed / skipped (with reason) / test results.
