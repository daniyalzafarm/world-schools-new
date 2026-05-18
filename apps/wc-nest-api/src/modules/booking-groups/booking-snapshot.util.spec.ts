import { BadRequestException } from '@nestjs/common'
import { Prisma } from '../../generated/client/client'
import { PaymentMode } from '../../generated/client/enums'
import {
  computeBookingFinancialSnapshot,
  computeGracePeriodDeadline,
  computeProviderResponseDeadline,
} from './booking-snapshot.util'

const NOW = new Date('2026-04-28T12:00:00.000Z')

function dayOffset(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
}

describe('computeBookingFinancialSnapshot', () => {
  describe('deposit flow (deposit configured)', () => {
    it('percentage deposit on a 200-day-out booking → deposit_then_balance, balance 60d before start', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('2000.00'),
        sessionStartDate: dayOffset(200),
        providerAppFeeCustom: true,
        providerAppFeePercentage: new Prisma.Decimal('15'),
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 30,
        },
        now: NOW,
      })

      expect(result.paymentMode).toBe(PaymentMode.deposit_then_balance)
      expect(result.depositAmount?.toFixed(2)).toBe('600.00') // 30% of 2000
      expect(result.appFeePercentageSnapshot.toFixed(2)).toBe('15.00')
      expect(result.serviceFeeAmount.toFixed(2)).toBe('300.00') // 15% of 2000
      expect(result.balanceDueAt!.toISOString()).toBe(dayOffset(200 - 60).toISOString())
    })

    it('fixed-amount deposit', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('2000.00'),
        sessionStartDate: dayOffset(120),
        providerAppFeeCustom: true,
        providerAppFeePercentage: new Prisma.Decimal('15'),
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: {
          depositRequired: true,
          depositType: 'fixed',
          depositFixedAmount: new Prisma.Decimal('500.00'),
        },
        now: NOW,
      })

      expect(result.paymentMode).toBe(PaymentMode.deposit_then_balance)
      expect(result.depositAmount?.toFixed(2)).toBe('500.00')
    })

    it('caps fixed deposit at totalAmount (consumer-protection)', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('300.00'),
        sessionStartDate: dayOffset(100),
        providerAppFeeCustom: true,
        providerAppFeePercentage: new Prisma.Decimal('10'),
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: {
          depositRequired: true,
          depositType: 'fixed',
          depositFixedAmount: new Prisma.Decimal('500.00'),
        },
        now: NOW,
      })
      expect(result.depositAmount?.toFixed(2)).toBe('300.00')
    })

    it('pulls balanceDueAt forward to now when computed value is in the past', () => {
      // 30 days out; deposit flow wants balance 60d before start = 30 days ago.
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('1000.00'),
        sessionStartDate: dayOffset(30),
        providerAppFeeCustom: true,
        providerAppFeePercentage: new Prisma.Decimal('10'),
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 50,
        },
        now: NOW,
      })
      expect(result.balanceDueAt!.toISOString()).toBe(NOW.toISOString())
    })

    it('rejects misconfigured percentage (out of range)', () => {
      expect(() =>
        computeBookingFinancialSnapshot({
          totalAmount: new Prisma.Decimal('1000.00'),
          sessionStartDate: dayOffset(100),
          providerAppFeeCustom: false,
          providerAppFeePercentage: null,
          systemDefaultAppFee: new Prisma.Decimal('10'),
          depositSettings: {
            depositRequired: true,
            depositType: 'percentage',
            depositPercentage: 150,
          },
          now: NOW,
        })
      ).toThrow(BadRequestException)
    })

    it('rejects misconfigured fixed amount (zero)', () => {
      expect(() =>
        computeBookingFinancialSnapshot({
          totalAmount: new Prisma.Decimal('1000.00'),
          sessionStartDate: dayOffset(100),
          providerAppFeeCustom: false,
          providerAppFeePercentage: null,
          systemDefaultAppFee: new Prisma.Decimal('10'),
          depositSettings: {
            depositRequired: true,
            depositType: 'fixed',
            depositFixedAmount: new Prisma.Decimal('0'),
          },
          now: NOW,
        })
      ).toThrow(BadRequestException)
    })

    it('rejects unknown depositType', () => {
      expect(() =>
        computeBookingFinancialSnapshot({
          totalAmount: new Prisma.Decimal('1000.00'),
          sessionStartDate: dayOffset(100),
          providerAppFeeCustom: false,
          providerAppFeePercentage: null,
          systemDefaultAppFee: new Prisma.Decimal('10'),
          depositSettings: {
            depositRequired: true,
            depositType: 'mystery',
          },
          now: NOW,
        })
      ).toThrow(BadRequestException)
    })
  })

  describe('no-deposit flow', () => {
    it('≥90 days out → full_at_due (SetupIntent path), balance 90d before start', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('2000.00'),
        sessionStartDate: dayOffset(120),
        providerAppFeeCustom: false,
        providerAppFeePercentage: null,
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: { depositRequired: false },
        now: NOW,
      })
      expect(result.paymentMode).toBe(PaymentMode.full_at_due)
      expect(result.depositAmount).toBeNull()
      expect(result.balanceDueAt!.toISOString()).toBe(dayOffset(120 - 90).toISOString())
      // Falls back to SystemSettings.defaultAppFee when provider has no snapshot.
      expect(result.appFeePercentageSnapshot.toFixed(2)).toBe('10.00')
    })

    it('<90 days out → full_at_booking (capture at acceptance), no balanceDueAt', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('1000.00'),
        sessionStartDate: dayOffset(60),
        providerAppFeeCustom: true,
        providerAppFeePercentage: new Prisma.Decimal('15'),
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: { depositRequired: false },
        now: NOW,
      })
      expect(result.paymentMode).toBe(PaymentMode.full_at_booking)
      expect(result.depositAmount).toBeNull()
      expect(result.balanceDueAt).toBeNull()
    })

    it('treats null providerSettings as no deposit', () => {
      const result = computeBookingFinancialSnapshot({
        totalAmount: new Prisma.Decimal('1000.00'),
        sessionStartDate: dayOffset(60),
        providerAppFeeCustom: false,
        providerAppFeePercentage: null,
        systemDefaultAppFee: new Prisma.Decimal('10'),
        depositSettings: null,
        now: NOW,
      })
      expect(result.paymentMode).toBe(PaymentMode.full_at_booking)
      expect(result.depositAmount).toBeNull()
    })
  })
})

