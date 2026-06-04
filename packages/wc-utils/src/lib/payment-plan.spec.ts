import { describe, it, expect } from 'vitest'
import {
  BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW,
  BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW,
  GRACE_PERIOD_HOURS,
  INVALID_DEPOSIT_CONFIG,
  PROVIDER_RESPONSE_WINDOW_HOURS,
  computeDepositAmountNumber,
  computeGracePeriodDeadline,
  computePaymentPlan,
  computeProviderResponseDeadline,
} from './payment-plan'

const NOW = new Date('2026-04-28T12:00:00.000Z')

function dayOffset(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
}

describe('computeDepositAmountNumber', () => {
  it('returns null when depositRequired is falsy', () => {
    expect(computeDepositAmountNumber(1000, { depositRequired: false })).toBeNull()
    expect(computeDepositAmountNumber(1000, null)).toBeNull()
  })

  it('computes a percentage deposit', () => {
    expect(
      computeDepositAmountNumber(2000, {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 30,
      })
    ).toBe(600)
  })

  it('rounds percentage deposits to 2dp (half-up)', () => {
    expect(
      computeDepositAmountNumber(199.99, {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 33,
      })
    ).toBe(66) // 199.99 * 0.33 = 65.9967 → 66.00
  })

  it('returns a fixed deposit unchanged when below total', () => {
    expect(
      computeDepositAmountNumber(2000, {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: 500,
      })
    ).toBe(500)
  })

  it('caps a fixed deposit at the total amount (consumer-protection)', () => {
    expect(
      computeDepositAmountNumber(300, {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: 500,
      })
    ).toBe(300)
  })

  it('throws INVALID_DEPOSIT_CONFIG for percentage out of range', () => {
    expect(() =>
      computeDepositAmountNumber(1000, {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 150,
      })
    ).toThrowError(new RegExp(`^${INVALID_DEPOSIT_CONFIG}`))
  })

  it('throws INVALID_DEPOSIT_CONFIG for missing percentage', () => {
    expect(() =>
      computeDepositAmountNumber(1000, {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: null,
      })
    ).toThrowError(new RegExp(`^${INVALID_DEPOSIT_CONFIG}`))
  })

  it('throws INVALID_DEPOSIT_CONFIG for non-positive fixed amount', () => {
    expect(() =>
      computeDepositAmountNumber(1000, {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: 0,
      })
    ).toThrowError(new RegExp(`^${INVALID_DEPOSIT_CONFIG}`))
  })

  it('throws INVALID_DEPOSIT_CONFIG for unknown depositType', () => {
    expect(() =>
      computeDepositAmountNumber(1000, {
        depositRequired: true,
        depositType: 'mystery',
      })
    ).toThrowError(new RegExp(`^${INVALID_DEPOSIT_CONFIG}`))
  })
})

describe('computePaymentPlan', () => {
  it('returns deposit-kind plan when a deposit is configured', () => {
    const plan = computePaymentPlan({
      total: 2000,
      sessionStartDate: dayOffset(200),
      depositSettings: {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 30,
      },
      now: NOW,
    })
    expect(plan).toEqual({
      kind: 'deposit',
      chargeAmount: 600,
      futureBalanceAmount: 1400,
      total: 2000,
    })
  })

  it('returns setup-kind plan for no-deposit + far-out bookings', () => {
    const plan = computePaymentPlan({
      total: 1500,
      sessionStartDate: dayOffset(BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW + 10),
      depositSettings: null,
      now: NOW,
    })
    expect(plan).toEqual({
      kind: 'setup',
      chargeAmount: 0,
      futureBalanceAmount: 1500,
      total: 1500,
    })
  })

  it('returns full-kind plan for no-deposit + close-to-start bookings', () => {
    const plan = computePaymentPlan({
      total: 1500,
      sessionStartDate: dayOffset(BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW - 1),
      depositSettings: { depositRequired: false },
      now: NOW,
    })
    expect(plan).toEqual({
      kind: 'full',
      chargeAmount: 1500,
      futureBalanceAmount: 0,
      total: 1500,
    })
  })
})

describe('deadline helpers', () => {
  it('computeProviderResponseDeadline returns now + 72h', () => {
    const deadline = computeProviderResponseDeadline(NOW)
    expect(deadline.getTime() - NOW.getTime()).toBe(PROVIDER_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000)
  })

  it('computeGracePeriodDeadline returns respondedAt + 48h', () => {
    const responded = new Date('2026-05-01T08:00:00.000Z')
    const deadline = computeGracePeriodDeadline(responded)
    expect(deadline.getTime() - responded.getTime()).toBe(GRACE_PERIOD_HOURS * 60 * 60 * 1000)
  })
})

describe('exported constants stay in lockstep with documented policy', () => {
  // Lock the values: changing any of these is a product decision, not a
  // refactor. If a number changes here, the customer-facing copy AND the
  // persisted snapshot semantics need a coordinated migration.
  it('matches the documented policy', () => {
    expect(BALANCE_DUE_OFFSET_DAYS_DEPOSIT_FLOW).toBe(60)
    expect(BALANCE_DUE_OFFSET_DAYS_NO_DEPOSIT_FLOW).toBe(90)
    expect(PROVIDER_RESPONSE_WINDOW_HOURS).toBe(72)
    expect(GRACE_PERIOD_HOURS).toBe(48)
  })
})
