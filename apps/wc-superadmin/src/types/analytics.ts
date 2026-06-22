export type DashboardRangePreset = '7d' | '30d' | '90d' | '1y' | 'custom'

export interface DashboardRange {
  preset: DashboardRangePreset
  from?: string
  to?: string
}

export interface KpiMetric {
  value: number
  previousValue: number
  trendPct: number
  sparkline: number[]
}

export interface AnalyticsOverview {
  gmv: KpiMetric
  platformRevenue: KpiMetric
  bookings: KpiMetric
  activeParents: KpiMetric
  activeProviders: KpiMetric
  conversionRate: KpiMetric
}

export interface RevenueTimeseries {
  bucket: 'day' | 'week' | 'month'
  buckets: { date: string; gmv: number; platformRevenue: number }[]
}

export interface BookingStatusDistribution {
  total: number
  slices: { status: string; count: number; amount: number }[]
}

export interface TopProvider {
  id: string
  name: string
  logoUrl: string | null
  city: string | null
  country: string | null
  bookingCount: number
  gmv: number
}

export interface GeographicCountry {
  code: string
  name: string
  value: number
  percent: number
}

export interface GeographicDistribution {
  metric: 'gmv' | 'bookings' | 'parents'
  countries: GeographicCountry[]
}

export interface FunnelLostReason {
  reason: string
  label: string
  count: number
}

export interface FunnelStep {
  key: string
  label: string
  count: number
  dropoffPctFromPrev: number
  conversionPctFromTop: number
  lostFromPrev: number
  lostBreakdown: FunnelLostReason[]
}

export interface ConversionFunnel {
  steps: FunnelStep[]
}

export interface CampsHealth {
  activeCamps: number
  upcomingSessions: number
  topCamps: { id: string; name: string; bookings: number }[]
}

export interface CurrenciesResponse {
  currencies: string[]
}
