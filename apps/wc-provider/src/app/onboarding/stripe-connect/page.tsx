'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button, Spinner } from '@heroui/react'
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { AlertCircle, Clock, Lock, Percent, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { canAccessStripeConnect, getNextAccessibleStep } from '../../../utils/onboarding-access'
import {
  type StripeAccountStatus,
  stripeConnectService,
} from '../../../services/stripe-connect.services'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { extractApiErrorMessage } from '../../../utils/api-errors'
import { createLogger } from '../../../utils/logger'
import config from '../../../config/config'

const log = createLogger('StripeConnect')

// Stripe's `appearance.variables` API requires raw hex colors, so we can't
// pass a Tailwind class. Pin the brand teal here in one place so theme tweaks
// propagate to the embedded component along with the rest of the UI.
// Mirrors `theme.colors.teal[600]` (#0D9488) — keep them in sync if either changes.
const STRIPE_BRAND_PRIMARY = '#0D9488'

// A Stripe account is fully payment-ready only when onboarding is finalized,
// both capabilities are enabled, and Stripe has no outstanding requirements.
function isPaymentReady(status: StripeAccountStatus): boolean {
  return (
    status.onboardingCompleted &&
    status.chargesEnabled &&
    status.payoutsEnabled &&
    status.requirementsCurrentlyDue.length === 0 &&
    status.requirementsPastDue.length === 0
  )
}

export default function StripeConnectPage() {
  const router = useRouter()
  const { status, fetchStatus } = useOnboardingStore()

  const [isInitializing, setIsInitializing] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [providerCurrency, setProviderCurrency] = useState<string | null>(null)
  const [liveAccountStatus, setLiveAccountStatus] = useState<StripeAccountStatus | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  // Set when the one-shot init fails so we can render an actionable error card
  // (with the actual cause + a retry button) instead of leaving the user with
  // a transient toast and an opaque generic fallback.
  const [initError, setInitError] = useState<string | null>(null)
  // Bumped by the Retry button to drive a fresh init pass.
  const [initAttempt, setInitAttempt] = useState(0)
  const [stripeConnectInstance, setStripeConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null)
  // Lifetime mount guard. Flipped to false on real unmount only — never on
  // re-runs of the init effect — so an in-flight async init can always finalize
  // its `setIsInitializing(false)` call even if `status` updated mid-flight.
  // The earlier "let cancelled = false" pattern wired into the effect cleanup
  // was buggy: the cleanup runs on every re-render, leaving the in-flight
  // promise to skip its finally and lock the spinner forever.
  const isMountedRef = useRef(true)
  // Each init pass bumps this. The async IIFE captures its own version and
  // only commits results to state if it's still the current version. Solves
  // two races at once: (a) parallel inits when `status` changes mid-flight,
  // (b) Retry interrupting a still-pending init — the older promise's late
  // arrival can't overwrite the new state.
  const initVersionRef = useRef(0)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Route protection: only approved providers can access this step
  useEffect(() => {
    if (status && !canAccessStripeConnect(status)) {
      router.push(getNextAccessibleStep(status))
    }
  }, [status, router])

  // Initialize Stripe Connect and ensure the Stripe account exists.
  //
  // H1/H2: redirect to /dashboard ONLY when the account is fully payment-ready
  // (onboarding finalized + capabilities enabled + no open requirements). A
  // provider whose verification is mid-review or paused stays on the wizard so
  // Stripe's embedded component can show what's missing.
  //
  // The effect re-runs on Retry (initAttempt bump) and on first mount; we no
  // longer guard with hasInitializedRef because the access guard above already
  // gates entry, and `setStripeConnectInstance` is itself idempotent — a stale
  // instance is just garbage-collected.
  // Distill `status` to a boolean — Zustand returns a fresh status object on
  // every store update, so depending on `status` directly would re-run the
  // init effect on EVERY store mutation (including unrelated fields). Boolean
  // primitives only flip when the access decision actually changes.
  const canRunInit = !!(status && canAccessStripeConnect(status))

  useEffect(() => {
    if (!canRunInit) return
    // If a prior init attempt already produced an instance, don't redo the
    // whole dance. (Retry path bumps `initAttempt` AND nulls the instance,
    // so this guard lets it through.)
    if (stripeConnectInstance) return

    initVersionRef.current += 1
    const myVersion = initVersionRef.current
    const isCurrent = () => isMountedRef.current && initVersionRef.current === myVersion

    setIsInitializing(true)
    setInitError(null)

    void (async () => {
      try {
        const accountResult = await stripeConnectService.createOrGetAccount()
        if (!isCurrent()) return

        if (!accountResult.success) {
          const msg =
            extractApiErrorMessage(accountResult, 'Failed to initialize Stripe account.') ??
            'Failed to initialize Stripe account.'
          // Persist the cause AND surface a toast — the card's retry path is
          // the more durable affordance for retryable failures (5xx etc.).
          setInitError(msg)
          addToast({ title: 'Setup error', description: msg, color: 'danger' })
          return
        }

        const live = accountResult.data
        setLiveAccountStatus(live)
        if (live.currency) setProviderCurrency(live.currency.toUpperCase())

        if (isPaymentReady(live)) {
          router.push('/dashboard')
          return
        }

        const instance = loadConnectAndInitialize({
          publishableKey: config.stripe.publishableKey,
          fetchClientSecret: async () => {
            const result = await stripeConnectService.createAccountSession()
            if (!result.success || !result.data?.clientSecret) {
              const message =
                extractApiErrorMessage(result, 'Failed to create account session') ??
                'Failed to create account session'
              // Surface to the user; Stripe's iframe shows a generic error
              // otherwise, leaving the user with no explanation.
              if (isMountedRef.current) setSessionError(message)
              throw new Error(message)
            }
            if (isMountedRef.current) setSessionError(null)
            return result.data.clientSecret
          },
          locale: 'en',
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: STRIPE_BRAND_PRIMARY,
            },
          },
        })

        if (!isCurrent()) return
        setStripeConnectInstance(instance)
      } catch (err) {
        if (!isCurrent()) return
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Failed to load payment setup. Please retry, or refresh the page.'
        setInitError(msg)
        addToast({ title: 'Setup error', description: msg, color: 'danger' })
        log.error('Initialization error', err)
      } finally {
        // Always settles for the current generation. The previous `cancelled`-
        // flag pattern skipped this on any re-render, leaving the user
        // staring at the "Loading payment setup…" spinner forever on any
        // 5xx from `/provider/stripe-connect/account`.
        if (isCurrent()) setIsInitializing(false)
      }
    })()
  }, [canRunInit, router, initAttempt, stripeConnectInstance])

  const handleRetryInit = () => {
    setStripeConnectInstance(null)
    setInitAttempt(n => n + 1)
  }

  const handleExit = async () => {
    if (isCompleting) return
    setIsCompleting(true)

    try {
      const result = await stripeConnectService.completeOnboarding()
      if (!result.success) {
        addToast({
          title: 'Error',
          description:
            extractApiErrorMessage(result, 'Failed to complete payment setup.') ??
            'Failed to complete payment setup.',
          color: 'danger',
        })
        return
      }

      // Stripe fires onExit for both "Done" and "Save and exit". The backend
      // returns the live status; route based on that rather than assuming
      // success === finished.
      const live = result.data
      setLiveAccountStatus(live)

      // Refresh the global onboarding store so other surfaces see the change.
      await fetchStatus()

      if (live.onboardingCompleted) {
        addToast({
          title: 'Payment setup complete',
          description: isPaymentReady(live)
            ? 'Your account is ready to accept bookings.'
            : 'Stripe is finishing verification — we will notify you when charges are enabled.',
          color: 'success',
        })
        router.push('/dashboard')
      } else {
        addToast({
          title: 'Saved your progress',
          description:
            'You exited before submitting all details. Resume anytime from Account → Stripe Account.',
          color: 'warning',
        })
        router.push('/dashboard')
      }
    } catch (err) {
      log.error('Complete error', err)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsCompleting(false)
    }
  }

  const handleSkip = async () => {
    if (isSkipping || isCompleting) return
    setIsSkipping(true)

    try {
      const result = await stripeConnectService.skipOnboarding()
      if (!result.success) {
        addToast({
          title: 'Could not skip',
          description:
            extractApiErrorMessage(result, 'Please try again in a moment.') ??
            'Please try again in a moment.',
          color: 'danger',
        })
        return
      }

      await fetchStatus()
      addToast({
        title: 'Saved for later',
        description:
          'Finish setting up payments anytime from your dashboard — you can reopen this directly from Account → Stripe Account.',
        color: 'success',
      })
      router.push('/dashboard')
    } catch (err) {
      log.error('Skip error', err)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsSkipping(false)
    }
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const commissionPercent =
    status.stripeCommissionPercentage !== null && status.stripeCommissionPercentage !== undefined
      ? String(status.stripeCommissionPercentage)
      : null

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Payment Setup"
      showAutoSave={false}
      showTrustScore={false}
    >
      <div className="space-y-8 pb-12">
        {/* Section Header */}
        <div>
          <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">Payment Setup</h1>
          <p className="text-sm text-default-500">
            Connect your bank account so we can pay out booking earnings to you. You can complete
            this now or skip and come back later from your account settings.
          </p>
          {status.stripeOnboardingSkippedAt && !liveAccountStatus?.onboardingCompleted && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-default-200 bg-default-50 px-3 py-1.5 text-xs text-default-600">
              <Clock className="h-3.5 w-3.5" />
              You skipped this step earlier — finish it whenever you're ready.
            </div>
          )}

          {/* Verification-pending notice — shown when the user has finished
              submitting details but Stripe hasn't fully enabled the account.
              Without this, returning here looks like a regression. */}
          {liveAccountStatus?.onboardingCompleted &&
            !isPaymentReady(liveAccountStatus) &&
            (liveAccountStatus.requirementsPastDue.length > 0 ? (
              <div className="mt-3 inline-flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Stripe has paused parts of your account — please update the items it requests
                  below to restore charges and payouts.
                </span>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Stripe is still verifying your account. You can update info below if anything
                  needs attention; otherwise we&apos;ll notify you once charges are enabled.
                </span>
              </div>
            ))}
        </div>

        {/* Info cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            icon={<Wallet className="h-4 w-4" />}
            label="Payout currency"
            value={providerCurrency ?? '—'}
            footnote={
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Set during your application — cannot be changed
              </span>
            }
          />

          {commissionPercent !== null && (
            <MetricCard
              icon={<Percent className="h-4 w-4" />}
              label="Platform commission"
              value={`${commissionPercent}%`}
              footnote="Deducted from each booking payout"
            />
          )}
        </div>

        {/* Account verification */}
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Account verification</h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-default-500">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Secured by Stripe
            </span>
          </div>

          {isInitializing ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-default-200 bg-default-50/50">
              <Spinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Loading payment setup…</p>
                <p className="mt-1 text-xs text-default-500">
                  Setting up your secure connection to Stripe
                </p>
              </div>
            </div>
          ) : stripeConnectInstance ? (
            <div className="space-y-3">
              {sessionError && (
                <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Couldn&apos;t connect to Stripe</p>
                    <p className="mt-0.5 text-xs">
                      {sessionError} If this persists, refresh the page or contact support.
                    </p>
                  </div>
                </div>
              )}
              {/* L5: Stripe's embedded component renders inside an iframe we
                  cannot decorate directly, so we annotate the wrapping region
                  for screen readers instead. */}
              <div
                role="region"
                aria-label="Stripe payment account verification"
                className="rounded-xl border border-default-200 bg-white p-2 shadow-sm sm:p-4"
              >
                <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                  <ConnectAccountOnboarding
                    onExit={() => void handleExit()}
                    onLoadError={({ error }) => {
                      log.error('Embedded onboarding load error', error)
                      setSessionError(error.message ?? 'Failed to load Stripe onboarding.')
                    }}
                  />
                </ConnectComponentsProvider>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-danger-200 bg-danger-50 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-danger" />
              <div className="max-w-md">
                <p className="font-semibold text-danger-700">Failed to load payment setup</p>
                <p className="mt-1 text-sm text-danger-600">
                  {initError ??
                    'Please retry or refresh the page. If this persists, contact support.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetryInit}
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-default-400">
            We never see or store your bank details. Stripe handles identity and bank verification
            on our behalf.
          </p>

          {/* Skip-for-now affordance — visible even if the embedded component
              failed to load, so the user always has an escape hatch. Hidden only
              while we're actively initializing or finalizing. */}
          {!isInitializing && !isCompleting && (
            <div className="mt-6 flex flex-col items-start gap-1 border-t border-default-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-default-500">
                Need to come back to this? You can finish setup anytime from{' '}
                <span className="font-medium text-foreground">Account → Stripe Account</span> in
                your dashboard.
              </p>
              <Button
                variant="bordered"
                color="secondary"
                size="sm"
                onPress={() => void handleSkip()}
                disabled={isSkipping}
              >
                {isSkipping ? 'Saving…' : 'Skip for now'}
              </Button>
            </div>
          )}
        </section>

        {isCompleting && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-lg bg-default-50 py-3 text-sm text-default-600"
          >
            <Spinner size="sm" />
            <span>Finalizing your payment setup…</span>
          </div>
        )}
      </div>
    </OnboardingPageLayout>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  footnote: React.ReactNode
}

function MetricCard({ icon, label, value, footnote }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-default-200 bg-default-50 p-5">
      <div className="flex items-center gap-2 text-default-500">
        <span className="text-default-400">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-default-400">{footnote}</p>
    </div>
  )
}
