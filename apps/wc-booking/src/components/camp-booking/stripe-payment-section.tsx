'use client'

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { Stripe, StripeElements, StripeElementsOptionsMode } from '@stripe/stripe-js'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { getStripeForAccount } from '@/lib/stripe'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import type { SubmitPaymentResponse } from '@/types/camp-booking'

export type StripePaymentSectionHandle = {
  /// Trigger the authorize-then-confirm flow from outside the component
  /// (e.g. a submit button rendered at the bottom of the form panel). Resolves
  /// once the flow finishes, regardless of success or error — the actual
  /// outcome is reported via `onPendingChange` and `onError`, plus the
  /// `paymentConfirmed` flag in the booking store.
  submit: () => Promise<void>
}

interface StripePaymentSectionProps {
  /// Total amount in major units (e.g. 600 for €600). Used for the deferred-mode
  /// `amount` so the PaymentElement can render method-specific UI (e.g. installment
  /// options) before the PaymentIntent is created server-side.
  amountMajor: number
  /// ISO 4217 lowercase ("eur"). Same source of truth as ProviderSettings.currency.
  currency: string
  /// Whether the booking is no-deposit-due-later (SetupIntent path) so the
  /// Element renders in `mode: 'setup'` rather than `mode: 'payment'`.
  isSetupOnly: boolean
  /// Connected provider's Stripe account id (`acct_…`). Under Direct Charges
  /// this is set on the Stripe.js instance via `loadStripe(pk, { stripeAccount })`
  /// (see `getStripeForAccount` in `@/lib/stripe`) — routing, branding, and
  /// 3DS for the PaymentIntent flow through this account. The backend creates
  /// the PaymentIntent with the matching `Stripe-Account` header.
  /// `initByCampSlug` refuses to enter the booking flow when this is missing,
  /// so it's required at this consumption site.
  stripeAccountId: string
  /// Reports the in-flight state of `submit()` so the parent's external button
  /// can render a loading spinner / disabled state.
  onPendingChange?: (pending: boolean) => void
  /// Reports the latest validation/confirmation error so the parent can render
  /// it next to its external submit button. `null` clears the error.
  onError?: (error: string | null) => void
  /// Pre-submit hook (e.g. validate the parent agreed to T&Cs). Return false
  /// to abort. Only called after `elements.submit()` succeeds.
  beforeConfirm?: () => boolean | Promise<boolean>
}

/**
 * Mounts Stripe Elements on the review-and-pay screen and drives the
 * authorize-then-confirm flow described in PAYMENT_FLOW_REFERENCE Part A.
 *
 * Flow:
 *   1. Parent enters card → Stripe.js renders the form via `<PaymentElement>`.
 *   2. Parent clicks "Authorize and submit" → we call `elements.submit()` to
 *      validate the form locally (per https://docs.stripe.com/js).
 *   3. We call our backend's `/user/booking-groups/:id/submit` → server creates
 *      the PaymentIntent (or SetupIntent) and returns the client secret.
 *   4. We call `stripe.confirmPayment` (or `confirmSetup` for the no-deposit-
 *      due-later path) with the live `elements` instance + the returned
 *      `clientSecret`.
 *   5. On success we mark `hasSubmitted` so the screen swaps to the
 *      "request submitted, awaiting provider acceptance" panel.
 *
 * This is the deferred-payment-method-creation flow per
 * https://docs.stripe.com/payments/payment-element/deferred-payment-element —
 * the canonical pattern for creating the intent only after the user
 * commits.
 */
export const StripePaymentSection = forwardRef<
  StripePaymentSectionHandle,
  StripePaymentSectionProps
