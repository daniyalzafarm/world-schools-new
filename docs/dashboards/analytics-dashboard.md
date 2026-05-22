# Analytics Dashboard — Product Guide

> **Route:** `/analytics-dashboard` in the World Camps Superadmin app
> **Audience:** Product Managers, Growth, Leadership, Support
> **Purpose:** Single source of truth for platform-wide growth, conversion, and geographic trends.

This guide explains **(a) what each widget shows, (b) exactly how every stat is calculated, and (c) how to use the dashboard to answer common product questions**. No SQL — plain English only.

---

## 1. What this dashboard is for

The Analytics Dashboard gives a top-down view of platform health: how much money is flowing through bookings (GMV), how much the platform earns from those bookings (platform revenue), how many bookings and parents are active, how well bookings convert from creation to completion, and where in the world activity is concentrated.

Use it to answer questions like: _"Is the business growing?"_, _"Where is the funnel leaking?"_, _"Which providers/markets are driving growth?"_

---

## 2. Controls & filters (top bar)

| Control | What it does |
|---|---|
| **Date Range** | Presets: **7D**, **30D** (default), **90D**, **1Y**, or a custom from/to. All widgets recompute when this changes. |
| **Currency** | "All Currencies" (aggregate) or a single settlement currency (USD, EUR, GBP, etc.). When set, only providers whose **settlement currency** matches are included. |
| **Refresh** | Forces a re-fetch from the backend. (Server caches results 60–600s per widget — refresh after major data changes.) |

### How the date range is interpreted
- The range you pick is the **current period**.
- For trend % comparisons, the dashboard automatically computes a **prior period of equal length** ending where the current period begins.
  - Example: a 30D range running May 1 → May 30 compares to April 1 → April 30.
- For time-series charts, the range determines **bucket granularity**:
  - ≤ 30 days → **daily** buckets
  - 31–90 days → **weekly** buckets
  - > 90 days → **monthly** buckets

### How the currency filter works
- Filters by the **provider's settlement currency**, not the parent's billing currency.
- "All Currencies" aggregates raw numbers across currencies. This is fine for counts (bookings, parents), but be aware: GMV and Platform Revenue values in "All Currencies" mode are simple unconverted sums and should be interpreted carefully if you have meaningful cross-currency mix.

---

## 3. Widgets & how every stat is calculated

### 3.1 Overview KPIs (5 cards)

Five top-line metrics. Each card shows: **current value**, **previous-period value**, **trend %** (vs prior equal-length window), and a **12-point sparkline** of the trend within the current window.

| KPI | Plain-English formula | What's included / excluded |
|---|---|---|
| **Total GMV** | Sum of booking-group totals for groups **created in the window**. | Excludes inactive statuses: `draft`, `declined`, `expired`, `cancelled`. |
| **Platform Revenue** | Sum of **application fees** on `succeeded` payments in the window. | Only `succeeded` payments count. |
| **Total Bookings** | Count of booking groups **created in the window**. | Excludes inactive statuses (same list as GMV). |
| **Active Parents** | Count of **distinct parents** who created at least one active booking in the window. | Inactive statuses excluded; a parent who only created a cancelled booking won't appear. |
| **Conversion Rate** | `Completed bookings ÷ Total bookings created × 100`, where "completed" = status in [`completed`, `at_camp`]. | Both numerator and denominator are scoped to the same window. |

**Trend %** = `(current − previous) ÷ previous × 100` using the equal-length prior window.

**Gotcha:** When a specific currency is selected, only providers whose settlement currency matches are counted. A parent who booked in EUR will not appear when "USD" is selected.

---

### 3.2 Revenue & GMV Chart

A two-line time series across the selected window.

- **GMV line** — same formula as Total GMV above, bucketed by date.
- **Platform Revenue line** — same formula as Platform Revenue above, bucketed by date.
- Bucket size (day/week/month) is auto-selected from the range length (see §2).

**How to read it:** Look for shape, not just direction — a flat GMV with rising Platform Revenue could mean fee changes, currency mix, or larger bookings; rising GMV with flat Revenue could mean fee leakage or a shift in cohort.

---

### 3.3 Booking Status Distribution (donut)

Counts and amounts grouped by **every** booking status for groups created in the window.

- Center label: total count of bookings.
- Each slice: status name + count + total GMV in that status.

**Important difference:** Unlike the KPI cards, this widget **includes inactive statuses** (`draft`, `declined`, `expired`, `cancelled`). It's the one place on the dashboard where you can see the full status mix — useful for spotting if `draft` or `declined` is unusually high.

---

### 3.4 Top Performing Providers

A ranked list of up to **10 providers** sorted by GMV in the window.

- **GMV** = sum of booking-group totals for that provider in the window, excluding inactive statuses.
- **Booking count** = number of active booking groups for that provider in the window.
- Each row shows: rank, provider logo, name, city/country, booking count, GMV.

