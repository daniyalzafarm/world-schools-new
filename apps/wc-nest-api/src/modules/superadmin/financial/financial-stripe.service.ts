import { Injectable, Logger } from '@nestjs/common'
import { StripeService } from '../../stripe/stripe.service'
import { DashboardCacheService } from '../analytics/dashboard-cache.util'

const TTL = {
  balance: 60,
  balanceTransactions: 300,
  applicationFees: 300,
  accountsList: 300,
  accountRetrieve: 300,
  perAccountList: 300,
}

const MAX_PAGES = 10 // 10 × 100 = 1000 items per window

/**
 * Stripe v22 in this project only exports `StripeConstructor` — `Stripe.X`
 * type references aren't available. We describe the response shapes we
 * actually consume here.
 */

interface StripeApplicationFee {
  id: string
  account: string | { id: string }
  amount: number
  amount_refunded: number
  currency: string
  charge: string | { id: string } | null
  balance_transaction: string | { id: string } | null
  created: number
}

interface StripeAccount {
  id: string
  email?: string | null
  business_profile?: {
    name?: string | null
  } | null
  settings?: {
    dashboard?: {
      display_name?: string | null
    } | null
  } | null
  charges_enabled?: boolean
  payouts_enabled?: boolean
  requirements?: {
    currently_due?: string[] | null
    past_due?: string[] | null
    disabled_reason?: string | null
  } | null
}

interface StripeCharge {
  id: string
  amount: number
  amount_refunded?: number
  currency: string
  status: string
  created: number
  refunded?: boolean
}

interface StripePaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  last_payment_error?: { code?: string; message?: string } | null
  created: number
}

interface StripeDispute {
  id: string
  amount: number
  currency: string
  status: string
  payment_intent?: string | { id: string } | null
  evidence_details?: { due_by?: number | null } | null
  created: number
}

interface StripeRefund {
  id: string
  amount: number
  currency: string
  reason?: string | null
  status?: string | null
  created: number
}

interface ListResult<T> {
  data: T[]
  error: string | null
  lastUpdated: string
}

@Injectable()
export class FinancialStripeService {
  private readonly logger = new Logger(FinancialStripeService.name)

  constructor(
    private readonly stripe: StripeService,
    private readonly cache: DashboardCacheService
  ) {}

  // -------------------------------------------------------------------------
  // Platform-level: Balance
  // -------------------------------------------------------------------------

