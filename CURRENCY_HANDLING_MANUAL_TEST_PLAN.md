# Currency Handling — Manual Test Plan (Case Matrix)

Companion to [STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md](STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md) and [STRIPE_PROVIDER_ONBOARDING_MANUAL_TEST_PLAN.md](STRIPE_PROVIDER_ONBOARDING_MANUAL_TEST_PLAN.md). Provider onboarding must pass before this plan runs (each booking needs an onboarded provider with a **Standard** Direct Charges connected account in one of the launch currencies).

This file is a **case matrix** for the `fix/currency-handling` branch. The branch implements the World Camps currency model: each camp lists in its provider's settlement currency, the parent pays in that camp currency, both the provider's Stripe balance and WC's 15% platform-fee balance accrue in the camp currency, and WC payouts land in matching-currency bank accounts so no Stripe FX margin applies. The supported launch scope is **USD / GBP / CHF / EUR** only (Payments and Payouts Spec v1.0 §3.3).

Mark each row Pass / Fail / Skip as you go. A row is **Pass** only when every column it claims to verify is actually observed.

---

## Section A — Pre-flight

Re-verify each session:

- Apps running: `npx nx serve wc-nest-api`, `npx nx dev wc-booking`, `npx nx dev wc-provider`, `npx nx dev wc-superadmin`.
- Prisma Studio open: `npx nx prisma:studio wc-nest-api`.
- Stripe Dashboard test mode open at https://dashboard.stripe.com/test/connect/accounts.
- Stripe CLI listening on both webhook scopes (see [STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md](STRIPE_PAYMENT_PROCESSING_MANUAL_TEST_PLAN.md) §A for the exact `stripe listen` invocation).
- API client (Postman / Insomnia / `curl`) ready with a valid Provider JWT and a valid Parent JWT.

**Seed data required:**

Spin up **four** providers, one per launch currency. The simplest path is to run the provider onboarding flow four times (or seed directly via Prisma Studio: `Provider` + `ProviderSettings.currency` set per provider). For each provider:

1. One published `Camp`.
2. One published `Session` with a single-price (e.g. 1000) so the currency symbol is unambiguous.
3. At least one `AddOn` with `price = 50`.
4. One Parent + one Child.
5. One `BookingGroup` in `accepted` status (deposit captured) under the **CHF** provider — used to verify that booking-detail and cancel-modal currency flows are not silently rendering USD/EUR.
6. One `BookingGroup` in `request` status under the **GBP** provider — used for grace-period cancel.

**Reference currency-by-provider quick table** (fill in as you seed):

| Provider | `ProviderSettings.currency` | Camp slug | Stripe `acct_*` `default_currency` |
|---|---|---|---|
| Acme USA | `USD` |  |  |
| Beta UK | `GBP` |  |  |
| Charlie CH | `CHF` |  |  |
| Delta EU | `EUR` |  |  |

---

## Section B — Currency allow-list (all 15 supported currencies)

Supported set (single source of truth: `SUPPORTED_CURRENCIES` in [packages/global-utils/src/lib/currency.ts](packages/global-utils/src/lib/currency.ts)): **CHF, EUR, GBP, USD, CAD, AED, AUD, SGD, JPY, CNY, HKD, DKK, SEK, THB, NZD**.

Backend allow-list lives in [apps/wc-nest-api/src/modules/stripe/stripe.constants.ts](apps/wc-nest-api/src/modules/stripe/stripe.constants.ts) (`SUPPORTED_CONNECT_CURRENCIES`), derived from `SUPPORTED_CURRENCIES`. DTO-level validation in [apps/wc-nest-api/src/modules/provider/onboarding/dto/google-business.dto.ts](apps/wc-nest-api/src/modules/provider/onboarding/dto/google-business.dto.ts) (`@IsIn` on `SaveGoogleBusinessProfileDto` and `UpdateCompanyDetailsDto`). Frontend dropdowns derive from the same `SUPPORTED_CURRENCIES` list, so the four surfaces never drift.

