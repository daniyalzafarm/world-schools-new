**INTERNAL — FOR DANIYAL ZAFAR — CONFIDENTIAL**

**World Camps — Payment Flow Reference**

Version: 1.0 | April 2026 | Owner: Alex Peipers

**Payment Flow Reference — Daniyal**

This document defines the complete payment flow for World Camps under both the default and non-default (early payout) models. It covers the parent-facing payment experience and the camp-facing payout flow. All Stripe logic must be implemented exactly as described.

# **Important Notes**
- The default service fee is configurable from the wc-superadmin app and each provider can also have the custom fee value.
- Deposit settings and the Cancellation Policy are being set in the provider onboarding flow(`apps/wc-provider/src/app/onboarding`). You can also make the changes if there are any bugs, issues or improvements to be made to make the implementation truly PRODUCTION GRADE. We need to update it to use the currency from the ProviderSettings and use the defaultAppFee from the SystemSettings to preview the calculations in both calculators.
- Review the schema file(`apps/wc-nest-api/prisma/schema.prisma`) and existing apis to get the understanding of the current architecture.
- We need to add the Payment processing in the booking flow(`apps/wc-booking/src/app/camps/[campSlug]/book`) in the wc-booking app.
- The provider stripe connection is already implemented in the `apps/wc-provider/src/app/onboarding/stripe-connect` and `apps/wc-provider/src/app/(dashboard)/account/business/stripe-account` page on the frontend.
- We need to do the implementation PRODUCTION GRADE as we will beta launch this application right away once this stripe integration is completed.
- Please review the test cases for the existing stripe implementation. Make sure to create proper test cases for the new implementation.
- As the Payments part is the most critical in any application, so we need to make sure we follow the silicon valley standard for this implementation.
- All the edge cases in any flow must be handled properly.


# **Part A — Parent-Facing Payment Flow**

## **A.1 With Non-Refundable Deposit (Camp has configured deposit)**

*Example: Camp sets 30% non-refundable deposit. Program price €2,000. Balance due date: 60 days before program start.*

| Step | Trigger | What parent pays | Stripe action | Parent sees |
| :---- | :---- | :---- | :---- | :---- |
| **1\. Booking** | Parent submits booking | Deposit (e.g. 30% \= €600 on €2,000 program) | PaymentIntent \#1 captured immediately. Non-refundable flag set. | Confirmation email. Receipt showing €600 charged. |
| **2\. Balance due** | Configured balance date (e.g. 60 days before program start) | Balance (70% \= €1,400) | PaymentIntent \#2 auto-charged using saved payment method. | Email notification. Receipt showing €1,400 charged. |
| **3\. Program runs** | Program start date | Nothing — already paid | Transfer released to camp (default payout). | No action required. |

## **A.2 No Deposit (Camp has configured no deposit)**

*Example: No deposit. Full payment due 90 days before program start. Or full payment at booking if \<90 days away.*

| Step | Trigger | What parent pays | Stripe action | Parent sees |
| :---- | :---- | :---- | :---- | :---- |
| **1\. Booking** | Parent submits booking | Nothing at booking (or first instalment if configured) | No charge yet. Payment method saved for future charges. | Confirmation email. Payment schedule shown. |
| **2\. Payment due** | Configured payment date (e.g. 90 days before start) | Full program fee (€2,000) or first instalment | PaymentIntent captured. Funds held by Stripe. | Email notification. Receipt. |
| **3\. Program runs** | Program start date | Nothing — already paid | Transfer released to camp (default payout). | No action required. |

# **Part B — Camp Payout Flow**

## **B.1 Default Model — Payout After Program Start**

*This is the standard model for all camps unless a written early payout agreement is in place. transfer\_date on Stripe PaymentIntent \= first business day after program start date.*

| Phase | Event | Stripe state | Camp dashboard shows | Refund possible? |
| :---- | :---- | :---- | :---- | :---- |
| Pre-booking | No booking yet | — | — | — |
| **Booking confirmed** | Parent pays deposit | Funds received. Held on camp's connected account (transfer\_date \= program start) | Booking confirmed. Deposit received: €540 (after 10% fee). Balance pending. | YES — deposit refundable only within 48h grace period |
| **Balance paid** | Balance auto-charged on configured date | Additional funds received. Still held. Total pending payout grows. | Balance received: €1,260 (after 10% fee). Total pending: €1,800. | YES — per cancellation policy |
| **Program start** | Program start date reached | transfer\_date reached → Stripe releases funds to camp bank account | Payout initiated: €1,800. Expected in bank within 2 business days. | **Refunds now require camp reimbursement** |
| Post-program | 30 days after program end | — | Participant data deleted per retention schedule. | **NO** |

## **B.2 Non-Default Model — Early Payout (Agreed in Writing)**

*Only available to camps with a written early payout agreement confirmed by Alex. transfer\_date \= agreed early payout date. World Camps dashboard must show this date clearly and flag the reimbursement obligation risk.*

| Phase | Event | Stripe state | Camp dashboard shows | Refund possible? |
| :---- | :---- | :---- | :---- | :---- |
| **Agreement** | World Camps approves early payout in writing | transfer\_date updated to agreed early payout date | Early payout confirmed. Date shown in dashboard. | — |
| **Booking confirmed** | Parent pays deposit | Funds held. transfer\_date \= early payout date (not program start) | Deposit received: €540. Balance pending. | YES — within 48h grace period |
| **Balance paid** | Balance auto-charged | Additional funds held. Total pending payout grows. | Balance received: €1,260. Total pending: €1,800. | YES — per cancellation policy |
| **Early payout date** | Agreed early payout date reached | transfer\_date reached → funds released BEFORE program start | Early payout initiated: €1,800. | **CAMP MUST REIMBURSE if cancellation occurs after this point** |
| Program start | Program runs as planned | Already settled — no further Stripe action | — | **NO** |

