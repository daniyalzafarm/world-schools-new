# Financial Dashboard — Product Guide

> **Route:** `/financial-dashboard` in the World Camps Superadmin app
> **Audience:** Finance Ops, PMs working on payments, Leadership
> **Purpose:** Stripe-backed view of the platform's financial health — revenue, balances, disputes, refunds, reimbursements, payouts, and connected-account status.

This guide explains **(a) what each widget shows, (b) exactly how every stat is calculated, and (c) how to use the dashboard to answer common product and finance questions**. No SQL — plain English only.

---

## 1. What this dashboard is for

The Financial Dashboard answers: _"Are we making money?"_, _"Where is money stuck?"_, _"Are there dispute / refund / reimbursement problems?"_, _"Will we be able to pay providers on time?"_, _"Which connected accounts are at risk?"_

All financial figures come from **Stripe** (live balances, payment intents, application fees, disputes, refunds, charges, account status) **and** from our database (`reimbursement` and `bookingPayoutSchedule` tables). It is not a substitute for Stripe's own dashboard for journal-level reconciliation — it's an operations cockpit.

---

## 2. Controls & filters (top bar)

| Control | What it does |
|---|---|
| **Currency** | "All Currencies" (aggregate) or a single currency. **The dashboard changes shape based on this** — see §3 below. |
| **Date Range** | Presets **7D**, **30D** (default), **90D**, **1Y**, or custom. |
| **Refresh** | Forces a re-fetch (server caches 60–600s per widget). |
| **Open Stripe** | External link to the Stripe Dashboard. |

Bucketing for time-series widgets follows the same rule as the Analytics Dashboard: ≤30d daily, 31–90d weekly, >90d monthly.

---

## 3. ⚠️ "All Currencies" vs single-currency mode — read this first

The biggest source of confusion on this dashboard is that it deliberately behaves differently in the two modes:

