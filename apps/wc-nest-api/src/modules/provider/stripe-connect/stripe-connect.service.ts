import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import Stripe from 'stripe'
import { ProviderGetPayload } from '../../../generated/client/models/Provider'
import { PrismaService } from '../../../prisma/prisma.service'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'
import { PROVIDER_MCC, SUPPORTED_CONNECT_CURRENCIES } from '../../stripe/stripe.constants'
import { mapStripeError } from '../../stripe/stripe-error.util'
import { StripeService } from '../../stripe/stripe.service'
import { StripeAccountStatusDto } from './dto/stripe-connect.dto'

/**
 * Stable JSON: serializes objects with sorted keys so structurally-equal
 * payloads always produce the same string regardless of property insertion
 * order. Required for content-hashed idempotency keys — if two retries
 * produced different stringifications of the same object, they'd hash to
 * different keys and Stripe would create duplicate accounts.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
  return `{${entries.join(',')}}`
}

// Structural snapshot of the fields we read from a live `accounts.retrieve()` response.
// We can't import `Stripe.Account` as a type via the default `import Stripe from 'stripe'`
// (Stripe v22 only exports `StripeConstructor` from the package entry — see stripe.service.ts),
// so we describe the shape we consume here.
type StripeAddressLike = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

type LiveStripeAccountSnapshot = {
  id?: string | null
  email?: string | null
  country?: string | null
  business_type?: string | null
  created?: number | null
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  business_profile?: {
    name?: string | null
    url?: string | null
    support_email?: string | null
    support_phone?: string | null
    product_description?: string | null
    mcc?: string | null
  } | null
  individual?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    dob?: { day?: number | null; month?: number | null; year?: number | null } | null
    address?: StripeAddressLike | null
    verification?: { status?: string | null } | null
  } | null
  company?: {
    name?: string | null
    phone?: string | null
    tax_id_provided?: boolean | null
    address?: StripeAddressLike | null
  } | null
  external_accounts?: {
    data?: Array<{
      id: string
      object: 'bank_account' | 'card' | string
      bank_name?: string | null
      last4?: string | null
      currency?: string | null
      country?: string | null
      account_holder_name?: string | null
      routing_number?: string | null
      default_for_currency?: boolean | null
      status?: string | null
    }>
  } | null
  settings?: {
    payouts?: {
      schedule?: {
        interval?: string | null
        delay_days?: number | string | null
        weekly_anchor?: string | null
        monthly_anchor?: number | null
      } | null
    } | null
  } | null
  tos_acceptance?: {
    date?: number | null
  } | null
  requirements?: {
    currently_due?: string[] | null
    past_due?: string[] | null
    eventually_due?: string[] | null
    disabled_reason?: string | null
  } | null
}

type ProviderWithSettings = ProviderGetPayload<{
  include: { settings: true; owner: true }
}>

function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null
  return new Date(seconds * 1000).toISOString()
}

function dobToIso(
  dob: { day?: number | null; month?: number | null; year?: number | null } | null | undefined
): string | null {
  if (dob?.year == null || dob.month == null || dob.day == null) return null
  // Validate the calendar — `Date.UTC` accepts month=13 and roll-overs silently,
  // so we round-trip through a Date to verify the components match what we set.
  const probe = new Date(Date.UTC(dob.year, dob.month - 1, dob.day))
  if (
    probe.getUTCFullYear() !== dob.year ||
    probe.getUTCMonth() !== dob.month - 1 ||
    probe.getUTCDate() !== dob.day
  ) {
    return null
  }
  const m = String(dob.month).padStart(2, '0')
  const d = String(dob.day).padStart(2, '0')
  return `${dob.year}-${m}-${d}`
}

/**
 * Stripe's `accounts.create` expects a 2-letter ISO 3166-1 alpha-2 code for
 * `country`. Our `Provider.legalCountry` field is a free-text column populated
 * from a Google Business Profile lookup, so we cannot trust the format. We
 * accept ONLY values that already look like alpha-2 codes (e.g. "US", "ch")
 * and pass them upper-cased; anything else is dropped, which makes Stripe fall
 * back to its email/IP-based heuristics — the pre-fix behavior.
 */
function normalizeCountryCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!/^[a-zA-Z]{2}$/.test(trimmed)) return undefined
  return trimmed.toUpperCase()
}

