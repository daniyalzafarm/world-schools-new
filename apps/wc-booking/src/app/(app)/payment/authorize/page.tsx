'use client'

import { Button, Spinner } from '@heroui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getStripeForAccount } from '@/lib/stripe'
import { bookingGroupsService } from '@/services/booking-groups.services'

type PageStatus = 'loading' | 'succeeded' | 'failed' | 'requires_action'

// Status strings that map to our `'succeeded'` page state. Mirrors the success
// branch of `resolveStatus` below — kept in lockstep so the post-resolve sync
// fires for the same conditions that show the success UI.
const SUCCESS_STATUSES: ReadonlySet<string> = new Set([
  'succeeded',
  'requires_capture',
  'processing',
])

// B1 audit fix: how long to wait on the post-3DS `syncPayment` reconciliation
// before redirecting. Stripe official guidance treats webhooks as the source
// of truth — so we're racing the (faster) sync call against an upper bound,
// not blocking on it. After the timeout we still redirect, but we surface a
// "we're confirming your booking" hint on the destination page rather than
// auto-jumping with potentially-stale state.
const SYNC_TIMEOUT_MS = 8_000
// Hard cap on how long the success panel sits before redirecting once sync
// has settled (or timed out). Keeps the original "user sees confirmation"
// pause without stranding the redirect on a slow sync.
const POST_SYNC_REDIRECT_DELAY_MS = 1_500

/**
 * 3DS / step-up landing + recovery page.
 *
 * Two paths arrive here:
 *   1. **Inline 3DS return** (Phase 2): Stripe redirects the parent after
 *      they complete a 3DS challenge triggered from the booking flow's
 *      `confirmPayment`. The URL carries `payment_intent` +
 *      `payment_intent_client_secret` (or the SetupIntent equivalents).
 *      We retrieve the live intent and surface the outcome.
 *   2. **Off-session recovery** (Phase 3): the balance-charge cron tried to
 *      charge the parent's saved card, Stripe returned `requires_action`
 *      because the issuer demands a fresh 3DS challenge. We email the
 *      parent a link to this same page with `payment_intent_client_secret`
 *      pre-filled. On retrieval we see status=`requires_action` and render
 *      a "Verify card" button. Pressing it calls `stripe.handleNextAction`
 *      which drives the issuer challenge and returns here with
 *      `redirect_status=succeeded` (or back to `requires_payment_method` on
 *      a hard decline). `handleNextAction` is the canonical Stripe.js call
 *      for already-attached PaymentMethods — no `<Elements>` re-mount is
 *      needed because the PM is already bound to the intent.
 */