  async getBalance() {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'balance', {}),
      TTL.balance,
      async () => {
        try {
          const balance = await this.stripe.client.balance.retrieve()
          return {
            available: balance.available.map(b => ({
              currency: b.currency,
              amount: b.amount / 100,
            })),
            pending: balance.pending.map(b => ({
              currency: b.currency,
              amount: b.amount / 100,
            })),
            lastUpdated: new Date().toISOString(),
            error: null as string | null,
          }
        } catch (err: any) {
          this.logger.warn(`Stripe Balance API failed: ${err?.message ?? err}`)
          return {
            available: [],
            pending: [],
            lastUpdated: new Date().toISOString(),
            error: err?.message ?? 'Stripe balance unavailable',
          }
        }
      }
    )
  }

  async getBalanceTransactions(limit = 50) {
    const cappedLimit = Math.max(1, Math.min(100, limit))
    return this.cache.withCache(
      this.cache.buildKey('financial', 'balance-transactions', { limit: cappedLimit }),
      TTL.balanceTransactions,
      async () => {
        try {
          const txns = await this.stripe.client.balanceTransactions.list({
            limit: cappedLimit,
          })
          return {
            transactions: txns.data.map(t => ({
              id: t.id,
              type: t.type,
              amount: t.amount / 100,
              fee: t.fee / 100,
              net: t.net / 100,
              currency: t.currency,
              status: t.status,
              created: new Date(t.created * 1000).toISOString(),
              description: t.description,
            })),
            lastUpdated: new Date().toISOString(),
            error: null as string | null,
          }
        } catch (err: any) {
          this.logger.warn(`Stripe BalanceTransactions API failed: ${err?.message ?? err}`)
          return {
            transactions: [],
            lastUpdated: new Date().toISOString(),
            error: err?.message ?? 'Stripe balance transactions unavailable',
          }
        }
      }
    )
  }

  // -------------------------------------------------------------------------
  // Platform-level: ApplicationFees (cross-account, source of truth for revenue)
  // -------------------------------------------------------------------------

  async listApplicationFees(range: {
    from: Date
    to: Date
  }): Promise<ListResult<StripeApplicationFee>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'application-fees', {
        v: 3,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      TTL.applicationFees,
      async () =>
        this.runPaginated(cursor =>
          this.stripe.client.applicationFees.list({
            created: { gte: toUnix(range.from), lte: toUnix(range.to) },
            limit: 100,
            ...(cursor ? { starting_after: cursor } : {}),
          })
        )
    )
  }

  /**
   * Distinct currencies from the 100 most-recent application fees. Used to
   * populate the currency selector with every currency the platform actively
   * earns fees in — the platform balance only surfaces *settled* currencies,
   * which misses currencies like USD/GBP when their fees haven't settled yet
   * or have been auto-converted to the platform's default settlement currency.
   */
  async listRecentApplicationFeeCurrencies(): Promise<string[]> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'fee-currencies', { v: 1 }),
      TTL.applicationFees,
      async () => {
        try {
          const result = await this.stripe.client.applicationFees.list({ limit: 100 })
          return result.data.map(f => f.currency.toLowerCase())
        } catch (err: any) {
          this.logger.warn(
            `Stripe applicationFees.list (currency discovery) failed: ${err?.message ?? err}`
          )
          return []
        }
      }
    )
  }

  // -------------------------------------------------------------------------
  // Platform-level: Connected accounts roster
  // -------------------------------------------------------------------------

  async listConnectedAccounts(): Promise<ListResult<StripeAccount>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'accounts-list', { v: 3 }),
      TTL.accountsList,
      async () =>
        this.runPaginated(cursor =>
          this.stripe.client.accounts.list({
            limit: 100,
            ...(cursor ? { starting_after: cursor } : {}),
          })
        )
    )
  }

  /**
   * Cached per-account retrieve — gives the *live* charges_enabled /
   * payouts_enabled / requirements. Separate cache key per account so a stale
   * account doesn't pollute the rest.
   */
  async retrieveAccount(accountId: string): Promise<StripeAccount | null> {
    return this.cache
      .withCache<StripeAccount | null>(
        this.cache.buildKey('financial', 'account-retrieve', { v: 3, id: accountId }),
        TTL.accountRetrieve,
        async () => {
          try {
            return (await this.stripe.client.accounts.retrieve(accountId)) as StripeAccount
          } catch (err: any) {
            this.logger.warn(
              `Stripe accounts.retrieve(${accountId}) failed: ${err?.message ?? err}`
            )
            return null
          }
        }
      )
      .catch(() => null)
  }

  // -------------------------------------------------------------------------
  // Per-account loops (Direct Charges: charges/intents/refunds/disputes live
  // on the connected account; must use Stripe-Account header per call).
  // -------------------------------------------------------------------------

  async listChargesAcrossAccounts(range: {
    from: Date
    to: Date
  }): Promise<ListResult<StripeCharge & { _account: string }>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'charges-cross-accounts', {
        v: 3,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      TTL.perAccountList,
      async () =>
        this.fanOutPerAccount(range, (acct, cursor) =>
          this.stripe.client.charges.list(
            {
              created: { gte: toUnix(range.from), lte: toUnix(range.to) },
              limit: 100,
              ...(cursor ? { starting_after: cursor } : {}),
            },
            { stripeAccount: acct }
          )
        )
    )
  }

  async listPaymentIntentsAcrossAccounts(range: {
    from: Date
    to: Date
  }): Promise<ListResult<StripePaymentIntent & { _account: string }>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'intents-cross-accounts', {
        v: 3,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      TTL.perAccountList,
      async () =>
        this.fanOutPerAccount(range, (acct, cursor) =>
          this.stripe.client.paymentIntents.list(
            {
              created: { gte: toUnix(range.from), lte: toUnix(range.to) },
              limit: 100,
              ...(cursor ? { starting_after: cursor } : {}),
            },
            { stripeAccount: acct }
          )
        )
    )
  }

  async listDisputesAcrossAccounts(range: {
    from: Date
    to: Date
  }): Promise<ListResult<StripeDispute & { _account: string }>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'disputes-cross-accounts', {
        v: 3,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      TTL.perAccountList,
      async () =>
        this.fanOutPerAccount(range, (acct, cursor) =>
          this.stripe.client.disputes.list(
            {
              created: { gte: toUnix(range.from), lte: toUnix(range.to) },
              limit: 100,
              ...(cursor ? { starting_after: cursor } : {}),
            },
            { stripeAccount: acct }
          )
        )
    )
  }

  async listRefundsAcrossAccounts(range: {
    from: Date
    to: Date
  }): Promise<ListResult<StripeRefund & { _account: string }>> {
    return this.cache.withCache(
      this.cache.buildKey('financial', 'refunds-cross-accounts', {
        v: 3,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      TTL.perAccountList,
      async () =>
        this.fanOutPerAccount(range, (acct, cursor) =>
          this.stripe.client.refunds.list(
            {
              created: { gte: toUnix(range.from), lte: toUnix(range.to) },
              limit: 100,
              ...(cursor ? { starting_after: cursor } : {}),
            },
            { stripeAccount: acct }
          )
        )
    )
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Run a paginated Stripe list call, looping on `starting_after` until
   * `has_more === false` or we hit `MAX_PAGES`. Wraps errors so the caller
   * always gets a `ListResult` shape.
   */
  private async runPaginated<T extends { id: string }>(
    fetchPage: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>
  ): Promise<ListResult<T>> {
    const all: T[] = []
    try {
      let cursor: string | undefined
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await fetchPage(cursor)
        all.push(...page.data)
        if (!page.has_more || page.data.length === 0) break
        cursor = page.data[page.data.length - 1].id
      }
      return { data: all, error: null, lastUpdated: new Date().toISOString() }
    } catch (err: any) {
      this.logger.warn(`Stripe paginated list failed: ${err?.message ?? err}`)
      return {
        data: all,
        error: err?.message ?? 'Stripe list call failed',
        lastUpdated: new Date().toISOString(),
      }
    }
  }

  /**
   * Run a paginated list call across every connected account in parallel via
   * `Promise.allSettled`. Each item is tagged with its `_account` id so
   * downstream consumers can group/filter without an extra lookup. A single
   * failing account is logged and skipped — never poisons the whole result.
   */
  private async fanOutPerAccount<T extends { id: string }>(
    range: { from: Date; to: Date },
    fetchPage: (accountId: string, cursor?: string) => Promise<{ data: T[]; has_more: boolean }>
  ): Promise<ListResult<T & { _account: string }>> {
    const accounts = await this.listConnectedAccounts()
    if (accounts.data.length === 0) {
      return {
        data: [],
        error: accounts.error,
        lastUpdated: new Date().toISOString(),
      }
    }

    const results = await Promise.allSettled(
      accounts.data.map(async acct => {
        const page = await this.runPaginated<T>(cursor => fetchPage(acct.id, cursor))
        if (page.error) {
          this.logger.warn(`Per-account list failed for ${acct.id}: ${page.error}`)
        }
        return page.data.map(item => ({ ...item, _account: acct.id }))
      })
    )

    const data: (T & { _account: string })[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') data.push(...r.value)
    }
    return { data, error: null, lastUpdated: new Date().toISOString() }
  }
}

function toUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}