---

### 3.5 Geographic Distribution

Three tabs — **GMV**, **Bookings**, **Parents** — showing the top 10 countries.

- Country = **`provider.legalCountry`** (where the camp operator is registered, not where the parent lives). Missing values bucketed as "Unknown".
- **GMV tab** — sum of booking-group totals per country (excluding inactive statuses).
- **Bookings tab** — count of active booking groups per country.
- **Parents tab** — count of distinct parents per country.
- **Percentage** shown on each bar = `country value ÷ total across all countries × 100`.

**How to read it:** Geographic mix changes slowly — sudden jumps usually indicate a new provider going live, a marketing push, or seasonal demand.

---

### 3.6 Booking Conversion Funnel

Six cumulative stages showing where bookings drop off between creation and completion.

| Stage | Stage definition (count = booking groups whose status reached this point or beyond) |
|---|---|
| 1. **Bookings created** | All groups created in the window (includes drafts). |
| 2. **Card authorized** | Reached `request` or later in the lifecycle. |
| 3. **Provider accepted** | Reached `accepted` or later. |
| 4. **Deposit paid** | Reached `deposit_paid` or later. |
| 5. **Fully paid** | Reached `fully_paid` or later. |
| 6. **Completed** | Status is `completed`. |

For each stage:
- **Drop-off %** = loss from the previous stage (`(prev − current) ÷ prev × 100`).
- **Conversion %** = `stage count ÷ Stage 1 count × 100`.

**Gotcha — cohort effect:** The funnel counts groups *created* in the window, regardless of when they later progressed. A group created on day 6 of a 7D window may not have had time to reach "completed" yet, so short windows will show artificially low completion rates. For funnel analysis, **prefer 90D or 1Y windows**.

---

## 4. Using this dashboard as a PM — example workflows

### "Is the platform growing?"
1. Set date range to **30D**.
2. Look at trend % on the four growth KPIs: Total GMV, Platform Revenue, Total Bookings, Active Parents.
3. Cross-check the **Revenue & GMV Chart** for shape (steady climb vs spike vs decline).
4. Switch to **1Y** to confirm direction over a longer horizon and rule out seasonality.

### "Which providers are driving growth?"
1. Set date range to **90D** (enough volume to be stable, recent enough to be relevant).
2. **Top Performing Providers** — who's on top? Anyone new?
3. **Geographic Distribution → GMV tab** — is growth concentrated in one country?
4. Optionally filter by currency to isolate a market.

### "Where is the funnel leaking?"
1. Set date range to **90D** (avoid the cohort gotcha — see §3.6).
2. Open the **Booking Conversion Funnel** and find the stage with the largest drop-off %.
3. Re-check at **30D** to see if the leak is recent or chronic.
4. Common patterns:
   - Big drop **Stage 1 → 2** ⇒ checkout / card auth friction.
   - Big drop **Stage 2 → 3** ⇒ provider response time / acceptance issues.
   - Big drop **Stage 4 → 5** ⇒ payment plan friction or balance-due reminders.

### "Are we acquiring new parents or just retaining existing ones?"
1. Compare **Active Parents** trend over 30D, 90D, 1Y.
2. Cross-reference with **Total Bookings** — if bookings are growing faster than parents, retention/repeat is up.
3. **Geographic Distribution → Parents tab** — are we picking up new markets?

### "Did a specific market move?"
1. Set the **Currency filter** to that market's currency.
2. Re-read every widget through that lens. Compare to "All Currencies" to see the relative size of that market's contribution.

### "Is the status mix healthy?"
1. **Booking Status Distribution** — check the share of `draft`, `declined`, `expired`, `cancelled`.
2. Rising `draft` ⇒ users start but don't finish — likely UX friction.
3. Rising `declined` ⇒ providers rejecting bookings — likely capacity or quality issues.

---

## 5. Data freshness & caching

The backend caches each widget independently for 60–600 seconds depending on cost-of-compute. Hit the **Refresh** button after seeding data, running migrations, or known large events. In normal use the cache is fast enough that real-time precision isn't needed.

---

## 6. Known limitations & things to watch

- **Currency filter is provider-scoped, not transaction-scoped.** A parent who paid in EUR for a provider whose settlement currency is USD will appear under "USD".
- **Active Parents is currency-window-scoped.** A parent active in both EUR and USD will appear in each market's view independently — they are **not** deduplicated cross-currency in single-currency views.
- **Funnel is cohort-based.** Short windows will undercount completions because newly-created bookings haven't had time to progress. Use ≥90D for funnel decisions.
- **"All Currencies" GMV sums currencies without FX conversion.** Treat the absolute number cautiously; it's best for trend, not for finance reporting.
- **Geographic Distribution uses provider legal country**, which may differ from where the camp physically operates if a multi-country operator is registered in one jurisdiction.