| # | Case | Pass criteria |
|---|---|---|
| B1 | Provider onboarding dropdown — `find-your-camp` page | Dropdown lists all 15 supported currencies (`CODE - Name`, e.g. `USD - US Dollar`, `JPY - Japanese Yen`). No INR / BRL / ZAR (unsupported) options are visible. File: [apps/wc-provider/src/app/onboarding/find-your-camp/page.tsx](apps/wc-provider/src/app/onboarding/find-your-camp/page.tsx). |
| B2 | Company-settings modal (post-onboarding edit) | Same 15 options. File: [apps/wc-provider/src/components/account/modals/company-settings-modal.tsx](apps/wc-provider/src/components/account/modals/company-settings-modal.tsx). |
| B3 | API direct: POST `SaveGoogleBusinessProfileDto` with `currency: "INR"` (unsupported) | 400 Bad Request. Response message is `currency must be one of: ...` listing the 15 supported codes (order may differ). |
| B4 | API direct: PATCH `UpdateCompanyDetailsDto` with `currency: "BRL"` (unsupported) | Same — 400 with the same allow-list message. |
| B5 | API direct: same endpoints with each of the 15 supported currencies (spot-check `USD`, `CHF`, `JPY`, `AED`, `NZD`) | 200 OK; `ProviderSettings.currency` row updated to the submitted value. |
| B6 | Stripe Connect account creation per currency | Walk Stripe-Connect onboarding for providers seeded across several of the 15 currencies. Each resulting `acct_*` has `default_currency` matching the provider's currency. For non-bank-account currencies (everything beyond CHF/EUR/GBP/USD), confirm the platform Stripe account has `default_currency = chf` with balance conversion-to-default enabled. Verify in **Stripe Dashboard → Connect → Accounts → [acct_*] → Account details**. |
| B7 | Lower-case submitted currency (`"usd"`) | If the FE always upper-cases (current behavior), expect 200. If sent verbatim via API, expect 400 — `@IsIn` is case-sensitive against the upper-case list. Document the observed behavior. |

---

## Section C — Provider currency is the single source of truth (parent surfaces)

Every parent-visible price on the booking app must render in the **camp's** provider currency. No locale-based or parent-preference conversion is performed (see Parent T&C §7.5). Most fallbacks now route through `getCampCurrency()` in [apps/wc-booking/src/utils/currency.ts](apps/wc-booking/src/utils/currency.ts).

