import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import Stripe from 'stripe'
import { Prisma } from '../../../generated/client/client'
import {
  PayoutMode,
  PayoutStatus,
  PayoutTrancheReason,
  PayoutTrancheStatus,
} from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeService } from '../../stripe/stripe.service'
import { PayoutsService } from './payouts.service'

describe('PayoutsService.computeDefaultTransferDate', () => {
  let service: PayoutsService

  beforeEach(async () => {
    const stripeService = { client: {} } as unknown as StripeService
    const prisma = {} as unknown as PrismaService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripeService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  // Table-driven cases. All dates UTC midnight for determinism.
  const cases: Array<{ name: string; sessionStart: string; expected: string }> = [
    {
      name: 'Monday session start → Tuesday payout',
      sessionStart: '2026-06-01T00:00:00.000Z',
      expected: '2026-06-02T00:00:00.000Z',
    },
    {
      name: 'Friday session start → Monday payout (skip weekend)',
      sessionStart: '2026-06-05T00:00:00.000Z',
      expected: '2026-06-08T00:00:00.000Z',
    },
    {
      name: 'Saturday session start → Monday payout',
      sessionStart: '2026-06-06T00:00:00.000Z',
      expected: '2026-06-08T00:00:00.000Z',
    },
    {
      name: 'Sunday session start → Monday payout',
      sessionStart: '2026-06-07T00:00:00.000Z',
      expected: '2026-06-08T00:00:00.000Z',
    },
    {
      name: 'Year-boundary weekend: Fri Dec 31 2027 → Mon Jan 3 2028',
      sessionStart: '2027-12-31T00:00:00.000Z',
      expected: '2028-01-03T00:00:00.000Z',
    },
  ]

  it.each(cases)('$name', ({ sessionStart, expected }) => {
    const result = service.computeDefaultTransferDate(new Date(sessionStart))
    expect(result.toISOString()).toBe(expected)
  })

  it('does not mutate the input session start date', () => {
    const input = new Date('2026-06-01T00:00:00.000Z')
    const before = input.getTime()
    service.computeDefaultTransferDate(input)
    expect(input.getTime()).toBe(before)
  })

  describe('providerTimezone', () => {
    it('null/undefined timezone preserves UTC behavior (legacy fallback)', () => {
      const sessionStart = new Date('2026-06-01T00:00:00.000Z')
      const utcResult = service.computeDefaultTransferDate(sessionStart)
      const nullResult = service.computeDefaultTransferDate(sessionStart, null)
      const undefResult = service.computeDefaultTransferDate(sessionStart, undefined)
      expect(nullResult.toISOString()).toBe(utcResult.toISOString())
      expect(undefResult.toISOString()).toBe(utcResult.toISOString())
    })

    it('Sydney session crossing local-day boundary picks the local day for advance', () => {
      // 2026-01-03T22:00:00Z is Sat 22:00 UTC, but Sun 09:00 AEDT in Sydney.
      // Local Sun → +1 = Mon → local Mon midnight AEDT = 2026-01-04T13:00:00Z.
      const sessionStart = new Date('2026-01-03T22:00:00.000Z')
      const result = service.computeDefaultTransferDate(sessionStart, 'Australia/Sydney')
      expect(result.toISOString()).toBe('2026-01-04T13:00:00.000Z')
    })

    it('America/New_York Friday-late session: UTC sees Sat, local sees Fri — local wins', () => {
      const sessionStart = new Date('2026-04-04T03:00:00.000Z')
      const result = service.computeDefaultTransferDate(sessionStart, 'America/New_York')
      expect(result.toISOString()).toBe('2026-04-06T04:00:00.000Z')
    })

    it('Europe/London session crossing DST spring-forward (BST starts Mar 29 2026)', () => {
      const sessionStart = new Date('2026-03-27T00:00:00.000Z')
      const result = service.computeDefaultTransferDate(sessionStart, 'Europe/London')
      expect(result.toISOString()).toBe('2026-03-29T23:00:00.000Z')
    })

    it('invalid IANA timezone falls back to UTC instead of throwing', () => {
      const sessionStart = new Date('2026-06-05T00:00:00.000Z')
      const result = service.computeDefaultTransferDate(sessionStart, 'Not/A_Real_Zone')
      const utcFallback = service.computeDefaultTransferDate(sessionStart)
      expect(result.toISOString()).toBe(utcFallback.toISOString())
    })
  })
})

describe('PayoutsService.computeOffsetReleaseDate', () => {
  let service: PayoutsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: {} },
        { provide: StripeService, useValue: { client: {} } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  const farFutureStart = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  it('returns sessionStart - offsetDays when in the future', () => {
    const result = service.computeOffsetReleaseDate(farFutureStart, 14, new Date())
    const expected = new Date(farFutureStart.getTime() - 14 * 24 * 60 * 60 * 1000)
    expect(result?.toISOString()).toBe(expected.toISOString())
  })

  it('returns null when the computed date would be in the past (caller falls back to default)', () => {
    const tooClose = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = service.computeOffsetReleaseDate(tooClose, 14, new Date())
    expect(result).toBeNull()
  })

  it('returns null when offsetDays is 0 or negative (defensive)', () => {
    expect(service.computeOffsetReleaseDate(farFutureStart, 0, new Date())).toBeNull()
    expect(service.computeOffsetReleaseDate(farFutureStart, -3, new Date())).toBeNull()
  })

  it('skips business-day rounding for offset releases (contractual date)', () => {
    // Sat is a valid releaseAt — the cron will release whenever it next runs.
    const friday = new Date('2026-08-21T00:00:00.000Z')
    const result = service.computeOffsetReleaseDate(friday, 1, new Date('2026-01-01'))
    expect(result?.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })
})

describe('PayoutsService.buildTranches', () => {
  let service: PayoutsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: {} },
        { provide: StripeService, useValue: { client: {} } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  function baseInput(overrides: Partial<Parameters<PayoutsService['buildTranches']>[0]> = {}) {
    const sessionStart = new Date('2027-01-01T00:00:00.000Z')
    return {
      payoutMode: PayoutMode.default_after_start,
      offsetDays: null,
      sessionStartDate: sessionStart,
      gracePeriodEndsAt: new Date('2026-05-03T00:00:00.000Z'),
      balanceDueAt: new Date('2026-11-02T00:00:00.000Z'),
      depositAmount: new Prisma.Decimal('600.00'),
      balanceAmount: new Prisma.Decimal('1400.00'),
      totalAmount: new Prisma.Decimal('2000.00'),
      providerTimezone: null,
      cancellationPolicy: 'moderate',
      cancellationPolicyCustom: null,
      now: new Date('2026-05-01T00:00:00.000Z'),
      ...overrides,
    }
  }

  it('default_after_start mode emits one final_default tranche for the full total', () => {
    const tranches = service.buildTranches(baseInput())
    expect(tranches).toHaveLength(1)
    expect(tranches[0].reason).toBe(PayoutTrancheReason.final_default)
    expect(tranches[0].plannedAmount.toFixed(2)).toBe('2000.00')
  })

  it('offset_days mode emits one offset_release tranche at sessionStart - offsetDays', () => {
    const tranches = service.buildTranches(
      baseInput({ payoutMode: PayoutMode.offset_days, offsetDays: 7 })
    )
    expect(tranches).toHaveLength(1)
    expect(tranches[0].reason).toBe(PayoutTrancheReason.offset_release)
    expect(tranches[0].plannedAmount.toFixed(2)).toBe('2000.00')
    // sessionStart - 7d = 2026-12-25T00:00:00.000Z
    expect(tranches[0].releaseAt.toISOString()).toBe('2026-12-25T00:00:00.000Z')
  })

  it('offset_days mode falls back to default-mode releaseAt when offset is too close (would land in past)', () => {
    const sessionStart = new Date('2026-05-08T00:00:00.000Z') // ~1 week from now()
    const tranches = service.buildTranches(
      baseInput({
        payoutMode: PayoutMode.offset_days,
        offsetDays: 30,
        sessionStartDate: sessionStart,
      })
    )
    expect(tranches).toHaveLength(1)
    // Default model: first business day after sessionStart.
    // 2026-05-08 = Fri → Mon 2026-05-11.
    expect(tranches[0].releaseAt.toISOString()).toBe('2026-05-11T00:00:00.000Z')
  })

  describe('policy_staged', () => {
    it('flexible policy: deposit_grace + tier_threshold @ -30d + final_default residual', () => {
      const tranches = service.buildTranches(
        baseInput({
          payoutMode: PayoutMode.policy_staged,
          cancellationPolicy: 'flexible',
        })
      )
      // Flexible = [{30d, 100%}] → before -30d everything refundable, after -30d 0% refundable
      // → at -30d the FULL balance becomes non-refundable.
      const reasons = tranches.map(t => t.reason)
      expect(reasons).toContain(PayoutTrancheReason.deposit_grace)
      expect(reasons).toContain(PayoutTrancheReason.tier_threshold)
      // Total scheduled = totalAmount.
      const total = tranches.reduce((acc, t) => acc.plus(t.plannedAmount), new Prisma.Decimal(0))
      expect(total.toFixed(2)).toBe('2000.00')
    })

    it('moderate policy: deposit + 60d tranche + 30d tranche + final_default residual', () => {
      const tranches = service.buildTranches(
        baseInput({
          payoutMode: PayoutMode.policy_staged,
          cancellationPolicy: 'moderate',
        })
      )
      // Moderate = [{60d, 100%}, {30d, 50%}, {0d, 0%}].
      //  - At -60d (100% refundable) → 0% non-refundable. No tranche emitted (increment=0).
      //  - At -30d (50% refundable) → 50% non-refundable = 700 increment.
      //  - At 0d (0% refundable) → 100% non-refundable = 700 more increment.
      // Plus deposit + final residual (zero).
      const total = tranches.reduce((acc, t) => acc.plus(t.plannedAmount), new Prisma.Decimal(0))
      expect(total.toFixed(2)).toBe('2000.00')
      const tierTranches = tranches.filter(t => t.reason === PayoutTrancheReason.tier_threshold)
      expect(tierTranches).toHaveLength(2)
      // 50% increment = 700.00
      expect(tierTranches[0].plannedAmount.toFixed(2)).toBe('700.00')
      // 50% → 100% = another 700.00
      expect(tierTranches[1].plannedAmount.toFixed(2)).toBe('700.00')
    })

    it('clamps tier releaseAt forward when the tier date lands before balanceDueAt + 24h buffer', () => {
      // Moderate emits two tier transitions: -60d (100% → 50% refundable) and
      // -30d (50% → 0% refundable). Set balanceDueAt so the -60d transition
      // would land before balanceDueAt + 24h and verify the clamp.
      const sessionStart = new Date('2027-01-01T00:00:00.000Z')
      const balanceDueAt = new Date('2026-11-03T00:00:00.000Z')
      const tranches = service.buildTranches(
        baseInput({
          payoutMode: PayoutMode.policy_staged,
          sessionStartDate: sessionStart,
          balanceDueAt,
          cancellationPolicy: 'moderate',
        })
      )
      const tierTranches = tranches.filter(t => t.reason === PayoutTrancheReason.tier_threshold)
      // The -60d transition (sessionStart - 60d = 2026-11-02) is BEFORE
      // balanceDueAt + 24h (= 2026-11-04). So it's clamped forward to that date.
      expect(tierTranches[0].releaseAt.toISOString()).toBe('2026-11-04T00:00:00.000Z')
      // The -30d transition (sessionStart - 30d = 2026-12-02) is well past
      // balanceDueAt and stays as-is.
      expect(tierTranches[1].releaseAt.toISOString()).toBe('2026-12-02T00:00:00.000Z')
    })

    it('omits deposit_grace when there is no deposit', () => {
      const tranches = service.buildTranches(
        baseInput({
          payoutMode: PayoutMode.policy_staged,
          depositAmount: new Prisma.Decimal('0'),
          balanceAmount: new Prisma.Decimal('2000.00'),
          totalAmount: new Prisma.Decimal('2000.00'),
        })
      )
      expect(tranches.find(t => t.reason === PayoutTrancheReason.deposit_grace)).toBeUndefined()
    })
  })
})

describe('PayoutsService.releasePendingTranche', () => {
  let service: PayoutsService
  let prisma: any
  let stripe: any

  function makeTranche(overrides: Partial<any> = {}) {
    return {
      id: 't-1',
      bookingGroupId: 'bg-1',
      reason: PayoutTrancheReason.final_default,
      releaseAt: new Date(Date.now() - 60_000),
      plannedAmount: new Prisma.Decimal('500.00'),
      currency: 'eur',
      tierDaysBeforeStart: null,
      tierRefundPercent: null,
      status: PayoutTrancheStatus.pending,
      releaseAttempts: 0,
      bookingGroup: {
        id: 'bg-1',
        paidAmount: new Prisma.Decimal('500.00'),
        refundedAmount: new Prisma.Decimal('0.00'),
        serviceFeeAmount: new Prisma.Decimal('0.00'),
        provider: {
          stripeAccountId: 'acct_live_1',
          settings: { currency: 'eur' },
        },
      },
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = {
      bookingPayoutSchedule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _sum: { releasedAmount: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bookingGroup: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    stripe = { client: { payouts: { create: jest.fn() } } }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  it('releases the planned amount + records stripePayoutId on the tranche', async () => {
    prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(makeTranche())
    stripe.client.payouts.create.mockResolvedValueOnce({ id: 'po_42' })

    const result = await service.releasePendingTranche('t-1')

    expect(result).toMatchObject({ stripePayoutId: 'po_42', skipped: false })
    expect(prisma.bookingPayoutSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-1' },
        data: expect.objectContaining({
          status: PayoutTrancheStatus.released,
          stripePayoutId: 'po_42',
        }),
      })
    )
  })

  it('queues a partial_residual tranche when available < plannedAmount', async () => {
    // Plan 500, but only 300 available (e.g., balance not yet captured).
    prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
      makeTranche({
        plannedAmount: new Prisma.Decimal('500.00'),
        bookingGroup: {
          id: 'bg-1',
          paidAmount: new Prisma.Decimal('300.00'),
          refundedAmount: new Prisma.Decimal('0.00'),
          serviceFeeAmount: new Prisma.Decimal('0.00'),
          provider: {
            stripeAccountId: 'acct_live_1',
            settings: { currency: 'eur' },
          },
        },
      })
    )
    stripe.client.payouts.create.mockResolvedValueOnce({ id: 'po_partial' })

    const result = await service.releasePendingTranche('t-1')

    expect(result).toMatchObject({ stripePayoutId: 'po_partial', releasedAmount: '300.00' })
    // Residual tranche queued for next cron tick.
    expect(prisma.bookingPayoutSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: PayoutTrancheReason.partial_residual,
          plannedAmount: expect.any(Prisma.Decimal),
        }),
      })
    )
  })

  it('skips when net available is zero (over-refunded)', async () => {
    prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
      makeTranche({
        bookingGroup: {
          id: 'bg-1',
          paidAmount: new Prisma.Decimal('500.00'),
          refundedAmount: new Prisma.Decimal('600.00'), // over-refunded somehow
          serviceFeeAmount: new Prisma.Decimal('0.00'),
          provider: {
            stripeAccountId: 'acct_live_1',
            settings: { currency: 'eur' },
          },
        },
      })
    )

    const result = await service.releasePendingTranche('t-1')

    expect(result).toMatchObject({ skipped: true, reason: 'no_funds_available' })
    expect(stripe.client.payouts.create).not.toHaveBeenCalled()
    expect(prisma.bookingPayoutSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayoutTrancheStatus.skipped }),
      })
    )
  })

  it('idempotent: skips when tranche is no longer pending', async () => {
    prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
      makeTranche({ status: PayoutTrancheStatus.released })
    )

    const result = await service.releasePendingTranche('t-1')

    expect(result).toMatchObject({ skipped: true, reason: 'already_released' })
    expect(stripe.client.payouts.create).not.toHaveBeenCalled()
  })

  it('skips when releaseAt is still in the future (defensive)', async () => {
    prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
      makeTranche({ releaseAt: new Date(Date.now() + 60_000) })
    )

    const result = await service.releasePendingTranche('t-1')

    expect(result).toMatchObject({ skipped: true, reason: 'release_at_not_reached' })
  })

  describe('balance_insufficient handling', () => {
    function makeBalanceInsufficientError(): InstanceType<
      typeof Stripe.errors.StripeInvalidRequestError
    > {
      return new Stripe.errors.StripeInvalidRequestError({
        message: 'You have insufficient funds in your Stripe account for this transfer.',
        type: 'invalid_request_error',
        code: 'balance_insufficient',
      })
    }

    it('reschedules + bumps releaseAttempts on first failure (no exception escapes)', async () => {
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 0 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())

      const result = await service.releasePendingTranche('t-1')

      expect(result).toMatchObject({
        stripePayoutId: null,
        skipped: true,
        reason: 'balance_insufficient',
      })
      expect(prisma.bookingPayoutSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-1' },
          data: expect.objectContaining({
            releaseAttempts: 1,
            skipReason: 'balance_insufficient (attempt 1)',
            releaseAt: expect.any(Date),
          }),
        })
      )
      // Crucially: status stays pending — the next cron tick must pick it up.
      const updateCall = prisma.bookingPayoutSchedule.update.mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('status')
    })

    it('pushes releaseAt forward with capped exponential backoff', async () => {
      // attempt 0 → +6h
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 0 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())
      const before = Date.now()
      await service.releasePendingTranche('t-1')
      const releaseAt1 = prisma.bookingPayoutSchedule.update.mock.calls[0][0].data.releaseAt as Date
      const delay1 = releaseAt1.getTime() - before
      expect(delay1).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000 - 1000)
      expect(delay1).toBeLessThanOrEqual(6 * 60 * 60 * 1000 + 1000)

      // attempt 3 → would be 6h * 2^3 = 48h, which equals the cap (48h).
      prisma.bookingPayoutSchedule.update.mockClear()
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 3 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())
      const before2 = Date.now()
      await service.releasePendingTranche('t-1')
      const releaseAt2 = prisma.bookingPayoutSchedule.update.mock.calls[0][0].data.releaseAt as Date
      const delay2 = releaseAt2.getTime() - before2
      expect(delay2).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 1000)
    })

    it('varies the Stripe idempotency key across retries (no replay of cached error)', async () => {
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 0 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())
      await service.releasePendingTranche('t-1')

      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 1 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())
      await service.releasePendingTranche('t-1')

      const key0 = stripe.client.payouts.create.mock.calls[0][1].idempotencyKey
      const key1 = stripe.client.payouts.create.mock.calls[1][1].idempotencyKey
      expect(key0).toEqual(expect.any(String))
      expect(key1).toEqual(expect.any(String))
      expect(key0).not.toEqual(key1)
    })

    it('parks tranche as skipped with max-retries reason after final failed attempt', async () => {
      // INSUFFICIENT_BALANCE_MAX_ATTEMPTS = 5; entering at releaseAttempts = 4
      // means this attempt becomes the 5th and trips the max-retries branch.
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(
        makeTranche({ releaseAttempts: 4 })
      )
      stripe.client.payouts.create.mockRejectedValueOnce(makeBalanceInsufficientError())

      const result = await service.releasePendingTranche('t-1')

      expect(result).toMatchObject({
        skipped: true,
        reason: 'balance_insufficient_max_retries',
      })
      expect(prisma.bookingPayoutSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-1' },
          data: expect.objectContaining({
            status: PayoutTrancheStatus.skipped,
            releaseAttempts: 5,
            skipReason: 'balance_insufficient_max_retries',
          }),
        })
      )
    })

    it('non-soft Stripe errors still bubble as Nest exceptions', async () => {
      prisma.bookingPayoutSchedule.findUnique.mockResolvedValueOnce(makeTranche())
      stripe.client.payouts.create.mockRejectedValueOnce(
        new Stripe.errors.StripePermissionError({
          message: 'You cannot perform this action on this connected account.',
          type: 'invalid_request_error',
          code: 'account_invalid',
        })
      )

      await expect(service.releasePendingTranche('t-1')).rejects.toThrow()
    })
  })
})

