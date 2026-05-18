import { createHash } from 'crypto'
import { stableStringify } from './stable-stringify.util'

/**
 * Builds a content-hashed Stripe idempotency key.
 *
 * Identical params (the actual retry case) produce identical keys, so Stripe
 * returns its cached response and idempotency is preserved. Different params
 * produce different keys, so we never hit the dreaded "same key, different
 * params" 503 from Stripe.
 *
 * The `prefix` is a stable namespace per call-site (e.g. `pi:bg:<id>:deposit`)
 * and is included in the key so unrelated operations on the same booking
 * cannot collide. The `params` object is canonicalized via `stableStringify`
 * before hashing.
 */
export function buildIdempotencyKey(prefix: string, params: unknown): string {
  const hash = createHash('sha256').update(stableStringify(params)).digest('hex').slice(0, 16)
  return `${prefix}:${hash}`
}
