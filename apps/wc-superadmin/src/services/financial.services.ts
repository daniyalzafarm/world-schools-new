import apiClient from '../utils/api-client'
import type { CurrenciesResponse, DashboardRange } from '../types/analytics'
import type {
  BalanceTransactions,
  ConnectedAccounts,
  DisputesSummary,
  FinancialOverview,
  PaymentStatusDistribution,
  RefundsSummary,
  ReimbursementsAging,
  RevenueComposition,
  StripeBalance,
  UpcomingPayouts,
} from '../types/financial'

const BASE = '/superadmin/financial'

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

export const financialService = {
  getCurrencies: () => unwrap<CurrenciesResponse>(`${BASE}/currencies`),
  getOverview: (range: DashboardRange, currency?: string) =>
    unwrap<FinancialOverview>(`${BASE}/overview?${rangeParams(range, { currency })}`),
  getBalance: () => unwrap<StripeBalance>(`${BASE}/balance`),
  getBalanceTransactions: (limit = 50) =>
    unwrap<BalanceTransactions>(`${BASE}/balance-transactions?limit=${limit}`),
  getRevenueComposition: (range: DashboardRange, currency?: string) =>
    unwrap<RevenueComposition>(`${BASE}/revenue-composition?${rangeParams(range, { currency })}`),
  getPaymentStatus: (range: DashboardRange, currency?: string) =>
    unwrap<PaymentStatusDistribution>(`${BASE}/payment-status?${rangeParams(range, { currency })}`),
  getUpcomingPayouts: (range: DashboardRange, currency?: string, daysAhead = 7) =>
    unwrap<UpcomingPayouts>(
      `${BASE}/upcoming-payouts?${rangeParams(range, { currency, daysAhead })}`
    ),
  getDisputesSummary: (range: DashboardRange, currency?: string) =>
    unwrap<DisputesSummary>(`${BASE}/disputes-summary?${rangeParams(range, { currency })}`),
  getRefundsSummary: (range: DashboardRange, currency?: string) =>
    unwrap<RefundsSummary>(`${BASE}/refunds-summary?${rangeParams(range, { currency })}`),
  getReimbursementsAging: (range: DashboardRange, currency?: string) =>
    unwrap<ReimbursementsAging>(`${BASE}/reimbursements-aging?${rangeParams(range, { currency })}`),
  getConnectedAccounts: (range: DashboardRange, currency?: string, limit = 20) =>
    unwrap<ConnectedAccounts>(
      `${BASE}/connected-accounts?${rangeParams(range, { currency, limit })}`
    ),
}
