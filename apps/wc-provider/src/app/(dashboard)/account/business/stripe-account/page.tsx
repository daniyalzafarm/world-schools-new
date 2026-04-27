'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addToast, Button, Chip, Divider, Tooltip } from '@heroui/react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileCheck,
  Globe,
  Landmark,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'
import { BackButton } from '@world-schools/ui-web'
import {
  type StripeAccountStatus,
  type StripeAddress,
  type StripeBankAccount,
  type StripeBusinessProfile,
  type StripeCompanyInfo,
  stripeConnectService,
  type StripePayoutSchedule,
  type StripeRepresentative,
} from '@/services/stripe-connect.services'
import { useAuth } from '@/hooks/use-auth'
import { extractApiErrorMessage } from '@/utils/api-errors'
import { createLogger } from '@/utils/logger'

const log = createLogger('StripeAccount')

// Single source of truth for the derived account states. Iterate with
// `Object.values` if a switch ever needs an exhaustiveness check.
const ACCOUNT_STATE = {
  None: 'none',
  Pending: 'pending',
  Restricted: 'restricted',
  Attention: 'attention',
  Verified: 'verified',
} as const
type AccountState = (typeof ACCOUNT_STATE)[keyof typeof ACCOUNT_STATE]

function deriveState(status: StripeAccountStatus): AccountState {
  if (!status.hasAccount) return ACCOUNT_STATE.None
  if (status.disabledReason || status.requirementsPastDue.length > 0) {
    return ACCOUNT_STATE.Restricted
  }
  if (!status.onboardingCompleted) return ACCOUNT_STATE.Pending
  if (
    status.requirementsCurrentlyDue.length > 0 ||
    !status.chargesEnabled ||
    !status.payoutsEnabled
  ) {
    return ACCOUNT_STATE.Attention
  }
  return ACCOUNT_STATE.Verified
}

// Translate the most common Stripe requirement codes into something a non-technical
// user can act on. Anything we don't translate falls back to the raw code, which is
// still better than nothing — Stripe's strings are descriptive (e.g. "external_account").
const REQUIREMENT_LABELS: Record<string, string> = {
  external_account: 'Bank or payout account details',
  'business_profile.url': 'Business website',
  'business_profile.mcc': 'Business industry',
  'business_profile.product_description': 'Description of what you sell',
  'business_profile.support_email': 'Customer support email',
  'business_profile.support_phone': 'Customer support phone',
  'business_profile.support_address.line1': 'Customer support address',
  'business_profile.support_url': 'Customer support page',
  'individual.verification.document': 'Government-issued photo ID',
  'individual.verification.additional_document': 'Additional ID document',
  'individual.dob.day': 'Date of birth',
  'individual.dob.month': 'Date of birth',
  'individual.dob.year': 'Date of birth',
  'individual.first_name': 'Legal first name',
  'individual.last_name': 'Legal last name',
  'individual.id_number': 'National ID / SSN',
  'individual.ssn_last_4': 'SSN (last 4 digits)',
  'individual.email': 'Email address',
  'individual.phone': 'Phone number',
  'individual.address.line1': 'Address',
  'individual.address.city': 'Address (city)',
  'individual.address.state': 'Address (state)',
  'individual.address.postal_code': 'Address (postal code)',
  'individual.relationship.title': 'Your role at the business',
  'individual.political_exposure': 'Political exposure declaration',
  'company.name': 'Legal company name',
  'company.tax_id': 'Company tax ID',
  'company.verification.document': 'Company verification document',
  'company.directors_provided': 'Company director details',
  'company.executives_provided': 'Company executive details',
  'company.owners_provided': 'Company owner details',
  'company.address.line1': 'Company address',
  'company.address.city': 'Company address (city)',
  'company.address.state': 'Company address (state)',
  'company.address.postal_code': 'Company address (postal code)',
  'company.phone': 'Company phone number',
  'tos_acceptance.date': 'Acceptance of Stripe terms',
  'tos_acceptance.ip': 'Acceptance of Stripe terms',
  'settings.payouts.statement_descriptor': 'Payout statement descriptor',
}

