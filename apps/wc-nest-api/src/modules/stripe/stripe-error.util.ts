import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import Stripe from 'stripe'

const logger = new Logger('StripeError')

/**
 * Redacts PII patterns we know Stripe error messages can carry. Stripe likes
 * to echo offending input back in the error string ("Invalid email address: …",
 * "The phone number provided …", "card number ending in …"), so we sanitize
 * before logging:
 *   - email-shaped tokens → `[redacted-email]`
 *   - 11+ digit runs (bank account, IBAN, SSN, card-number remnants) → `[redacted-digits]`
 *   - JWT-ish tokens → `[redacted-token]`
 * The user-facing exception still receives the un-redacted Stripe message —
 * Stripe is responsible for what it surfaces in its own error strings; this
 * function only governs what hits OUR application logs.
 */
export function redactPii(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[redacted-email]')
    .replace(/\d{11,}/g, '[redacted-digits]')
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
}

/**
 * Translates a Stripe SDK error into a typed Nest exception and throws it.
 * Logs the full Stripe error (including requestId) so failures can be correlated
 * with Stripe's dashboard, but only the user-safe `message` reaches the response.
 *
 * Non-Stripe errors are re-thrown unchanged.
 */
export function mapStripeError(err: unknown): never {
  if (!(err instanceof Stripe.errors.StripeError)) {
    throw err
  }

  const requestId = err.requestId ?? 'unknown'
  const safeMessage = redactPii(err.message ?? '')
  const detail = `[${err.type} requestId=${requestId} code=${err.code ?? 'n/a'}] ${safeMessage}`

  if (err instanceof Stripe.errors.StripeCardError) {
    logger.warn(`Card error: ${detail}`)
    throw new BadRequestException(err.message)
  }

  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    logger.warn(`Invalid request: ${detail}`)
    throw new BadRequestException(err.message)
  }

  if (err instanceof Stripe.errors.StripePermissionError) {
    logger.error(`Permission error: ${detail}`)
    throw new ForbiddenException(err.message)
  }

  if (err instanceof Stripe.errors.StripeRateLimitError) {
    logger.warn(`Rate limited: ${detail}`)
    throw new ServiceUnavailableException('Payment provider is rate-limiting us, try again shortly')
  }

  if (
    err instanceof Stripe.errors.StripeAPIError ||
    err instanceof Stripe.errors.StripeConnectionError ||
    err instanceof Stripe.errors.StripeIdempotencyError
  ) {
    logger.error(`Transient Stripe failure: ${detail}`)
    throw new ServiceUnavailableException('Payment provider is unavailable, try again shortly')
  }

  if (err instanceof Stripe.errors.StripeAuthenticationError) {
    // Loud — this is a server-side config issue, never the caller's fault.
    logger.error(`Stripe authentication failed (check STRIPE_SECRET_KEY): ${detail}`)
    throw new InternalServerErrorException('Payment provider configuration error')
  }

  logger.error(`Unhandled Stripe error: ${detail}`)
  throw new InternalServerErrorException('Payment provider error')
}