function mapAddress(address: StripeAddressLike | null | undefined) {
  if (!address) return null
  // Treat an address with every field empty as no-address so the UI can hide
  // the section entirely instead of rendering a row of dashes.
  const mapped = {
    line1: address.line1 ?? null,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    postalCode: address.postal_code ?? null,
    country: address.country ?? null,
  }
  if (Object.values(mapped).every(v => v === null || v === '')) return null
  return mapped
}

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly profileCompletion: ProfileCompletionService
  ) {}

  /**
   * Emits a single-line structured audit event for any state-mutating action on
   * a provider's Stripe account. Format is keyword=value so it's easy to grep
   * in logs and parse downstream (Loki, Datadog, etc.) without inventing a
   * separate audit table. Avoid PII — log identifiers and outcomes only.
   */
  private auditLog(fields: Record<string, string | number | boolean | null | undefined>): void {
    const parts = Object.entries(fields)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    this.logger.log(`stripe-connect.audit ${parts.join(' ')}`)
  }

  /**
   * Creates (or retrieves existing) Stripe Standard connected account (Direct Charges) for a provider.
   * Idempotent — safe to call multiple times, even concurrently.
   *
   * Concurrency contract (C4 + C5 from production audit):
   *   - The Stripe-side idempotency key `provider-account:{providerId}` prevents
   *     two distinct accounts from being created on Stripe within their 24h cache
   *     window. So even with concurrent requests, both Stripe SDK calls return the
   *     SAME account.id.
   *   - The DB-side update uses `updateMany({where:{id, stripeAccountId:null}})`
   *     so only the first caller's write succeeds. The losing caller refetches
   *     and returns the now-populated row — never overwriting freshly-set data.
   *   - Beyond 24h, if a previous attempt orphaned a Stripe account (rare:
   *     Stripe call succeeded but DB write failed permanently), a fresh attempt
   *     will create a NEW account. Orphan detection happens at the loud
   *     `Stripe account orphan detected` error log emitted below — operators
   *     should monitor it and reconcile manually until a scheduled
   *     reconciliation job is in place.
   */
  async createOrGetAccount(providerId: string): Promise<StripeAccountStatusDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { settings: true, owner: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (provider.approvalStatus !== 'approved') {
      throw new BadRequestException(
        'Stripe Connect account can only be created after your application has been approved'
      )
    }

    // Return existing account if already created
    if (provider.stripeAccountId) {
      return this.buildStatusDto(provider)
    }

    if (!provider.settings?.currency) {
      throw new UnprocessableEntityException(
        'Provider currency must be set before creating a Stripe account'
      )
    }
    const currency = provider.settings.currency

    // H5: pre-validate currency against the platform's allow-list. Sending an
    // unsupported currency to `accounts.create` produces a generic Stripe 400;
    // surface a friendly platform-policy message here instead.
    if (!SUPPORTED_CONNECT_CURRENCIES.has(currency.toLowerCase())) {
      throw new UnprocessableEntityException(
        `Currency ${currency.toUpperCase()} is not supported for provider payouts. ` +
          'Contact support to onboard a provider in this currency.'
      )
    }

    // B6: pass the provider's legal country to Stripe so it doesn't default to
    // `US` and force non-US providers to switch country mid-form. We accept only
    // a strict 2-letter ISO 3166-1 alpha-2 code (Stripe's contract); anything
    // else (legacy free-text) is silently dropped and Stripe falls back to its
    // default heuristics, which is the pre-fix behavior.
    const country = normalizeCountryCode(provider.legalCountry)

    // Type inferred from the SDK directly; see note on
    // `createAccountWithIdempotencyRotation` for why we can't import
    // `Stripe.AccountCreateParams` as a named type in this file.
    const accountParams: Parameters<InstanceType<typeof Stripe>['accounts']['create']>[0] = {
      controller: {
        // Stripe Dashboard account with platform controls (Direct Charges target).
        // Per https://docs.stripe.com/connect/direct-charges?platform=web&ui=elements
        // direct charges are recommended for accounts with full Dashboard access,
        // so providers can self-serve payouts/disputes/reporting at
        // `dashboard.stripe.com`. Replaces the prior `express` dashboard type.
        stripe_dashboard: { type: 'full' },
        // Full Stripe Dashboard accounts are responsible for their own Stripe
        // relationship: the connected account pays Stripe processing fees from
        // its balance (`fees.payer: 'account'`) and bears chargeback / dispute
        // losses (`losses.payments: 'stripe'`). The platform's commission still
        // flows via `application_fee_amount` on every PaymentIntent — that is
        // independent of `fees.payer`. This is a Stripe-imposed constraint for
        // `stripe_dashboard.type: 'full'`; `payer: 'application'` is only valid
        // with `'express'` or `'none'`. Attempting `'application'` here returns
        // `fees[payer]=application is not supported when creating an account
        // with the full dashboard.` from accounts.create.
        fees: { payer: 'account' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      ...(country ? { country } : {}),
      default_currency: currency.toLowerCase(),
      email: provider.owner.email,
      business_profile: {
        mcc: PROVIDER_MCC,
        name: provider.legalCompanyName ?? undefined,
        url: provider.website ?? undefined,
      },
      // Manual payout schedule: captured funds settle to the connected account
      // and stay there until the platform-driven `payout-release.cron.ts`
      // calls `payouts.create({}, { stripeAccount })` based on each
      // booking's `transferDate`. This is what gives us per-booking precision
      // for both the default (first business day after session start) and
      // early-payout (agreed earlier date) flows. Required by the spec — do
      // NOT change to `daily` / `weekly` without a coordinated payout-release
      // refactor.
      settings: {
        payouts: {
          schedule: { interval: 'manual' },
        },
      },
    }

    // Content-hashed idempotency key. Identical params (the actual retry case)
    // → identical key → Stripe returns cached response, idempotency preserved.
    // Different params → different key → no `same key, different params` 503.
    //
    // We intentionally do NOT catch `StripeIdempotencyError` and rotate to a
    // fresh key. With correct hashing it should never fire — if it does, that
    // signals a regression in `stableStringify` or a non-deterministic field
    // sneaking into `accountParams`. We want that to surface loudly as a 503
    // (via `mapStripeError`) so we notice and fix the underlying bug, rather
    // than silently minting duplicate Stripe accounts on every call.
    const paramsHash = createHash('sha256')
      .update(stableStringify(accountParams))
      .digest('hex')
      .slice(0, 16)
    const idempotencyKey = `provider-account:${providerId}:${paramsHash}`

    // Concurrency cure for `idempotency_key_in_use`: two near-simultaneous
    // POSTs to /provider/stripe-connect/account hash to the SAME idempotency
    // key (by design — same provider, same params), so Stripe rejects the
    // loser with `StripeAPIError code='idempotency_key_in_use'` while the
    // winner is still in flight. Without recovery, `mapStripeError` 503s the
    // loser even though the winner will succeed seconds later.
    //
    // The winner will populate `Provider.stripeAccountId` shortly after; the
    // loser waits a beat, re-reads the row, and either:
    //   (a) finds the winner's account id → `accounts.retrieve` and return; or
    //   (b) re-issues `accounts.create` with the same key — Stripe's idempotency
    //       cache replays the winner's response once it has settled.
    // Bounded to MAX_IDEMPOTENCY_RETRIES so a Stripe-side hang doesn't wedge
    // us indefinitely; the final iteration falls through to whatever error
    // Stripe returns and `mapStripeError` handles it.
    const MAX_IDEMPOTENCY_RETRIES = 3
    const account = await this.withStripeErrors(async () => {
      for (let attempt = 0; attempt <= MAX_IDEMPOTENCY_RETRIES; attempt++) {
        try {
          return await this.stripeService.client.accounts.create(accountParams, { idempotencyKey })
        } catch (err) {
          const isInFlightConflict =
            err instanceof Stripe.errors.StripeAPIError && err.code === 'idempotency_key_in_use'
          if (!isInFlightConflict || attempt === MAX_IDEMPOTENCY_RETRIES) throw err

          this.logger.debug(
            `idempotency_key_in_use for provider ${providerId}; concurrent winner in flight (attempt ${attempt + 1}/${MAX_IDEMPOTENCY_RETRIES + 1})`
          )
          // Backoff 250ms / 500ms / 1000ms — worst-case ≈ 1.75s before bubbling.
          await new Promise(r => setTimeout(r, 250 * 2 ** attempt))

          // Fast-path: if the winner has already committed the DB write, skip
          // the next Stripe call entirely and fetch the live account.
          const refreshed = await this.prisma.provider.findUnique({
            where: { id: providerId },
            select: { stripeAccountId: true },
          })
          if (refreshed?.stripeAccountId) {
            return await this.stripeService.client.accounts.retrieve(refreshed.stripeAccountId)
          }
          // Otherwise loop and retry `accounts.create` with the same key.
        }
      }
      // Unreachable — the loop either returns or throws above. Defensive
      // throw so the surrounding `withStripeErrors` has a non-undefined return.
      throw new Error('createAccount idempotency retry loop exhausted without exit')
    })

    // Atomic claim: only the first concurrent caller's write succeeds. A losing
    // caller (count === 0) refetches — by which point the winning caller has
    // already populated `stripeAccountId` (with the SAME `account.id` returned
    // by Stripe's idempotency key, so the values agree).
    //
    // App-fee fields (`appFeeCustom`, `appFeePercentage`) are intentionally NOT
    // touched here — they are managed exclusively by the superadmin via the
    // Settings tab on the provider detail page. New providers fall
    // back to `SystemSettings.defaultAppFee` until a custom rate is negotiated.
    const claim = await this.prisma.provider.updateMany({
      where: { id: providerId, stripeAccountId: null },
      data: {
        stripeAccountId: account.id,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        // Clear the disconnect markers on a successful reconnect so the
        // catalog reads a clean state. If this row was never disconnected
        // (i.e. first connect), these are already null — the write is a
        // safe no-op.
        stripeAccountDisconnectedAt: null,
        stripeAccountDisconnectedReason: null,
      },
    })

    const updated = await this.prisma.provider.findUniqueOrThrow({
      where: { id: providerId },
      include: { settings: true, owner: true },
    })

    if (claim.count === 0) {
      // Concurrent caller beat us. Validate the stored account matches what we
      // just received — if not, we've orphaned a Stripe account (idempotency key
      // race across the 24h boundary). Log loudly so reconciliation can clean up.
      if (updated.stripeAccountId !== account.id) {
        this.logger.error(
          `Stripe account orphan detected for provider ${providerId}: ` +
            `Stripe returned ${account.id} but DB already has ${updated.stripeAccountId}. ` +
            `The orphaned account ${account.id} must be reconciled.`
        )
        this.auditLog({
          action: 'create_account.orphan',
          providerId,
          stripeAccountIdReturned: account.id,
          stripeAccountIdStored: updated.stripeAccountId,
        })
      } else {
        this.auditLog({
          action: 'create_account.concurrent_resolved',
          providerId,
          stripeAccountId: account.id,
        })
      }
    } else {
      this.logger.log(
        `Created Stripe account ${account.id} for provider ${providerId} (currency: ${currency})`
      )
      this.auditLog({
        action: 'create_account.created',
        providerId,
        stripeAccountId: account.id,
        currency,
      })
    }

    return this.buildStatusDto(updated)
  }

  /**
   * Creates a single-use AccountSession client_secret for the embedded onboarding component.
   * Do NOT persist the returned secret — it expires quickly.
   */
  async createAccountSession(providerId: string): Promise<{ clientSecret: string }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (!provider.stripeAccountId) {
      throw new BadRequestException(
        'Stripe account has not been created yet. Call POST /provider/stripe-connect/account first.'
      )
    }

    // B4 + H1: enable the components Stripe's Embedded Onboarding docs
    // recommend for production:
    //   - `account_onboarding`: the KYC form itself (used in `/onboarding/stripe-connect`)
    //   - `account_management`: post-onboarding profile editing (used on the
    //     Account → Stripe Account page so providers can update business info
    //     in-place instead of bouncing to the Stripe Dashboard).
    //   - `notification_banner`: surfaces new requirements / risk-review state
    //     mid-rolling-KYC without us having to poll `/account` for changes.
    //
    // We do NOT set `disable_stripe_user_authentication`: Stripe rejects that
    // flag for accounts where the platform doesn't own requirement collection.
    // Our connected accounts are Standard with `controller.requirement_collection
    // = 'stripe'` (see `accounts.create` above) ⇒ Stripe owns requirements ⇒
    // the flag is invalid here. The flag's intent (suppress an in-iframe login
    // prompt) is already satisfied for Standard accounts loaded inside an
    // authenticated wc-provider session — Stripe doesn't prompt for a separate
    // login in that path.
    //
    // `external_account_collection: true` lets the provider add/edit payout
    // bank details inline (required for first-time onboarding, useful later).
    const featuresWithExternalAccount = {
      external_account_collection: true,
    } as const

    const accountSession = await this.withStripeErrors(() =>
      this.stripeService.client.accountSessions.create({
        account: provider.stripeAccountId!,
        components: {
          account_onboarding: {
            enabled: true,
            features: featuresWithExternalAccount,
          },
          account_management: {
            enabled: true,
            features: featuresWithExternalAccount,
          },
          notification_banner: {
            enabled: true,
            features: featuresWithExternalAccount,
          },
        },
      })
    )

    this.logger.debug(`Created AccountSession for provider ${providerId}`)

    return { clientSecret: accountSession.client_secret }
  }

  /**
   * Records the result of an `onExit` from the embedded onboarding.
   *
   * Stripe fires `onExit` for BOTH "Done" (form fully submitted) and
   * "Save and exit" (partial). We must not blindly mark our system "complete"
   * — the source of truth is the live Stripe account's `details_submitted`.
   *
   *   - `details_submitted === true`  → finalize: set `stripeOnboardingCompleted`
   *     and clear any prior skip timestamp, so the wizard gate stops gating.
   *   - `details_submitted === false` → treat as "skipped for now": persist
   *     `stripeOnboardingSkippedAt` so the user can return to the wizard via
   *     `/onboarding/stripe-connect` and resume — the layout gate already
   *     allows access to that exact path while a skip timestamp is set.
   *
   * Capability flags (`charges_enabled`, `payouts_enabled`) are always synced
   * from the live snapshot since those drive payment-readiness checks.
   */
  async completeOnboarding(providerId: string): Promise<StripeAccountStatusDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { settings: true, owner: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (!provider.stripeAccountId) {
      throw new BadRequestException('No Stripe account found for this provider')
    }

    let account: LiveStripeAccountSnapshot
    try {
      account = await this.stripeService.client.accounts.retrieve(provider.stripeAccountId)
    } catch (err) {
      // B1: a Stripe-side delete between createAccountSession and onExit shows
      // up here as `resource_missing`. Without this branch the user gets a
      // confusing 400 and the cached DB flags stay set ("verified" UI for a
      // dead account). Scrub the cached state and return a no-account DTO so
      // the frontend re-renders the "set up payment account" CTA.
      const cleared = await this.scrubIfResourceMissing(providerId, err)
      if (cleared) return this.buildStatusDto(cleared)
      // mapStripeError is `: never`, but we add an explicit `throw err` after
      // it as a defense-in-depth measure (B3) so a future tweak that adds a
      // non-throwing branch can't silently fall through to a stale snapshot.
      mapStripeError(err)
      throw err
    }

    const detailsSubmitted = Boolean(account.details_submitted)
    const finalized = detailsSubmitted

    // H9: `details_submitted` is a one-way switch on Stripe's side — once true
    // it stays true. Two concurrent `onExit` deliveries (e.g. two browser tabs)
    // therefore converge: the first sets `stripeOnboardingCompleted=true`,
    // clears the skip timestamp, and stamps `completedAt`; the second computes
    // identical values from the same Stripe response and rewrites the same
    // row. Last-write-wins is therefore safe — no risk of `skippedAt` flapping
    // because both writers see `finalized=true`. Documenting here so a future
    // refactor doesn't add a guard that breaks the convergence.
    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        stripeOnboardingCompleted: finalized,
        stripeOnboardingCompletedAt: finalized
          ? (provider.stripeOnboardingCompletedAt ?? new Date())
          : null,
        // Save-and-exit: keep the skip flag set so the layout gate continues to
        // permit /onboarding/stripe-connect access. Don't overwrite an existing
        // earlier skip timestamp on every visit — preserve the original.
        stripeOnboardingSkippedAt: finalized
          ? null
          : (provider.stripeOnboardingSkippedAt ?? new Date()),
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: detailsSubmitted,
      },
      include: { settings: true, owner: true },
    })

    this.auditLog({
      action: finalized ? 'complete_onboarding.finalized' : 'complete_onboarding.partial',
      providerId,
      stripeAccountId: provider.stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted,
    })

    // Stripe charges-enabled is worth 20 pts in
    // the provider's profile-completion formula. Recompute on every
    // onboarding finalize so the "incomplete profile" reminder is gated
    // against current state.
    await this.profileCompletion.enqueueRecomputeForProvider(providerId)

    return this.buildStatusDto(updated, account)
  }

  /**
   * Shared resource_missing recovery path used by `getAccountStatus` and
   * `completeOnboarding`. When Stripe returns `resource_missing` for the
   * cached `stripeAccountId`, the connected account was deleted out from
   * under us (rare, usually a manual platform-side delete via Stripe
   * dashboard) without firing a deauth webhook.
   *
   * Returns the post-scrub provider row when scrubbing happened, or `null`
   * for any other error so the caller can re-throw via `mapStripeError`.
   *
   * `appFeeCustom` / `appFeePercentage` are deliberately preserved — a
   * Stripe disconnect is a payment-rails change, not a commercial-terms
   * change, and the superadmin's negotiated rate must survive a deauth/
   * reauth round-trip.
   */
  private async scrubIfResourceMissing(
    providerId: string,
    err: unknown
  ): Promise<ProviderWithSettings | null> {
    if (
      !(err instanceof Stripe.errors.StripeInvalidRequestError) ||
      err.code !== 'resource_missing'
    ) {
      return null
    }
    this.logger.warn(
      `Stripe account for provider ${providerId} no longer exists — clearing cached state`
    )
    this.auditLog({
      action: 'scrub_missing_account',
      providerId,
    })
    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        stripeAccountId: null,
        stripeOnboardingCompleted: false,
        stripeOnboardingCompletedAt: null,
        stripeOnboardingSkippedAt: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeAttentionRequired: false,
        // Mirrored from the deauth-webhook path so the notification
        // catalog reads the same fields whether the disconnect arrived as
        // an explicit deauth event or was discovered via a `resource_missing`
        // probe.
        stripeAccountDisconnectedAt: new Date(),
        stripeAccountDisconnectedReason: 'stripe_resource_missing',
      },
      include: { settings: true, owner: true },
    })
  }

  /**
   * Asserts a provider is fully payment-ready: Stripe account connected,
   * `charges_enabled === true`, and `payouts_enabled === true`. Throws 412
   * `PreconditionFailedException` otherwise.
   *
   * Call this from any payment-touching path BEFORE committing the parent to
   * a charge. Today the booking flow is pre-payment so this is invoked from
   * nowhere — but it MUST be wired in when payment intents / charges are added,
   * otherwise a provider who skipped or whose verification was paused will
   * accept bookings that fail at charge time, leaving orphaned bookings and
   * customer-facing errors.
   *
   * Returns the cached DB flags (no Stripe API call) so it is cheap to call
   * inline inside booking-create handlers. Webhooks keep these flags fresh.
   */
  async assertProviderPaymentReady(providerId: string): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (!provider.stripeAccountId) {
      throw new PreconditionFailedException({
        message:
          'This provider has not finished connecting their Stripe account and cannot accept paid bookings yet.',
        code: 'STRIPE_ACCOUNT_MISSING',
      })
    }

    if (!provider.stripeChargesEnabled || !provider.stripePayoutsEnabled) {
      throw new PreconditionFailedException({
        message:
          'This provider is not yet able to accept payments. Their Stripe account is awaiting verification or has been restricted.',
        code: 'STRIPE_CAPABILITIES_DISABLED',
        details: {
          chargesEnabled: provider.stripeChargesEnabled,
          payoutsEnabled: provider.stripePayoutsEnabled,
        },
      })
    }
  }

  /**
   * Live variant of `assertProviderPaymentReady` for paths where
   * the cached DB flags could be dangerously stale.
   *
   * The cached check is fine for the booking-create / submit flow — the
   * `account.updated` webhook syncs flags within seconds of a Stripe-side
   * change, and a parent who submits during the gap will simply see the next
   * page's PaymentIntent call fail (the existing fallback). The off-session
   * balance-charge cron is different: it fires up to 90 days after the
   * booking, the parent isn't watching, and a stale cache could lead to a
   * charge attempt against a deauthorized connected account that fails
   * silently.
   *
   * This method makes a live `accounts.retrieve` call against Stripe and
   * applies the same gates as the cached variant, but using the
   * authoritative state. The DB flags are also re-synced opportunistically
   * so subsequent calls see fresh values without waiting for the webhook.
   *
   * Used by `PaymentIntentsService.chargeOffSession`.
   */
  async assertProviderPaymentReadyLive(providerId: string): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, stripeAccountId: true },
    })

    if (!provider) throw new NotFoundException('Provider not found')
    if (!provider.stripeAccountId) {
      throw new PreconditionFailedException({
        message:
          'This provider has not finished connecting their Stripe account and cannot accept paid bookings yet.',
        code: 'STRIPE_ACCOUNT_MISSING',
      })
    }

    let liveAccount
    try {
      liveAccount = await this.stripeService.client.accounts.retrieve(provider.stripeAccountId)
    } catch (err) {
      // Transient Stripe outage — bubble the error so the caller (typically
      // the off-session cron) can retry on the next tick rather than
      // proceeding with a stale cached flag.
      this.logger.warn(
        `assertProviderPaymentReadyLive: accounts.retrieve failed for ${provider.stripeAccountId}: ${(err as Error).message}`
      )
      throw err
    }

    if (!liveAccount.charges_enabled || !liveAccount.payouts_enabled) {
      // Refresh the cache so admin UIs / next-call paths see the new state
      // without waiting for the next account.updated webhook delivery.
      await this.prisma.provider
        .update({
          where: { id: provider.id },
          data: {
            stripeChargesEnabled: liveAccount.charges_enabled,
            stripePayoutsEnabled: liveAccount.payouts_enabled,
          },
        })
        .catch(() => {
          /* cache refresh is best-effort */
        })
      throw new PreconditionFailedException({
        message:
          'This provider is not currently able to accept payments. Their Stripe account is awaiting verification, restricted, or has been deauthorized.',
        code: 'STRIPE_CAPABILITIES_DISABLED',
        details: {
          chargesEnabled: liveAccount.charges_enabled,
          payoutsEnabled: liveAccount.payouts_enabled,
        },
      })
    }
  }

  /**
   * Marks Stripe onboarding as skipped — provider can finish later from the
   * dashboard's Stripe Account page. Frontend gates allow them to bypass the
   * onboarding wizard while this timestamp is set; completing onboarding clears it.
   */
  async skipOnboarding(providerId: string): Promise<StripeAccountStatusDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { settings: true, owner: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (provider.stripeOnboardingCompleted) {
      throw new BadRequestException('Stripe onboarding is already completed')
    }

    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data: { stripeOnboardingSkippedAt: new Date() },
      include: { settings: true, owner: true },
    })

    this.auditLog({
      action: 'skip_onboarding',
      providerId,
      stripeAccountId: provider.stripeAccountId,
    })

    return this.buildStatusDto(updated)
  }

  /**
   * Returns current Stripe account status for display.
   *
   * If the provider has a Stripe account, fetches live data (capabilities +
   * `requirements`) so the UI can surface what's blocking the account beyond
   * the cached boolean flags.
   *
   * If Stripe responds `resource_missing` — the account was deleted on Stripe's
   * side without firing a deauth webhook — we surface `hasAccount: false` and
   * scrub the cached capability flags so the UI shows a "set up payment account"
   * CTA instead of stale "your account is verified" text. We also clear the
   * stale `stripeAccountId` from the DB so subsequent calls don't re-attempt
   * the live lookup.
   *
   * If no Stripe account exists yet, returns a status DTO with `hasAccount: false`
   * — never throws — so the page can render a "set up payment account" CTA.
   */
  async getAccountStatus(providerId: string): Promise<StripeAccountStatusDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { settings: true, owner: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (!provider.stripeAccountId) {
      return this.buildStatusDto(provider)
    }

    let liveAccount: LiveStripeAccountSnapshot | null = null
    try {
      liveAccount = await this.stripeService.client.accounts.retrieve(provider.stripeAccountId)
    } catch (err) {
      const cleared = await this.scrubIfResourceMissing(providerId, err)
      if (cleared) return this.buildStatusDto(cleared)
      // Any other failure (auth, network, rate limit) is surfaced as a typed
      // error via the global filter — better than a stale-cache white lie.
      // The `throw err` after `mapStripeError` is defense-in-depth (B3): the
      // util is `: never`, but a future regression that adds a non-throwing
      // branch would otherwise fall through and silently return the cached
      // snapshot the comment above warns against.
      mapStripeError(err)
      throw err
    }

    return this.buildStatusDto(provider, liveAccount)
  }

  private buildStatusDto(
    provider: ProviderWithSettings,
    liveAccount?: LiveStripeAccountSnapshot | null
  ): StripeAccountStatusDto {
    const hasAccount = Boolean(provider.stripeAccountId)
    const requirements = liveAccount?.requirements
    const businessType = liveAccount?.business_type ?? null

    return {
      hasAccount,
      stripeAccountId: provider.stripeAccountId,
      // Prefer live values when we just fetched them — webhook sync can lag a few
      // seconds and the user staring at this page expects fresh data.
      chargesEnabled: liveAccount?.charges_enabled ?? provider.stripeChargesEnabled,
      payoutsEnabled: liveAccount?.payouts_enabled ?? provider.stripePayoutsEnabled,
      detailsSubmitted: liveAccount?.details_submitted ?? provider.stripeDetailsSubmitted,
      // Prefer the live snapshot when present — it's authoritative — falling
      // back to the webhook-synced cache when we're not making a live call.
      attentionRequired: liveAccount?.requirements
        ? (liveAccount.requirements.currently_due ?? []).length > 0 ||
          (liveAccount.requirements.past_due ?? []).length > 0
        : provider.stripeAttentionRequired,
      onboardingCompleted: provider.stripeOnboardingCompleted,
      onboardingSkippedAt: provider.stripeOnboardingSkippedAt?.toISOString() ?? null,
      currency: provider.settings?.currency ?? '',
      appFeePercentage: provider.appFeePercentage ? Number(provider.appFeePercentage) : null,
      requirementsCurrentlyDue: requirements?.currently_due ?? [],
      requirementsPastDue: requirements?.past_due ?? [],
      requirementsEventuallyDue: requirements?.eventually_due ?? [],
      disabledReason: requirements?.disabled_reason ?? null,
      businessType,
      country: liveAccount?.country ?? null,
      accountEmail: liveAccount?.email ?? null,
      accountCreatedAt: unixToIso(liveAccount?.created),
      tosAcceptedAt: unixToIso(liveAccount?.tos_acceptance?.date),
      businessProfile: liveAccount?.business_profile
        ? {
            name: liveAccount.business_profile.name ?? null,
            url: liveAccount.business_profile.url ?? null,
            supportEmail: liveAccount.business_profile.support_email ?? null,
            supportPhone: liveAccount.business_profile.support_phone ?? null,
            productDescription: liveAccount.business_profile.product_description ?? null,
            mcc: liveAccount.business_profile.mcc ?? null,
          }
        : null,
      representative:
        liveAccount?.individual && businessType === 'individual'
          ? {
              firstName: liveAccount.individual.first_name ?? null,
              lastName: liveAccount.individual.last_name ?? null,
              email: liveAccount.individual.email ?? null,
              phone: liveAccount.individual.phone ?? null,
              dateOfBirth: dobToIso(liveAccount.individual.dob),
              address: mapAddress(liveAccount.individual.address),
              verificationStatus: liveAccount.individual.verification?.status ?? null,
            }
          : null,
      company:
        liveAccount?.company && businessType !== 'individual' && businessType !== null
          ? {
              name: liveAccount.company.name ?? null,
              phone: liveAccount.company.phone ?? null,
              taxIdProvided: Boolean(liveAccount.company.tax_id_provided),
              address: mapAddress(liveAccount.company.address),
            }
          : null,
      externalAccounts: (liveAccount?.external_accounts?.data ?? []).map(ea => ({
        id: ea.id,
        type: ea.object === 'bank_account' || ea.object === 'card' ? ea.object : ('other' as const),
        bankName: ea.bank_name ?? null,
        last4: ea.last4 ?? null,
        currency: (ea.currency ?? '').toLowerCase(),
        country: ea.country ?? null,
        accountHolderName: ea.account_holder_name ?? null,
        routingNumber: ea.routing_number ?? null,
        defaultForCurrency: Boolean(ea.default_for_currency),
        status: ea.status ?? null,
      })),
      payoutSchedule: liveAccount?.settings?.payouts?.schedule
        ? {
            interval: liveAccount.settings.payouts.schedule.interval ?? null,
            delayDays:
              typeof liveAccount.settings.payouts.schedule.delay_days === 'number'
                ? liveAccount.settings.payouts.schedule.delay_days
                : null,
            weeklyAnchor: liveAccount.settings.payouts.schedule.weekly_anchor ?? null,
            monthlyAnchor: liveAccount.settings.payouts.schedule.monthly_anchor ?? null,
          }
        : null,
    }
  }

  private async withStripeErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      // `mapStripeError` is typed `: never` and always throws — but the type
      // system doesn't enforce that at the call boundary, so a future refactor
      // could accidentally turn it into a returning function and silently
      // produce `undefined` here. N3: explicit re-throw as belt-and-suspenders.
      mapStripeError(err)
      throw err
    }
  }
}
