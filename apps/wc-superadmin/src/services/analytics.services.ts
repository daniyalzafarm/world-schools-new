import apiClient from '../utils/api-client'
import type {
  AnalyticsOverview,
  BookingStatusDistribution,
  CampsHealth,
  ConversionFunnel,
  CurrenciesResponse,
  DashboardRange,
  GeographicDistribution,
  RevenueTimeseries,
  TopProvider,
} from '../types/analytics'

const BASE = '/superadmin/analytics'

function rangeParams(
  range: DashboardRange,
  extra: Record<string, string | number | undefined> = {}
) {
  const params = new URLSearchParams()
  if (range.preset) params.set('range', range.preset)
  if (range.preset === 'custom') {
    if (range.from) params.set('from', range.from)
    if (range.to) params.set('to', range.to)
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  return params.toString()
}

async function unwrap<T>(url: string): Promise<T> {
  const res = await apiClient.get<T>(url)
  if (!res.success) {
    throw new Error((res.data as any)?.message ?? 'Request failed')
  }
  return res.data as T
}

export const analyticsService = {
  getCurrencies: () => unwrap<CurrenciesResponse>(`${BASE}/currencies`),
  getOverview: (range: DashboardRange, currency?: string) =>
    unwrap<AnalyticsOverview>(`${BASE}/overview?${rangeParams(range, { currency })}`),
  getRevenueTimeseries: (range: DashboardRange, currency?: string) =>
    unwrap<RevenueTimeseries>(`${BASE}/timeseries/revenue?${rangeParams(range, { currency })}`),
  getBookingStatusDistribution: (range: DashboardRange, currency?: string) =>
    unwrap<BookingStatusDistribution>(
      `${BASE}/booking-status-distribution?${rangeParams(range, { currency })}`
    ),
  getTopProviders: (range: DashboardRange, currency?: string, limit = 10) =>
    unwrap<{ providers: TopProvider[] }>(
      `${BASE}/top-providers?${rangeParams(range, { currency, limit })}`
    ),
  getGeographicDistribution: (
    range: DashboardRange,
    currency?: string,
    metric: 'gmv' | 'bookings' | 'parents' = 'gmv'
  ) =>
    unwrap<GeographicDistribution>(
      `${BASE}/geographic?${rangeParams(range, { currency, metric })}`
    ),
  getFunnel: (range: DashboardRange, currency?: string) =>
    unwrap<ConversionFunnel>(`${BASE}/funnel?${rangeParams(range, { currency })}`),
  getCampsHealth: (range: DashboardRange, currency?: string) =>
    unwrap<CampsHealth>(`${BASE}/camps-health?${rangeParams(range, { currency })}`),
}