describe('PayoutsService.cancelPendingTranches', () => {
  let service: PayoutsService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      bookingPayoutSchedule: {
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      bookingGroup: { update: jest.fn() },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: { client: {} } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  it('flips every pending tranche to canceled with the supplied reason', async () => {
    prisma.bookingPayoutSchedule.updateMany.mockResolvedValueOnce({ count: 3 })

    const result = await service.cancelPendingTranches('bg-1', 'camp_cancel')

    expect(result.canceledCount).toBe(3)
    expect(prisma.bookingPayoutSchedule.updateMany).toHaveBeenCalledWith({
      where: { bookingGroupId: 'bg-1', status: PayoutTrancheStatus.pending },
      data: { status: PayoutTrancheStatus.canceled, skipReason: 'camp_cancel' },
    })
  })

  it('no-op when no pending tranches exist (idempotent)', async () => {
    prisma.bookingPayoutSchedule.updateMany.mockResolvedValueOnce({ count: 0 })
    const result = await service.cancelPendingTranches('bg-1', 'camp_cancel')
    expect(result.canceledCount).toBe(0)
  })
})

describe('PayoutsService.recordPayoutPaid / recordPayoutFailed', () => {
  let service: PayoutsService
  let prisma: any
  let stripe: any

  function makeStripePayout(overrides: Partial<any> = {}) {
    return {
      id: 'po_live_1',
      amount: 50_000,
      currency: 'eur',
      arrival_date: 1762012800,
      failure_code: null,
      failure_message: null,
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = {
      bookingPayoutSchedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
      },
      bookingGroup: { update: jest.fn() },
      payoutEvent: { upsert: jest.fn() },
      provider: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    stripe = { client: {} }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PayoutsService)
  })

  it('recordPayoutPaid: backfills payoutEventId on every tranche whose stripePayoutId matches', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({ id: 'pr-1' })
    prisma.payoutEvent.upsert.mockResolvedValueOnce({ id: 'pe-1' })
    prisma.bookingPayoutSchedule.updateMany.mockResolvedValueOnce({ count: 2 })
    prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([
      { bookingGroupId: 'bg-1' },
      { bookingGroupId: 'bg-2' },
    ])

    await service.recordPayoutPaid(makeStripePayout({ id: 'po_paid_1' }) as any, 'acct_live_1')

    expect(prisma.bookingPayoutSchedule.updateMany).toHaveBeenCalledWith({
      where: { stripePayoutId: 'po_paid_1', payoutEventId: null },
      data: { payoutEventId: 'pe-1', status: PayoutTrancheStatus.paid },
    })
  })

  it('recordPayoutPaid: writes the PayoutEvent with status=paid', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({ id: 'pr-1' })
    prisma.payoutEvent.upsert.mockResolvedValueOnce({ id: 'pe-1' })

    await service.recordPayoutPaid(makeStripePayout() as any, 'acct_live_1')

    expect(prisma.payoutEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: PayoutStatus.paid }),
        update: expect.objectContaining({ status: PayoutStatus.paid }),
      })
    )
  })

  it('recordPayoutPaid: payoutEventId: null guard ensures idempotent re-delivery', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({ id: 'pr-1' })
    prisma.payoutEvent.upsert.mockResolvedValueOnce({ id: 'pe-1' })
    prisma.bookingPayoutSchedule.updateMany.mockResolvedValueOnce({ count: 0 })

    await service.recordPayoutPaid(makeStripePayout() as any, 'acct_live_1')

    const where = prisma.bookingPayoutSchedule.updateMany.mock.calls[0][0].where
    expect(where).toHaveProperty('payoutEventId', null)
  })

  it('recordPayoutPaid: skips silently when the connected account is unknown', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce(null)
    await service.recordPayoutPaid(makeStripePayout() as any, 'acct_unknown')
    expect(prisma.payoutEvent.upsert).not.toHaveBeenCalled()
    expect(prisma.bookingPayoutSchedule.updateMany).not.toHaveBeenCalled()
  })

  it('recordPayoutFailed: marks the matching released tranche as failed and queues a residual retry', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({ id: 'pr-1' })
    prisma.payoutEvent.upsert.mockResolvedValueOnce({ id: 'pe-1' })
    prisma.bookingPayoutSchedule.findFirst.mockResolvedValueOnce({
      id: 't-1',
      bookingGroupId: 'bg-1',
      releasedAmount: new Prisma.Decimal('500.00'),
      plannedAmount: new Prisma.Decimal('500.00'),
      currency: 'eur',
      tierDaysBeforeStart: null,
      tierRefundPercent: null,
    })

    await service.recordPayoutFailed(
      makeStripePayout({ failure_code: 'account_closed' }) as any,
      'acct_live_1'
    )

    // Failed tranche is marked but NOT linked to the failed PayoutEvent (so
    // a successful retry under a new payout id can take its place).
    expect(prisma.bookingPayoutSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-1' },
        data: expect.objectContaining({ status: PayoutTrancheStatus.failed }),
      })
    )
    // Fresh pending tranche queued for retry — `status` is not set so the
    // schema's default `pending` applies.
    expect(prisma.bookingPayoutSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingGroupId: 'bg-1',
          reason: PayoutTrancheReason.partial_residual,
        }),
      })
    )
  })
})
