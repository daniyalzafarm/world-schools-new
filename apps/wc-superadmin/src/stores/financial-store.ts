import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { financialService } from '../services/financial.services'
import type { DashboardRange } from '../types/analytics'
import type {
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

type WidgetKey =
  | 'overview'
  | 'balance'
  | 'revenueComposition'
  | 'paymentStatus'
  | 'upcomingPayouts'
  | 'disputes'
  | 'refunds'
  | 'reimbursements'
  | 'connectedAccounts'
  | 'currencies'

interface FinancialState {
  range: DashboardRange
  currency: string | undefined
  currencies: string[]
  overview: FinancialOverview | null
  balance: StripeBalance | null
  revenueComposition: RevenueComposition | null
  paymentStatus: PaymentStatusDistribution | null
  upcomingPayouts: UpcomingPayouts | null
  disputes: DisputesSummary | null
  refunds: RefundsSummary | null
  reimbursements: ReimbursementsAging | null
  connectedAccounts: ConnectedAccounts | null
  loading: Record<WidgetKey, boolean>
  errors: Record<WidgetKey, string | null>
}

interface FinancialStore extends FinancialState {
  setRange: (range: DashboardRange) => void
  setCurrency: (currency: string | undefined) => void
  fetchCurrencies: () => Promise<void>
  fetchAll: () => Promise<void>
  fetchWidget: (key: WidgetKey) => Promise<void>
}

// Per-widget request-id counter — kept outside reactive state so updates
// don't trigger re-renders. Each fetchWidget invocation increments its key's
// counter and only commits its response if the counter hasn't moved on.
// Guards against stale responses overwriting fresher state when params change
// mid-flight (e.g. user toggling range/currency rapidly).
const requestIds: Record<WidgetKey, number> = {
  overview: 0,
  balance: 0,
  revenueComposition: 0,
  paymentStatus: 0,
  upcomingPayouts: 0,
  disputes: 0,
  refunds: 0,
  reimbursements: 0,
  connectedAccounts: 0,
  currencies: 0,
}

const initialState: FinancialState = {
  range: { preset: '30d' },
  currency: undefined,
  currencies: [],
  overview: null,
  balance: null,
  revenueComposition: null,
  paymentStatus: null,
  upcomingPayouts: null,
  disputes: null,
  refunds: null,
  reimbursements: null,
  connectedAccounts: null,
  loading: {
    overview: false,
    balance: false,
    revenueComposition: false,
    paymentStatus: false,
    upcomingPayouts: false,
    disputes: false,
    refunds: false,
    reimbursements: false,
    connectedAccounts: false,
    currencies: false,
  },
  errors: {
    overview: null,
    balance: null,
    revenueComposition: null,
    paymentStatus: null,
    upcomingPayouts: null,
    disputes: null,
    refunds: null,
    reimbursements: null,
    connectedAccounts: null,
    currencies: null,
  },
}

export const useFinancialStore = create<FinancialStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      setRange: (range: DashboardRange) => {
        set(draft => {
          draft.range = range
        })
      },

      setCurrency: (currency: string | undefined) => {
        set(draft => {
          draft.currency = currency
        })
      },

      fetchCurrencies: async () => {
        set(draft => {
          draft.loading.currencies = true
          draft.errors.currencies = null
        })
        try {
          const res = await financialService.getCurrencies()
          set(draft => {
            draft.currencies = res.currencies
            draft.loading.currencies = false
            // No auto-default: leaving `currency` undefined means "All Currencies",
            // which is the intended landing state for the superadmin.
          })
        } catch (err: any) {
          set(draft => {
            draft.loading.currencies = false
            draft.errors.currencies = err.message ?? 'Failed to load currencies'
          })
        }
      },

      fetchAll: async () => {
        await Promise.allSettled([
          get().fetchWidget('overview'),
          get().fetchWidget('balance'),
          get().fetchWidget('revenueComposition'),
          get().fetchWidget('paymentStatus'),
          get().fetchWidget('upcomingPayouts'),
          get().fetchWidget('disputes'),
          get().fetchWidget('refunds'),
          get().fetchWidget('reimbursements'),
          get().fetchWidget('connectedAccounts'),
        ])
      },

      fetchWidget: async (key: WidgetKey) => {
        const myId = ++requestIds[key]
        const { range, currency } = get()
        set(draft => {
          draft.loading[key] = true
          draft.errors[key] = null
        })
        const isStale = () => myId !== requestIds[key]
        try {
          switch (key) {
            case 'overview': {
              const res = await financialService.getOverview(range, currency)
              if (isStale()) return
              set(draft => {
                draft.overview = res
                draft.loading.overview = false
              })
              break
            }
            case 'balance': {
              const res = await financialService.getBalance()
              if (isStale()) return
              set(draft => {
                draft.balance = res
                draft.loading.balance = false
              })
              break
            }
            case 'revenueComposition': {
              const res = await financialService.getRevenueComposition(range, currency)
              if (isStale()) return
              set(draft => {
                draft.revenueComposition = res
                draft.loading.revenueComposition = false
              })
              break
            }
            case 'paymentStatus': {
              const res = await financialService.getPaymentStatus(range, currency)
              if (isStale()) return
              set(draft => {
                draft.paymentStatus = res
                draft.loading.paymentStatus = false
              })
              break
            }
            case 'upcomingPayouts': {
              const res = await financialService.getUpcomingPayouts(range, currency)
              if (isStale()) return
              set(draft => {
                draft.upcomingPayouts = res
                draft.loading.upcomingPayouts = false
              })
              break
            }
            case 'disputes': {
              const res = await financialService.getDisputesSummary(range, currency)
              if (isStale()) return
              set(draft => {
                draft.disputes = res
                draft.loading.disputes = false
              })
              break
            }
            case 'refunds': {
              const res = await financialService.getRefundsSummary(range, currency)
              if (isStale()) return
              set(draft => {
                draft.refunds = res
                draft.loading.refunds = false
              })
              break
            }
            case 'reimbursements': {
              const res = await financialService.getReimbursementsAging(range, currency)
              if (isStale()) return
              set(draft => {
                draft.reimbursements = res
                draft.loading.reimbursements = false
              })
              break
            }
            case 'connectedAccounts': {
              const res = await financialService.getConnectedAccounts(range, currency)
              if (isStale()) return
              set(draft => {
                draft.connectedAccounts = res
                draft.loading.connectedAccounts = false
              })
              break
            }
            default:
              set(draft => {
                draft.loading[key] = false
              })
          }
        } catch (err: any) {
          if (isStale()) return
          set(draft => {
            draft.loading[key] = false
            draft.errors[key] = err.message ?? 'Failed to load widget'
          })
        }
      },
    })),
    { name: 'FinancialStore' }
  )
)
