import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../../generated/client/client'
import {
  PaymentKind,
  PaymentStatus,
  RefundReason,
  RefundStatus,
  ReimbursementStatus,
} from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { StripeService } from '../../stripe/stripe.service'
import { CancelCaptureService } from '../captures/cancel-capture.service'
import { PayoutsService } from '../payouts/payouts.service'
import { ReimbursementsService } from '../reimbursements/reimbursements.service'
import { buildBookingPolicySnapshot } from '../shared/cancellation-policy.util'
import { RefundsService } from './refunds.service'

// Direct Charges: every refund is issued against the connected account that
// owns the charge (`Payment.stripeAccountId`). Use a single constant here so
// every `payment.stripeAccountId` assertion stays in sync.
const STRIPE_ACCOUNT_ID = 'acct_test_provider'
// Parent record id (on `Parent` table). The Parent's `userId` maps back to
// the requesting User; `BookingGroup.parentId` references this id directly.
const PARENT_ID = 'parent-1'

describe('RefundsService', () => {
  let service: RefundsService
  let prisma: any
  let stripe: any
  let redis: any
  let redisClient: any
  let reimbursements: any
  let payouts: any
  let cancelCapture: any

  function makeGroup(overrides: Partial<any> = {}) {
    // Default fixture populates `cancellationPolicySnapshot` so the existing
    // tests exercise the production snapshot-first code path. Pass
    // `cancellationPolicySnapshot: null` in overrides to test the legacy
    // fallback path explicitly.
    const policySnapshot = buildBookingPolicySnapshot({
      policyName: 'moderate',
      cancellationPolicyCustom: null,
      cancellationPolicySpecialCircumstances: null,
    })
    return {
      id: 'bg-1',
      parentId: PARENT_ID,
      transferDate: null as Date | null,
      gracePeriodEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      session: { startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
      cancellationPolicySnapshot: JSON.parse(JSON.stringify(policySnapshot)),
      provider: {
        settings: {
          cancellationPolicy: 'moderate',
          cancellationPolicyCustom: null,
          cancellationPolicySpecialCircumstances: null,
        },
      },
      ...overrides,
    }
  }

  // Default Stripe charge fixture for the C2 validation pre-flight. Mirrors
  // the `Payment` defaults: €600 deposit, captured, no prior refunds.
  function makeCharge(overrides: Partial<any> = {}) {
    return {
      id: 'ch_1',
      amount: 60000, // 600.00 EUR in minor units
      amount_refunded: 0,
      captured: true,
      currency: 'eur',
      ...overrides,
    }
  }

  function makePayment(overrides: Partial<any> = {}) {
    return {
      id: 'pay-1',
      bookingGroupId: 'bg-1',
      kind: PaymentKind.deposit,
      stripeChargeId: 'ch_1',
      // Direct Charges: snapshot of the connected account the charge lives
      // on. `issueRefund` reads this to route the API call.
      stripeAccountId: STRIPE_ACCOUNT_ID,
      amount: new Prisma.Decimal('600.00'),
      currency: 'eur',
      status: PaymentStatus.succeeded,
      ...overrides,
    }
  }

  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    redis = { getClient: () => redisClient }
    prisma = {
      bookingGroup: { findUnique: jest.fn(), update: jest.fn() },
      // Default Parent lookup returns the owning parent — C1 ownership check
      // passes for the canonical happy path. Tests that exercise the
      // forbidden path override this mock.
      parent: {
        findUnique: jest.fn().mockResolvedValue({ id: PARENT_ID }),
      },
      payment: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
      },
      refund: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      bookingPayoutSchedule: {
        // Default: no paid tranches — `resolveRequiresReimbursement` returns
        // false. Tests that need to assert "post-payout refund" behavior
        // override the count() mock to return >0.
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { releasedAmount: null } }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    stripe = {
      client: {
        refunds: { create: jest.fn() },
        // C2 audit fix: every refund first validates the live charge against
        // the Payment row. Default mock derives the charge amount/currency
        // from whatever payments the test has set up via `payment.findMany`,
        // so single-charge and multi-charge tests both work without
        // per-test charge mocks. Validation-specific tests override this
        // mock per-call with `mockResolvedValueOnce`.
        charges: {
          retrieve: jest.fn().mockImplementation(async (chargeId: string) => {
            const findManyMock = prisma.payment.findMany as jest.Mock
            for (const result of findManyMock.mock.results) {
              if (result.type !== 'return') continue
              try {
                const value = await result.value
                if (!Array.isArray(value)) continue
                const match = value.find((p: any) => p?.stripeChargeId === chargeId)
                if (match) {
                  const minor = Math.round(parseFloat(match.amount.toString()) * 100)
                  return makeCharge({
                    id: chargeId,
                    amount: minor,
                    currency: match.currency,
                  })
                }
              } catch {
                /* ignore — rejected promise from a prior throw mock */
              }
            }
            return makeCharge({ id: chargeId })
          }),
        },
      },
    }
    reimbursements = { createIfNeeded: jest.fn() }
    payouts = {
      cancelPendingTranches: jest.fn().mockResolvedValue({ canceledCount: 0 }),
      recomputeRemainingTranches: jest.fn().mockResolvedValue({ canceledCount: 0 }),
    }
    // Payments revamp (Spec v2.3): the shared cancel sink cancels scheduled
    // captures + removes their delayed jobs for every cancel path.
    cancelCapture = { cancelForBooking: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: RedisService, useValue: redis },
        { provide: ReimbursementsService, useValue: reimbursements },
        { provide: PayoutsService, useValue: payouts },
        { provide: CancelCaptureService, useValue: cancelCapture },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(RefundsService)
  })

  describe('processGracePeriodRefund', () => {
    it('refunds 100% of every succeeded payment with refund_application_fee=true on the connected account', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.deposit, amount: new Prisma.Decimal('600.00') }),
        makePayment({
          id: 'pay-2',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
          stripeChargeId: 'ch_2',
        }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockImplementation(async (params: any) => ({
        id: `re_${params.charge}`,
        status: 'succeeded',
      }))
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-1', ...data }))

      await service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })

      const calls = stripe.client.refunds.create.mock.calls
      expect(calls).toHaveLength(2)
      for (const [params, options] of calls) {
        // Direct Charges: `reverse_transfer` is gone (no transfer to reverse),
        // `stripeAccount` is now on the 2nd-arg request option.
        expect(params).not.toHaveProperty('reverse_transfer')
        expect(params.refund_application_fee).toBe(true)
        expect(options.stripeAccount).toBe(STRIPE_ACCOUNT_ID)
      }
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1' },
          data: expect.objectContaining({ status: 'cancelled', cancelledReason: 'grace_period' }),
        })
      )
      // Payments revamp (Spec v2.3): the shared cancel sink cancels the booking's
      // scheduled captures + removes their delayed jobs (covers every cancel path).
      expect(cancelCapture.cancelForBooking).toHaveBeenCalledWith('bg-1', 'cancelled:grace_period')
    })

    it('rejects when grace period has ended', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(
        makeGroup({ gracePeriodEndsAt: new Date(Date.now() - 1000) })
      )
      await expect(
        service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('rejects when there is nothing to refund', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([])
      await expect(
        service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('grace boundary: T-1ms succeeds, T+1ms rejects', async () => {
      const t = new Date()
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(
        makeGroup({ gracePeriodEndsAt: new Date(t.getTime() + 1) })
      )
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1' })

      await expect(
        service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })
      ).resolves.toBeDefined()

      prisma.bookingGroup.findUnique.mockResolvedValueOnce(
        makeGroup({ gracePeriodEndsAt: new Date(t.getTime() - 1) })
      )
      await expect(
        service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('processPolicyRefund', () => {
    it('refunds balance × tier% but skips deposit (deposit non-refundable post-grace)', async () => {
      // Moderate policy + 90 days before start → first matching tier is daysBeforeStart=60 → 100%? No: 90 ≥ 60, 100%.
      const group = makeGroup({
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.deposit, amount: new Prisma.Decimal('600.00') }),
        makePayment({
          id: 'pay-2',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
          stripeChargeId: 'ch_2',
        }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-1', ...data }))

      await service.processPolicyRefund({ bookingGroupId: 'bg-1' })

      // Only the balance Payment was refunded.
      expect(stripe.client.refunds.create).toHaveBeenCalledTimes(1)
      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params.charge).toBe('ch_2')
      expect(params.refund_application_fee).toBe(false) // platform retains the app fee
      expect(params.amount).toBe(140000) // 100% of 1400 EUR
    })

    it('30-49 days before start = 50% on moderate policy', async () => {
      const group = makeGroup({
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1' })

      await service.processPolicyRefund({ bookingGroupId: 'bg-1' })

      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params.amount).toBe(50000) // 50% of 1000 EUR = 500
    })

    it('zero-tier match (last-minute cancellation) issues no refunds but still cancels the group', async () => {
      const group = makeGroup({
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
      ])

      await service.processPolicyRefund({ bookingGroupId: 'bg-1' })

      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) })
      )
    })

    it('rejects when still within grace period', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      await expect(service.processPolicyRefund({ bookingGroupId: 'bg-1' })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('honors booking snapshot when live settings would yield a different tier', async () => {
      // Live policy is 0%-everywhere custom, but the booking was snapshotted
      // under standard moderate. Refund must follow the snapshot — that's the
      // consumer-protection invariant against post-booking provider edits.
      const moderateSnapshot = buildBookingPolicySnapshot({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        cancellationPolicySpecialCircumstances: null,
      })
      const group = makeGroup({
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) },
        cancellationPolicySnapshot: JSON.parse(JSON.stringify(moderateSnapshot)),
        provider: {
          settings: {
            cancellationPolicy: 'custom',
            cancellationPolicyCustom: { tiers: [{ daysBeforeStart: 0, refundPercentage: 0 }] },
            cancellationPolicySpecialCircumstances: null,
          },
        },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_snap', status: 'succeeded' })
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-snap', ...data }))

      await service.processPolicyRefund({ bookingGroupId: 'bg-1' })

      // 100 days before start under SNAPSHOT (moderate) = 100% on $1000.
      // Under the LIVE 0%-everywhere policy this would have been $0.
      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params.amount).toBe(100000)
    })

    it('cancelForParent({ circumstance: medical }) issues refund with reason=special_circumstance and override on policySnapshot', async () => {
      // Provider configured a 90% medical-emergency override. Parent
      // cancels 10 days before camp (standard tier = 0%). Override should
      // upgrade the refund to 90% of the balance.
      const snapshot = buildBookingPolicySnapshot({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        cancellationPolicySpecialCircumstances: [{ type: 'medical', refundPercentage: 90 }] as any,
      })
      const group = makeGroup({
        status: 'accepted',
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        cancellationPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
      })
      // cancelForParent calls loadGroupOrThrow + succeededPayments twice
      // (once at top, once inside processPolicyRefundUnlocked).
      // mockResolvedValue (not …Once) so all calls in this test get the same data.
      prisma.bookingGroup.findUnique.mockResolvedValue(group)
      prisma.payment.findMany.mockResolvedValue([
        makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_med', status: 'succeeded' })
      const created: any[] = []
      prisma.refund.create.mockImplementation(async ({ data }: any) => {
        created.push(data)
        return { id: 'r-med', ...data }
      })

      await service.cancelForParent({
        bookingGroupId: 'bg-1',
        parentUserId: 'user-1',
        circumstance: 'medical',
      })

      const [params] = stripe.client.refunds.create.mock.calls[0]
      // 90% of $1000 = $900 → 90000 minor units.
      expect(params.amount).toBe(90000)
      // Reason on the persisted Refund row reflects the override path.
      expect(created[0].reason).toBe(RefundReason.special_circumstance)
      // Snapshot pinned on the Refund row records the applied circumstance.
      expect(created[0].policySnapshot.appliedCircumstance).toEqual({
        type: 'medical',
        refundPercentage: 90,
      })
    })

    it.each([
      ['force_majeure', 75],
      ['weather', 100],
    ] as const)(
      'cancelForParent({ circumstance: %s }) honors the configured override',
      async (circumstanceType, providerPct) => {
        // Same shape as the medical test, parameterized over the other two
        // SpecialCircumstanceTypes. Beyond proving each type wires through,
        // this also catches any per-type mishandling (e.g. typoing one of
        // the types in `resolveSpecialCircumstances`).
        const snapshot = buildBookingPolicySnapshot({
          policyName: 'moderate',
          cancellationPolicyCustom: null,
          cancellationPolicySpecialCircumstances: [
            { type: circumstanceType, refundPercentage: providerPct },
          ] as any,
        })
        const group = makeGroup({
          status: 'accepted',
          gracePeriodEndsAt: new Date(Date.now() - 1000),
          session: { startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
          cancellationPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
        })
        prisma.bookingGroup.findUnique.mockResolvedValue(group)
        prisma.payment.findMany.mockResolvedValue([
          makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
        ])
        prisma.refund.findUnique.mockResolvedValue(null)
        stripe.client.refunds.create.mockResolvedValue({ id: 're_x', status: 'succeeded' })
        const created: any[] = []
        prisma.refund.create.mockImplementation(async ({ data }: any) => {
          created.push(data)
          return { id: 'r-x', ...data }
        })

        await service.cancelForParent({
          bookingGroupId: 'bg-1',
          parentUserId: 'user-1',
          circumstance: circumstanceType,
        })

        const [params] = stripe.client.refunds.create.mock.calls[0]
        expect(params.amount).toBe(providerPct * 1000) // % × $1000 → minor units
        expect(created[0].reason).toBe(RefundReason.special_circumstance)
        expect(created[0].policySnapshot.appliedCircumstance).toEqual({
          type: circumstanceType,
          refundPercentage: providerPct,
        })
      }
    )

    it('cancelForParent({ circumstance }) falls back to standard tier when provider has not configured that circumstance', async () => {
      // Provider configured ONLY medical. Parent claims weather. Override
      // doesn't fire — standard tier (0% at 10 days) wins. No Stripe refund
      // call is made (zero-amount path), and no special_circumstance row
      // appears since reason wasn't elevated.
      const snapshot = buildBookingPolicySnapshot({
        policyName: 'moderate',
        cancellationPolicyCustom: null,
        cancellationPolicySpecialCircumstances: [{ type: 'medical', refundPercentage: 90 }] as any,
      })
      const group = makeGroup({
        status: 'accepted',
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        cancellationPolicySnapshot: JSON.parse(JSON.stringify(snapshot)),
      })
      prisma.bookingGroup.findUnique.mockResolvedValue(group)
      prisma.payment.findMany.mockResolvedValue([
        makePayment({ kind: PaymentKind.balance, amount: new Prisma.Decimal('1000.00') }),
      ])

      await service.cancelForParent({
        bookingGroupId: 'bg-1',
        parentUserId: 'user-1',
        circumstance: 'weather',
      })

      // 0% tier × $1000 = $0 — no refund is issued.
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      // Group is still cancelled (zero-tier match path, see existing test
      // "zero-tier match issues no refunds but still cancels the group").
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) })
      )
    })

    it('parent-cancel post-grace uses refund_application_fee=false on the connected account — platform keeps the fee', async () => {
      // Verifies the Direct-Charges policy refund preset REFUND_FLAGS_KEEP_PLATFORM_FEE.
      // The destination-charges-era `reverse_transfer` no longer applies (no
      // transfer to reverse on a Direct Charge); the platform's commercial
      // deterrent for parent-driven post-grace cancels is keeping the app fee.
      const group = makeGroup({
        gracePeriodEndsAt: new Date(Date.now() - 1000),
        session: { startDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
          stripeChargeId: 'ch_x',
        }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_x', status: 'succeeded' })
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-x', ...data }))

      await service.processPolicyRefund({ bookingGroupId: 'bg-1' })

      const [params, options] = stripe.client.refunds.create.mock.calls[0]
      expect(params).not.toHaveProperty('reverse_transfer')
      expect(params.refund_application_fee).toBe(false)
      expect(options.stripeAccount).toBe(STRIPE_ACCOUNT_ID)
    })
  })

  describe('processCampCancelRefund', () => {
    it('Phase 8: issues full refund + creates Reimbursement when at least one tranche has paid', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      // The new resolveRequiresReimbursement queries the tranche table.
      // Returning >0 simulates "deposit_grace tranche has already paid."
      prisma.bookingPayoutSchedule.count.mockResolvedValueOnce(1)
      prisma.refund.create.mockResolvedValue({
        id: 'r-1',
        amount: new Prisma.Decimal('600.00'),
        bookingGroupId: 'bg-1',
        requiresReimbursement: true,
      })

      await service.processCampCancelRefund({ bookingGroupId: 'bg-1', adminUserId: 'u-1' })

      expect(reimbursements.createIfNeeded).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingGroupId: 'bg-1',
          refundId: 'r-1',
          currency: 'eur',
        }),
        expect.anything() // Phase-7 H4: tx client passed as 2nd arg
      )
    })

    it('Phase 8: does NOT create Reimbursement when no tranches have released yet', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.bookingPayoutSchedule.count.mockResolvedValueOnce(0)
      prisma.refund.create.mockResolvedValue({
        id: 'r-1',
        requiresReimbursement: false,
      })

      await service.processCampCancelRefund({ bookingGroupId: 'bg-1', adminUserId: 'u-1' })

      expect(reimbursements.createIfNeeded).not.toHaveBeenCalled()
    })

    it('Phase 8: cancelByCamp invokes payouts.cancelPendingTranches so the cron stops firing', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.bookingPayoutSchedule.count.mockResolvedValueOnce(0)
      prisma.refund.create.mockResolvedValue({
        id: 'r-1',
        requiresReimbursement: false,
      })

      await service.processCampCancelRefund({ bookingGroupId: 'bg-1', adminUserId: 'u-1' })

      expect(payouts.cancelPendingTranches).toHaveBeenCalledWith(
        'bg-1',
        expect.stringContaining('camp_cancel')
      )
    })

    it('Phase-7 H4: createIfNeeded throwing rolls back the Refund row + refundedAmount increment', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      // Phase 8: at least one tranche has paid → createIfNeeded gets called.
      prisma.bookingPayoutSchedule.count.mockResolvedValueOnce(1)
      prisma.refund.create.mockResolvedValue({
        id: 'r-1',
        amount: new Prisma.Decimal('600.00'),
        bookingGroupId: 'bg-1',
        requiresReimbursement: true,
      })
      reimbursements.createIfNeeded.mockRejectedValueOnce(new Error('db blip'))

      await expect(
        service.processCampCancelRefund({ bookingGroupId: 'bg-1', adminUserId: 'u-1' })
      ).rejects.toThrow('db blip')

      // The error propagated; the outer transaction would roll back the
      // Refund insert + refundedAmount increment together with the failed
      // Reimbursement create. (We verify the helper was called with a tx as
      // its second arg — that's the contract that lets the rollback happen.)
      expect(reimbursements.createIfNeeded).toHaveBeenCalledWith(
        expect.objectContaining({ refundId: 'r-1' }),
        expect.anything()
      )
    })
  })

  describe('processProviderDeclinedRefund / processProviderExpiredRefund', () => {
    it('exits early without acquiring lock when nothing was captured (common case)', async () => {
      prisma.payment.count.mockResolvedValueOnce(0)
      const result = await service.processProviderDeclinedRefund({ bookingGroupId: 'bg-1' })
      expect(result).toEqual([])
      expect(redisClient.set).not.toHaveBeenCalled()
    })

    it('refunds when a deposit was somehow captured before decline', async () => {
      prisma.payment.count.mockResolvedValueOnce(1)
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1' })

      await service.processProviderDeclinedRefund({ bookingGroupId: 'bg-1' })
      expect(stripe.client.refunds.create).toHaveBeenCalled()
    })
  })

  describe('Refund idempotency', () => {
    it('returns the prior Refund row when (paymentId, reason) already exists', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValueOnce({ id: 'r-prior', stripeRefundId: 're_prior' })

      const result = await service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      expect(result[0]).toMatchObject({ id: 'r-prior' })
    })
  })

  describe('markRefundCompleted (webhook)', () => {
    it('increments BookingGroup.refundedAmount only on the first transition into succeeded', async () => {
      prisma.refund.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        bookingGroupId: 'bg-1',
        paymentId: 'pay-1',
        amount: new Prisma.Decimal('600.00'),
        status: RefundStatus.pending,
        succeededAt: null,
        requiresReimbursement: false,
        payment: { currency: 'eur' },
      })

      await service.markRefundCompleted({ id: 're_1', status: 'succeeded' } as never)

      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { refundedAmount: { increment: expect.anything() } },
        })
      )
    })

    it('does not double-increment when the row was already succeeded', async () => {
      prisma.refund.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        bookingGroupId: 'bg-1',
        paymentId: 'pay-1',
        amount: new Prisma.Decimal('600.00'),
        status: RefundStatus.succeeded,
        succeededAt: new Date(),
        requiresReimbursement: false,
        payment: { currency: 'eur' },
      })

      await service.markRefundCompleted({ id: 're_1', status: 'succeeded' } as never)

      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })

    it('recovers an orphan refund (lost-dispute auto-refund) by creating a synthetic Refund row', async () => {
      // Primary lookup misses (Stripe issued the refund without us calling create).
      prisma.refund.findUnique.mockResolvedValueOnce(null)
      // Charge → Payment lookup hits.
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        currency: 'eur',
      })
      // No prior dispute Refund row exists.
      prisma.refund.findUnique.mockResolvedValueOnce(null)
      // Phase 8: orphan-recovery uses tranche table to decide reimbursement.
      // Pretend at least one tranche has paid so requiresReimbursement=true.
      prisma.bookingPayoutSchedule.count.mockResolvedValueOnce(1)
      prisma.refund.create.mockResolvedValueOnce({
        id: 'r-recovered',
        bookingGroupId: 'bg-1',
        paymentId: 'pay-1',
        amount: new Prisma.Decimal('600.00'),
        reason: RefundReason.dispute,
        status: RefundStatus.pending,
        succeededAt: null,
        requiresReimbursement: true,
        reimbursementStatus: ReimbursementStatus.pending,
        payment: { currency: 'eur' },
      })

      await service.markRefundCompleted({
        id: 're_orphan',
        charge: 'ch_1',
        amount: 60000,
        currency: 'eur',
        status: 'succeeded',
      } as never)

      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: 'pay-1',
            reason: RefundReason.dispute,
          }),
        })
      )
    })
  })

  // -------- Phase 4: previewParentCancel ---------------------------------

  describe('previewParentCancel', () => {
    it('returns mode=not_cancelable for terminal-status bookings (does not throw)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'cancelled' }))

      const result = await service.previewParentCancel('bg-1')

      expect(result.mode).toBe('not_cancelable')
      expect(result.totalRefundMajor).toBe('0.00')
      // Read-only: no Stripe call, no row write.
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      expect(prisma.refund.create).not.toHaveBeenCalled()
    })

    it('returns mode=void_auth when there are no succeeded payments yet', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'request' }))
      prisma.payment.findMany.mockResolvedValueOnce([])

      const result = await service.previewParentCancel('bg-1')

      expect(result.mode).toBe('void_auth')
      expect(result.items).toEqual([])
      expect(result.totalRefundMajor).toBe('0.00')
    })

    it('returns mode=grace with 100% refund of every succeeded payment when within the 48h window', async () => {
      const group = makeGroup({
        status: 'deposit_paid',
        gracePeriodEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.deposit, amount: new Prisma.Decimal('600.00') }),
        makePayment({
          id: 'pay-2',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
        }),
      ])

      const result = await service.previewParentCancel('bg-1')

      expect(result.mode).toBe('grace')
      expect(result.items).toHaveLength(2)
      expect(result.totalRefundMajor).toBe('2000.00')
      // Round-trip: deposit + balance both refund at full original amount.
      expect(result.items.find(i => i.kind === PaymentKind.deposit)?.refundAmountMajor).toBe(
        '600.00'
      )
      expect(result.items.find(i => i.kind === PaymentKind.balance)?.refundAmountMajor).toBe(
        '1400.00'
      )
    })

    it('returns mode=policy with deposit non-refundable + balance × tier% post-grace', async () => {
      const group = makeGroup({
        status: 'deposit_paid',
        // Grace ended an hour ago.
        gracePeriodEndsAt: new Date(Date.now() - 60 * 60 * 1000),
        // Session 90 days out → moderate policy 'first tier' returns 100%.
        session: { startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.deposit, amount: new Prisma.Decimal('600.00') }),
        makePayment({
          id: 'pay-2',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
        }),
      ])

      const result = await service.previewParentCancel('bg-1')

      expect(result.mode).toBe('policy')
      // Deposit row is in items but with refund=0 (non-refundable post-grace).
      expect(result.items.find(i => i.kind === PaymentKind.deposit)?.refundAmountMajor).toBe('0.00')
      // Balance × 100% = 1400.
      expect(result.items.find(i => i.kind === PaymentKind.balance)?.refundAmountMajor).toBe(
        '1400.00'
      )
      expect(result.totalRefundMajor).toBe('1400.00')
      expect(result.policy).toBeDefined()
    })

    it('returns mode=policy with 0% refund when past the strictest tier (last-minute cancellation)', async () => {
      const group = makeGroup({
        status: 'deposit_paid',
        gracePeriodEndsAt: new Date(Date.now() - 60 * 60 * 1000),
        // Session 5 days out → moderate's last tier (>=0d, 0%) matches.
        session: { startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findMany.mockResolvedValueOnce([
        makePayment({ kind: PaymentKind.deposit, amount: new Prisma.Decimal('600.00') }),
        makePayment({
          id: 'pay-2',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
        }),
      ])

      const result = await service.previewParentCancel('bg-1')

      expect(result.mode).toBe('policy')
      expect(result.totalRefundMajor).toBe('0.00')
    })
  })

  // -------- Phase 4: cancelForParent dispatch ----------------------------

  describe('cancelForParent', () => {
    it('rejects when booking is in a terminal status (defends against preview→confirm race)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'cancelled' }))

      await expect(
        service.cancelForParent({ bookingGroupId: 'bg-1', parentUserId: 'u-1' })
      ).rejects.toThrow(/cannot be cancelled/)
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('voids the auth + marks cancelled when no succeeded payments exist (pre-capture)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'request' }))
      prisma.payment.findMany.mockResolvedValueOnce([])
      const voidAuthFn = jest.fn().mockResolvedValue(undefined)

      const result = await service.cancelForParent({
        bookingGroupId: 'bg-1',
        parentUserId: 'u-1',
        voidAuthFn,
      })

      expect(result.mode).toBe('void_auth')
      expect(result.refunds).toEqual([])
      expect(voidAuthFn).toHaveBeenCalledWith('bg-1')
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
            cancelledReason: 'parent_cancel_pre_capture',
            cancelledByUserId: 'u-1',
          }),
        })
      )
      // No refund + no Stripe call.
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('dispatches to grace when within the 48h window', async () => {
      const group = makeGroup({
        status: 'deposit_paid',
        gracePeriodEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      // The dispatch path calls loadGroupOrThrow + succeededPayments twice
      // (outer cancelForParent + inner processGracePeriodRefundUnlocked).
      prisma.bookingGroup.findUnique.mockResolvedValue(group)
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1', amount: new Prisma.Decimal('600.00') })

      const result = await service.cancelForParent({
        bookingGroupId: 'bg-1',
        parentUserId: 'u-1',
      })

      expect(result.mode).toBe('grace')
      expect(stripe.client.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ refund_application_fee: true }),
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID })
      )
      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params).not.toHaveProperty('reverse_transfer')
    })

    it('dispatches to policy when post-grace', async () => {
      const group = makeGroup({
        status: 'deposit_paid',
        gracePeriodEndsAt: new Date(Date.now() - 60 * 60 * 1000),
        session: { startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
      })
      prisma.bookingGroup.findUnique.mockResolvedValue(group)
      prisma.payment.findMany.mockResolvedValue([
        makePayment({
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
        }),
      ])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1', amount: new Prisma.Decimal('1400.00') })

      const result = await service.cancelForParent({
        bookingGroupId: 'bg-1',
        parentUserId: 'u-1',
      })

      expect(result.mode).toBe('policy')
      expect(stripe.client.refunds.create).toHaveBeenCalledWith(
        // Per spec: policy keeps app fee, refunds balance × tier%. Direct
        // Charges drops `reverse_transfer` (asserted absent below) and routes
        // via `stripeAccount`.
        expect.objectContaining({ refund_application_fee: false }),
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID })
      )
      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params).not.toHaveProperty('reverse_transfer')
    })

    // -------- C1 audit fix: parent ownership defense-in-depth ------------

    it('throws ForbiddenException when the caller is a different parent (cross-parent attack)', async () => {
      // Booking belongs to PARENT_ID; caller resolves to a different Parent
      // row. The controller is the first auth gate, this is the second.
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'deposit_paid' }))
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'parent-other' })

      await expect(
        service.cancelForParent({ bookingGroupId: 'bg-1', parentUserId: 'u-other' })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when the requesting user has no Parent record', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'deposit_paid' }))
      prisma.parent.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.cancelForParent({ bookingGroupId: 'bg-1', parentUserId: 'u-non-parent' })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })
  })

  // -------- C2 audit fix: charge validation pre-flight -----------------

  describe('issueRefund charge validation', () => {
    it('throws when the live Stripe charge is not captured (still on auth)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup())
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.charges.retrieve.mockResolvedValueOnce(makeCharge({ captured: false }))

      await expect(service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })).rejects.toThrow(
        /not captured/
      )
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('throws when the live Stripe charge amount does not match the Payment row', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup())
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      // Payment row says €600; Stripe says €700. Indicates Payment row drift
      // or wrong charge id. Refund must not proceed.
      stripe.client.charges.retrieve.mockResolvedValueOnce(makeCharge({ amount: 70000 }))

      await expect(service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })).rejects.toThrow(
        /does not match Payment row/
      )
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('throws when the live Stripe charge currency does not match the Payment row', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup())
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.charges.retrieve.mockResolvedValueOnce(makeCharge({ currency: 'usd' }))

      await expect(service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })).rejects.toThrow(
        /does not match Payment row/
      )
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('throws when the charge has already been fully refunded (no remaining refundable amount)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup())
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      // Charge already 100% refunded on the Stripe side (e.g. manual
      // dashboard refund). Our `(paymentId, reason)` dedup would not catch
      // this — different `reason` would slip through. C2 catches it.
      stripe.client.charges.retrieve.mockResolvedValueOnce(makeCharge({ amount_refunded: 60000 }))

      await expect(service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })).rejects.toThrow(
        /only 0 remains refundable/
      )
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('retrieves the charge on the same connected account that owns the payment', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup())
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1', amount: new Prisma.Decimal('600.00') })

      await service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })

      expect(stripe.client.charges.retrieve).toHaveBeenCalledWith(
        'ch_1',
        undefined,
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID })
      )
    })
  })

  // -------- Phase 4: admin orchestrators ---------------------------------

  describe('cancelByCamp', () => {
    it('voids the auth (no refund) when there are no succeeded payments', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'request' }))
      prisma.payment.findMany.mockResolvedValueOnce([])
      const voidAuthFn = jest.fn().mockResolvedValue(undefined)

      const result = await service.cancelByCamp({
        bookingGroupId: 'bg-1',
        adminUserId: 'admin-1',
        voidAuthFn,
      })

      expect(result.mode).toBe('void_auth')
      expect(voidAuthFn).toHaveBeenCalled()
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('processes a 100% refund with refund_application_fee=true on the connected account when payments exist', async () => {
      // Outer cancelByCamp + inner processCampCancelRefundUnlocked each call
      // loadGroupOrThrow + succeededPayments — use mockResolvedValue so both
      // calls see the same mock.
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup({ status: 'deposit_paid' }))
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1', amount: new Prisma.Decimal('600.00') })

      const result = await service.cancelByCamp({
        bookingGroupId: 'bg-1',
        adminUserId: 'admin-1',
      })

      expect(result.mode).toBe('camp_cancel')
      expect(stripe.client.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ refund_application_fee: true }),
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID })
      )
      const [params] = stripe.client.refunds.create.mock.calls[0]
      expect(params).not.toHaveProperty('reverse_transfer')
    })

    it('rejects on terminal status (cannot camp-cancel a completed booking)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'completed' }))
      await expect(
        service.cancelByCamp({ bookingGroupId: 'bg-1', adminUserId: 'admin-1' })
      ).rejects.toThrow(/cannot be cancelled by camp/)
    })
  })

  describe('cancelByForceMajeure', () => {
    it('credit_note mode: marks cancelled with no Stripe refund (docs module handles credit note)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup({ status: 'deposit_paid' }))
      const voidAuthFn = jest.fn().mockResolvedValue(undefined)

      const result = await service.cancelByForceMajeure({
        bookingGroupId: 'bg-1',
        adminUserId: 'admin-1',
        mode: 'credit_note',
        voidAuthFn,
      })

      expect(result.mode).toBe('force_majeure_credit_note')
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
      // voidAuth is called for credit_note too, since any open auth should
      // be released regardless of refund mode.
      expect(voidAuthFn).toHaveBeenCalled()
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
            cancelledReason: 'force_majeure_credit_note',
          }),
        })
      )
    })

    it('cash mode + no captures: voids the auth, no Stripe refund', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'request' }))
      prisma.payment.findMany.mockResolvedValueOnce([])
      const voidAuthFn = jest.fn().mockResolvedValue(undefined)

      const result = await service.cancelByForceMajeure({
        bookingGroupId: 'bg-1',
        adminUserId: 'admin-1',
        mode: 'cash',
        voidAuthFn,
      })

      expect(result.mode).toBe('force_majeure_cash')
      expect(voidAuthFn).toHaveBeenCalled()
      expect(stripe.client.refunds.create).not.toHaveBeenCalled()
    })

    it('cash mode + captures: processes refund with refund_application_fee=false (platform keeps the app fee)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(makeGroup({ status: 'deposit_paid' }))
      prisma.payment.findMany.mockResolvedValue([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' })
      prisma.refund.create.mockResolvedValue({ id: 'r-1', amount: new Prisma.Decimal('600.00') })

      const result = await service.cancelByForceMajeure({
        bookingGroupId: 'bg-1',
        adminUserId: 'admin-1',
        mode: 'cash',
      })

      expect(result.mode).toBe('force_majeure_cash')
      expect(stripe.client.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ refund_application_fee: false }),
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID })
      )
    })

    it('rejects on terminal status', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'fully_refunded' }))
      await expect(
        service.cancelByForceMajeure({
          bookingGroupId: 'bg-1',
          adminUserId: 'admin-1',
          mode: 'cash',
        })
      ).rejects.toThrow(/force-majeure cancel is not applicable/)
    })
  })

  // -------- Phase 4 audit regression tests -------------------------------

  describe('issueRefund — Phase 2-pattern bug fix (audit Q1)', () => {
    /**
     * Stripe routinely returns `succeeded` synchronously for card refunds.
     * If issueRefund wrote that status without also incrementing
     * BookingGroup.refundedAmount, the eventual webhook would short-circuit
     * (wasSucceeded=true, isSucceeded=true) and the increment would never
     * run — leaving `refundedAmount` stuck at 0. The fix runs the increment
     * synchronously inside the same transaction; the webhook becomes a true
     * no-op on re-fire.
     */
    it('increments BookingGroup.refundedAmount synchronously when Stripe returns succeeded immediately', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'deposit_paid' }))
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValueOnce({
        id: 're_1',
        status: 'succeeded',
        charge: 'ch_1',
        amount: 60000,
        currency: 'eur',
      })
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-1', ...data }))

      await service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })

      // Inside the transaction, BookingGroup.update is called to increment
      // refundedAmount alongside the Refund row create.
      const incrementCall = prisma.bookingGroup.update.mock.calls.find(
        (c: any) => c[0]?.data?.refundedAmount?.increment !== undefined
      )
      expect(incrementCall).toBeDefined()
      expect(incrementCall![0]).toMatchObject({
        where: { id: 'bg-1' },
        data: { refundedAmount: { increment: expect.anything() } },
      })
    })

    it('does NOT increment refundedAmount when Stripe returns pending (webhook will drive)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup({ status: 'deposit_paid' }))
      prisma.payment.findMany.mockResolvedValueOnce([makePayment()])
      prisma.refund.findUnique.mockResolvedValue(null)
      stripe.client.refunds.create.mockResolvedValueOnce({
        id: 're_1',
        status: 'pending',
        charge: 'ch_1',
      })
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({ id: 'r-1', ...data }))

      await service.processGracePeriodRefund({ bookingGroupId: 'bg-1' })

      // Pending refund: no synchronous increment. The webhook handler will
      // run the increment when status transitions pending→succeeded.
      const incrementCall = prisma.bookingGroup.update.mock.calls.find(
        (c: any) => c[0]?.data?.refundedAmount?.increment !== undefined
      )
      expect(incrementCall).toBeUndefined()
    })
  })

  describe('recoverOrphanRefund — audit Q1b', () => {
    /**
     * When Stripe sends a refund webhook for a refund we didn't initiate
     * (lost dispute auto-refund, manual Stripe-dashboard refund), the
     * recovery path creates the Refund row from scratch. If we wrote the
     * row at status=succeeded matching Stripe's payload, the caller
     * (markRefundCompleted) would see wasSucceeded=true and skip the
     * increment. The fix: always write `pending` here; let the caller
     * drive the transition + increment.
     */
    it('writes status=pending regardless of Stripe payload status, so the caller can drive the increment', async () => {
      // Primary lookup misses → recovery path.
      prisma.refund.findUnique.mockResolvedValueOnce(null)
      // recoverOrphanRefund needs the payment + the existing-by-(paymentId,reason)=dispute check.
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        stripeChargeId: 'ch_1',
        currency: 'eur',
      })
      // No prior dispute row.
      prisma.refund.findUnique.mockResolvedValueOnce(null)
      // Phase 8: shouldFlagReimbursement queries the tranche table — default
      // mock returns 0 so requiresReimbursement=false here.
      prisma.refund.create.mockImplementation(async ({ data }: any) => ({
        id: 'r-recov',
        bookingGroupId: data.bookingGroupId,
        paymentId: data.paymentId,
        amount: new Prisma.Decimal('600.00'),
        reason: data.reason,
        status: data.status, // capture what was actually written
        succeededAt: null,
        requiresReimbursement: false,
        reimbursementStatus: ReimbursementStatus.not_required,
        payment: { currency: 'eur' },
      }))
      // markRefundCompleted's tx.refund.update + tx.bookingGroup.update.

      await service.markRefundCompleted({
        id: 're_orphan',
        charge: 'ch_1',
        amount: 60000,
        currency: 'eur',
        status: 'succeeded',
      } as never)

      // The recovery row was created with status=pending (NOT succeeded).
      const recoverCall = prisma.refund.create.mock.calls.find(
        (c: any) => c[0]?.data?.reason === RefundReason.dispute
      )
      expect(recoverCall).toBeDefined()
      expect(recoverCall![0].data.status).toBe(RefundStatus.pending)
    })
  })
})