>(function StripePaymentSection(props, ref) {
  const { amountMajor, currency, isSetupOnly, stripeAccountId } = props

  // Per https://docs.stripe.com/payments/payment-element/deferred-payment-element
  // — `mode`/`amount`/`currency` upfront, then `elements.submit()` →
  // server creates the intent → `stripe.confirmPayment` with the resulting
  // `clientSecret`. Do NOT set `paymentMethodCreation: 'manual'` here; that
  // option is for an entirely different flow (PM-first creation via
  // `stripe.createPaymentMethod` before any intent exists).
  //
  // CRITICAL: memoize so the options reference is stable across renders.
  // <Elements> uses options for initial config; if the reference changes
  // mid-flow Stripe.js may remount the form, which discards the data
  // queued by `elements.submit()` and prevents the subsequent
  // `confirmPayment` call from reaching Stripe at all.
  //
  // Direct Charges: the connected-account routing lives on the Stripe.js
  // instance itself (via `loadStripe(pk, { stripeAccount })` in
  // `getStripeForAccount`). No `onBehalfOf` on Elements options.
  const options = useMemo<StripeElementsOptionsMode>(
    () =>
      isSetupOnly
        ? {
            mode: 'setup',
            currency,
            // SetupIntent flow — parent saves card today, gets charged off-session
            // at `dueAt` (Phase 3 cron handles the actual charge).
            setupFutureUsage: 'off_session',
            appearance: { theme: 'stripe' },
          }
        : {
            mode: 'payment',
            amount: toStripeMinorUnits(amountMajor, currency),
            currency,
            // Manual capture: card is authorized at submit; captured at provider
            // accept. This lets us void cleanly on decline without the parent
            // ever seeing a charge.
            captureMethod: 'manual',
            // Save the PM so the off-session balance charge (Phase 3 cron) can
            // reuse it without prompting the parent again.
            setupFutureUsage: 'off_session',
            appearance: { theme: 'stripe' },
          },
    [isSetupOnly, amountMajor, currency]
  )

  // Memoize the Stripe.js promise on `stripeAccountId` so swapping providers
  // (rare — would only happen if the parent navigates back to pick a different
  // camp) cleanly re-initializes Elements against the new connected account.
  // Bumping the nonce re-creates the Stripe.js promise (via the memo dep) so the
  // "Try again" button can re-attempt the load without a full page reload.
  const [retryNonce, setRetryNonce] = useState(0)
  const stripePromise = useMemo(
    () => getStripeForAccount(stripeAccountId),
    [stripeAccountId, retryNonce]
  )

  // H5: detect "Stripe.js failed to load" up front and render a recovery
  // panel instead of a frozen Elements form. `getStripeForAccount` already
  // coerces the rejection to `null` (ad-blocker / CSP / regional outage /
  // captive-portal), but `<Elements stripe={null}>` only surfaces that via
  // a cryptic error after the user clicks "Pay". Awaiting once on mount
  // lets us swap the panel before the form is even visible. A timeout guards
  // against a promise that never settles (hung network) — without it the form
  // would spin forever.
  const [stripeLoadState, setStripeLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let cancelled = false
    setStripeLoadState('loading')
    const timeout = setTimeout(() => {
      if (!cancelled) setStripeLoadState('failed')
    }, 15000)
    stripePromise
      .then(stripe => {
        if (cancelled) return
        clearTimeout(timeout)
        setStripeLoadState(stripe ? 'ready' : 'failed')
      })
      .catch(() => {
        if (cancelled) return
        clearTimeout(timeout)
        setStripeLoadState('failed')
      })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [stripePromise])

  if (stripeLoadState === 'failed') {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-2xl border border-danger-200 bg-danger-50 p-6 text-sm text-danger-700"
      >
        <p className="font-medium">Payment form failed to load.</p>
        <p>
          This usually means an ad-blocker, browser extension, or your network is blocking
          {' js.stripe.com'}. Disable extensions / try a different browser, then refresh this page.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-danger-300 px-3 py-1 text-xs font-medium hover:bg-danger-100"
            onClick={() => {
              setStripeLoadState('loading')
              setRetryNonce(n => n + 1)
            }}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-lg border border-danger-300 px-3 py-1 text-xs font-medium hover:bg-danger-100"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <InnerForm {...props} handleRef={ref} />
    </Elements>
  )
})