- **Amounts cannot be legitimately summed across currencies** (you'd be adding USD to JPY). So in **All-Currencies mode**, amount figures in many widgets are **intentionally hidden / zeroed**, and the dashboard switches to **counts and rates** which are currency-agnostic.
- In **single-currency mode**, you see full monetary detail for that one currency.
- Some widgets have an **extra "by currency" breakdown** that only appears in All-Currencies mode (e.g. the Currency Performance Table).

When you see a number that looks lower than expected — or "—" instead of an amount — check the currency selector first. That's almost always the cause.

---

## 4. Widgets & how every stat is calculated

### 4.1 Financial Overview KPIs

**In All-Currencies mode — 4 cards:**

| KPI | Formula |
|---|---|
| **Currencies Active** | Number of distinct currencies with activity in the window. Footer shows the top currency by GMV. |
| **Payments Processed** | Count of `succeeded` payment intents platform-wide (across all currencies). |
| **Payment Success Rate** | `succeeded ÷ (succeeded + failed) × 100` across all payment intents. "Failed" = canceled or `requires_payment_method` with an error. |
| **Open Dispute Rate** | `total disputes ÷ succeeded payment intents × 100`. Footer shows total disputes + urgent count (needs response, evidence due within 72h). |

**In single-currency mode — 5 cards:**

| KPI | Formula |
|---|---|
| **Net Revenue** | Application fees collected **minus** the refunded portion of those fees, for the window. |
| **GMV Processed** | Sum of `succeeded` payment intent amounts for the window. |
| **Stripe Balance (available)** | Live from Stripe's balance API. Card shows a "last updated" timestamp. |
| **Stripe Balance (pending)** | Live from Stripe — funds in flight, not yet available. |
| **Payment Success Rate** | Same as above, scoped to the selected currency. |

---

### 4.2 Currency Performance Table *(All-Currencies mode only)*

One row per currency, sorted by **GMV descending**.

| Column | Meaning |
|---|---|
| **Currency** | ISO code. |
| **GMV** | Sum of succeeded payment-intent amounts for the window. |
| **Net Revenue** | Application fees collected minus refunded portion. |
| **Payments** | Count of payment intents (any status). |
| **Success %** | `succeeded ÷ total payments × 100`. Chip color: **≥95% green**, **≥80% yellow**, **<80% red**. |
| **Refunds** | Count of refunds + refund rate (`refund count ÷ payments × 100`). |
| **Disputes** | Count of disputes + open dispute rate. |
| **Pending Payouts** | Sum of upcoming payout tranches in that currency. |
| **Available / Pending** | Live Stripe balance — available and pending portions. |

**How to read it:** This is the single most useful "where do we stand by market" view. Sort/scan visually for any currency with low Success %, high Refunds, or high Disputes.

---

### 4.3 Revenue Composition Chart

A stacked bar chart showing how revenue is composed over time. Three stacked components per bar:

| Component | Formula |
|---|---|
| **Application Fees** | Net platform fees collected per bucket (gross fee minus refunded portion). |
| **Refunds** | Portion of application fees that were refunded in that bucket. |
| **Reimbursements** | Amount providers owe the platform (from the `reimbursement` table) with status in [`settled`, `invoiced`], bucketed by created date. |

- **All-Currencies mode:** Top 6 currencies appear as tabs; click to switch. Each tab has its own chart with its own Y-axis.
- **Single-currency mode:** One chart for the selected currency.
- Bucketing: same daily/weekly/monthly rule as the rest of the dashboard.

**How to read it:** Big refund bars relative to application fees ⇒ refund pressure. Big reimbursement bars ⇒ providers owe the platform money (e.g. for camps that didn't run as expected).

---

### 4.4 Payment Status Distribution (donut)

Counts of payment intents in the window, grouped by Stripe status:

| Status | Meaning |
|---|---|
| `succeeded` | Captured successfully. |
| `processing` | Stripe is processing. |
| `requires_action` | Awaiting customer action (e.g. 3DS challenge). |
| `requires_capture` | Authorized, not yet captured. |
| `requires_confirmation` | Awaiting final confirmation. |
| `requires_payment_method` | Customer needs to provide a payment method (often a failure case). |
| `failed` | Payment failed. |
| `canceled` | Payment canceled. |

- **Single-currency mode:** Donut also surfaces total amount per status.
- **All-Currencies mode:** Counts only.

**How to read it:** A growing slice of `requires_action` or `requires_payment_method` is the leading indicator of checkout friction.

---

### 4.5 Dispute Activity

A donut + a side panel.

**Donut by outcome:**
- **Open** — `needs_response`, `under_review`, `warning_needs_response`, `warning_under_review`.
- **Won** — dispute won.
- **Lost** — dispute lost.
- **Warning Closed** — warning closed (no chargeback occurred).
- **Other** — anything else.

**Header stat — Open Dispute Rate:** `total disputes ÷ succeeded payment intents × 100`. (Same formula as the KPI card.)

**Side panel:**
- **All-Currencies mode → "By Currency"** — top 6 currencies with: dispute count, open rate, total amount.
- **Single-currency mode → "Urgent"** — up to 5 disputes with status `needs_response` **and** evidence due within 72 hours. Each row shows provider name, evidence due date, and disputed amount.

**How to read it:** The Urgent panel is the operational queue — anything here needs evidence submitted by the deadline or the dispute is auto-lost.

---

### 4.6 Refunds Overview

Progress bars per refund **reason** (from Stripe): `duplicate`, `fraudulent`, `requested_by_customer`, `other`.

- **Single-currency mode:** Bars show **amount** per reason; sorted by amount descending. Header shows total count + total amount.
- **All-Currencies mode:** Bars show **percentage of count** per reason (amounts can't be summed across currencies); sorted by count descending. Header shows total refund count across all currencies.

Plus a **currency breakdown** (All-Currencies mode only): top 8 currencies by refund count, each row showing count + total amount in that currency.

**How to read it:** A growing `fraudulent` share is a red flag — escalate to risk. A growing `duplicate` share usually points to a checkout idempotency bug.

---

### 4.7 Reimbursement Aging

Three aging buckets showing money owed to the platform by providers.

| Bucket | Definition | Color |
|---|---|---|
| **0–7 days** | Not yet overdue (`today − due date ≤ 0`). | Green |
| **8–30 days overdue** | Past due by up to 30 days. | Orange |
| **30+ days overdue** | Past due by more than 30 days. | Red |

- Source: rows in the `reimbursement` table with status in [`pending`, `invoiced`].
- **Single-currency mode:** Bars show **amounts**. Underneath, two status cards: **Pending** and **Invoiced** with count + amount.
- **All-Currencies mode:** Bars show **counts**. A "by currency" list below shows outstanding totals per currency.

**How to read it:** The **30+ days bucket is the leading indicator of bad debt**. Anything moving into it should trigger collections action.

---

### 4.8 Upcoming Payouts

A list of pending payout tranches scheduled to release within the next N days (default **7**, max **60**).

- Source: `bookingPayoutSchedule` table where status = `pending` and release date ∈ `[now, now + N days]`.
- Sorted by **release date ascending**; capped at **25 rows**.
- Each row: provider name, reason badge (e.g. "Deposit Return"), release date, amount.

Layout:
- **Single-currency mode:** Flat list.
- **All-Currencies mode:** Grouped by currency, with a per-currency header showing count + total amount in that currency.

**How to read it:** Cross-reference with the **Stripe Balance (available)** KPI — if available balance can't cover upcoming payouts, you have a cash-flow problem.

---

### 4.9 Connected Accounts Health (table)

Top **20** (provider × currency) pairs by GMV in the window. Each row is a unique account-currency combo.

| Column | Meaning |
|---|---|
| **Provider** | Display name. Falls back to Stripe business profile / dashboard display name / email / account ID if the DB name is missing. |
| **Currency** | ISO code. |
| **GMV** | Sum of `succeeded` Stripe charges for that account × currency × window. |
| **Charges** | Live from Stripe: ✅ enabled / ❌ disabled. |
| **Payouts** | Live from Stripe: ✅ enabled / ❌ disabled. |
| **Attention** | Yellow badge if Stripe `requirements.currently_due` or `past_due` is non-empty, or `disabled_reason` is set. Otherwise "—". |
| **Last Payout** | **Currently shown as "—"** — backend leaves null (known TODO). |
| **Payout Success** | **Currently shown as "—"** — backend leaves null (known TODO). |

**How to read it:** Visually scan for any row where **Charges** or **Payouts** is ❌, or **Attention** shows a badge. These are providers at risk of being suspended or already restricted by Stripe.

---

## 5. Using this dashboard as a PM — example workflows

### "Are we making money this month?"
1. Set **Currency** to your reporting currency (e.g. USD).
2. Look at **Net Revenue** KPI for the **30D** window.
3. Open **Revenue Composition Chart** — is the trend rising or falling? Are refunds eating into application fees?
4. Compare against **1Y** to confirm direction over a longer horizon.

### "Which currencies/markets matter?"
1. Switch to **All Currencies** mode.
2. Open **Currency Performance Table**, sort visually by GMV.
3. Scan **Success %**, **Refunds**, and **Disputes** columns — flag any market with red Success % or high dispute rate.

### "Do we have a refund problem?"
1. Open **Refunds Overview** (start in All Currencies for the high-level mix, then drill into a specific currency).
2. Which **reason** dominates? Is `fraudulent` growing? `duplicate` growing?
3. Cross-check **Revenue Composition Chart** — is the refund bar visibly outsized vs application fees?

### "How urgent are disputes?"
1. Switch to single-currency mode for the currency you operate in.
2. Open **Dispute Activity** → **Urgent** panel.
3. Anything listed needs evidence before its 72h deadline. Outside of urgent items, watch the **Open Dispute Rate** trend over 30D / 90D.

### "Are providers paying us back?"
1. Open **Reimbursement Aging**.
2. The **30+ days bucket** is the highest-risk number on the dashboard. Each item is a candidate for collections / escalation.
3. Compare its size to the **0–7 days** bucket — a healthy mix has most of the weight on the left.

### "Will we make payroll / pay providers this week?"
1. Single-currency mode.
2. Compare **Stripe Balance (available)** vs **Upcoming Payouts** total. If payouts > available, you'll need pending funds to clear or to top up.

### "Which providers are at risk of being suspended by Stripe?"
1. Open **Connected Accounts Health** table.
2. Visually scan for ❌ on Charges/Payouts or a yellow **Attention** badge.
3. Each flagged account is a provider whose Stripe onboarding needs to be unblocked or who has outstanding requirements.

### "What just happened to our success rate?"
1. **Payment Status Distribution** — has the `requires_action` or `requires_payment_method` slice grown?
2. Cross-check with **Payment Success Rate** trend.
3. A spike in `requires_action` after a code change often points to a 3DS / SCA regression.

---

## 6. Data freshness & caching

Each widget is cached server-side independently:

| Widget | Cache TTL |
|---|---|
| Overview / Balance | 60s |
| Upcoming Payouts | 60s |
| Payment Status / Disputes / Connected Accounts | 120s |
| Revenue Composition / Refunds / Reimbursements | 300s |
| Currencies (selector list) | 600s |

Stripe data is **near-live** — the balance card is timestamped so you know exactly when it was last fetched. Click **Refresh** after operational changes.

---

## 7. Known limitations & things to watch

- **"All Currencies" amounts are intentionally hidden** in many widgets because summing currencies isn't meaningful. If you need a money number, pick a specific currency.
- **"Last Payout" and "Payout Success %"** in the Connected Accounts table are placeholders — the backend currently returns null. Treat as not-yet-implemented.
- **Connected Accounts table is capped at top 20 by GMV.** Smaller accounts won't appear — use Stripe's dashboard for the long tail.
- **Open Dispute Rate denominator is succeeded payment intents.** Early-stage currencies with near-zero succeeded payments will show wildly skewed rates — ignore for those markets.
- **Reimbursement aging is from our DB, not Stripe.** It reflects the platform's record of what providers owe, which is the source of truth for this metric.
- **Stripe charges for Connected Accounts GMV are fetched per account** — the dashboard ranks by GMV first, then hydrates live status for the top accounts only.
- **No FX conversion anywhere on this dashboard.** Don't mentally add up multi-currency totals — use the per-currency rows instead.
