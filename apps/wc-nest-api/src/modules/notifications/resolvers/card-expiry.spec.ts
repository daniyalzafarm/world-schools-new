import { cardExpiresBeforeDate } from './prop-loaders'

describe('cardExpiresBeforeDate', () => {
  it('a card is valid through the LAST day of its expiry month', () => {
    // Card 08/2026 → valid until 2026-08-31 23:59, expired from 2026-09-01.
    expect(cardExpiresBeforeDate(8, 2026, new Date('2026-08-31T23:59:59Z'))).toBe(false)
    expect(cardExpiresBeforeDate(8, 2026, new Date('2026-09-01T00:00:00Z'))).toBe(true)
  })

  it('handles a December expiry rolling into the next year', () => {
    expect(cardExpiresBeforeDate(12, 2026, new Date('2026-12-31T12:00:00Z'))).toBe(false)
    expect(cardExpiresBeforeDate(12, 2026, new Date('2027-01-01T00:00:00Z'))).toBe(true)
  })

  it('a future-dated card is not expired for a near-term capture', () => {
    expect(cardExpiresBeforeDate(5, 2030, new Date('2026-09-01T00:00:00Z'))).toBe(false)
  })

  it('a long-past card is expired for any current capture', () => {
    expect(cardExpiresBeforeDate(1, 2020, new Date('2026-09-01T00:00:00Z'))).toBe(true)
  })
})