| # | Case | Pass criteria |
|---|---|---|
| C1 | Camp listing card on parent home / search | Card price for the **CHF** camp shows the CHF symbol (e.g. `CHF 1,000`). Repeat for the GBP/EUR/USD camps. |
| C2 | Camp detail page `/camps/[campSlug]` — sidebar, sessions section, add-ons accordion | All three render the CHF camp's prices in CHF (no `EUR` / `USD` leakage). Implementation files: [apps/wc-booking/src/app/camps/[campSlug]/page.tsx](apps/wc-booking/src/app/camps/%5BcampSlug%5D/page.tsx), [apps/wc-booking/src/components/camp/AccordionGroup.tsx](apps/wc-booking/src/components/camp/AccordionGroup.tsx). |
| C3 | Mobile sticky footer on the CHF camp | Price + extras total in CHF. File: [apps/wc-booking/src/components/camp-booking/mobile-booking-footer.tsx](apps/wc-booking/src/components/camp-booking/mobile-booking-footer.tsx). |
| C4 | Booking flow review step + desktop sidebar (CHF camp) | Subtotal, extras total, payment-plan summary, deposit / balance breakdown all in CHF. Files: [apps/wc-booking/src/components/camp-booking/camp-booking-flow.tsx](apps/wc-booking/src/components/camp-booking/camp-booking-flow.tsx), [apps/wc-booking/src/components/camp-booking/use-booking-sidebar-data.ts](apps/wc-booking/src/components/camp-booking/use-booking-sidebar-data.ts). |
| C5 | Wishlist card + wishlist map panel (CHF + GBP camps) | Each card's min-price label and each map pin's price use the camp's provider currency. **Regression check**: pre-fix both files defaulted to `'CHF'` on missing data — verify the GBP camp explicitly shows £, not CHF. Files: [apps/wc-booking/src/components/wishlists/wishlist-camp-card.tsx](apps/wc-booking/src/components/wishlists/wishlist-camp-card.tsx), [apps/wc-booking/src/components/wishlists/wishlist-map-panel.tsx](apps/wc-booking/src/components/wishlists/wishlist-map-panel.tsx). |
| C6 | Booking detail sidebar `/account/bookings/[id]` (CHF booking) | Subtotal / Discounts / Total / Deposit / Paid to date / Balance due / Refunded / per-child row totals **all** render in CHF. **Regression check**: pre-fix `formatCurrency(amount)` was called with no currency arg and defaulted to USD — a CHF camp's booking summary would show `$1,000.00` instead of `CHF 1,000.00`. File: [apps/wc-booking/src/components/bookings/booking-detail-sidebar.tsx](apps/wc-booking/src/components/bookings/booking-detail-sidebar.tsx). |
| C7 | Cancel modal preview on the GBP booking in grace mode | Headline refund amount and `RefundBreakdown` rows all in GBP. Switch the seeded booking to outside the grace window (manually edit `requestedAt` to `NOW() - 4 days` in Prisma Studio) and re-open — `policy` mode renders the same way. File: [apps/wc-booking/src/components/bookings/cancel-booking-modal.tsx](apps/wc-booking/src/components/bookings/cancel-booking-modal.tsx). |
| C8 | Browser-locale independence | Set browser language to `de-DE` and reload C2–C6. The currency code shown does **not** change with locale — a CHF camp stays CHF for a German parent. (Number-separator formatting is covered in Section H.) |
| C9 | Parent with the `/account/children/[id]/preferences` currency selector set to a non-camp currency | Selecting USD/EUR/GBP/AED in the child preferences must **not** change any camp / booking / wishlist price. This selector is currently confined to budget-range display only and is flagged in the audit as a future cleanup. |

---

## Section D — Fail-loud `getCampCurrency` helper

Helper at [apps/wc-booking/src/utils/currency.ts](apps/wc-booking/src/utils/currency.ts). Throws in dev when `provider.settings.currency` is missing; warns + falls back to `CHF` in prod.

| # | Case | Pass criteria |
|---|---|---|
| D1 | Dev build, intentionally missing currency | In Prisma Studio, temporarily NULL out `ProviderSettings.currency` for the CHF provider. Reload the CHF camp page. The page errors (Next.js dev overlay shows `Missing provider currency on camp:<slug>; check provider onboarding state`) rather than silently rendering EUR/USD. **Restore the value immediately.** |
| D2 | Prod build, intentionally missing currency | Build with `NODE_ENV=production` (or run the staging build). Repeat D1. The page renders with **CHF** as the displayed currency and the browser console shows `[currency] Missing provider currency on camp:<slug>; falling back to CHF`. **Restore the value.** |
| D3 | Multiple consumer surfaces hit the helper | After D1 setup, also touch the wishlist map panel (`wishlist-map-panel`) and booking flow (`camp-booking-flow`) — each context-hint string is reflected in the thrown / logged message, confirming the call sites pass distinct hints. |

---

## Section E — Add-on currency forced from `ProviderSettings.currency`

DTO change: `currency` removed from [apps/wc-nest-api/src/modules/provider/add-ons/dto/create-add-on.dto.ts](apps/wc-nest-api/src/modules/provider/add-ons/dto/create-add-on.dto.ts). Service change: [apps/wc-nest-api/src/modules/provider/add-ons/add-ons.service.ts](apps/wc-nest-api/src/modules/provider/add-ons/add-ons.service.ts) loads provider currency and throws if missing. FE type aligned: [apps/wc-provider/src/types/add-ons.ts](apps/wc-provider/src/types/add-ons.ts).

