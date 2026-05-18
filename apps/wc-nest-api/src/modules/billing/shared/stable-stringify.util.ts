/**
 * Stable JSON: serializes objects with sorted keys so structurally-equal
 * payloads always produce the same string regardless of property insertion
 * order. Required for content-hashed idempotency keys — if two retries
 * produced different stringifications of the same object they'd hash to
 * different keys and Stripe would create duplicate resources.
 *
 * Mirrors the implementation in `provider/stripe-connect/stripe-connect.service.ts`
 * — kept in a single shared utility so every billing service uses the same
 * canonicalization. Do not introduce a second copy.
 */
export function stableStringify(value: unknown): string {
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
