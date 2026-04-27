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
  const detail = `[${err.type} requestId=${requestId} code=${err.code ?? 'n/a'}] ${err.message}`

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
