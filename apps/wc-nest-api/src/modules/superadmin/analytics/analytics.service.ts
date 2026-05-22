import { Injectable } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { BookingGroupStatus, CampStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { DashboardCacheService } from './dashboard-cache.util'
import type { AnalyticsRangeDto } from './dto/analytics-range.dto'
import { type ResolvedRange, resolveRange } from './range.util'

const INACTIVE_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.draft,
  BookingGroupStatus.declined,
  BookingGroupStatus.expired,
  BookingGroupStatus.cancelled,
]

const REVENUE_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.accepted,
  BookingGroupStatus.deposit_paid,
  BookingGroupStatus.fully_paid,
  BookingGroupStatus.at_camp,
  BookingGroupStatus.completed,
  BookingGroupStatus.partially_refunded,
]

const TTL = {
  overview: 60,
  timeseries: 300,
  distribution: 300,
  topProviders: 120,
  geographic: 300,
  funnel: 300,
  campsHealth: 120,
  currencies: 600,
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService
  ) {}

  // -------------------------------------------------------------------------
  // Currency discovery
  // -------------------------------------------------------------------------

  async getCurrencies() {
    return this.cache.withCache(
      this.cache.buildKey('analytics', 'currencies', {}),
      TTL.currencies,
      async () => {
        const rows = await this.prisma.providerSettings.findMany({
          select: { currency: true },
          distinct: ['currency'],
        })
        const currencies = rows
          .map(r => r.currency.toLowerCase())
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .sort()
        return { currencies }
      }
    )
  }

  // -------------------------------------------------------------------------
  // Overview KPIs (5 cards: GMV, Platform Revenue, Bookings, Active Parents, Conversion Rate)
  // -------------------------------------------------------------------------

  async getOverview(query: AnalyticsRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('analytics', 'overview', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.overview, async () => {
      const [current, previous, currentSparkline] = await Promise.all([
        this.computeOverviewWindow(range.from, range.to, currency),
        this.computeOverviewWindow(range.previousFrom, range.previousTo, currency),
        this.computeSparklineSeries(range, currency),
      ])

      const buildKpi = (
        currentValue: number,
        previousValue: number,
        seriesKey: keyof typeof currentSparkline
      ) => ({
        value: currentValue,
        previousValue,
        trendPct: computeTrendPct(currentValue, previousValue),
        sparkline: currentSparkline[seriesKey],
      })

      return {
        gmv: buildKpi(current.gmv, previous.gmv, 'gmv'),
        platformRevenue: buildKpi(
          current.platformRevenue,
          previous.platformRevenue,
          'platformRevenue'
        ),
        bookings: buildKpi(current.bookings, previous.bookings, 'bookings'),
        activeParents: buildKpi(current.activeParents, previous.activeParents, 'activeParents'),
        conversionRate: buildKpi(current.conversionRate, previous.conversionRate, 'conversionRate'),
      }
    })
  }

  private async computeOverviewWindow(from: Date, to: Date, currency?: string) {
    const providerFilter = buildProviderCurrencyFilter(currency)

    const [activeGroups, paymentSum, distinctParents, totalGroupsCreated] = await Promise.all([
      this.prisma.bookingGroup.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: { notIn: INACTIVE_STATUSES },
          ...providerFilter,
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: 'succeeded',
          ...(currency ? { currency } : {}),
        },
        _sum: { applicationFeeAmount: true },
      }),
      this.prisma.bookingGroup.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          status: { notIn: INACTIVE_STATUSES },
          ...providerFilter,
        },
        select: { parentId: true },
        distinct: ['parentId'],
      }),
      this.prisma.bookingGroup.count({
        where: {
          createdAt: { gte: from, lte: to },
          ...providerFilter,
        },
      }),
    ])

    const completedCount = await this.prisma.bookingGroup.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: [BookingGroupStatus.completed, BookingGroupStatus.at_camp] },
        ...providerFilter,
      },
    })

    return {
      gmv: Number(activeGroups._sum.totalAmount ?? 0),
      platformRevenue: Number(paymentSum._sum.applicationFeeAmount ?? 0),
      bookings: activeGroups._count,
      activeParents: distinctParents.length,
      conversionRate:
        totalGroupsCreated > 0 ? Math.round((completedCount / totalGroupsCreated) * 100) : 0,
    }
  }

  private async computeSparklineSeries(range: ResolvedRange, currency?: string) {
    // 12-point downsampled trend for each metric, regardless of range — drives the KPI card minicharts.
    const buckets = generateBuckets(range.from, range.to, 12)

    const series = await Promise.all(
      buckets.map(async ({ start, end }) => {
        const win = await this.computeOverviewWindow(start, end, currency)
        return win
      })
    )

    return {
      gmv: series.map(s => s.gmv),
      platformRevenue: series.map(s => s.platformRevenue),
      bookings: series.map(s => s.bookings),
      activeParents: series.map(s => s.activeParents),
      conversionRate: series.map(s => s.conversionRate),
    }
  }

  // -------------------------------------------------------------------------
  // Revenue time series (bucketed GMV + platform revenue)
  // -------------------------------------------------------------------------

  async getRevenueTimeseries(query: AnalyticsRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('analytics', 'timeseries-revenue', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
      bucket: range.bucket,
    })

    return this.cache.withCache(cacheKey, TTL.timeseries, async () => {
      const truncUnit = range.bucket
      const currencyClause = currency
        ? Prisma.sql`AND ps.currency = ${currency.toUpperCase()}`
        : Prisma.empty

      const gmvRows = await this.prisma.$queryRaw<{ bucket: Date; gmv: number }[]>`
        SELECT date_trunc(${truncUnit}, bg.created_at) as bucket,
               COALESCE(SUM(bg.total_amount), 0)::float8 as gmv
        FROM booking_groups bg
        JOIN providers p ON p.id = bg.provider_id
        LEFT JOIN provider_settings ps ON ps.provider_id = p.id
        WHERE bg.created_at >= ${range.from}
          AND bg.created_at <= ${range.to}
          AND bg.status NOT IN ('draft', 'declined', 'expired', 'cancelled')
          ${currencyClause}
        GROUP BY bucket
        ORDER BY bucket ASC
      `

      const platformRows = await this.prisma.$queryRaw<{ bucket: Date; revenue: number }[]>`
        SELECT date_trunc(${truncUnit}, created_at) as bucket,
               COALESCE(SUM(application_fee_amount), 0)::float8 as revenue
        FROM payments
        WHERE created_at >= ${range.from}
          AND created_at <= ${range.to}
          AND status = 'succeeded'
          ${currency ? Prisma.sql`AND currency = ${currency}` : Prisma.empty}
        GROUP BY bucket
        ORDER BY bucket ASC
      `

      const gmvMap = new Map(gmvRows.map(r => [r.bucket.toISOString(), Number(r.gmv)]))
      const platformMap = new Map(
        platformRows.map(r => [r.bucket.toISOString(), Number(r.revenue)])
      )
      const allKeys = Array.from(new Set([...gmvMap.keys(), ...platformMap.keys()])).sort()

      const buckets = allKeys.map(key => ({
        date: key,
        gmv: gmvMap.get(key) ?? 0,
        platformRevenue: platformMap.get(key) ?? 0,
      }))

      return { bucket: range.bucket, buckets }
    })
  }

  // -------------------------------------------------------------------------
  // Booking status distribution (donut)
  // -------------------------------------------------------------------------

  async getBookingStatusDistribution(query: AnalyticsRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('analytics', 'booking-status-distribution', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.distribution, async () => {
      const providerFilter = buildProviderCurrencyFilter(currency)

      const rows = await this.prisma.bookingGroup.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: range.from, lte: range.to },
          ...providerFilter,
        },
        _count: true,
        _sum: { totalAmount: true },
      })

      const slices = rows.map(r => ({
        status: r.status,
        count: r._count,
        amount: Number(r._sum.totalAmount ?? 0),
      }))
      const total = slices.reduce((s, x) => s + x.count, 0)

      return { total, slices }
    })
  }

  // -------------------------------------------------------------------------
  // Top performing providers (ranked list)
  // -------------------------------------------------------------------------

  async getTopProviders(query: AnalyticsRangeDto & { limit?: number }) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const limit = Math.max(1, Math.min(50, query.limit ?? 10))
    const cacheKey = this.cache.buildKey('analytics', 'top-providers', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
      limit,
    })

    return this.cache.withCache(cacheKey, TTL.topProviders, async () => {
      const providerFilter = buildProviderCurrencyFilter(currency)

      const grouped = await this.prisma.bookingGroup.groupBy({
        by: ['providerId'],
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: { notIn: INACTIVE_STATUSES },
          ...providerFilter,
        },
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: limit,
      })

      if (grouped.length === 0) return { providers: [] }

      const providers = await this.prisma.provider.findMany({
        where: { id: { in: grouped.map(g => g.providerId) } },
        select: {
          id: true,
          legalCompanyName: true,
          logoUrl: true,
          legalCity: true,
          legalCountry: true,
        },
      })
      const providerMap = new Map(providers.map(p => [p.id, p]))

      return {
        providers: grouped.map(g => {
          const p = providerMap.get(g.providerId)
          return {
            id: g.providerId,
            name: p?.legalCompanyName ?? 'Unknown provider',
            logoUrl: p?.logoUrl ?? null,
            city: p?.legalCity ?? null,
            country: p?.legalCountry ?? null,
            bookingCount: g._count,
            gmv: Number(g._sum.totalAmount ?? 0),
          }
        }),
      }
    })
  }

  // -------------------------------------------------------------------------
  // Geographic distribution (by provider country)
  // -------------------------------------------------------------------------

  async getGeographicDistribution(
    query: AnalyticsRangeDto & { metric?: 'gmv' | 'bookings' | 'parents' }
  ) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const metric = query.metric ?? 'gmv'
    const cacheKey = this.cache.buildKey('analytics', 'geographic', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
      metric,
    })

    return this.cache.withCache(cacheKey, TTL.geographic, async () => {
      const currencyClause = currency
        ? Prisma.sql`AND ps.currency = ${currency.toUpperCase()}`
        : Prisma.empty

      // Single GROUP BY of bookings → provider.legalCountry, with both GMV and
      // counts and distinct parents in one pass.
      const rows = await this.prisma.$queryRaw<
        { country: string; gmv: number; bookings: bigint; parents: bigint }[]
      >`
        SELECT
          COALESCE(p.legal_country, 'Unknown') as country,
          COALESCE(SUM(bg.total_amount), 0)::float8 as gmv,
          COUNT(*) as bookings,
          COUNT(DISTINCT bg.parent_id) as parents
        FROM booking_groups bg
        JOIN providers p ON p.id = bg.provider_id
        LEFT JOIN provider_settings ps ON ps.provider_id = p.id
        WHERE bg.created_at >= ${range.from}
          AND bg.created_at <= ${range.to}
          AND bg.status NOT IN ('draft', 'declined', 'expired', 'cancelled')
          ${currencyClause}
        GROUP BY country
        ORDER BY gmv DESC
        LIMIT 10
      `

      const valueOf = (r: (typeof rows)[number]) =>
        metric === 'gmv'
          ? Number(r.gmv)
          : metric === 'bookings'
            ? Number(r.bookings)
            : Number(r.parents)

      const total = rows.reduce((s, r) => s + valueOf(r), 0)
      return {
        metric,
        countries: rows.map(r => {
          const value = valueOf(r)
          return {
            code: r.country,
            name: r.country,
            value,
            percent: total > 0 ? Math.round((value / total) * 100) : 0,
          }
        }),
      }
    })
  }

  // -------------------------------------------------------------------------
  // Conversion funnel
  // -------------------------------------------------------------------------

  async getFunnel(query: AnalyticsRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('analytics', 'funnel', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.funnel, async () => {
      const providerFilter = buildProviderCurrencyFilter(currency)
      const baseWhere = { createdAt: { gte: range.from, lte: range.to }, ...providerFilter }

      const [created, requested, accepted, depositPaid, fullyPaid, completed] = await Promise.all([
        this.prisma.bookingGroup.count({ where: baseWhere }),
        this.prisma.bookingGroup.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                BookingGroupStatus.request,
                BookingGroupStatus.accepted,
                BookingGroupStatus.deposit_paid,
                BookingGroupStatus.fully_paid,
                BookingGroupStatus.at_camp,
                BookingGroupStatus.completed,
                BookingGroupStatus.partially_refunded,
                BookingGroupStatus.fully_refunded,
              ],
            },
          },
        }),
        this.prisma.bookingGroup.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                BookingGroupStatus.accepted,
                BookingGroupStatus.deposit_paid,
                BookingGroupStatus.fully_paid,
                BookingGroupStatus.at_camp,
                BookingGroupStatus.completed,
                BookingGroupStatus.partially_refunded,
                BookingGroupStatus.fully_refunded,
              ],
            },
          },
        }),
        this.prisma.bookingGroup.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                BookingGroupStatus.deposit_paid,
                BookingGroupStatus.fully_paid,
                BookingGroupStatus.at_camp,
                BookingGroupStatus.completed,
                BookingGroupStatus.partially_refunded,
              ],
            },
          },
        }),
        this.prisma.bookingGroup.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                BookingGroupStatus.fully_paid,
                BookingGroupStatus.at_camp,
                BookingGroupStatus.completed,
              ],
            },
          },
        }),
        this.prisma.bookingGroup.count({
          where: { ...baseWhere, status: BookingGroupStatus.completed },
        }),
      ])

      const counts = [created, requested, accepted, depositPaid, fullyPaid, completed]
      const labels = [
        'Bookings created',
        'Card authorized',
        'Provider accepted',
        'Deposit paid',
        'Fully paid',
        'Completed',
      ]

      const steps = counts.map((count, i) => {
        const prev = i === 0 ? counts[0] : counts[i - 1]
        const dropoff = i === 0 || prev === 0 ? 0 : Math.round(((prev - count) / prev) * 100)
        const conversion = counts[0] === 0 ? 0 : Math.round((count / counts[0]) * 100)
        return {
          key: ['created', 'requested', 'accepted', 'deposit_paid', 'fully_paid', 'completed'][i],
          label: labels[i],
          count,
          dropoffPctFromPrev: dropoff,
          conversionPctFromTop: conversion,
        }
      })

      return { steps }
    })
  }

  // -------------------------------------------------------------------------
  // Camp health (light extra widget for analytics)
  // -------------------------------------------------------------------------

  async getCampsHealth(query: AnalyticsRangeDto) {
    const range = resolveRange(query)
    const currency = query.currency?.toLowerCase()
    const cacheKey = this.cache.buildKey('analytics', 'camps-health', {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      currency,
    })

    return this.cache.withCache(cacheKey, TTL.campsHealth, async () => {
      const providerFilter = buildProviderCurrencyFilter(currency)
      const ninetyDaysOut = new Date(range.to.getTime() + 90 * 24 * 60 * 60 * 1000)

      const [activeCamps, upcomingSessions, topCampsRaw] = await Promise.all([
        this.prisma.camp.count({
          where: { status: CampStatus.published, ...providerFilter },
        }),
        this.prisma.session.count({
          where: {
            startDate: { gte: range.to, lte: ninetyDaysOut },
            ...(currency
              ? { camp: { provider: { settings: { currency: currency.toUpperCase() } } } }
              : {}),
          },
        }),
        this.prisma.bookingGroup.groupBy({
          by: ['campId'],
          where: {
            createdAt: { gte: range.from, lte: range.to },
            status: { notIn: INACTIVE_STATUSES },
            ...providerFilter,
          },
          _count: true,
          orderBy: { _count: { campId: 'desc' } },
          take: 5,
        }),
      ])

      const camps = await this.prisma.camp.findMany({
        where: { id: { in: topCampsRaw.map(c => c.campId) } },
        select: { id: true, name: true },
      })
      const campMap = new Map(camps.map(c => [c.id, c.name]))

      return {
        activeCamps,
        upcomingSessions,
        topCamps: topCampsRaw.map(c => ({
          id: c.campId,
          name: campMap.get(c.campId) ?? 'Unknown camp',
          bookings: c._count,
        })),
      }
    })
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function buildProviderCurrencyFilter(currency?: string) {
  if (!currency) return {}
  return {
    provider: { settings: { currency: currency.toUpperCase() } },
  }
}

function computeTrendPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

function generateBuckets(from: Date, to: Date, count: number): { start: Date; end: Date }[] {
  const totalMs = to.getTime() - from.getTime()
  const step = Math.max(1, Math.floor(totalMs / count))
  const buckets: { start: Date; end: Date }[] = []
  for (let i = 0; i < count; i++) {
    const start = new Date(from.getTime() + i * step)
    const end = i === count - 1 ? to : new Date(start.getTime() + step)
    buckets.push({ start, end })
  }
  return buckets
}
