'use client'

import { useEffect, useRef, useState } from 'react'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { stripeConnectService } from '../services/stripe-connect.services'
import { extractApiErrorMessage } from '../utils/api-errors'
import { createLogger } from '../utils/logger'
import config from '../config/config'

const log = createLogger('useStripeConnect')

// Shared with the onboarding page so theme tweaks propagate across every
// embedded surface in one place. Mirrors theme.colors.teal[600] (#0D9488).
export const STRIPE_BRAND_PRIMARY = '#0D9488'

/**
 * Shared appearance overrides for every embedded Stripe Connect surface in
 * wc-provider. Centralized so the onboarding wizard, the notification banner,
 * and the account-management editor all render with the same look — visual
 * cohesion is part of "production-ready" per Stripe's embedded UI guidance.
 *
 * Stripe's appearance API only accepts raw hex colors and a small whitelist of
 * font tokens, so we can't reuse Tailwind variables directly. Keep these
 * values aligned with the host theme by hand (mirrors `theme.colors.teal[600]`,
 * `colors.gray[900]`, default Inter stack, and an 8 px radius matching HeroUI's
 * default `rounded-md`).
 */
export const STRIPE_CONNECT_APPEARANCE = {
  overlays: 'dialog' as const,
  variables: {
    colorPrimary: STRIPE_BRAND_PRIMARY,
    colorBackground: '#ffffff',
    colorText: '#111827',
    colorDanger: '#ef4444',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: '8px',
  },
}

type ConnectInstance = ReturnType<typeof loadConnectAndInitialize>

interface UseStripeConnectInstanceResult {
  instance: ConnectInstance | null
  isInitializing: boolean
  initError: string | null
  sessionError: string | null
  retry: () => void
}

/**
 * Initializes a Stripe Connect embedded instance for the currently-authenticated
 * provider, exposing the instance + load state for any surface that needs to
 * render embedded components (`ConnectAccountOnboarding`,
 * `ConnectAccountManagement`, `ConnectNotificationBanner`, etc.).
 *
 * The initialization is gated on `enabled` so callers can hold off until they
 * know the provider has a Stripe account (no point creating a session for an
 * empty account — the backend would 400). Pass `enabled=false` while the
 * surrounding page is still loading account status, then flip to `true`.
 *
 * Encapsulates the same race-safety pattern used by the onboarding page:
 *   - `isMountedRef` guards against state updates after unmount.
 *   - `initVersionRef` invalidates older in-flight init promises whenever the
 *     effect re-runs (retry, enabled flip), so a late-arriving older promise
 *     can't overwrite fresh state.
 *   - `fetchClientSecret` is required to refetch on every iframe call —
 *     AccountSession secrets are single-use.
 *
 * Session-expiry contract (H6 audit clarification):
 *   `AccountSession.client_secret` is short-lived (~15 min) but we do NOT need
 *   an interval-based refresh on this side. Stripe's `loadConnectAndInitialize`
 *   invokes our `fetchClientSecret` callback on demand every time an embedded
 *   component needs to talk to Stripe — including immediately before any API
 *   call when it detects the cached secret is stale. As long as our backend
 *   `/account-session` endpoint stays available (it just calls
 *   `accountSessions.create` and returns a fresh secret), the iframe self-
 *   heals on the next provider interaction. Adding a setInterval refresh
 *   would risk forcing an iframe remount and losing in-flight form state.
 */
export function useStripeConnectInstance({
  enabled,
}: {
  enabled: boolean
}): UseStripeConnectInstanceResult {
  const [instance, setInstance] = useState<ConnectInstance | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [initAttempt, setInitAttempt] = useState(0)

  const isMountedRef = useRef(true)
  const initVersionRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (instance) return

    initVersionRef.current += 1
    const myVersion = initVersionRef.current
    const isCurrent = () => isMountedRef.current && initVersionRef.current === myVersion

    setIsInitializing(true)
    setInitError(null)

    const next = loadConnectAndInitialize({
      publishableKey: config.stripe.publishableKey,
      fetchClientSecret: async () => {
        const result = await stripeConnectService.createAccountSession()
        if (!result.success || !result.data?.clientSecret) {
          const message =
            extractApiErrorMessage(result, 'Failed to create account session') ??
            'Failed to create account session'
          if (isMountedRef.current) setSessionError(message)
          throw new Error(message)
        }
        if (isMountedRef.current) setSessionError(null)
        return result.data.clientSecret
      },
      locale: 'en',
      appearance: STRIPE_CONNECT_APPEARANCE,
    })

    try {
      if (!isCurrent()) return
      setInstance(next)
    } catch (err) {
      if (!isCurrent()) return
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load Stripe embedded surface. Please retry.'
      setInitError(msg)
      log.error('init failed', err)
    } finally {
      if (isCurrent()) setIsInitializing(false)
    }
  }, [enabled, instance, initAttempt])

  return {
    instance,
    isInitializing,
    initError,
    sessionError,
    retry: () => {
      setInstance(null)
      setInitAttempt(n => n + 1)
    },
  }
}
