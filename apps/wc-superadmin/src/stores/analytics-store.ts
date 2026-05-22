import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { analyticsService } from '../services/analytics.services'
import type {
  AnalyticsOverview,
  BookingStatusDistribution,
  CampsHealth,
  ConversionFunnel,
  DashboardRange,
  GeographicDistribution,
  RevenueTimeseries,
  TopProvider,
} from '../types/analytics'

type WidgetKey =
  | 'overview'
  | 'revenue'
  | 'bookingStatus'
  | 'topProviders'
  | 'geographic'
  | 'funnel'
  | 'campsHealth'
  | 'currencies'

interface AnalyticsState {
  range: DashboardRange
  currency: string | undefined
  currencies: string[]
  overview: AnalyticsOverview | null
  revenue: RevenueTimeseries | null
  bookingStatus: BookingStatusDistribution | null
  topProviders: TopProvider[] | null
  geographic: GeographicDistribution | null
  funnel: ConversionFunnel | null
  campsHealth: CampsHealth | null
  loading: Record<WidgetKey, boolean>
  errors: Record<WidgetKey, string | null>
}

interface AnalyticsStore extends AnalyticsState {
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
  revenue: 0,
  bookingStatus: 0,
  topProviders: 0,
  geographic: 0,
  funnel: 0,
  campsHealth: 0,
  currencies: 0,
}

const initialState: AnalyticsState = {
  range: { preset: '30d' },
  currency: undefined,
  currencies: [],
  overview: null,
  revenue: null,
  bookingStatus: null,
  topProviders: null,
  geographic: null,
  funnel: null,
  campsHealth: null,
  loading: {
    overview: false,
    revenue: false,
    bookingStatus: false,
    topProviders: false,
    geographic: false,
    funnel: false,
    campsHealth: false,
    currencies: false,
  },
  errors: {
    overview: null,
    revenue: null,
    bookingStatus: null,
    topProviders: null,
    geographic: null,
    funnel: null,
    campsHealth: null,
    currencies: null,
  },
}

export const useAnalyticsStore = create<AnalyticsStore>()(
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
          const res = await analyticsService.getCurrencies()
          set(draft => {
            draft.currencies = res.currencies
            draft.loading.currencies = false
            if (!draft.currency && res.currencies.length > 0) {
              draft.currency = res.currencies[0]
            }
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
          get().fetchWidget('revenue'),
          get().fetchWidget('bookingStatus'),
          get().fetchWidget('topProviders'),
          get().fetchWidget('geographic'),
          get().fetchWidget('funnel'),
          get().fetchWidget('campsHealth'),
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
              const res = await analyticsService.getOverview(range, currency)
              if (isStale()) return
              set(draft => {
                draft.overview = res
                draft.loading.overview = false
              })
              break
            }
            case 'revenue': {
              const res = await analyticsService.getRevenueTimeseries(range, currency)
              if (isStale()) return
              set(draft => {
                draft.revenue = res
                draft.loading.revenue = false
              })
              break
            }
            case 'bookingStatus': {
              const res = await analyticsService.getBookingStatusDistribution(range, currency)
              if (isStale()) return
              set(draft => {
                draft.bookingStatus = res
                draft.loading.bookingStatus = false
              })
              break
            }
            case 'topProviders': {
              const res = await analyticsService.getTopProviders(range, currency)
              if (isStale()) return
              set(draft => {
                draft.topProviders = res.providers
                draft.loading.topProviders = false
              })
              break
            }
            case 'geographic': {
              const res = await analyticsService.getGeographicDistribution(range, currency)
              if (isStale()) return
              set(draft => {
                draft.geographic = res
                draft.loading.geographic = false
              })
              break
            }
            case 'funnel': {
              const res = await analyticsService.getFunnel(range, currency)
              if (isStale()) return
              set(draft => {
                draft.funnel = res
                draft.loading.funnel = false
              })
              break
            }
            case 'campsHealth': {
              const res = await analyticsService.getCampsHealth(range, currency)
              if (isStale()) return
              set(draft => {
                draft.campsHealth = res
                draft.loading.campsHealth = false
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
    { name: 'AnalyticsStore' }
  )
)
