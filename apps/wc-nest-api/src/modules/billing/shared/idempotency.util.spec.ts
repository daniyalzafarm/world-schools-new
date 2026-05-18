import { buildIdempotencyKey } from './idempotency.util'

describe('buildIdempotencyKey', () => {
  it('produces identical keys for structurally-equal params regardless of key insertion order', () => {
    const a = buildIdempotencyKey('pi:bg:abc:deposit', {
      amount: 600,
      currency: 'eur',
      customer: 'cus_1',
    })
    const b = buildIdempotencyKey('pi:bg:abc:deposit', {
      customer: 'cus_1',
      currency: 'eur',
      amount: 600,
    })
    expect(a).toBe(b)
  })

  it('produces different keys when any param value differs', () => {
    const a = buildIdempotencyKey('pi:bg:abc:deposit', { amount: 600, currency: 'eur' })
    const b = buildIdempotencyKey('pi:bg:abc:deposit', { amount: 700, currency: 'eur' })
    expect(a).not.toBe(b)
  })

  it('namespaces by prefix so unrelated calls cannot collide', () => {
    const a = buildIdempotencyKey('pi:bg:abc:deposit', { amount: 600 })
    const b = buildIdempotencyKey('pi:bg:abc:balance', { amount: 600 })
    expect(a).not.toBe(b)
  })

  it('treats nested objects with reordered keys as equal', () => {
    const a = buildIdempotencyKey('refund:p:1:grace', {
      metadata: { bookingGroupId: 'bg', paymentId: 'p1' },
    })
    const b = buildIdempotencyKey('refund:p:1:grace', {
      metadata: { paymentId: 'p1', bookingGroupId: 'bg' },
    })
    expect(a).toBe(b)
  })

  it('preserves array order (different order = different hash)', () => {
    const a = buildIdempotencyKey('x', { items: [1, 2, 3] })
    const b = buildIdempotencyKey('x', { items: [3, 2, 1] })
    expect(a).not.toBe(b)
  })

  it('produces a 16-char hex hash suffix', () => {
    const key = buildIdempotencyKey('test', { a: 1 })
    const parts = key.split(':')
    const hash = parts[parts.length - 1]
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })
})