describe('computeBookingFinancialSnapshot — app fee custom toggle (Phase 5)', () => {
  it('uses Provider.appFeePercentage when appFeeCustom=true', () => {
    const result = computeBookingFinancialSnapshot({
      totalAmount: new Prisma.Decimal('1000.00'),
      sessionStartDate: dayOffset(120),
      providerAppFeeCustom: true,
      providerAppFeePercentage: new Prisma.Decimal('12.5'),
      systemDefaultAppFee: new Prisma.Decimal('10'),
      depositSettings: { depositRequired: false },
      now: NOW,
    })
    expect(result.appFeePercentageSnapshot.toFixed(2)).toBe('12.50')
    expect(result.serviceFeeAmount.toFixed(2)).toBe('125.00')
  })

  it('falls back to SystemSettings.defaultAppFee when appFeeCustom=false (even with a percentage on the row)', () => {
    // This is the "preserve previous override on toggle-off" case: the row
    // still carries a percentage, but the boolean says don't use it.
    const result = computeBookingFinancialSnapshot({
      totalAmount: new Prisma.Decimal('1000.00'),
      sessionStartDate: dayOffset(120),
      providerAppFeeCustom: false,
      providerAppFeePercentage: new Prisma.Decimal('20'),
      systemDefaultAppFee: new Prisma.Decimal('10'),
      depositSettings: { depositRequired: false },
      now: NOW,
    })
    expect(result.appFeePercentageSnapshot.toFixed(2)).toBe('10.00')
  })

  it('falls back to SystemSettings.defaultAppFee when custom=true but percentage is null (defensive)', () => {
    const result = computeBookingFinancialSnapshot({
      totalAmount: new Prisma.Decimal('1000.00'),
      sessionStartDate: dayOffset(120),
      providerAppFeeCustom: true,
      providerAppFeePercentage: null,
      systemDefaultAppFee: new Prisma.Decimal('10'),
      depositSettings: { depositRequired: false },
      now: NOW,
    })
    expect(result.appFeePercentageSnapshot.toFixed(2)).toBe('10.00')
  })
})

describe('computeProviderResponseDeadline', () => {
  it('returns now + 72h', () => {
    const deadline = computeProviderResponseDeadline(NOW)
    expect(deadline.getTime() - NOW.getTime()).toBe(72 * 60 * 60 * 1000)
  })
})

describe('computeGracePeriodDeadline', () => {
  it('returns respondedAt + 48h', () => {
    const responded = new Date('2026-05-01T08:00:00.000Z')
    const deadline = computeGracePeriodDeadline(responded)
    expect(deadline.getTime() - responded.getTime()).toBe(48 * 60 * 60 * 1000)
  })
})
