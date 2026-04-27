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
    private readonly stripeService: StripeService
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
   * Creates (or retrieves existing) Stripe Express connected account for a provider.
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

    const systemSettings = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', defaultCommission: 10 },
      update: {},
    })

    // Type inferred from the SDK directly; see note on
    // `createAccountWithIdempotencyRotation` for why we can't import
    // `Stripe.AccountCreateParams` as a named type in this file.
    const accountParams: Parameters<InstanceType<typeof Stripe>['accounts']['create']>[0] = {
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      default_currency: currency.toLowerCase(),
      email: provider.owner.email,
      business_profile: {
        mcc: PROVIDER_MCC,
        name: provider.legalCompanyName ?? undefined,
        url: provider.website ?? undefined,
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

    const account = await this.withStripeErrors(() =>
      this.stripeService.client.accounts.create(accountParams, { idempotencyKey })
    )

    // Atomic claim: only the first concurrent caller's write succeeds. A losing
    // caller (count === 0) refetches — by which point the winning caller has
    // already populated `stripeAccountId` (with the SAME `account.id` returned
    // by Stripe's idempotency key, so the values agree).
    //
    // H10 commission-snapshot semantics: we record the platform's CURRENT
    // `defaultCommission` here ONCE. The provider's `stripeCommissionPercentage`
    // does not auto-track later changes to `systemSettings.defaultCommission`;
    // existing providers keep their original rate. The deauth webhook clears
    // this back to `null`, so a subsequent reconnect re-snapshots the (then-)
    // current default. Surface this column on the admin provider detail page
    // for auditability.
    const claim = await this.prisma.provider.updateMany({
      where: { id: providerId, stripeAccountId: null },
      data: {
        stripeAccountId: account.id,
        stripeCommissionPercentage: systemSettings.defaultCommission,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
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
        `Created Stripe account ${account.id} for provider ${providerId} ` +
          `(currency: ${currency}, commission: ${systemSettings.defaultCommission}%)`
      )
      this.auditLog({
        action: 'create_account.created',
        providerId,
        stripeAccountId: account.id,
        currency,
        commission: Number(systemSettings.defaultCommission),
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

    const accountSession = await this.withStripeErrors(() =>
      this.stripeService.client.accountSessions.create({
        account: provider.stripeAccountId!,
        components: {
          account_onboarding: {
            enabled: true,
            features: {
              external_account_collection: true,
            },
          },
        },
      })
    )

    this.logger.debug(`Created AccountSession for provider ${providerId}`)

    return { clientSecret: accountSession.client_secret }
  }

  /**
   * Creates a single-use login URL for the provider's Stripe Express dashboard.
   *
   * The URL Stripe returns is short-lived (a few minutes) and can only be used
   * once — we MUST NOT cache it. The frontend should request a fresh link every
   * time the provider clicks "Open Stripe dashboard".
   *
   * Stripe rejects login-link creation when the account hasn't submitted enough
   * details to have a usable dashboard yet; surfaced as `BadRequestException`
   * via `mapStripeError` (StripeInvalidRequestError → 400).
   */
  async createLoginLink(providerId: string): Promise<{ url: string }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    if (!provider.stripeAccountId) {
      throw new BadRequestException(
        'Stripe account has not been created yet. Complete payment setup first.'
      )
    }

    const loginLink = await this.withStripeErrors(() =>
      this.stripeService.client.accounts.createLoginLink(provider.stripeAccountId!)
    )

    this.auditLog({
      action: 'create_login_link',
      providerId,
      stripeAccountId: provider.stripeAccountId,
    })

    return { url: loginLink.url }
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

    const account = await this.withStripeErrors(() =>
      this.stripeService.client.accounts.retrieve(provider.stripeAccountId!)
    )

    const detailsSubmitted = Boolean(account.details_submitted)
    const finalized = detailsSubmitted

    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        stripeOnboardingCompleted: finalized,
        stripeOnboardingCompletedAt: finalized ? new Date() : null,
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

    return this.buildStatusDto(updated, account)
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
      if (
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.code === 'resource_missing'
      ) {
        // Stripe-side deletion without webhook delivery (rare but possible —
        // e.g., a manual platform-side delete via Stripe dashboard). Reset the
        // local cache so subsequent reads short-circuit and the UI offers a
        // fresh "set up payment account" CTA.
        this.logger.warn(
          `Stripe account ${provider.stripeAccountId} for provider ${providerId} no longer exists — clearing cached state`
        )
        const cleared = await this.prisma.provider.update({
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
            stripeCommissionPercentage: null,
          },
          include: { settings: true, owner: true },
        })
        return this.buildStatusDto(cleared)
      }
      // Any other failure (auth, network, rate limit) is surfaced as a typed
      // error via the global filter — better than a stale-cache white lie.
      mapStripeError(err)
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
      commissionPercentage: provider.stripeCommissionPercentage
        ? Number(provider.stripeCommissionPercentage)
        : null,
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
      mapStripeError(err)
    }
  }
}