export default function PaymentAuthorizePage() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  // B1 audit fix: track whether the post-success `syncPayment` actually
  // completed (vs. timed out). Drives the badge on the success panel so the
  // parent knows whether to expect a fresh state on /bookings or whether
  // the webhook is still catching up.
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'timed_out'>('pending')
  const piSecretRef = useRef<string | null>(null)
  const siSecretRef = useRef<string | null>(null)
  // Captured on first resolve so `handleVerify` can re-initialize the same
  // per-account Stripe.js instance (the cache in `getStripeForAccount` keeps
  // this lookup cheap).
  const stripeAccountRef = useRef<string | null>(null)

  const resolveStatus = useCallback(
    async (
      stripeStatus: string,
      onRequiresAction: () => void,
      setOutcome: (s: PageStatus) => void,
      setOutcomeMessage: (m: string | null) => void
    ) => {
      switch (stripeStatus) {
        case 'succeeded':
        case 'requires_capture':
        case 'processing':
          setOutcome('succeeded')
          return
        case 'requires_action':
          setOutcome('requires_action')
          setOutcomeMessage(null)
          onRequiresAction()
          return
        case 'requires_payment_method':
          setOutcome('failed')
          setOutcomeMessage('Your card was declined. Please use a different payment method.')
          return
        case 'canceled':
          setOutcome('failed')
          setOutcomeMessage('This payment was canceled. Please return to your bookings.')
          return
        default:
          setOutcome('failed')
          setOutcomeMessage(`Unexpected payment status: ${stripeStatus}`)
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      // Direct Charges: the intent lives on the connected (provider) account,
      // so Stripe.js must be initialized with `stripeAccount` to look it up.
      // Both the booking-flow return URL (`buildReturnUrl`) and the off-
      // session recovery email link carry `stripe_account` in the query.
      const stripeAccountId = params.get('stripe_account')
      if (!stripeAccountId) {
        // H4: surface the actual cause so a parent (or support) knows the
        // recovery link is malformed rather than just "something failed".
        // The "Return to bookings" CTA in the failure panel gives them a
        // way back to a working surface — the booking-detail page surfaces
        // the live Payment status and can re-mint a fresh 3DS link from
        // the off-session recovery cron on the next pickup.
        setStatus('failed')
        setMessage(
          'This payment-verification link is missing the connected-account reference and ' +
            'we can’t verify your card from it. Return to your bookings and try the payment ' +
            'again — if this keeps happening, contact support.'
        )
        return
      }
      stripeAccountRef.current = stripeAccountId
      const stripe = await getStripeForAccount(stripeAccountId)
      if (!stripe) {
        setStatus('failed')
        setMessage('Payments are not configured for this environment.')
        return
      }

      const piSecret = params.get('payment_intent_client_secret')
      const siSecret = params.get('setup_intent_client_secret')
      // Booking-flow path includes `booking_group_id` so we can reconcile the
      // local Payment row with Stripe before the auto-redirect to /bookings.
      // Off-session recovery emails omit it; sync is best-effort and skipped
      // when absent (the next webhook delivery will reconcile naturally).
      const bookingGroupId = params.get('booking_group_id')
      piSecretRef.current = piSecret
      siSecretRef.current = siSecret

      try {
        if (piSecret) {
          const { paymentIntent, error } = await stripe.retrievePaymentIntent(piSecret)
          if (cancelled) return
          if (error) {
            setStatus('failed')
            setMessage(error.message ?? 'Card verification failed.')
            return
          }
          if (!paymentIntent) {
            setStatus('failed')
            setMessage('Could not look up payment status.')
            return
          }
          await resolveStatus(paymentIntent.status, () => undefined, setStatus, setMessage)
          if (cancelled) return
          if (bookingGroupId && SUCCESS_STATUSES.has(paymentIntent.status)) {
            await runPostSuccessSync(bookingGroupId, setSyncStatus, () => cancelled)
          }
          return
        }
        if (siSecret) {
          const { setupIntent, error } = await stripe.retrieveSetupIntent(siSecret)
          if (cancelled) return
          if (error) {
            setStatus('failed')
            setMessage(error.message ?? 'Card verification failed.')
            return
          }
          if (!setupIntent) {
            setStatus('failed')
            setMessage('Could not look up setup status.')
            return
          }
          await resolveStatus(setupIntent.status, () => undefined, setStatus, setMessage)
          if (cancelled) return
          if (bookingGroupId && SUCCESS_STATUSES.has(setupIntent.status)) {
            await runPostSuccessSync(bookingGroupId, setSyncStatus, () => cancelled)
          }
          return
        }
        setStatus('failed')
        setMessage('Missing payment reference. Please return to your bookings.')
      } catch (err) {
        if (!cancelled) {
          setStatus('failed')
          setMessage((err as Error)?.message ?? 'Unexpected error.')
        }
      }
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [params, resolveStatus])

  // B1 audit fix: redirect on success only AFTER the post-success sync has
  // either committed or timed out. Waiting on the sync (with a hard
  // `SYNC_TIMEOUT_MS` cap) means the booking-detail page the parent lands on
  // sees fresh data instead of racing the webhook. The
  // `POST_SYNC_REDIRECT_DELAY_MS` is the legacy "let the user read the
  // confirmation" pause — kept so the success state is visible.
  useEffect(() => {
    if (status !== 'succeeded') return
    if (syncStatus === 'pending') return
    const handle = window.setTimeout(() => {
      router.push('/bookings?submitted=1')
    }, POST_SYNC_REDIRECT_DELAY_MS)
    return () => window.clearTimeout(handle)
  }, [status, syncStatus, router])

  // Drive the 3DS challenge for the off-session recovery path. The PM is
  // already attached to the intent (the cron used the parent's saved card),
  // so we don't need to mount <Elements> — `handleNextAction` walks the
  // parent through the issuer flow and returns/redirects with the outcome.
  // We deliberately keep all transient state local (no Zustand writes) so
  // a parent-tree re-render can never remount Stripe.js mid-flow — the same
  // hazard that bit the Phase 2 booking submit path.
  const handleVerify = useCallback(async () => {
    const stripeAccountId = stripeAccountRef.current
    if (!stripeAccountId) {
      setStatus('failed')
      setMessage('Missing payment reference. Please return to your bookings.')
      return
    }
    const stripe = await getStripeForAccount(stripeAccountId)
    if (!stripe) return
    const clientSecret = piSecretRef.current ?? siSecretRef.current
    if (!clientSecret) {
      setStatus('failed')
      setMessage('Missing payment reference. Please return to your bookings.')
      return
    }
    setVerifying(true)
    setMessage(null)
    try {
      const result = await stripe.handleNextAction({ clientSecret })
      if (result.error) {
        setStatus('failed')
        setMessage(result.error.message ?? 'Verification failed. Please try a different card.')
        return
      }
      // Either `paymentIntent` or `setupIntent` is populated depending on
      // which secret was provided. Both expose `.status`.
      const intent =
        'paymentIntent' in result
          ? result.paymentIntent
          : 'setupIntent' in result
            ? (result as { setupIntent?: { status: string } }).setupIntent
            : undefined
      if (!intent) {
        // Most browsers redirect to the issuer's challenge and back, so
        // returning without `paymentIntent`/`setupIntent` typically means
        // we're mid-redirect. Stay in `loading`-style state.
        return
      }
      await resolveStatus(intent.status, () => undefined, setStatus, setMessage)
    } catch (err) {
      setStatus('failed')
      setMessage((err as Error)?.message ?? 'Unexpected error during verification.')
    } finally {
      setVerifying(false)
    }
  }, [resolveStatus])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-default-200 bg-white p-8 text-center shadow-sm">
        {status === 'loading' ? (
          <>
            <Spinner color="primary" />
            <p className="text-sm text-default-500">Verifying your card with Stripe…</p>
          </>
        ) : status === 'succeeded' ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Payment confirmed</h1>
            {/* H7 audit fix: by this point Stripe has returned `succeeded` /
                `requires_capture` / `processing` on the intent — the payment
                IS confirmed regardless of how long our internal sync takes.
                Copy must affirm that, not leave the parent guessing whether
                their card went through. */}
            <p className="text-sm text-default-500">
              {syncStatus === 'pending'
                ? 'Your payment is confirmed. Finalizing your booking…'
                : syncStatus === 'timed_out'
                  ? 'Your payment is confirmed. Your bookings page will refresh shortly.'
                  : 'Your payment is confirmed. Redirecting you to your bookings…'}
            </p>
          </>
        ) : status === 'requires_action' ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Verify your card</h1>
            <p className="text-sm text-default-500">
              {message ??
                "Your bank wants to confirm this payment with you. Click below to complete verification — you'll be sent to your bank's site for a moment."}
            </p>
            <Button color="primary" className="w-full" isLoading={verifying} onPress={handleVerify}>
              Verify card
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-danger">Card verification failed</h1>
            <p className="text-sm text-default-500">
              {message ??
                'Your card could not be verified. You can try a different card on your booking.'}
            </p>
            {/* H3 audit fix: high-friction "Return to bookings" forced the
                parent to find their booking manually. When we have the
                booking-group id from the return URL, deep-link straight
                back to the booking detail page so the retry flow is one
                click away. Fall back to the bookings list when the URL
                lacks the id (off-session recovery emails). */}
            <Button
              color="primary"
              className="w-full"
              onPress={() => {
                const bgId = params.get('booking_group_id')
                router.push(bgId ? `/bookings/${bgId}` : '/bookings')
              }}
            >
              {params.get('booking_group_id') ? 'Try a different card' : 'Return to bookings'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * B1 audit fix — runs `bookingGroupsService.syncPayment` post-3DS-return
 * with a hard `SYNC_TIMEOUT_MS` ceiling and reports the outcome via
 * `setSyncStatus`. Stripe's direct-charges spec is explicit that the
 * webhook is the authoritative path; this call is the dev-parity / latency
 * bridge so the booking-detail page the parent navigates to next sees
 * fresh state instead of racing the webhook.
 *
 * On timeout: sets `syncStatus = 'timed_out'`, the success panel surfaces
 * a "still confirming" hint, and the auto-redirect still fires (the
 * webhook will catch up shortly).
 *
 * On error: same as timeout — webhook is authoritative, we don't surface
 * the failure to the user beyond the "still confirming" hint.
 */
async function runPostSuccessSync(
  bookingGroupId: string,
  setSyncStatus: (s: 'pending' | 'synced' | 'timed_out') => void,
  isCancelled: () => boolean
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<'timed_out'>(resolve => {
    timeoutHandle = setTimeout(() => resolve('timed_out'), SYNC_TIMEOUT_MS)
  })
  const syncPromise = bookingGroupsService
    .syncPayment(bookingGroupId)
    .then(() => 'synced' as const)
    .catch(syncErr => {
      console.warn('payments.sync_after_3ds_return failed:', syncErr)
      return 'timed_out' as const
    })

  const outcome = await Promise.race([syncPromise, timeoutPromise])
  if (timeoutHandle) clearTimeout(timeoutHandle)
  if (isCancelled()) return
  setSyncStatus(outcome)
}
