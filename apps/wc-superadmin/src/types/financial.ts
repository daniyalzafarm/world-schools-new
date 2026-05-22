export interface CurrencyOverviewRow {
  currency: string
  netRevenue: number
  gmvProcessed: number
  refundsIssued: number
  paymentsCount: number
  succeededCount: number
  balanceAvailable: number
  balancePending: number
}

export interface FinancialOverview {
  netRevenue: number
  gmvProcessed: number
  refundsIssued: number
  paymentSuccessRate: number
  balanceAvailable: number
  balancePending: number
  balanceLastUpdated: string
  balanceError: string | null
  // Populated only when no `currency` is requested (All Currencies mode). When
  // present the scalar amount fields above are zero and consumers should render
  // the per-currency breakdown instead.
  byCurrency?: CurrencyOverviewRow[]
  paymentsCount?: number
  succeededCount?: number
}

export interface BalanceCurrency {
  currency: string
  amount: number
}

export interface StripeBalance {
  available: BalanceCurrency[]
  pending: BalanceCurrency[]
  lastUpdated: string
  error: string | null
}

export interface BalanceTransactionRow {
  id: string
  type: string
  amount: number
  fee: number
  net: number
  currency: string
  status: string
  created: string
  description: string | null
}

export interface BalanceTransactions {
  transactions: BalanceTransactionRow[]
  lastUpdated: string
  error: string | null
}

export interface RevenueBucket {
  date: string
  applicationFees: number
  refunds: number
  reimbursements: number
}

export interface RevenueComposition {
  bucket: 'day' | 'week' | 'month'
  buckets: RevenueBucket[]
  // All Currencies mode: per-currency time series. When present, `buckets[]`
  // above is empty and consumers should derive series from this map.
  byCurrency?: Record<string, { buckets: RevenueBucket[] }>
}

export interface PaymentStatusDistribution {
  slices: { status: string; count: number; amount: number }[]
  // All Currencies mode: per-currency amount breakdown by status. Counts in
  // `slices` are platform-wide and sum cleanly; amounts there are zeroed.
  amountByCurrency?: Record<string, { status: string; amount: number }[]>
}

export interface UpcomingPayoutTranche {
  id: string
  amount: number
  currency: string
  releaseAt: string
  reason: string
  bookingGroupId: string
  providerId: string
  providerName: string
}

export interface UpcomingPayouts {
  totalAmount: number
  count: number
  tranches: UpcomingPayoutTranche[]
  // All Currencies mode: pending payout amounts split by currency.
  totalsByCurrency?: { currency: string; amount: number }[]
}

export interface DisputeUrgent {
  id: string
  amount: number
  currency: string
  evidenceDueBy: string | null
  providerName: string
  bookingGroupId: string
}

export interface DisputesByCurrencyRow {
  currency: string
  count: number
  amount: number
  openRate: number
}

export interface DisputesSummary {
  totalDisputes: number
  totalAmount: number
  byOutcome: Record<string, { count: number; amount: number }>
  openDisputeRate: number
  urgent: DisputeUrgent[]
  // All Currencies mode: per-currency dispute counts/amounts.
  byCurrency?: DisputesByCurrencyRow[]
}

export interface RefundsByCurrencyRow {
  currency: string
  count: number
  amount: number
}

export interface RefundsSummary {
  totalCount: number
  totalAmount: number
  byReason: Record<string, { count: number; amount: number; pct: number }>
  // All Currencies mode: per-currency refund amounts. In this mode `pct` on
  // byReason is share-of-count instead of share-of-amount and `amount` on
  // byReason is zero.
  byCurrency?: RefundsByCurrencyRow[]
}

export interface ReimbursementsAging {
  pendingTotal: number
  byBucket: {
    current: { label: string; count: number; amount: number }
    weekOverdue: { label: string; count: number; amount: number }
    monthOverdue: { label: string; count: number; amount: number }
  }
  byStatus: {
    pending: { count: number; amount: number }
    invoiced: { count: number; amount: number }
  }
  // All Currencies mode: per-currency outstanding totals. Amounts on the
  // aging buckets and status cards are zero in this mode (counts remain).
  pendingTotalsByCurrency?: { currency: string; amount: number }[]
}

export interface ConnectedAccountRow {
  id: string
  name: string
  logoUrl: string | null
  gmv: number
  currency: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  attentionRequired: boolean
  lastPayoutDate: string | null
  payoutSuccessRate: number | null
}

export interface ConnectedAccounts {
  providers: ConnectedAccountRow[]
}