function humanizeRequirement(code: string): string {
  if (REQUIREMENT_LABELS[code]) return REQUIREMENT_LABELS[code]
  // Strip the prefix and prettify, e.g. `individual.foo_bar` → `Foo bar`
  const tail = code.split('.').pop() ?? code
  return tail.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

function uniqueHumanRequirements(codes: string[]): string[] {
  const seen = new Set<string>()
  for (const code of codes) {
    seen.add(humanizeRequirement(code))
  }
  return Array.from(seen)
}

// Stripe's `requirements.disabled_reason` values are dotted snake_case
// identifiers (e.g. `requirements.past_due`, `rejected.fraud`). Map the ones
// we expect to see to plain English; anything we don't translate falls back
// to a prettified version of the trailing component.
//
// Reference: https://stripe.com/docs/api/accounts/object#account_object-requirements-disabled_reason
const DISABLED_REASON_LABELS: Record<string, string> = {
  'requirements.past_due': 'required information is past due',
  'requirements.pending_verification': 'Stripe is still verifying the details you submitted',
  listed: 'the account is on a regulatory watch list',
  platform_paused: 'our platform has paused this account',
  'rejected.fraud': 'rejected for suspected fraud',
  'rejected.incorrect_account_data': 'rejected because account details were incorrect',
  'rejected.listed': 'rejected — the account appears on a watch list',
  'rejected.terms_of_service': "rejected for breaching Stripe's terms of service",
  'rejected.platform_fraud': 'rejected by our platform for suspected fraud',
  'rejected.platform_terms_of_service': 'rejected by our platform for terms of service breach',
  'rejected.platform_other': 'rejected by our platform',
  'rejected.other': 'rejected by Stripe',
  under_review: 'Stripe is reviewing this account',
  other: 'an unspecified issue Stripe has flagged',
  'action_required.requested_capabilities': 'a requested capability needs more information',
}

function humanizeDisabledReason(reason: string): string {
  if (DISABLED_REASON_LABELS[reason]) return DISABLED_REASON_LABELS[reason]
  // Fallback: take the last dot-separated segment and prettify.
  // `rejected.something_new` → "Something new"
  const tail = reason.split('.').pop() ?? reason
  return tail.replace(/_/g, ' ').replace(/^./, c => c.toLowerCase())
}

/**
 * Stripe returns `past_due`, `currently_due`, and `eventually_due` as overlapping
 * sets — a past-due item is also currently due, and currently-due items are also
 * eventually due. Rendering them as-is duplicates every overdue field three
 * times in the UI. Project each requirement onto its highest-urgency bucket
 * (past > currently > eventually) so the user sees each item exactly once.
 */
function partitionRequirements(status: StripeAccountStatus) {
  const pastDue = status.requirementsPastDue
  const pastDueSet = new Set(pastDue)
  const currentlyDue = status.requirementsCurrentlyDue.filter(r => !pastDueSet.has(r))
  const currentlyDueSet = new Set(currentlyDue)
  const eventuallyDue = status.requirementsEventuallyDue.filter(
    r => !pastDueSet.has(r) && !currentlyDueSet.has(r)
  )
  return { pastDue, currentlyDue, eventuallyDue }
}

export default function StripeAccountPage() {
  const router = useRouter()
  const { isProviderAdmin } = useAuth()
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks whether the user has opened the Stripe dashboard in another tab.
  // We only auto-refresh on visibilitychange after that — refreshing every
  // time the tab regains focus would be noisy for users who just alt-tab.
  const [pendingDashboardReturn, setPendingDashboardReturn] = useState(false)
  // M9: ref-based reentrancy guard for handleOpenDashboard. Using state in the
  // dep array (the previous pattern) recreated the callback on every press,
  // defeating useCallback. A ref keeps the callback identity stable.
  const isOpeningDashboardRef = useRef(false)

  const loadAccountStatus = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const result = await stripeConnectService.getAccountStatus()
      if (result.success) {
        setAccountStatus(result.data)
      } else {
        const message =
          extractApiErrorMessage(result, "We couldn't load your Stripe account status.") ??
          "We couldn't load your Stripe account status."
        if (mode === 'refresh') {
          // Don't blow away the previously-loaded data on a transient refresh
          // failure — keep the page interactive and surface a non-blocking toast.
          addToast({
            title: 'Refresh failed',
            description: message,
            color: 'danger',
          })
        } else {
          setError(message)
        }
      }
    } catch (err) {
      log.error('Failed to load', err)
      const message = 'A network error occurred. Please check your connection and try again.'
      if (mode === 'refresh') {
        addToast({ title: 'Refresh failed', description: message, color: 'danger' })
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isProviderAdmin) {
      router.replace('/account')
      return
    }
    void loadAccountStatus()
  }, [isProviderAdmin, router, loadAccountStatus])

  // H8: When the user returns to this tab after visiting their Stripe Express
  // dashboard, auto-refresh once. We gate on `pendingDashboardReturn` so a plain
  // tab-switch (e.g. alt-tab to email) doesn't trigger redundant refetches.
  useEffect(() => {
    if (!pendingDashboardReturn) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPendingDashboardReturn(false)
        void loadAccountStatus('refresh')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pendingDashboardReturn, loadAccountStatus])

  const handleOpenDashboard = useCallback(async () => {
    if (isOpeningDashboardRef.current) return
    isOpeningDashboardRef.current = true
    setIsOpeningDashboard(true)
    try {
      const result = await stripeConnectService.createLoginLink()
      if (!result.success || !result.data?.url) {
        addToast({
          title: "Couldn't open Stripe dashboard",
          description:
            extractApiErrorMessage(
              result,
              'Try again in a moment, or finish setup if any details are still required.'
            ) ?? 'Try again in a moment, or finish setup if any details are still required.',
          color: 'danger',
        })
        return
      }
      // Single-use, short-lived URL — open in a new tab so the user keeps their place here.
      const popup = window.open(result.data.url, '_blank', 'noopener,noreferrer')
      if (!popup) {
        // Browser blocked the popup OR we're inside a sandboxed/iframe context.
        // The login link is single-use and short-lived, so we can't keep it
        // around for a "click to open" fallback — just direct the user to
        // allow popups and retry.
        addToast({
          title: 'Popup blocked',
          description:
            'Your browser blocked the new tab. Allow popups for this site and click "Open Stripe dashboard" again.',
          color: 'warning',
        })
        return
      }
      // Mark that we expect the user to come back; the visibilitychange effect
      // will then auto-refresh on return so they don't see stale status.
      setPendingDashboardReturn(true)
    } catch (err) {
      log.error('Open dashboard failed', err)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      isOpeningDashboardRef.current = false
      setIsOpeningDashboard(false)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <PageShell>
        <StripeAccountSkeleton />
      </PageShell>
    )
  }

  if (error || !accountStatus) {
    return (
      <PageShell>
        <ErrorCard
          message={error ?? 'Unknown error.'}
          onRetry={() => void loadAccountStatus('refresh')}
          isRetrying={isRefreshing}
        />
      </PageShell>
    )
  }

  const state = deriveState(accountStatus)

  // Stripe's three requirement buckets overlap (a past-due item is also
  // currently due, and currently-due items are also eventually due). Project
  // each requirement onto its highest-urgency bucket so the UI shows it once.
  const requirements = partitionRequirements(accountStatus)
  const hasAnyRequirements =
    requirements.pastDue.length > 0 ||
    requirements.currentlyDue.length > 0 ||
    requirements.eventuallyDue.length > 0

  // Only offer the dashboard button when Stripe will actually let us create a
  // login link. Stripe rejects login-link creation for accounts that haven't
  // submitted enough details yet, and there's no point offering it when the
  // account doesn't exist at all.
  const canOpenDashboard =
    accountStatus.hasAccount &&
    (accountStatus.onboardingCompleted || accountStatus.detailsSubmitted)

  return (
    <PageShell
      actions={
        canOpenDashboard ? (
          <Button
            onPress={() => void handleOpenDashboard()}
            color="primary"
            isLoading={isOpeningDashboard}
            startContent={!isOpeningDashboard ? <ExternalLink className="h-4 w-4" /> : null}
          >
            {isOpeningDashboard ? 'Opening…' : 'Open Stripe dashboard'}
          </Button>
        ) : null
      }
    >
      <StatusBanner state={state} status={accountStatus} />

      {state === ACCOUNT_STATE.None ? (
        <NoAccountCallout />
      ) : (
        <>
          {/* Overview cards — at-a-glance summary up top */}
          <OverviewCards status={accountStatus} />

          <Sections>
            {/* Account-level info — compact grid since each value is short */}
            <Section title="Stripe Connect Account">
              <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
                <GridField
                  label="Account ID"
                  hint="Your Stripe Express identifier"
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <span className="font-mono text-sm break-all">
                    {accountStatus.stripeAccountId ?? '—'}
                  </span>
                </GridField>

                <GridField label="Onboarding status">
                  <OnboardingChip status={accountStatus} />
                </GridField>

                {accountStatus.onboardingSkippedAt && !accountStatus.onboardingCompleted && (
                  <GridField label="Skipped on" hint="You can finish setup at any time">
                    {formatDate(accountStatus.onboardingSkippedAt)}
                  </GridField>
                )}

                {accountStatus.accountCreatedAt && (
                  <GridField label="Account opened">
                    {formatDate(accountStatus.accountCreatedAt)}
                  </GridField>
                )}

                {accountStatus.tosAcceptedAt && (
                  <GridField label="Stripe terms accepted">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{formatDate(accountStatus.tosAcceptedAt)}</span>
                      <Chip size="sm" color="success" variant="flat">
                        <span className="inline-flex items-center gap-1">
                          <FileCheck className="h-3 w-3" />
                          Accepted
                        </span>
                      </Chip>
                    </span>
                  </GridField>
                )}
              </dl>
            </Section>

            {/* Business profile — name, support contact, industry, website */}
            {accountStatus.businessProfile &&
              hasBusinessProfileData(accountStatus.businessProfile) && (
                <Section title="Business profile">
                  <BusinessProfileSection profile={accountStatus.businessProfile} />
                </Section>
              )}

            {/* Identity — representative for individuals or company info for companies */}
            {accountStatus.representative && (
              <Section title="Account holder">
                <RepresentativeSection rep={accountStatus.representative} />
              </Section>
            )}

            {accountStatus.company && (
              <Section title="Company information">
                <CompanySection company={accountStatus.company} />
              </Section>
            )}

            {/* Connected bank accounts / payout methods */}
            <Section title="Payout method">
              <BankAccountsSection accounts={accountStatus.externalAccounts} />
            </Section>

            {/* Payout schedule */}
            {accountStatus.payoutSchedule && (
              <Section title="Payout schedule">
                <PayoutScheduleSection schedule={accountStatus.payoutSchedule} />
              </Section>
            )}

            {/* Action items: requirements due now, past due, or eventually due —
                each requirement is shown in only its highest-urgency bucket. */}
            {hasAnyRequirements && (
              <Section title="What's needed">
                {requirements.pastDue.length > 0 && (
                  <RequirementList
                    tone="danger"
                    heading="Overdue"
                    description="Stripe has paused parts of your account until these are provided."
                    items={uniqueHumanRequirements(requirements.pastDue)}
                  />
                )}
                {requirements.currentlyDue.length > 0 && (
                  <RequirementList
                    tone="warning"
                    heading="Required now"
                    description="Provide these to keep your account fully active."
                    items={uniqueHumanRequirements(requirements.currentlyDue)}
                  />
                )}
                {requirements.eventuallyDue.length > 0 && (
                  <RequirementList
                    tone="info"
                    heading="Will be required later"
                    description="No immediate impact, but Stripe will ask for these eventually."
                    items={uniqueHumanRequirements(requirements.eventuallyDue)}
                  />
                )}
              </Section>
            )}

            {/* Capability flags — short label + chip per cell */}
            <Section title="Payment Capabilities">
              <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-3">
                <GridField
                  label="Charges"
                  hint={
                    accountStatus.chargesEnabled
                      ? 'Stripe accepts payments on your behalf.'
                      : 'Stripe is not currently accepting payments.'
                  }
                >
                  <Chip
                    size="sm"
                    color={accountStatus.chargesEnabled ? 'success' : 'danger'}
                    variant="flat"
                  >
                    {accountStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                  </Chip>
                </GridField>
                <GridField
                  label="Payouts"
                  hint={
                    accountStatus.payoutsEnabled
                      ? 'Earnings transfer to your bank.'
                      : 'Payouts to your bank are paused.'
                  }
                >
                  <Chip
                    size="sm"
                    color={accountStatus.payoutsEnabled ? 'success' : 'danger'}
                    variant="flat"
                  >
                    {accountStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                  </Chip>
                </GridField>
                <GridField
                  label="Details submitted"
                  hint={
                    accountStatus.detailsSubmitted
                      ? 'Stripe has everything it asked for so far.'
                      : 'Stripe is still expecting more info.'
                  }
                >
                  <Chip
                    size="sm"
                    color={accountStatus.detailsSubmitted ? 'success' : 'warning'}
                    variant="flat"
                  >
                    {accountStatus.detailsSubmitted ? 'Yes' : 'Not yet'}
                  </Chip>
                </GridField>
              </dl>
            </Section>

            {/* Payout details — currency + commission */}
            <Section title="Payout Details">
              <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2">
                <GridField label="Currency" hint="Set during your application — cannot be changed">
                  <span className="font-mono">
                    {accountStatus.currency ? accountStatus.currency.toUpperCase() : '—'}
                  </span>
                </GridField>
                <GridField label="Platform commission" hint="Deducted from each booking payout">
                  {accountStatus.commissionPercentage !== null
                    ? `${accountStatus.commissionPercentage}%`
                    : '—'}
                </GridField>
              </dl>
            </Section>
          </Sections>

          {/* Refresh footer */}
          <div className="mt-10 flex items-center justify-between border-t border-default-100 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Status syncs from Stripe. Changes can take a few seconds to appear.
            </p>
            <Button
              size="sm"
              variant="flat"
              startContent={
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              }
              onPress={() => void loadAccountStatus('refresh')}
              isDisabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </>
      )}
    </PageShell>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PageShell({
  children,
  actions,
}: {
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="min-h-full w-full bg-white dark:bg-gray-900">
      <div className="mb-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <BackButton href="/account" />
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Stripe Account
            </h1>
          </div>
          {actions}
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Your connected Stripe account is what we use to send your booking earnings to your bank.
        </p>
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}

/**
 * Renders children with a `<Divider />` between every visible one.
 * `React.Children.toArray` already filters out booleans/null, so conditional
 * sections (`{cond && <Section />}`) don't leave orphan dividers.
 *
 * L6: `React.Children.toArray` itself assigns each child a stable, content-
 * derived key (`.${original-key-or-index}`), so we forward THAT key onto our
 * Fragment wrapper rather than re-keying by the post-filter index. Re-keying
 * by index would break reconciliation if a conditionally-rendered Section
 * appeared/disappeared in the middle of the list.
 */
function Sections({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <>
      {items.map((item, i) => {
        const key =
          React.isValidElement(item) && item.key !== null && item.key !== undefined
            ? item.key
            : `section-${i}`
        return (
          <React.Fragment key={key}>
            {i > 0 && <Divider className="my-8" />}
            {item}
          </React.Fragment>
        )
      })}
    </>
  )
}

function GridField({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-gray-900 dark:text-gray-100">{children}</dd>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

function StatusBanner({ state, status }: { state: AccountState; status: StripeAccountStatus }) {
  if (state === ACCOUNT_STATE.None) return null

  const config = {
    verified: {
      tone: 'success' as const,
      icon: <CheckCircle2 className="h-5 w-5" />,
      title: 'Your payment account is fully active',
      description: 'You can accept bookings and receive payouts to your bank.',
      action: null,
    },
    attention: {
      tone: 'warning' as const,
      icon: <AlertTriangle className="h-5 w-5" />,
      title: !status.chargesEnabled
        ? 'Charges are paused'
        : !status.payoutsEnabled
          ? 'Payouts are paused'
          : 'A few things still needed',
      description:
        status.requirementsCurrentlyDue.length > 0
          ? 'Provide the items below to keep your account fully active.'
          : 'Capabilities are limited until Stripe finishes verifying your account.',
      action: { label: 'Update info', href: '/onboarding/stripe-connect' },
    },
    restricted: {
      tone: 'danger' as const,
      icon: <AlertCircle className="h-5 w-5" />,
      title: 'Your account is restricted',
      description: status.disabledReason
        ? `Stripe has restricted this account because ${humanizeDisabledReason(status.disabledReason)}.`
        : 'Some required information is past due — provide it to restore your account.',
      action: { label: 'Resolve', href: '/onboarding/stripe-connect' },
    },
    pending: {
      tone: 'warning' as const,
      icon: <AlertTriangle className="h-5 w-5" />,
      title: 'Finish setting up payments',
      description:
        'Your Stripe account is created but verification isn’t complete. You can’t receive payouts until you finish.',
      action: { label: 'Continue setup', href: '/onboarding/stripe-connect' },
    },
  }[state]

  const toneClasses = {
    success:
      'border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950/40',
    warning:
      'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-950/40',
    danger:
      'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950/40',
  }[config.tone]

  return (
    <div
      className={`mb-8 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${toneClasses}`}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0">{config.icon}</span>
        <div>
          <p className="font-semibold">{config.title}</p>
          <p className="mt-0.5 text-sm opacity-90">{config.description}</p>
        </div>
      </div>
      {config.action && (
        <Button
          as={Link}
          href={config.action.href}
          color={config.tone === 'danger' ? 'danger' : 'primary'}
          size="sm"
          className="shrink-0 self-start sm:self-center"
          endContent={<ArrowUpRight className="h-4 w-4" />}
        >
          {config.action.label}
        </Button>
      )}
    </div>
  )
}

// M10: matches the structural shape of the loaded page (status banner +
// 3 overview cards + dense info grid) so the layout doesn't thrash when
// the real data lands.
function StripeAccountSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-20 animate-pulse rounded-xl bg-default-100 dark:bg-gray-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-default-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-default-100 dark:bg-gray-800" />
        <div className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-default-100 dark:bg-gray-800" />
              <div className="h-5 w-32 animate-pulse rounded bg-default-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NoAccountCallout() {
  // Copy is intentionally inclusive of both first-time setup and post-deauth
  // reconnect. The account-deauthorized webhook nulls `stripeAccountId`, so a
  // returning provider hits this same callout — wording it as "not connected"
  // (rather than "not set up yet") works in both cases.
  return (
    <div className="rounded-xl border border-default-200 bg-default-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900/40">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-default-100 dark:bg-gray-800">
        <AlertTriangle className="h-5 w-5 text-default-500" />
      </div>
      <p className="font-semibold text-gray-900 dark:text-gray-100">
        Payment account not connected
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Connect your bank through Stripe so we can send you booking earnings. Setup takes about 5
        minutes — if you previously connected a Stripe account, you&apos;ll need to do this once
        more.
      </p>
      <Button
        as={Link}
        href="/onboarding/stripe-connect"
        color="primary"
        className="mt-5"
        endContent={<ArrowUpRight className="h-4 w-4" />}
      >
        Connect payment account
      </Button>
    </div>
  )
}

function OnboardingChip({ status }: { status: StripeAccountStatus }) {
  if (status.onboardingCompleted) {
    return (
      <Chip size="sm" color="success" variant="flat">
        Complete
      </Chip>
    )
  }
  if (status.onboardingSkippedAt) {
    return (
      <Chip size="sm" color="warning" variant="flat">
        Skipped
      </Chip>
    )
  }
  return (
    <Chip size="sm" color="warning" variant="flat">
      In progress
    </Chip>
  )
}

function RequirementList({
  tone,
  heading,
  description,
  items,
}: {
  tone: 'danger' | 'warning' | 'info'
  heading: string
  description: string
  items: string[]
}) {
  const toneClasses = {
    danger: 'text-danger-700 dark:text-danger-400',
    warning: 'text-warning-700 dark:text-warning-400',
    info: 'text-default-600 dark:text-default-300',
  }[tone]

  return (
    <div className="border-b border-default-100 py-4 last:border-b-0">
      <p className={`text-sm font-semibold ${toneClasses}`}>{heading}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      <ul className="mt-2 space-y-1">
        {items.map(item => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ErrorCard({
  message,
  onRetry,
  isRetrying,
}: {
  message: string
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 dark:border-danger-800 dark:bg-danger-950/40">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
        <div className="flex-1">
          <p className="font-semibold text-danger-700 dark:text-danger-400">
            Couldn&apos;t load your Stripe account
          </p>
          <p className="mt-1 text-sm text-danger-600 dark:text-danger-300">{message}</p>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            className="mt-4"
            onPress={onRetry}
            isLoading={isRetrying}
            startContent={!isRetrying ? <RefreshCw className="h-3.5 w-3.5" /> : null}
          >
            {isRetrying ? 'Retrying…' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Overview cards ──────────────────────────────────────────────────────────

function OverviewCards({ status }: { status: StripeAccountStatus }) {
  const businessTypeLabel = formatBusinessType(status.businessType)
  const accountName =
    status.businessProfile?.name ??
    status.company?.name ??
    (status.representative
      ? [status.representative.firstName, status.representative.lastName].filter(Boolean).join(' ')
      : null)
  const defaultAccount = status.externalAccounts.find(a => a.defaultForCurrency)

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard
        icon={<Building2 className="h-4 w-4" />}
        label="Business"
        value={accountName ?? businessTypeLabel ?? '—'}
        sub={accountName && businessTypeLabel ? businessTypeLabel : null}
      />
      <SummaryCard
        icon={<Globe className="h-4 w-4" />}
        label="Country"
        value={status.country ? regionDisplayName(status.country) : '—'}
        sub={status.country ? status.country.toUpperCase() : null}
      />
      <SummaryCard
        icon={<Landmark className="h-4 w-4" />}
        label="Default payout"
        value={
          defaultAccount
            ? `${defaultAccount.bankName ?? 'Bank'} •••• ${defaultAccount.last4 ?? '----'}`
            : 'None connected'
        }
        sub={defaultAccount ? defaultAccount.currency.toUpperCase() : null}
        muted={!defaultAccount}
      />
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  muted,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string | null
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border border-default-200 bg-default-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-default-500">
        <span className="text-default-400">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p
        className={`mt-2 truncate text-base font-semibold ${
          muted ? 'text-default-500' : 'text-foreground'
        }`}
        title={value}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-default-400">{sub}</p>}
    </div>
  )
}

// ── Business profile ────────────────────────────────────────────────────────

function hasBusinessProfileData(profile: StripeBusinessProfile): boolean {
  return Boolean(
    profile.name ||
    profile.url ||
    profile.supportEmail ||
    profile.supportPhone ||
    profile.productDescription ||
    profile.mcc
  )
}

function BusinessProfileSection({ profile }: { profile: StripeBusinessProfile }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
      {profile.name && <GridField label="Business name">{profile.name}</GridField>}
      {profile.url && (
        <GridField label="Website">
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-primary-600 hover:underline"
          >
            {profile.url}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </a>
        </GridField>
      )}
      {profile.mcc && (
        <GridField label="Industry" hint={`MCC ${profile.mcc}`}>
          {mccLabel(profile.mcc)}
        </GridField>
      )}
      {profile.supportEmail && (
        <GridField label="Support email">
          <a
            href={`mailto:${profile.supportEmail}`}
            className="break-all text-primary-600 hover:underline"
          >
            {profile.supportEmail}
          </a>
        </GridField>
      )}
      {profile.supportPhone && (
        <GridField label="Support phone">
          <span className="font-mono text-sm">{profile.supportPhone}</span>
        </GridField>
      )}
      {profile.productDescription && (
        <GridField label="What you sell" className="sm:col-span-2 lg:col-span-3">
          {profile.productDescription}
        </GridField>
      )}
    </dl>
  )
}

// ── Account holder (individual / sole proprietor) ──────────────────────────

function RepresentativeSection({ rep }: { rep: StripeRepresentative }) {
  const fullName = [rep.firstName, rep.lastName].filter(Boolean).join(' ')

  return (
    <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
      {fullName && (
        <GridField label="Legal name">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-default-400" />
              {fullName}
            </span>
            {rep.verificationStatus && <VerificationChip status={rep.verificationStatus} />}
          </span>
        </GridField>
      )}
      {rep.dateOfBirth && (
        <GridField label="Date of birth">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4 text-default-400" />
            {formatDate(rep.dateOfBirth)}
          </span>
        </GridField>
      )}
      {rep.email && (
        <GridField label="Email">
          <a
            href={`mailto:${rep.email}`}
            className="inline-flex items-center gap-2 break-all text-primary-600 hover:underline"
          >
            <Mail className="h-4 w-4 shrink-0 text-default-400" />
            {rep.email}
          </a>
        </GridField>
      )}
      {rep.phone && (
        <GridField label="Phone">
          <span className="inline-flex items-center gap-2 font-mono text-sm">
            <Phone className="h-4 w-4 text-default-400" />
            {rep.phone}
          </span>
        </GridField>
      )}
      {rep.address && (
        <GridField label="Address" className="sm:col-span-2">
          <span className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-default-400" />
            <span>{formatAddress(rep.address)}</span>
          </span>
        </GridField>
      )}
    </dl>
  )
}

// ── Company (company / non_profit / government_entity) ─────────────────────

function CompanySection({ company }: { company: StripeCompanyInfo }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2">
      {company.name && (
        <GridField label="Legal company name">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-default-400" />
            {company.name}
          </span>
        </GridField>
      )}
      <GridField
        label="Tax ID"
        hint={company.taxIdProvided ? 'Provided to Stripe' : 'Not provided'}
      >
        <Chip size="sm" color={company.taxIdProvided ? 'success' : 'warning'} variant="flat">
          {company.taxIdProvided ? 'On file' : 'Missing'}
        </Chip>
      </GridField>
      {company.phone && (
        <GridField label="Business phone">
          <span className="inline-flex items-center gap-2 font-mono text-sm">
            <Phone className="h-4 w-4 text-default-400" />
            {company.phone}
          </span>
        </GridField>
      )}
      {company.address && (
        <GridField label="Business address" className="sm:col-span-2">
          <span className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-default-400" />
            <span>{formatAddress(company.address)}</span>
          </span>
        </GridField>
      )}
    </dl>
  )
}

// ── Bank accounts / payout methods ─────────────────────────────────────────

function BankAccountsSection({ accounts }: { accounts: StripeBankAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-dashed border-default-200 bg-default-50/40 p-6 text-center dark:border-gray-800 dark:bg-gray-900/40">
        <CreditCard className="mx-auto mb-2 h-6 w-6 text-default-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          No payout method connected
        </p>
        <p className="mt-1 text-xs text-default-500">
          Add a bank account in Stripe to start receiving payouts.
        </p>
        <Button
          as={Link}
          href="/onboarding/stripe-connect"
          size="sm"
          color="primary"
          variant="flat"
          className="mt-4"
          endContent={<ArrowUpRight className="h-4 w-4" />}
        >
          Add bank account
        </Button>
      </div>
    )
  }

  return (
    <div className="my-3 grid gap-3">
      {accounts.map(account => (
        <BankAccountCard key={account.id} account={account} />
      ))}
    </div>
  )
}

function BankAccountCard({ account }: { account: StripeBankAccount }) {
  const isCard = account.type === 'card'
  const Icon = isCard ? CreditCard : Landmark
  const title = account.bankName ?? (isCard ? 'Debit card' : 'Bank account')
  const subtitle = account.accountHolderName

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-default-200 bg-white p-4 transition-colors hover:border-default-300 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default-100 text-secondary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            {account.last4 && (
              <span className="font-mono text-xs text-default-500">•••• {account.last4}</span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-default-500">{subtitle}</p>}
          {account.routingNumber && !isCard && (
            <p className="mt-0.5 truncate font-mono text-xs text-default-400">
              Routing •••• {account.routingNumber.slice(-4)}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Chip size="sm" variant="flat" className="font-mono uppercase">
          {account.currency}
        </Chip>
        {account.defaultForCurrency && (
          <Chip size="sm" color="success" variant="flat">
            Default
          </Chip>
        )}
        {account.status && account.status !== 'verified' && account.status !== 'new' && (
          <Tooltip content={account.status.replace(/_/g, ' ')} placement="left">
            <Chip
              size="sm"
              color={account.status === 'errored' ? 'danger' : 'warning'}
              variant="flat"
            >
              {account.status}
            </Chip>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

// ── Payout schedule ─────────────────────────────────────────────────────────

function PayoutScheduleSection({ schedule }: { schedule: StripePayoutSchedule }) {
  const intervalLabel = formatInterval(schedule)
  return (
    <dl className="grid gap-x-6 gap-y-5 py-4 sm:grid-cols-2">
      <GridField label="Frequency" hint={scheduleHint(schedule)}>
        <span className="inline-flex items-center gap-2">
          <Wallet className="h-4 w-4 text-default-400" />
          {intervalLabel}
        </span>
      </GridField>
      {schedule.delayDays !== null && (
        <GridField label="Settlement delay" hint="How long Stripe holds funds before a payout">
          {schedule.delayDays} day{schedule.delayDays === 1 ? '' : 's'}
        </GridField>
      )}
    </dl>
  )
}

function VerificationChip({ status }: { status: string }) {
  const map: Record<string, { color: 'success' | 'warning' | 'danger'; label: string }> = {
    verified: { color: 'success', label: 'Verified' },
    pending: { color: 'warning', label: 'Pending' },
    unverified: { color: 'warning', label: 'Unverified' },
  }
  const { color, label } = map[status] ?? { color: 'warning' as const, label: status }
  return (
    <Chip size="sm" color={color} variant="flat">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        {label}
      </span>
    </Chip>
  )
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // M11: guard against malformed ISO from upstream — `new Date('not-a-date')`
  // produces an Invalid Date that `toLocaleDateString` happily renders as
  // "Invalid Date" instead of throwing. Fall back to an em-dash so the UI
  // doesn't surface a confusing literal string.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatAddress(address: StripeAddress): string {
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(' '),
    address.country ? regionDisplayName(address.country) : null,
  ].filter(Boolean)
  return parts.join(', ') || '—'
}

function formatBusinessType(type: string | null): string | null {
  if (!type) return null
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatInterval(schedule: StripePayoutSchedule): string {
  switch (schedule.interval) {
    case 'manual':
      return 'Manual (you trigger payouts)'
    case 'daily':
      return 'Daily'
    case 'weekly':
      return schedule.weeklyAnchor
        ? `Weekly (every ${capitalize(schedule.weeklyAnchor)})`
        : 'Weekly'
    case 'monthly':
      return schedule.monthlyAnchor ? `Monthly (on day ${schedule.monthlyAnchor})` : 'Monthly'
    default:
      return schedule.interval ? capitalize(schedule.interval) : '—'
  }
}

function scheduleHint(schedule: StripePayoutSchedule): string | undefined {
  if (schedule.interval === 'manual') {
    return 'Funds stay in your Stripe balance until you initiate a payout.'
  }
  return undefined
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function regionDisplayName(country: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) ?? country
  } catch {
    return country
  }
}

// Tiny lookup for the MCC values most likely to appear on this platform.
// Anything else falls back to a "Code <mcc>" label so the value is still visible.
const MCC_LABELS: Record<string, string> = {
  '7032': 'Sporting and recreational camps',
  '8211': 'Schools — elementary and secondary',
  '8299': 'Educational services (other)',
  '7999': 'Recreational services',
}

function mccLabel(mcc: string): string {
  return MCC_LABELS[mcc] ?? `Code ${mcc}`
}