| # | Case | Pass criteria |
|---|---|---|
| E1 | POST `/provider/add-ons` (as the GBP provider) with body containing the now-removed `currency: "JPY"` field | 201 Created. Response body and DB row both have `currency = "GBP"` — the JPY value is silently stripped by `class-validator` (`whitelist: true`) and the service derives currency from `ProviderSettings`. |
| E2 | POST `/provider/add-ons` for a provider whose `ProviderSettings.currency` is temporarily NULL | 400 Bad Request: `"Provider currency must be configured before creating add-ons"`. Restore the value afterwards. |
| E3 | PATCH `/provider/add-ons/:id` with body `currency: "EUR"` from the USD provider | 200 OK. DB row's `currency` stays `USD`. The field is whitelisted out because `UpdateAddOnDto extends PartialType(CreateAddOnDto)` and `CreateAddOnDto` no longer declares it. |
| E4 | Camp detail page — add-ons accordion (CHF camp) | Each add-on's price renders in CHF. **Regression check**: pre-fix [AccordionGroup.tsx](apps/wc-booking/src/components/camp/AccordionGroup.tsx) read `addon.currency ?? 'EUR'`. |
| E5 | Transport FAQ (CHF camp with a transport-like add-on, e.g. "Airport Transfer") | The FAQ answer renders the price in CHF. **Regression check**: pre-fix [faq-builders.ts](apps/wc-booking/src/utils/faq-builders.ts) chained `addon.currency ?? camp.currency ?? 'EUR'`. |
| E6 | Provider add-ons list page (provider app) | Existing add-ons display the correct symbol for each currency. Verify the GBP provider's add-on row shows £, not $. |

---

## Section F — Provider-side `CurrencyInput` symbol map

Symbol map at [packages/ui-web/src/components/currency-input.tsx](packages/ui-web/src/components/currency-input.tsx) (lines 70-80). CHF added; JPY/CAD/AUD removed. `SessionForm` no longer hardcodes `currency="USD"` — uses `camp?.currency`. File: [apps/wc-provider/src/components/sessions/SessionForm.tsx](apps/wc-provider/src/components/sessions/SessionForm.tsx).

| # | Case | Pass criteria |
|---|---|---|
| F1 | Provider session create form, USD camp | Single price input shows `$` as `startContent`. |
| F2 | Same form, EUR camp | Shows `€`. |
| F3 | Same form, GBP camp | Shows `£`. |
| F4 | Same form, CHF camp | Shows `CHF`. **Regression check**: pre-fix CHF was missing from the symbol map and would render the literal currency code via fallback — confirm the icon column is no longer empty / placeholder. |
| F5 | Age-group pricing variant (camp with 2+ age groups, switched to age-group mode) | Every per-age-group input renders the same symbol as F1–F4 for the corresponding camp. **Regression check**: both `CurrencyInput`s in [SessionForm.tsx](apps/wc-provider/src/components/sessions/SessionForm.tsx) were previously hardcoded to `"USD"`. |
| F6 | Add-on modal `CurrencyInput` (editing existing add-on under CHF provider) | Shows `CHF` (sourced from the saved add-on row, which equals provider currency). |
| F7 | Discount modal `CurrencyInput` for each currency | Each shows the matching symbol; behaves the same as F1–F4. |

---

## Section G — Cancel modal explicit "Refund currency is unavailable" state

Change at [apps/wc-booking/src/components/bookings/cancel-booking-modal.tsx](apps/wc-booking/src/components/bookings/cancel-booking-modal.tsx) lines ~193-205. Replaces the silent `preview.currency ?? 'EUR'` fallback.

| # | Case | Pass criteria |
|---|---|---|
| G1 | `preview.currency === null` for a `grace`-mode preview (simulate via DevTools network override — open the cancel modal, intercept the `GET …/refund-preview` response and edit the `currency` field to `null`) | Modal body renders the red message: **"Refund currency is unavailable for this booking. Please contact support before cancelling."** No formatted refund amount is shown. |
| G2 | Same for `policy` mode (simulate by editing `requestedAt` to push out of grace, then repeat G1) | Same red message. |
| G3 | Normal `grace` preview with `preview.currency = "GBP"` | Unchanged rendering — refund amount, `RefundBreakdown` rows, and copy all show in GBP. |
| G4 | Normal `policy` preview | Unchanged rendering. |
| G5 | `void_auth` mode | Returns early before the currency check — unaffected by the change. Verify the "no payment was taken" copy renders normally. |