function InnerForm({
  amountMajor,
  currency,
  isSetupOnly,
  onPendingChange,
  onError,
  beforeConfirm,
  stripeAccountId,
  handleRef,
}: StripePaymentSectionProps & {
  handleRef: React.ForwardedRef<StripePaymentSectionHandle>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const bookingGroupId = useCampBookingStore(state => state.bookingGroupId)
  const submitBookingGroup = useCampBookingStore(state => state.submitBookingGroup)
  const markPaymentConfirmed = useCampBookingStore(state => state.markPaymentConfirmed)
  const hasSubmitted = useCampBookingStore(state => state.hasSubmitted)
  const paymentConfirmed = useCampBookingStore(state => state.paymentConfirmed)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  useEffect(() => {
    onError?.(error)
  }, [error, onError])

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements) {
      setError('Payment form is not ready yet. Please wait a moment.')
      return
    }
    setError(null)
    setPending(true)

    try {
      // 1) Local form validation. Per docs.stripe.com/js, this MUST be called
      //    before we hit our server when using the deferred-creation flow.
      const submitResult = await elements.submit()
      if (submitResult.error) {
        setError(submitResult.error.message ?? 'Please correct the highlighted fields.')
        return
      }

      // 2) Optional pre-submit hook (e.g. T&Cs gate).
      if (beforeConfirm) {
        const ok = await beforeConfirm()
        if (!ok) return
      }

      // 3) Server creates the PaymentIntent / SetupIntent + returns clientSecret.
      //    submitBookingGroup is intentionally side-effect-free (no store
      //    mutations) so React doesn't re-render and risk remounting
      //    <Elements> between elements.submit() and confirmPayment.
      const payment = await submitBookingGroup()
      if (!payment) {
        setError('Failed to start payment. Please try again.')
        return
      }

      // 4) Confirm with Stripe. We `redirect: 'if_required'` because most
      //    flows complete without a redirect (3DS-less cards); only step-up
      //    flows redirect to the issuer's challenge URL and back to
      //    `return_url`.
      const returnUrl = buildReturnUrl(payment, bookingGroupId, stripeAccountId)
      const confirmResult = await runConfirm(stripe, elements, payment, returnUrl)
      if (confirmResult.error) {
        setError(confirmResult.error.message ?? 'Card confirmation failed. Please try again.')
        return
      }

      // 5) Server-side sync. Stripe webhook delivery is the authoritative path
      //    (per https://docs.stripe.com/connect/direct-charges?platform=
      //    web&ui=elements: "Listen for these events rather than waiting on a
      //    callback from the client. On the client, the customer could close
      //    the browser window or quit the app before the callback executes.").
      //    `syncPayment` is the dev-parity / latency-bridge call: in dev (no
      //    `stripe listen`) the webhook may never arrive; in prod the webhook
      //    is fast but not instantaneous. Race it against a short timeout so
      //    we don't hold the success UI hostage to a slow sync — but also
      //    don't flip to "confirmed" before the server has had a chance to
      //    reconcile, which is the bug B6 audit fix targets.
      //
      //    The booking-detail page that we navigate to after success can do
      //    its own state polling for the residual cases where neither the
      //    sync nor the webhook landed within `SYNC_AWAIT_TIMEOUT_MS`.
      if (bookingGroupId) {
        await raceWithTimeout(
          bookingGroupsService.syncPayment(bookingGroupId).catch(syncErr => {
            // Don't surface; webhook is authoritative. Log so dev catches
            // sync failures during local testing.
            console.warn('payments.sync_after_confirm failed:', syncErr)
          }),
          SYNC_AWAIT_TIMEOUT_MS
        )
      }

      markPaymentConfirmed()
    } catch (err) {
      setError((err as Error)?.message ?? 'Unexpected error. Please try again.')
    } finally {
      setPending(false)
    }
  }, [
    stripe,
    elements,
    submitBookingGroup,
    markPaymentConfirmed,
    beforeConfirm,
    bookingGroupId,
    stripeAccountId,
  ])

  useImperativeHandle(handleRef, () => ({ submit: handleSubmit }), [handleSubmit])

  if (hasSubmitted && paymentConfirmed) {
    // The parent ReviewStep renders its own success panel; we render nothing
    // here so the form doesn't flash back into view.
    return null
  }

  // H6 audit fix: surface what the parent is about to authorize directly
  // above the card form. The outer review step shows the same number, but at
  // the moment of card entry it needs to be adjacent so the parent isn't
  // glancing between two panels. `setupFutureUsage` is always set so the
  // saved-PM disclosure on the PaymentElement is consistent across paths.
  const authorizationSummary = isSetupOnly
    ? "We'll save this card so we can charge you on the balance due date — no charge today."
    : `Authorizing ${formatMajor(amountMajor, currency)} now. This card will also be saved for the remaining balance.`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-default-200 bg-default-50 px-4 py-3 text-sm text-default-700">
        {authorizationSummary}
      </div>
      <PaymentElement
        options={{
          layout: 'accordion',
          // `'auto'` keeps Stripe's behavior of surfacing wallets when the
          // browser/device supports them, but pins the contract against
          // future default changes.
          wallets: { applePay: 'auto', googlePay: 'auto' },
          // Show the saved-card mandate text whenever `setup_future_usage`
          // is set on the intent (deposit/full paths). Required by Stripe
          // for off-session reuse compliance; `'auto'` lets Stripe decide
          // based on the live intent so the SetupIntent path renders
          // correctly too.
          terms: { card: 'auto' },
          // Let Stripe collect billing details (including address) inside the
          // PaymentElement form. Setting `fields.billingDetails.address:
          // 'never'` would require us to pass address through
          // `confirmParams.payment_method_data.billing_details.address`,
          // which we don't have here (the parent's user-record address
          // isn't pulled into this component). Most cards require AVS
          // anyway, so collecting in-form is the right default.
        }}
      />
    </div>
  )
}

