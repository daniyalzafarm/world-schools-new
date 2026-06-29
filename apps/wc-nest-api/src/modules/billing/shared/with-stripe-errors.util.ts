import Stripe from 'stripe'
import { mapStripeError } from '../../stripe/stripe-error.util'

/**
 * Backoff parameters for `StripeRateLimitError` (HTTP 429).
 * Stripe's rate limits are per-account and per-resource and recover quickly;
 * a short exponential retry with jitter is the canonical mitigation. Total
 * worst-case wait across all retries is ~700ms — small enough not to
 * dominate user-facing call latency, large enough to ride out a transient
 * burst.
 */
const RATE_LIMIT_MAX_RETRIES = 3
const RATE_LIMIT_BASE_DELAY_MS = 100

function isStripeRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { type?: string; statusCode?: number }
  return e.type === 'StripeRateLimitError' || e.statusCode === 429
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Typed sentinel returned by `withStripeErrors` when the underlying call
 * fails with a Stripe error whose `code` matches one of `softErrorCodes`.
 *
 * The caller opts in to soft-fail handling per call site (e.g. payout-release
 * tolerating `balance_insufficient`). Callers that don't opt in get the
 * default behavior — `mapStripeError` translates the error into a typed Nest
 * exception and throws.
 */
export interface SoftStripeFailure {
  _soft: true
  code: string
  message: string
}

export function isSoftStripeFailure(v: unknown): v is SoftStripeFailure {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as SoftStripeFailure)._soft === true &&
    typeof (v as SoftStripeFailure).code === 'string'
  )
}

export interface WithStripeErrorsOptions {
  softErrorCodes?: readonly string[]
}

/**
 * Wraps any Stripe SDK call so its errors are translated into typed Nest
 * exceptions via `mapStripeError`. Lifted into a shared utility so every
 * billing service uses the same translation layer without copying the
 * inner try/catch block from `stripe-connect.service.ts`.
 *
 * Also retries with exponential backoff + jitter on
 * `StripeRateLimitError` (HTTP 429) up to `RATE_LIMIT_MAX_RETRIES` times.
 * Non-rate-limit errors propagate immediately. This is a process-local
 * mitigation, not a circuit breaker — Stripe's official guidance is to
 * back off and retry on 429, and 3 attempts with 100/200/400ms delays
 * comfortably rides out the bursts we've seen in load testing.
 *
 * Soft-fail option: pass `softErrorCodes` (e.g. `['balance_insufficient']`)
 * to suppress `mapStripeError` for known transient Stripe error codes and
 * return a `SoftStripeFailure` sentinel instead. Callers narrow with
 * `isSoftStripeFailure` and handle the case (typically: reschedule + retry
 * later) without the error reaching the Nest exception filter.
 */

export function withStripeErrors<T>(fn: () => Promise<T>): Promise<T>
// eslint-disable-next-line no-redeclare
export function withStripeErrors<T>(
  fn: () => Promise<T>,
  opts: WithStripeErrorsOptions
): Promise<T | SoftStripeFailure>
// eslint-disable-next-line no-redeclare
export async function withStripeErrors<T>(
  fn: () => Promise<T>,
  opts?: WithStripeErrorsOptions
): Promise<T | SoftStripeFailure> {
  const softCodes = opts?.softErrorCodes
  let lastErr: unknown
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isStripeRateLimitError(err) || attempt === RATE_LIMIT_MAX_RETRIES) {
        // Non-429 error, or we've exhausted retries — translate + throw.
        break
      }
      // Exponential backoff: 100ms, 200ms, 400ms — plus 0-50% jitter so two
      // concurrent retriers don't synchronize and re-thunder Stripe.
      const delay = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt
      const jitter = Math.random() * delay * 0.5
      await sleepMs(delay + jitter)
    }
  }

  if (softCodes && softCodes.length > 0 && lastErr instanceof Stripe.errors.StripeError) {
    const code = lastErr.code
    if (typeof code === 'string' && softCodes.includes(code)) {
      return { _soft: true, code, message: lastErr.message ?? '' }
    }
  }

  mapStripeError(lastErr)
}