---

## Section H — `formatMajor` locale pinning on Stripe payment section

Change at [apps/wc-booking/src/components/camp-booking/stripe-payment-section.tsx](apps/wc-booking/src/components/camp-booking/stripe-payment-section.tsx) lines 456-465. Locale pinned to `'en-US'` (matching `apps/wc-booking/src/app/layout.tsx`). Currency itself is still the camp's currency.

| # | Case | Pass criteria |
|---|---|---|
| H1 | Browser language `de-DE`, open the CHF camp's payment step | Amounts render with US separators: `CHF 1,000.00` (comma thousands, dot decimal). Pre-fix this would have rendered `CHF 1.000,00` (German separators). |
| H2 | Browser language `fr-FR`, same | Same `CHF 1,000.00` format. |
| H3 | Browser language `en-GB`, USD camp | Renders `$1,000.00`. The currency code matches the camp (not the browser). |
| H4 | Browser language `en-US`, EUR camp | Renders `€1,000.00`. |
| H5 | Currency code resilience | Manually invoke `formatMajor(1000, "XYZ")` via DevTools console. Falls back to the string `"1000 XYZ"` (the `catch` branch) rather than throwing. |

---

## Section I — Backend `requireCurrency` + API contract

New helper in [apps/wc-nest-api/src/modules/booking-groups/booking-groups.service.ts](apps/wc-nest-api/src/modules/booking-groups/booking-groups.service.ts). Returns upper-case ISO 4217 and throws when missing. Now used in `getForParent`. Type update: [apps/wc-booking/src/types/camp-booking.ts](apps/wc-booking/src/types/camp-booking.ts) — `ParentBookingGroupDetail.currency: string` (required).