# **Part C — Service Fee Calculation**

*15% service fee applies to the total program price. It is split proportionally across deposit and balance payments. Camp always receives 85% net regardless of deposit structure.*

| Scenario | Program price | Deposit (30%) | Balance (70%) | Service fee (15%) | Camp net payout |
| :---- | :---- | :---- | :---- | :---- | :---- |
| With deposit | €2,000 | €600 | €1,400 | −€300 | **€1,700** |
| No deposit | €2,000 | — | €2,000 | −€300 | **€1,700** |
| Note: Service fee is 15%. Camp always receives 85% of program price regardless of deposit structure. |  |  |  |  |  |

# **Part D — Cancellation and Refund Scenarios**

*All refunds are processed by World Camps via Stripe API. Camp never processes refunds directly. Stripe reverses the relevant PaymentIntent. If funds already disbursed (early payout), camp reimbursement flow must be triggered.*

| Cancellation scenario | Who cancels | Deposit refund | Balance refund | Payout impact |
| :---- | :---- | :---- | :---- | :---- |
| Within 48h grace period | Parent | **FULL refund (100%)** | **FULL refund (100%)** | Stripe reversal. No payout to camp. |
| After 48h — before non-refund window | Parent | **NON-REFUNDABLE** | Per cancellation policy (e.g. 100% refund if 90+ days before) | Stripe reversal of refundable portion. Deposit stays held until payout date. |
| After 48h — within non-refund window | Parent | **NON-REFUNDABLE** | 0% or partial per policy | World Camps releases non-refundable portion to camp at payout date. |
| Camp cancels | Camp | **FULL refund to parent** | **FULL refund to parent** | Camp must reimburse World Camps full amount incl. service fee within 7 days. |
| Camp cancels — early payout already disbursed | Camp | **FULL refund to parent** | **FULL refund to parent** | **Camp must reimburse World Camps full amount within 7 days. Deducted from future payouts or direct bank transfer.** |
| Force majeure | Either / external event | Included in credit note or partial cash refund | 100% credit note valid 24 months OR cash refund less service fee | Service fee retained at World Camps discretion. Camp reimburses net share. |

# **Part E — Key Stripe Implementation Notes**

**PaymentIntents:**

Create separate PaymentIntents for deposit and balance. Do not combine into one. This allows independent refund handling. Set transfer\_data.destination \= camp connected account ID. Set application\_fee\_amount \= 15% of the payment amount.

**Saved payment method:**

At booking, save the parent's payment method (SetupIntent) for future balance charges. Use off\_session: true for automatic balance charges on the due date. Implement retry logic with 48h window and notification email on first failure.

**transfer\_date (default model):**

Set transfer\_date \= first business day after program start date. Use Unix timestamp. This is the key parameter that holds funds until payout date. Do not set transfer\_date in the past.

**transfer\_date (early payout model):**

Set transfer\_date \= agreed early payout date. This must be stored in the DB per booking (not per camp) so it can be audited. Flag all early payout bookings in the dashboard with a reimbursement risk indicator.

**Refund flow:**

Refunds are processed via refunds.create() on the original PaymentIntent. For deposit: only refundable within 48h grace period. For balance: refund amount \= balance × refund percentage per cancellation policy. Service fee portion is non-refundable after 48h.

# **AFC Tax Ruling**

Here's what it means for us:

**Our model is approved.**

The AFC confirms we operate as a disclosed collection agent under Art. 20 al. 2 LTVA. The platform deemed-supplier rule (Art. 20a) does not apply to us.

No VAT on camp prices for parents.
Parents pay the listed price — no VAT line, no surcharge. Exactly as designed.

Our commission invoices to camps
are subject to Swiss VAT only for Swiss-based camps. For all foreign camps (the vast majority), the commission is 0% — which is most of our inventory.

Booking confirmations
can be issued centrally by us, as long as they clearly state we're acting on behalf of the camp. Our existing Terms & Conditions document language is compliant.

**One operational note:
if a parent cancels after the 48h grace period and we retain the commission, we need to correct the VAT declared on that commission.**

We're clear to proceed from a VAT perspective.

Concretely this means in terms of docs that we must generate:

**Parents receive:**

Booking Confirmation (DOC-01) — issued by World Schools Sàrl, but in the name and on behalf of [Camp Name]. Must clearly state:

**The camp is the service provider** 

World Camps is acting as disclosed collection agent
Full booking details, price paid, dates, participant
No VAT invoice to parents. No separate receipt. The booking confirmation is the document. 

**Camps receive:**
- Commission Invoice (DOC-02) — World Schools Sàrl → Camp (B2B). Swiss camps: 8.1% VAT applied. Foreign camps: 0% (place of supply abroad).
- Payout Statement (DOC-03) — Per-booking statements. To be defined if we do monthly statement.
- Credit Note (DOC-04) — triggered when a parent cancels after the 48h grace period and commission is retained (fully or partially). This corrects the VAT on the commission. Important: this must be linked to the original commission invoice.