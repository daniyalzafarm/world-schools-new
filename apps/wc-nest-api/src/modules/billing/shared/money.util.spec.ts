import { Prisma } from '../../../generated/client/client'
import { computeApplicationFee, fromStripeMinorUnits, toStripeMinorUnits } from './money.util'

describe('toStripeMinorUnits', () => {
  it('multiplies EUR by 100 (two-decimal currency)', () => {
    expect(toStripeMinorUnits('19.99', 'eur')).toBe(1999)
    expect(toStripeMinorUnits(new Prisma.Decimal('600.00'), 'EUR')).toBe(60000)
  })

  it('does NOT multiply JPY (zero-decimal currency)', () => {
    expect(toStripeMinorUnits('1000', 'jpy')).toBe(1000)
    expect(toStripeMinorUnits(new Prisma.Decimal('1234'), 'JPY')).toBe(1234)
  })

  it('multiplies KWD by 1000 (three-decimal currency)', () => {
    expect(toStripeMinorUnits('1.234', 'kwd')).toBe(1234)
  })

  it('throws when the value has more decimal places than the currency allows', () => {
    expect(() => toStripeMinorUnits('19.999', 'eur')).toThrow(/not an integer/)
    expect(() => toStripeMinorUnits('100.5', 'jpy')).toThrow(/not an integer/)
  })

  it('avoids float drift on values like 19.99 * 100', () => {
    // 19.99 * 100 in IEEE754 = 1998.9999999999998 — must come back as 1999.
    expect(toStripeMinorUnits('19.99', 'usd')).toBe(1999)
    expect(toStripeMinorUnits('0.10', 'usd')).toBe(10)
    expect(toStripeMinorUnits('2.30', 'usd')).toBe(230)
  })
})

describe('fromStripeMinorUnits', () => {
  it('round-trips two-decimal currencies', () => {
    expect(fromStripeMinorUnits(1999, 'eur')).toBe('19.99')
    expect(fromStripeMinorUnits(60000, 'EUR')).toBe('600.00')
  })

  it('returns integer string for zero-decimal currencies', () => {
    expect(fromStripeMinorUnits(1000, 'jpy')).toBe('1000')
  })

  it('returns three-decimal string for KWD', () => {
    expect(fromStripeMinorUnits(1234, 'kwd')).toBe('1.234')
  })
})

describe('computeApplicationFee', () => {
  it('computes 10% of 2000 as 200.00', () => {
    expect(computeApplicationFee('2000.00', '10')).toBe('200.00')
  })

  it('computes 15% of 2000 as 300.00', () => {
    expect(computeApplicationFee('2000.00', '15')).toBe('300.00')
  })

  it('rounds half-up to two decimals (app fee must not skew over time)', () => {
    // 19.99 * 0.085 = 1.69915 → expect "1.70" (half-up)
    expect(computeApplicationFee('19.99', '8.5')).toBe('1.70')
  })

  it('accepts Prisma.Decimal as input', () => {
    expect(computeApplicationFee(new Prisma.Decimal('1000.00'), new Prisma.Decimal('12.5'))).toBe(
      '125.00'
    )
  })

  it('returns "0.00" when the app fee is zero', () => {
    expect(computeApplicationFee('500.00', '0')).toBe('0.00')
  })
})