| # | Case | Pass criteria |
|---|---|---|
| I1 | GET `/user/booking-groups/:id` for the CHF booking | Response body includes top-level `"currency": "CHF"`. Repeat for the GBP booking → `"GBP"`. The value is upper-case. |
| I2 | Same endpoint, with `ProviderSettings.currency` temporarily NULL | 400 Bad Request: `"Provider has no currency configured"`. **Restore the value.** |
| I3 | Backend snapshot integrity (read-only check via Prisma Studio after a fresh booking submission on the GBP provider) | New rows have `currency = "GBP"` (case as stored): `Payment.currency`, `BookingPayoutSchedule.currency`, `PayoutEvent.currency` (after a payout fires). All match the provider's settlement currency. |
| I4 | Provider-side `payment_intents.service.ts` still uses lower-case | Stripe PaymentIntent created during the GBP booking submission has `currency: "gbp"` (lower-case is Stripe's API contract — `PaymentIntentsService.requireCurrency` returns lower-case while `BookingGroupsService.requireCurrency` returns upper-case for parent payloads). Verify in Stripe Dashboard → Connect → Accounts → [acct_*] → Payments. |
| I5 | Refund preview API for a CHF booking | `preview.currency === "CHF"` in the response — this is what feeds Section G's UI. |

---

## Section J — Cross-currency end-to-end smoke (recommended single happy-path check)

Pick the **GBP** provider and run a single booking end to end to confirm currency is consistent at every hop.

| # | Case | Pass criteria |
|---|---|---|
| J1 | Camp page → booking flow → review → authorize | Every price shown in GBP. |
| J2 | Stripe Elements card form | "Pay £…" copy. Card charged in GBP. |
| J3 | Stripe Dashboard (connected account view) | PaymentIntent appears with `currency = gbp`, `application_fee_amount` in GBP minor units. |
| J4 | DB after submission | `Payment.currency = "GBP"`, `BookingPayoutSchedule.currency = "GBP"`, `BookingGroup.totalAmount` interpreted in GBP. |
| J5 | Confirmation email (if enabled) | Amount + symbol render as GBP. |
| J6 | Booking detail sidebar `/account/bookings/[id]` | Summary, deposit, balance, paid rows all in GBP (regression check for C6 in the realistic flow, not via seeded data). |

---

## Out of scope (do **not** raise as defects against this branch)

- **Multi-currency Stripe-FX payout routing of WC platform-fee balances** — wiring WC's USD/GBP/CHF/EUR external accounts to the platform Stripe account and per-currency aggregation is a separate workstream (ops + Stripe configuration, not code on this branch).
- **Provider Terms §6.8 amendment** — legal/docs task tracked with the legal team. Code already follows the intended end-state.
- **Child-preferences page currency selector** at `/account/children/[id]/preferences` (USD/EUR/GBP/AED, used only for the budget-range slider) and the USD-hardcoded `RangeSlider` that backs it — flagged in the audit, deliberately deferred per product call. C9 above is a regression check that this selector does not leak into camp / booking pricing.
- **CHF provider's `CurrencyInput` symbol on `AddOn` create when no prior add-on exists** — modal currently uses `addOn?.currency ?? 'CHF'`; cosmetic-only (server ignores client-supplied currency). Out of scope here.

---

## Quick reference — what shipped (for testers cross-referencing the diff)

| Change | File(s) |
|---|---|
| Allow-list → 4 currencies | [stripe.constants.ts](apps/wc-nest-api/src/modules/stripe/stripe.constants.ts) |
| API-boundary `@IsIn` | [google-business.dto.ts](apps/wc-nest-api/src/modules/provider/onboarding/dto/google-business.dto.ts) |
| Provider dropdowns trimmed | [find-your-camp/page.tsx](apps/wc-provider/src/app/onboarding/find-your-camp/page.tsx), [company-settings-modal.tsx](apps/wc-provider/src/components/account/modals/company-settings-modal.tsx) |
| Add-on currency server-side only | [add-ons.service.ts](apps/wc-nest-api/src/modules/provider/add-ons/add-ons.service.ts), [create-add-on.dto.ts](apps/wc-nest-api/src/modules/provider/add-ons/dto/create-add-on.dto.ts), [types/add-ons.ts](apps/wc-provider/src/types/add-ons.ts) |
| `requireCurrency` + `currency` on parent DTO | [booking-groups.service.ts](apps/wc-nest-api/src/modules/booking-groups/booking-groups.service.ts), [camp-booking.ts](apps/wc-booking/src/types/camp-booking.ts) |
| Booking-detail sidebar threads currency | [booking-detail-sidebar.tsx](apps/wc-booking/src/components/bookings/booking-detail-sidebar.tsx) |
| `getCampCurrency` helper + fallbacks replaced | [utils/currency.ts](apps/wc-booking/src/utils/currency.ts), [camps/[campSlug]/page.tsx](apps/wc-booking/src/app/camps/%5BcampSlug%5D/page.tsx), [camp-booking-flow.tsx](apps/wc-booking/src/components/camp-booking/camp-booking-flow.tsx), [use-booking-sidebar-data.ts](apps/wc-booking/src/components/camp-booking/use-booking-sidebar-data.ts), [mobile-booking-footer.tsx](apps/wc-booking/src/components/camp-booking/mobile-booking-footer.tsx), [wishlist-camp-card.tsx](apps/wc-booking/src/components/wishlists/wishlist-camp-card.tsx), [wishlist-map-panel.tsx](apps/wc-booking/src/components/wishlists/wishlist-map-panel.tsx), [AccordionGroup.tsx](apps/wc-booking/src/components/camp/AccordionGroup.tsx), [faq-builders.ts](apps/wc-booking/src/utils/faq-builders.ts) |
| Cancel-modal explicit unavailable state | [cancel-booking-modal.tsx](apps/wc-booking/src/components/bookings/cancel-booking-modal.tsx) |
| `formatMajor` locale-pinned | [stripe-payment-section.tsx](apps/wc-booking/src/components/camp-booking/stripe-payment-section.tsx) |
| `CurrencyInput` symbol map; `SessionForm` no hardcode | [currency-input.tsx](packages/ui-web/src/components/currency-input.tsx), [SessionForm.tsx](apps/wc-provider/src/components/sessions/SessionForm.tsx) |
