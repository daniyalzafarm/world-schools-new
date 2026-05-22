import { Injectable } from '@nestjs/common'
import { ReimbursementStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { DashboardCacheService } from '../analytics/dashboard-cache.util'
import { resolveRange } from '../analytics/range.util'
import type { FinancialRangeDto } from './dto/financial-range.dto'
import { FinancialStripeService } from './financial-stripe.service'

const TTL = {
  overview: 60,
  revenueComposition: 300,
  paymentStatus: 120,
  upcomingPayouts: 60,
  disputesSummary: 120,
  refundsSummary: 300,
  reimbursementsAging: 300,
  connectedAccounts: 120,
  currencies: 600,
}

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
    private readonly stripe: FinancialStripeService
  ) {}

  // -------------------------------------------------------------------------
  // Currencies — DB Payment rows ∪ Stripe live balance currencies
  // -------------------------------------------------------------------------

  async getCurrencies() {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'currencies', { v: 4 }),
      TTL.currencies,
      async () => {
        const [rows, balance, feeCurrencies] = await Promise.all([
          this.prisma.payment.findMany({
            select: { currency: true },
            distinct: ['currency'],
          }),
          this.stripe.getBalance().catch(() => ({ available: [], pending: [] })),
          this.stripe.listRecentApplicationFeeCurrencies(),
        ])

        const merged = [
          ...rows.map(r => r.currency.toLowerCase()),
          ...balance.available.map(b => b.currency.toLowerCase()),
          ...balance.pending.map(b => b.currency.toLowerCase()),
          ...feeCurrencies,
        ]
        return {
          currencies: merged.filter((v, i, arr) => arr.indexOf(v) === i).sort(),
        }
      }
    )
  }

  // -------------------------------------------------------------------------
  // Overview KPIs (Net Revenue, GMV, Refunds, Success Rate, Balance)
  // -------------------------------------------------------------------------

  async getOverview(query: FinancialRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'overview', {
      v: 4,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.overview, async () => {
      const [fees, intents, balance] = await Promise.all([
        this.stripe.listApplicationFees(range),
        this.stripe.listPaymentIntentsAcrossAccounts(range),
        this.stripe.getBalance(),
      ])

      const matchesCurrency = (c: string) => !currency || c.toLowerCase() === currency

      // Per-currency accumulator. Holds everything we need both for the
      // currency-scoped totals (sum over a single entry) and the All Currencies
      // breakdown (`byCurrency` array).
      const perCurrency = new Map<
        string,
        {
          netRevenue: number
          gmvProcessed: number
          refundsIssued: number
          paymentsCount: number
          succeededCount: number
          failedCount: number
        }
      >()
      const slot = (c: string) => {
        const k = c.toLowerCase()
        let s = perCurrency.get(k)
        if (!s) {
          s = {
            netRevenue: 0,
            gmvProcessed: 0,
            refundsIssued: 0,
            paymentsCount: 0,
            succeededCount: 0,
            failedCount: 0,
          }
          perCurrency.set(k, s)
        }
        return s
      }

      for (const fee of fees.data) {
        if (!matchesCurrency(fee.currency)) continue
        const s = slot(fee.currency)
        s.netRevenue += (fee.amount - fee.amount_refunded) / 100
        s.refundsIssued += fee.amount_refunded / 100
      }

      for (const intent of intents.data) {
        if (!matchesCurrency(intent.currency)) continue
        const s = slot(intent.currency)
        s.paymentsCount++
        if (intent.status === 'succeeded') {
          s.succeededCount++
          s.gmvProcessed += intent.amount / 100
        } else if (intent.status === 'canceled') {
          s.failedCount++
        } else if (intent.status === 'requires_payment_method' && intent.last_payment_error) {
          s.failedCount++
        }
      }

      // Currency-agnostic platform-wide success rate (counts sum cleanly).
      let totalSucceeded = 0
      let totalFailed = 0
      for (const s of perCurrency.values()) {
        totalSucceeded += s.succeededCount
        totalFailed += s.failedCount
      }
      const successDenom = totalSucceeded + totalFailed
      const paymentSuccessRate =
        successDenom > 0 ? Math.round((totalSucceeded / successDenom) * 100) : 0

      // Balance map for quick per-currency lookup.
      const availByCurrency = new Map<string, number>()
      for (const b of balance.available) availByCurrency.set(b.currency.toLowerCase(), b.amount)
      const pendByCurrency = new Map<string, number>()
      for (const b of balance.pending) pendByCurrency.set(b.currency.toLowerCase(), b.amount)

      if (currency) {
        // Single-currency mode: preserve the existing flat response shape.
        const s = perCurrency.get(currency) ?? {
          netRevenue: 0,
          gmvProcessed: 0,
          refundsIssued: 0,
          paymentsCount: 0,
          succeededCount: 0,
          failedCount: 0,
        }
        return {
          netRevenue: s.netRevenue,
          gmvProcessed: s.gmvProcessed,
          refundsIssued: s.refundsIssued,
          paymentSuccessRate,
          balanceAvailable: availByCurrency.get(currency) ?? 0,
          balancePending: pendByCurrency.get(currency) ?? 0,
          balanceLastUpdated: balance.lastUpdated,
          balanceError: balance.error,
        }
      }

      // All Currencies mode: zero out cross-currency amounts and surface the
      // per-currency breakdown. Counts/rates remain meaningful platform-wide.
      const allCurrencies = new Set<string>([
        ...perCurrency.keys(),
        ...availByCurrency.keys(),
        ...pendByCurrency.keys(),
      ])
      const byCurrency = Array.from(allCurrencies)
        .map(c => {
          const s = perCurrency.get(c)
          return {
            currency: c,
            netRevenue: s?.netRevenue ?? 0,
            gmvProcessed: s?.gmvProcessed ?? 0,
            refundsIssued: s?.refundsIssued ?? 0,
            paymentsCount: s?.paymentsCount ?? 0,
            succeededCount: s?.succeededCount ?? 0,
            balanceAvailable: availByCurrency.get(c) ?? 0,
            balancePending: pendByCurrency.get(c) ?? 0,
          }
        })
        .sort((a, b) => b.gmvProcessed - a.gmvProcessed || a.currency.localeCompare(b.currency))

      return {
        netRevenue: 0,
        gmvProcessed: 0,
        refundsIssued: 0,
        paymentSuccessRate,
        balanceAvailable: 0,
        balancePending: 0,
        balanceLastUpdated: balance.lastUpdated,
        balanceError: balance.error,
        paymentsCount: totalSucceeded + totalFailed,
        succeededCount: totalSucceeded,
        byCurrency,
      }
    })
  }

  // -------------------------------------------------------------------------
  // Balance (passthrough)
  // -------------------------------------------------------------------------

  async getBalance() {
    return this.stripe.getBalance()
  }

  async getBalanceTransactions(limit?: number) {
    return this.stripe.getBalanceTransactions(limit)
  }

  // -------------------------------------------------------------------------
  // Revenue composition (application fees + refunds + reimbursements over time)
  // -------------------------------------------------------------------------

  async getRevenueComposition(query: FinancialRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'revenue-composition', {
      v: 4,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
      bucket: range.bucket,
    })

    return this.cache.withCache(cacheKey, TTL.revenueComposition, async () => {
      const [fees, reimbRows] = await Promise.all([
        this.stripe.listApplicationFees(range),
        // Reimbursements stay DB-backed (platform-only concept).
        this.prisma.reimbursement.findMany({
          where: {
            createdAt: { gte: range.from, lte: range.to },
            status: { in: [ReimbursementStatus.settled, ReimbursementStatus.invoiced] },
            ...(currency ? { currency } : {}),
          },
          select: { createdAt: true, amountOwed: true, currency: true },
        }),
      ])

      type Slot = { fees: number; refunds: number; reimbursements: number }
      const slotFor = (m: Map<string, Slot>, key: string) => {
        let s = m.get(key)
        if (!s) {
          s = { fees: 0, refunds: 0, reimbursements: 0 }
          m.set(key, s)
        }
        return s
      }

      // For single-currency mode, accumulate into one Map keyed by bucket date.
      // For All Currencies mode, accumulate into a Map keyed by `${currency}|${date}`
      // and pivot at the end. Doing both via a per-currency map keeps the code
      // unified and lets us still emit the legacy top-level `buckets[]` shape.
      const byCurrencyBucket = new Map<string, Map<string, Slot>>()
      const slotForCurrency = (c: string, key: string) => {
        let m = byCurrencyBucket.get(c)
        if (!m) {
          m = new Map()
          byCurrencyBucket.set(c, m)
        }
        return slotFor(m, key)
      }

      for (const fee of fees.data) {
        if (currency && fee.currency.toLowerCase() !== currency) continue
        const c = fee.currency.toLowerCase()
        const key = bucketKey(new Date(fee.created * 1000), range.bucket)
        const s = slotForCurrency(c, key)
        s.fees += (fee.amount - fee.amount_refunded) / 100
        s.refunds += fee.amount_refunded / 100
      }
      for (const row of reimbRows) {
        const c = row.currency.toLowerCase()
        const key = bucketKey(row.createdAt, range.bucket)
        const s = slotForCurrency(c, key)
        s.reimbursements += Number(row.amountOwed)
      }

      // Legacy top-level buckets[] = sum across whatever currencies were
      // requested. In single-currency mode this is the one currency; in All
      // Currencies mode it's left empty and the frontend reads `byCurrency`.
      const topBuckets: {
        date: string
        applicationFees: number
        refunds: number
        reimbursements: number
      }[] = []
      if (currency) {
        const m = byCurrencyBucket.get(currency) ?? new Map<string, Slot>()
        const keys = Array.from(m.keys()).sort()
        for (const key of keys) {
          const s = m.get(key)!
          topBuckets.push({
            date: key,
            applicationFees: s.fees,
            refunds: s.refunds,
            reimbursements: s.reimbursements,
          })
        }
        return { bucket: range.bucket, buckets: topBuckets }
      }

      // All Currencies: pivot per-currency bucket maps into the shape the
      // frontend chart can consume.
      const byCurrencyOut: Record<
        string,
        {
          buckets: {
            date: string
            applicationFees: number
            refunds: number
            reimbursements: number
          }[]
        }
      > = {}
      for (const [c, m] of byCurrencyBucket) {
        const keys = Array.from(m.keys()).sort()
        byCurrencyOut[c] = {
          buckets: keys.map(key => {
            const s = m.get(key)!
            return {
              date: key,
              applicationFees: s.fees,
              refunds: s.refunds,
              reimbursements: s.reimbursements,
            }
          }),
        }
      }

      return { bucket: range.bucket, buckets: [], byCurrency: byCurrencyOut }
    })
  }

  // -------------------------------------------------------------------------
  // Payment status distribution (donut) — cross-account PaymentIntent statuses
  // -------------------------------------------------------------------------

  async getPaymentStatus(query: FinancialRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'payment-status', {
      v: 4,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.paymentStatus, async () => {
      const intents = await this.stripe.listPaymentIntentsAcrossAccounts(range)

      // Counts are currency-agnostic and sum cleanly platform-wide. Amounts are
      // not — so we track amount per (status, currency) and surface it in
      // `amountByCurrency` for All Currencies callers.
      const slices = new Map<string, { count: number; amount: number }>()
      const amountByCurrency = new Map<string, Map<string, number>>()

      for (const intent of intents.data) {
        if (currency && intent.currency.toLowerCase() !== currency) continue
        const slot = slices.get(intent.status) ?? { count: 0, amount: 0 }
        slot.count++
        slot.amount += intent.amount / 100
        slices.set(intent.status, slot)

        const c = intent.currency.toLowerCase()
        let perStatus = amountByCurrency.get(c)
        if (!perStatus) {
          perStatus = new Map()
          amountByCurrency.set(c, perStatus)
        }
        perStatus.set(intent.status, (perStatus.get(intent.status) ?? 0) + intent.amount / 100)
      }

      const slicesOut = Array.from(slices.entries()).map(([status, info]) => ({
        status,
        // In All Currencies mode, the platform-wide amount is meaningless
        // (mixed currencies). Zero it out — donut/legend will show counts only.
        count: info.count,
        amount: currency ? info.amount : 0,
      }))

      if (currency) {
        return { slices: slicesOut }
      }

      const amountByCurrencyOut: Record<string, { status: string; amount: number }[]> = {}
      for (const [c, perStatus] of amountByCurrency) {
        amountByCurrencyOut[c] = Array.from(perStatus.entries()).map(([status, amount]) => ({
          status,
          amount,
        }))
      }
      return { slices: slicesOut, amountByCurrency: amountByCurrencyOut }
    })
  }

  // -------------------------------------------------------------------------
  // Upcoming payouts — DB-backed (our scheduling logic, not in Stripe)
  // -------------------------------------------------------------------------

  async getUpcomingPayouts(query: FinancialRangeDto & { daysAhead?: number }) {
    const daysAhead = Math.max(1, Math.min(60, query.daysAhead ?? 7))
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'upcoming-payouts', {
      v: 2,
      daysAhead,
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.upcomingPayouts, async () => {
      const now = new Date()
      const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

      const tranches = await this.prisma.bookingPayoutSchedule.findMany({
        where: {
          status: 'pending' as any,
          releaseAt: { gte: now, lte: horizon },
          ...(currency ? { currency } : {}),
        },
        select: {
          id: true,
          plannedAmount: true,
          currency: true,
          releaseAt: true,
          reason: true,
          bookingGroup: {
            select: {
              id: true,
              provider: { select: { id: true, legalCompanyName: true } },
            },
          },
        },
        orderBy: { releaseAt: 'asc' },
        take: 25,
      })

      const totalsMap = new Map<string, number>()
      for (const t of tranches) {
        const c = t.currency.toLowerCase()
        totalsMap.set(c, (totalsMap.get(c) ?? 0) + Number(t.plannedAmount))
      }
      const totalsByCurrency = Array.from(totalsMap.entries())
        .map(([c, amount]) => ({ currency: c, amount }))
        .sort((a, b) => b.amount - a.amount)

      // Legacy totalAmount: only meaningful in single-currency mode. Set to 0
      // in All Currencies to avoid cross-currency garbage; frontend reads
      // `totalsByCurrency` instead.
      const totalAmount = currency ? tranches.reduce((s, t) => s + Number(t.plannedAmount), 0) : 0

      return {
        totalAmount,
        count: tranches.length,
        totalsByCurrency,
        tranches: tranches.map(t => ({
          id: t.id,
          amount: Number(t.plannedAmount),
          currency: t.currency.toLowerCase(),
          releaseAt: t.releaseAt.toISOString(),
          reason: t.reason,
          bookingGroupId: t.bookingGroup.id,
          providerId: t.bookingGroup.provider.id,
          providerName: t.bookingGroup.provider.legalCompanyName ?? 'Unknown provider',
        })),
      }
    })
  }

  // -------------------------------------------------------------------------
  // Disputes summary — cross-account dispute list from Stripe
  // -------------------------------------------------------------------------

  async getDisputesSummary(query: FinancialRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'disputes-summary', {
      v: 4,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.disputesSummary, async () => {
      const [disputes, intents] = await Promise.all([
        this.stripe.listDisputesAcrossAccounts(range),
        this.stripe.listPaymentIntentsAcrossAccounts(range),
      ])

      const filtered = disputes.data.filter(d => !currency || d.currency.toLowerCase() === currency)

      const byOutcome: Record<string, { count: number; amount: number }> = {}
      const byCurrencyMap = new Map<string, { count: number; amount: number; succeeded: number }>()

      const succeededByCurrency = new Map<string, number>()
      for (const i of intents.data) {
        if (i.status !== 'succeeded') continue
        if (currency && i.currency.toLowerCase() !== currency) continue
        const c = i.currency.toLowerCase()
        succeededByCurrency.set(c, (succeededByCurrency.get(c) ?? 0) + 1)
      }

      for (const d of filtered) {
        const outcome = mapDisputeOutcome(d.status)
        const slot = byOutcome[outcome] ?? { count: 0, amount: 0 }
        slot.count++
        slot.amount += d.amount / 100
        byOutcome[outcome] = slot

        const c = d.currency.toLowerCase()
        let bc = byCurrencyMap.get(c)
        if (!bc) {
          bc = { count: 0, amount: 0, succeeded: succeededByCurrency.get(c) ?? 0 }
          byCurrencyMap.set(c, bc)
        }
        bc.count++
        bc.amount += d.amount / 100
      }

      const totalDisputes = filtered.length
      // Top-level totalAmount only meaningful in single-currency mode.
      const totalAmount = currency ? filtered.reduce((s, d) => s + d.amount / 100, 0) : 0

      const succeededIntents = intents.data.filter(
        i => i.status === 'succeeded' && (!currency || i.currency.toLowerCase() === currency)
      ).length
      const openDisputeRate =
        succeededIntents > 0 ? Math.round((totalDisputes / succeededIntents) * 10000) / 100 : 0

      // Urgent: needs_response AND evidence due within 72h
      const now = Date.now() / 1000
      const horizon = now + 72 * 60 * 60
      const urgent = filtered
        .filter(d => {
          if (d.status !== 'needs_response') return false
          const dueBy = d.evidence_details?.due_by ?? 0
          return dueBy > 0 && dueBy <= horizon
        })
        .slice(0, 10)
        .map(d => ({
          id: d.id,
          amount: d.amount / 100,
          currency: d.currency.toLowerCase(),
          evidenceDueBy: d.evidence_details?.due_by
            ? new Date(d.evidence_details.due_by * 1000).toISOString()
            : null,
          providerName: d._account,
          bookingGroupId: typeof d.payment_intent === 'string' ? d.payment_intent : '',
        }))

      if (currency) {
        return {
          totalDisputes,
          totalAmount,
          byOutcome,
          openDisputeRate,
          urgent,
        }
      }

      const byCurrency = Array.from(byCurrencyMap.entries())
        .map(([c, info]) => ({
          currency: c,
          count: info.count,
          amount: info.amount,
          openRate:
            info.succeeded > 0 ? Math.round((info.count / info.succeeded) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)

      return {
        totalDisputes,
        totalAmount,
        byOutcome,
        openDisputeRate,
        urgent,
        byCurrency,
      }
    })
  }

  // -------------------------------------------------------------------------
  // Refunds summary (by reason) — cross-account refund list from Stripe
  // -------------------------------------------------------------------------

  async getRefundsSummary(query: FinancialRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'refunds-summary', {
      v: 4,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.refundsSummary, async () => {
      const refunds = await this.stripe.listRefundsAcrossAccounts(range)
      const filtered = refunds.data.filter(r => !currency || r.currency.toLowerCase() === currency)

      const byReasonRaw = new Map<string, { count: number; amount: number }>()
      const byCurrencyMap = new Map<string, { count: number; amount: number }>()
      for (const r of filtered) {
        const reason = r.reason ?? 'other'
        const slot = byReasonRaw.get(reason) ?? { count: 0, amount: 0 }
        slot.count++
        slot.amount += r.amount / 100
        byReasonRaw.set(reason, slot)

        const c = r.currency.toLowerCase()
        const bc = byCurrencyMap.get(c) ?? { count: 0, amount: 0 }
        bc.count++
        bc.amount += r.amount / 100
        byCurrencyMap.set(c, bc)
      }

      const totalAmountSingle = Array.from(byReasonRaw.values()).reduce((s, v) => s + v.amount, 0)
      const totalCount = Array.from(byReasonRaw.values()).reduce((s, v) => s + v.count, 0)

      // `pct` is reason-share-of-total — meaningful in single-currency mode
      // only. In All Currencies mode it's count-share instead so the bars stay
      // informative even though amounts can't be summed.
      const byReason: Record<string, { count: number; amount: number; pct: number }> = {}
      if (currency) {
        for (const [reason, info] of byReasonRaw) {
          byReason[reason] = {
            count: info.count,
            amount: info.amount,
            pct: totalAmountSingle > 0 ? Math.round((info.amount / totalAmountSingle) * 100) : 0,
          }
        }
        return { totalCount, totalAmount: totalAmountSingle, byReason }
      }

      for (const [reason, info] of byReasonRaw) {
        byReason[reason] = {
          count: info.count,
          amount: 0,
          pct: totalCount > 0 ? Math.round((info.count / totalCount) * 100) : 0,
        }
      }

      const byCurrency = Array.from(byCurrencyMap.entries())
        .map(([c, info]) => ({ currency: c, count: info.count, amount: info.amount }))
        .sort((a, b) => b.count - a.count)

      return { totalCount, totalAmount: 0, byReason, byCurrency }
    })
  }

  // -------------------------------------------------------------------------
  // Reimbursements aging — DB-only (platform concept, not in Stripe)
  // -------------------------------------------------------------------------

  async getReimbursementsAging(query: FinancialRangeDto) {
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('financial', 'reimbursements-aging', { v: 2, currency })

    return this.cache.withCache(cacheKey, TTL.reimbursementsAging, async () => {
      const where = {
        status: { in: [ReimbursementStatus.pending, ReimbursementStatus.invoiced] },
        ...(currency ? { currency } : {}),
      }

      const rows = await this.prisma.reimbursement.findMany({
        where,
        select: {
          amountOwed: true,
          status: true,
          dueDate: true,
          createdAt: true,
          currency: true,
        },
      })

      const now = new Date()
      const buckets = {
        current: { label: '0–7 days', count: 0, amount: 0 },
        weekOverdue: { label: '8–30 days overdue', count: 0, amount: 0 },
        monthOverdue: { label: '30+ days overdue', count: 0, amount: 0 },
      }
      const byStatus = {
        pending: { count: 0, amount: 0 },
        invoiced: { count: 0, amount: 0 },
      }
      let pendingTotalSingle = 0
      const pendingByCurrency = new Map<string, number>()

      for (const row of rows) {
        const amount = Number(row.amountOwed)
        const c = row.currency.toLowerCase()
        pendingTotalSingle += amount
        pendingByCurrency.set(c, (pendingByCurrency.get(c) ?? 0) + amount)

        if (row.status === ReimbursementStatus.pending) {
          byStatus.pending.count++
          if (currency) byStatus.pending.amount += amount
        } else if (row.status === ReimbursementStatus.invoiced) {
          byStatus.invoiced.count++
          if (currency) byStatus.invoiced.amount += amount
        }

        const overdueMs = now.getTime() - row.dueDate.getTime()
        const overdueDays = Math.floor(overdueMs / (24 * 60 * 60 * 1000))
        if (overdueDays <= 0) {
          buckets.current.count++
          if (currency) buckets.current.amount += amount
        } else if (overdueDays <= 30) {
          buckets.weekOverdue.count++
          if (currency) buckets.weekOverdue.amount += amount
        } else {
          buckets.monthOverdue.count++
          if (currency) buckets.monthOverdue.amount += amount
        }
      }

      if (currency) {
        return { pendingTotal: pendingTotalSingle, byBucket: buckets, byStatus }
      }

      const pendingTotalsByCurrency = Array.from(pendingByCurrency.entries())
        .map(([c, amount]) => ({ currency: c, amount }))
        .sort((a, b) => b.amount - a.amount)

      return {
        pendingTotal: 0,
        byBucket: buckets,
        byStatus,
        pendingTotalsByCurrency,
      }
    })
  }

  // -------------------------------------------------------------------------
  // Connected accounts health — Stripe live status + GMV ranking
  // -------------------------------------------------------------------------

  async getConnectedAccountsHealth(query: FinancialRangeDto & { limit?: number }) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const limit = Math.max(1, Math.min(50, query.limit ?? 20))
    const cacheKey = this.cache.buildKey('financial', 'connected-accounts', {
      v: 5,
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
      limit,
    })

    return this.cache.withCache(cacheKey, TTL.connectedAccounts, async () => {
      const charges = await this.stripe.listChargesAcrossAccounts(range)

      // Aggregate GMV per (account, currency). A connected account that takes
      // payments in multiple currencies needs separate rows so the table
      // remains honest about which currency the GMV is in.
      type Key = string // `${acctId}|${currency}`
      const gmvByKey = new Map<Key, { acctId: string; currency: string; gmv: number }>()
      for (const charge of charges.data) {
        if (currency && charge.currency.toLowerCase() !== currency) continue
        if (charge.status !== 'succeeded') continue
        const c = charge.currency.toLowerCase()
        const key = `${charge._account}|${c}`
        const slot = gmvByKey.get(key) ?? { acctId: charge._account, currency: c, gmv: 0 }
        slot.gmv += charge.amount / 100
        gmvByKey.set(key, slot)
      }

      const top = Array.from(gmvByKey.values())
        .sort((a, b) => b.gmv - a.gmv)
        .slice(0, limit)

      if (top.length === 0) return { providers: [] }

      const uniqueAcctIds = Array.from(new Set(top.map(t => t.acctId)))

      // Fetch live status + provider display names in parallel.
      const [stripeAccounts, dbProviders] = await Promise.all([
        Promise.all(uniqueAcctIds.map(acctId => this.stripe.retrieveAccount(acctId))),
        this.prisma.provider.findMany({
          where: { stripeAccountId: { in: uniqueAcctIds } },
          select: {
            id: true,
            stripeAccountId: true,
            legalCompanyName: true,
            logoUrl: true,
          },
        }),
      ])

      type DbProvider = (typeof dbProviders)[number]
      const providerByAcctId = new Map<string, DbProvider>()
      for (const p of dbProviders) {
        if (p.stripeAccountId) providerByAcctId.set(p.stripeAccountId, p)
      }
      const liveByAcctId = new Map<string, (typeof stripeAccounts)[number]>()
      uniqueAcctIds.forEach((acctId, i) => liveByAcctId.set(acctId, stripeAccounts[i]))

      return {
        providers: top.map(row => {
          const liveAcct = liveByAcctId.get(row.acctId)
          const dbProvider = providerByAcctId.get(row.acctId)
          const requirements = liveAcct?.requirements
          const attentionRequired =
            !!requirements &&
            (requirements.currently_due?.length ||
              requirements.past_due?.length ||
              requirements.disabled_reason)

          // Most providers have `legalCompanyName` set. For accounts where it's
          // null (older onboarding flows, accounts created directly in Stripe,
          // test data) fall back through the names Stripe exposes on the live
          // account before resorting to the raw account ID.
          const name =
            dbProvider?.legalCompanyName ||
            liveAcct?.business_profile?.name ||
            liveAcct?.settings?.dashboard?.display_name ||
            liveAcct?.email ||
            `Connected account ${row.acctId}`

          return {
            id: dbProvider?.id ?? row.acctId,
            name,
            logoUrl: dbProvider?.logoUrl ?? null,
            currency: row.currency,
            gmv: row.gmv,
            chargesEnabled: liveAcct?.charges_enabled ?? false,
            payoutsEnabled: liveAcct?.payouts_enabled ?? false,
            attentionRequired: !!attentionRequired,
            lastPayoutDate: null,
            payoutSuccessRate: null,
          }
        }),
      }
    })
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function bucketKey(d: Date, bucket: 'day' | 'week' | 'month'): string {
  const date = new Date(d)
  if (bucket === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString()
  }
  if (bucket === 'week') {
    // ISO week start (Monday) — truncate to date then back off to Monday in UTC.
    const day = date.getUTCDay()
    const offset = (day + 6) % 7 // Mon=0, Sun=6
    const monday = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset)
    )
    return monday.toISOString()
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  ).toISOString()
}

/**
 * Map Stripe's free-form dispute `status` to our 5-bucket enum used by the
 * frontend `STATUS_COLOR_MAP` (`open`, `won`, `lost`, `warning_closed`, `other`).
 */
function mapDisputeOutcome(status: string): string {
  switch (status) {
    case 'needs_response':
    case 'warning_needs_response':
    case 'under_review':
    case 'warning_under_review':
      return 'open'
    case 'won':
      return 'won'
    case 'lost':
      return 'lost'
    case 'warning_closed':
      return 'warning_closed'
    default:
      return 'other'
  }
}