async function runConfirm(
  stripe: Stripe,
  elements: StripeElements,
  payment: SubmitPaymentResponse,
  returnUrl: string
) {
  if (payment.intentType === 'setup_intent') {
    return stripe.confirmSetup({
      elements,
      clientSecret: payment.clientSecret,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })
  }
  return stripe.confirmPayment({
    elements,
    clientSecret: payment.clientSecret,
    confirmParams: { return_url: returnUrl },
    redirect: 'if_required',
  })
}

/**
 * Where Stripe redirects the parent after a 3DS challenge. The route is
 * `/payment/authorize` which polls the backend for terminal status and shows
 * an inline success/failure state. Phase 3 reuses this route for off-session
 * step-up flows triggered by the balance-charge cron.
 *
 * `booking_group_id` is included so the return page can call `syncPayment` to
 * reconcile our local Payment row with Stripe before navigating onward — the
 * inline (no-3DS) success path does the same in `handleSubmit` above. When the
 * caller is the off-session recovery email flow (no booking-group context),
 * this param is omitted and the return page's sync step is skipped.
 */
function buildReturnUrl(
  payment: SubmitPaymentResponse,
  bookingGroupId: string | null,
  stripeAccountId: string
): string {
  if (typeof window === 'undefined') return '/payment/authorize'
  const params = new URLSearchParams({
    payment_id: payment.paymentId,
    intent_type: payment.intentType,
    // Direct Charges: the return page needs the connected account to
    // initialize Stripe.js for `retrievePaymentIntent`/`handleNextAction`.
    stripe_account: stripeAccountId,
  })
  if (bookingGroupId) params.set('booking_group_id', bookingGroupId)
  return `${window.location.origin}/payment/authorize?${params.toString()}`
}

/**
 * B6 audit fix: cap on how long the deferred-flow's post-confirm
 * `syncPayment` call may take before we flip the success UI. 5s is generous
 * enough for normal RTT + DB writes but small enough that a sync hiccup
 * doesn't strand the user staring at a spinner. After the timeout the
 * webhook continues to reconcile in the background, and the booking-detail
 * page can poll if it lands before the webhook commits.
 */
const SYNC_AWAIT_TIMEOUT_MS = 5_000

function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>(resolve => {
      const handle = setTimeout(() => resolve(undefined), ms)
      // Best-effort: if the promise resolves first, leave the timer alone —
      // it's a no-op. Avoids a leaked clearTimeout reference path.
      void promise.finally(() => clearTimeout(handle))
    }),
  ])
}

/**
 * Mirror of `toStripeMinorUnits` from the backend `money.util.ts` — kept
 * inline because it's a single-call site and we want to avoid pulling
 * Prisma.Decimal into the frontend bundle. Handles the same currency
 * minor-unit table.
 */
function toStripeMinorUnits(amount: number, currency: string): number {
  const lower = currency.toLowerCase()
  const zeroDecimal = new Set([
    'bif',
    'clp',
    'djf',
    'gnf',
    'jpy',
    'kmf',
    'krw',
    'mga',
    'pyg',
    'rwf',
    'ugx',
    'vnd',
    'vuv',
    'xaf',
    'xof',
    'xpf',
  ])
  const threeDecimal = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd'])
  const factor = zeroDecimal.has(lower) ? 1 : threeDecimal.has(lower) ? 1000 : 100
  // Round half-up to avoid IEEE754 drift on values like 19.99 * 100.
  return Math.round(amount * factor)
}

/**
 * H6 audit fix: render a major-unit amount in the camp's settlement
 * currency. Pinned to `en-US` locale (matching the app shell at
 * `apps/wc-booking/src/app/layout.tsx`) so the thousands/decimal
 * separators stay consistent across the booking flow regardless of the
 * parent's browser locale. Falls back to a `${amount} ${CCY}` string
 * when `Intl.NumberFormat` rejects the currency code (which it shouldn't
 * for any of our supported ISO 4217 codes, but a misconfigured provider
 * shouldn't break the payment form).
 */
function formatMajor(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  } catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}
