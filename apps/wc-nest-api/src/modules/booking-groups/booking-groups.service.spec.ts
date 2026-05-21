import { BadRequestException, PreconditionFailedException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../generated/client/client'
import { PaymentMode } from '../../generated/client/enums'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'
import {
  PaymentAuthorizationExpiredError,
  PaymentIntentsService,
} from '../billing/intents/payment-intents.service'
import { PayoutsService } from '../billing/payouts/payouts.service'
import { RedisService } from '../redis/redis.service'
import { RefundsService } from '../billing/refunds/refunds.service'
import { RefundsNotificationsService } from '../billing/refunds/notifications/refunds-notifications.service'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import { BookingDeclineReason } from '@world-schools/wc-types'
import { BookingGroupsService } from './booking-groups.service'

/**
 * Phase 2 wiring tests. Focuses on the new submit → authorize → capture →
 * decline-cancel paths added in Phase 2; the existing draft/list/get tests
 * are covered separately at higher levels.
 */
describe('BookingGroupsService — Phase 2 billing wiring', () => {
  let service: BookingGroupsService
  let prisma: any
  let payments: any
  let payouts: any
  let refunds: any
  let refundsNotifications: any
  let eventEmitter: any

  function makeBookingGroup(overrides: Partial<any> = {}) {
    return {
      id: 'bg-1',
      bookingGroupNumber: 'BG-0001',
      status: 'draft',
      providerId: 'pr-1',
      parentId: 'p-1',
      sessionId: 'sess-1',
      totalAmount: new Prisma.Decimal('2000.00'),
      expiresAt: null,
      camp: {
        name: 'Cool Camp',
        // Phase 9: deposit lives on the camp now (snapshotted from provider
        // on creation, editable per camp). Default fixture: 30% deposit.
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 30,
        depositFixedAmount: null,
      },
      // C4 audit fix: session capacity fields are now selected by submit
      // so it can re-check availability. Default: 20-spot single-cohort
      // session — generous so existing fixtures aren't accidentally at-cap.
      session: {
        startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        availabilityType: 'single',
        totalSpots: 20,
        ageGroupSpots: null,
      },
      provider: {
        appFeeCustom: true,
        appFeePercentage: new Prisma.Decimal('15'),
        settings: {
          payoutMode: 'default_after_start',
          earlyPayoutOffsetDays: null,
          timezone: 'America/New_York',
        },
      },
      parent: { userId: 'u-1' },
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = {
      parent: { findUnique: jest.fn() },
      bookingGroup: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        // C5 audit fix: submitForParent transitions draft→request via a
        // status-guarded updateMany. Default mock: 1 row updated (the
        // happy path — we won the race). Tests for the lost-race path
        // override this to return `{ count: 0 }`.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        updateMany: jest.fn(),
        // C4 audit fix: capacity check at submit issues two `count` calls
        // (current participants on this draft + other-booked spots for the
        // session). Default: 1 participant on this draft, 0 elsewhere — so
        // canonical fixtures don't trip the limit. Per-test mocks override.
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // currentParticipants
          .mockResolvedValueOnce(0) // otherBooked
          .mockResolvedValue(0),
      },
      payment: { findUniqueOrThrow: jest.fn() },
      systemSettings: { upsert: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    payments = {
      authorizeDeposit: jest.fn(),
      authorizeFull: jest.fn(),
      createSetupIntent: jest.fn(),
      captureForBookingGroup: jest.fn(),
      cancelForBookingGroup: jest.fn(),
      syncForBookingGroup: jest.fn(),
    }
    payouts = {
      computeDefaultTransferDate: jest.fn(
        (start: Date) => new Date(start.getTime() + 24 * 60 * 60 * 1000)
      ),
      generateScheduleForBooking: jest.fn().mockResolvedValue({ trancheCount: 1 }),
    }
    refunds = {
      previewParentCancel: jest.fn(),
      cancelForParent: jest.fn(),
    }
    refundsNotifications = {
      notifyParentCancelled: jest.fn().mockResolvedValue(undefined),
    }
    eventEmitter = { emit: jest.fn() }

    // C5 audit fix: submit acquires a Redis SET-NX lock. Default mock: lock
    // is always available (`set` returns 'OK'). Tests that exercise the
    // contended path override `redisClient.set` to return `null`.
    const redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    const redis = { getClient: () => redisClient }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingGroupsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: {} },
        { provide: ProfilePhotoService, useValue: { generatePhotoUrl: jest.fn() } },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: PaymentIntentsService, useValue: payments },
        { provide: PayoutsService, useValue: payouts },
        { provide: RefundsService, useValue: refunds },
        { provide: RefundsNotificationsService, useValue: refundsNotifications },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()
    service = module.get(BookingGroupsService)
    // Expose redisClient to tests that need to override the lock behavior.
    ;(service as any)._testRedisClient = redisClient
  })

  describe('submitForParent', () => {
    it('writes app fee/deposit/balance/transferDate snapshots and authorizes a deposit PaymentIntent', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-1',
        paymentIntentId: 'pi_1',
        clientSecret: 'secret_1',
        amount: '600.00',
        currency: 'eur',
      })

      const result = await service.submitForParent('u-1', 'bg-1')

      // C5 audit fix: the draft→request transition is a status-guarded
      // `updateMany` (so concurrent submits can't both transition). Phase 8:
      // transferDate is no longer written here (it's a cached pointer
      // derived from the tranche schedule generated at acceptance).
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', status: 'draft' },
          data: expect.objectContaining({
            status: 'request',
            appFeePercentageSnapshot: expect.anything(),
            serviceFeeAmount: expect.anything(),
            depositAmount: expect.anything(),
            paymentMode: PaymentMode.deposit_then_balance,
            balanceDueAt: expect.any(Date),
            payoutMode: 'default_after_start',
            payoutOffsetDaysSnapshot: null,
            expiresAt: expect.any(Date),
          }),
        })
      )

      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
      expect(eventEmitter.emit).toHaveBeenCalled()

      expect(result.payment).toMatchObject({
        intentType: 'payment_intent',
        kind: 'deposit',
        clientSecret: 'secret_1',
        currency: 'eur',
      })
    })

    it('uses authorizeFull when no deposit and session start <90 days', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: { startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          camp: {
            name: 'Cool Camp',
            depositRequired: false,
            depositType: null,
            depositPercentage: null,
            depositFixedAmount: null,
          },
          provider: {
            appFeePercentage: new Prisma.Decimal('10'),
            settings: {
              payoutMode: 'default_after_start',
              earlyPayoutOffsetDays: null,
              timezone: null,
            },
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeFull.mockResolvedValueOnce({
        paymentId: 'pay-2',
        paymentIntentId: 'pi_2',
        clientSecret: 'secret_2',
        amount: '2000.00',
        currency: 'eur',
      })

      const result = await service.submitForParent('u-1', 'bg-1')

      expect(payments.authorizeFull).toHaveBeenCalledWith('bg-1')
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(result.payment.kind).toBe('full')
    })

    it('uses createSetupIntent when no deposit and session start ≥90 days', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: { startDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) },
          camp: {
            name: 'Cool Camp',
            depositRequired: false,
            depositType: null,
            depositPercentage: null,
            depositFixedAmount: null,
          },
          provider: {
            appFeePercentage: new Prisma.Decimal('10'),
            settings: {
              payoutMode: 'default_after_start',
              earlyPayoutOffsetDays: null,
              timezone: null,
            },
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.createSetupIntent.mockResolvedValueOnce({
        paymentId: 'pay-3',
        setupIntentId: 'si_1',
        clientSecret: 'secret_si',
      })
      prisma.payment.findUniqueOrThrow.mockResolvedValueOnce({ currency: 'eur' })

      const result = await service.submitForParent('u-1', 'bg-1')

      expect(payments.createSetupIntent).toHaveBeenCalledWith('bg-1')
      expect(result.payment).toMatchObject({
        intentType: 'setup_intent',
        kind: 'setup',
        clientSecret: 'secret_si',
      })
    })

    it('rolls back to draft when authorize throws', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeDeposit.mockRejectedValueOnce(new Error('stripe down'))

      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toThrow('stripe down')

      // C5 audit fix: the forward transition is now `updateMany` (status-
      // guarded), but the rollback on Stripe failure stays as a plain
      // `update` since at rollback time we know the row is in `request`
      // status. So we should see: one updateMany (forward), one update
      // (rollback to draft).
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledTimes(1)
      const updateCalls = prisma.bookingGroup.update.mock.calls
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0][0].data).toMatchObject({ status: 'draft', expiresAt: null })
    })

    it('resumes (returns existing intent client secret) when status is already request', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          status: 'request',
          paymentMode: PaymentMode.deposit_then_balance,
          depositAmount: new Prisma.Decimal('600.00'),
          totalAmount: new Prisma.Decimal('2000.00'),
        })
      )
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-1',
        paymentIntentId: 'pi_existing',
        clientSecret: 'secret_resume',
        amount: '600.00',
        currency: 'eur',
      })

      const result = await service.submitForParent('u-1', 'bg-1')

      // Resume must NOT re-write snapshots — they already exist.
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
      expect(prisma.systemSettings.upsert).not.toHaveBeenCalled()
      // Resume routes through the same authorize call (idempotent: returns
      // existing PaymentIntent's fresh client secret instead of creating a new one).
      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
      expect(result).toMatchObject({
        bookingGroupId: 'bg-1',
        status: 'request',
        payment: expect.objectContaining({ clientSecret: 'secret_resume', kind: 'deposit' }),
      })
    })

    it('rejects resume when paymentMode snapshot is missing (corrupted state)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({ status: 'request', paymentMode: null })
      )
      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('rejects when booking is in a non-resumable status (e.g. completed)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup({ status: 'completed' }))
      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    // ─── Phase 8: payout-mode snapshot at submit ───

    it('Phase 8: snapshots payoutMode=offset_days + offset days when provider is on offset-days mode', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          provider: {
            appFeeCustom: true,
            appFeePercentage: new Prisma.Decimal('15'),
            settings: {
              depositRequired: true,
              depositType: 'percentage',
              depositPercentage: 30,
              depositFixedAmount: null,
              payoutMode: 'offset_days',
              earlyPayoutOffsetDays: 7,
              timezone: 'America/New_York',
            },
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-9',
        paymentIntentId: 'pi_9',
        clientSecret: 'secret_9',
        amount: '600.00',
        currency: 'eur',
      })

      await service.submitForParent('u-1', 'bg-1')

      // Snapshotted on the booking — frozen so post-submit edits to provider
      // settings don't retroactively shift this in-flight booking. C5 audit
      // fix: forward transition is `updateMany`.
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', status: 'draft' },
          data: expect.objectContaining({
            payoutMode: 'offset_days',
            payoutOffsetDaysSnapshot: 7,
          }),
        })
      )
    })

    it('Phase 8: snapshots payoutMode=policy_staged with no offset days when provider is policy-staged', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          provider: {
            appFeeCustom: true,
            appFeePercentage: new Prisma.Decimal('15'),
            settings: {
              depositRequired: true,
              depositType: 'percentage',
              depositPercentage: 30,
              depositFixedAmount: null,
              payoutMode: 'policy_staged',
              earlyPayoutOffsetDays: null,
              timezone: 'America/New_York',
            },
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-10',
        paymentIntentId: 'pi_10',
        clientSecret: 'secret_10',
        amount: '600.00',
        currency: 'eur',
      })

      await service.submitForParent('u-1', 'bg-1')

      // C5 audit fix: forward transition is `updateMany`.
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payoutMode: 'policy_staged',
            payoutOffsetDaysSnapshot: null,
          }),
        })
      )
    })

    // ─── C4 audit fix: session-capacity recheck at submit ───

    it('throws ConflictException when the session is at capacity by the time submit runs', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        // 5-spot session.
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
            availabilityType: 'single',
            totalSpots: 5,
            ageGroupSpots: null,
          },
        })
      )
      // 1 participant on this draft; 5 already booked by other parents
      // → 5+1 > 5 → conflict.
      prisma.booking.count = jest
        .fn()
        .mockResolvedValueOnce(1) // currentParticipants
        .mockResolvedValueOnce(5) // otherBooked

      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toThrow(/Session is now full/)
      // Stripe call MUST NOT fire — capacity check runs before authorize.
      // Likewise, the status flip (`updateMany`) must not happen.
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })

    it('throws ConflictException when summed age-group capacity is exhausted', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
            availabilityType: 'age_group',
            totalSpots: null,
            // Two age groups, 3 + 4 = 7 total. 1 on this draft + 7 elsewhere
            // → 8 > 7 → conflict.
            ageGroupSpots: [{ spots: 3 }, { spots: 4 }],
          },
        })
      )
      prisma.booking.count = jest
        .fn()
        .mockResolvedValueOnce(1) // currentParticipants
        .mockResolvedValueOnce(7) // otherBooked

      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toThrow(/Session is now full/)
    })

    it('skips capacity enforcement when the session has unlimited spots (totalSpots=null)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
            availabilityType: 'single',
            totalSpots: null,
            ageGroupSpots: null,
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-cap',
        paymentIntentId: 'pi_cap',
        clientSecret: 'secret_cap',
        amount: '600.00',
        currency: 'eur',
      })

      await service.submitForParent('u-1', 'bg-1')

      // No capacity check → no booking.count call, authorize proceeds.
      expect(prisma.booking.count).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
    })

    // ─── C5 audit fix: submit-lock serializes concurrent retries ───

    it('throws ConflictException when another submit for the same booking is in flight (Redis lock contended)', async () => {
      // Override the default lock-acquire success with a `null` result —
      // mimicking another in-flight submit holding the SET-NX lock.
      ;(service as any)._testRedisClient.set.mockResolvedValueOnce(null)

      await expect(service.submitForParent('u-1', 'bg-1')).rejects.toThrow(/already in progress/)
      // Critically: NO parent lookup, NO PaymentIntent created, NO row touched.
      expect(prisma.parent.findUnique).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
    })

    it('skips capacity enforcement on the resume path (status=request — booking already counted)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          status: 'request',
          paymentMode: PaymentMode.deposit_then_balance,
          depositAmount: new Prisma.Decimal('600.00'),
          // Even with 0 spots and 100 already booked, resume MUST proceed —
          // this booking is already in the count.
          session: {
            startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
            availabilityType: 'single',
            totalSpots: 5,
            ageGroupSpots: null,
          },
        })
      )
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-r',
        paymentIntentId: 'pi_r',
        clientSecret: 'secret_r',
        amount: '600.00',
        currency: 'eur',
      })

      await service.submitForParent('u-1', 'bg-1')

      expect(prisma.booking.count).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
    })

    it('falls back to the resume path when a concurrent submit beat us to the status flip', async () => {
      // Both submits passed the initial `findFirst` check seeing status='draft'.
      // First submit transitioned successfully (count: 1); we are the second
      // submit and our `updateMany` returns count: 0. The fallback re-reads
      // the booking — now in `request` — and routes through the same
      // `authorizeForPaymentMode` path the resume case uses, returning a
      // valid clientSecret instead of crashing the parent.
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup({ status: 'draft' }))
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      // Lost the race: status-guarded updateMany affected 0 rows.
      prisma.bookingGroup.updateMany.mockResolvedValueOnce({ count: 0 })
      // The fallback re-reads the booking and sees it's now in `request`.
      prisma.bookingGroup.findUnique.mockResolvedValueOnce({
        status: 'request',
        paymentMode: PaymentMode.deposit_then_balance,
        depositAmount: new Prisma.Decimal('600.00'),
        totalAmount: new Prisma.Decimal('2000.00'),
      })
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-race',
        paymentIntentId: 'pi_race',
        clientSecret: 'secret_race',
        amount: '600.00',
        currency: 'eur',
      })

      const result = await service.submitForParent('u-1', 'bg-1')

      // We did NOT cause a second status flip — the first submitter did.
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledTimes(1)
      // The fallback re-read the booking before delegating to authorize.
      expect(prisma.bookingGroup.findUnique).toHaveBeenCalled()
      // The user still got a usable response.
      expect(result).toMatchObject({
        bookingGroupId: 'bg-1',
        status: 'request',
        payment: expect.objectContaining({ clientSecret: 'secret_race' }),
      })
    })
  })

  describe('acceptForProvider', () => {
    it('captures the auth, sets gracePeriodEndsAt = +48h, and transitions to accepted', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        totalAmount: new Prisma.Decimal('600.00'),
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })
      payments.captureForBookingGroup.mockResolvedValueOnce(['pay-1'])

      const result = await service.acceptForProvider('pr-1', 'bg-1')

      expect(payments.captureForBookingGroup).toHaveBeenCalledWith('bg-1')
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1' },
          data: expect.objectContaining({
            status: 'accepted',
            respondedAt: expect.any(Date),
            gracePeriodEndsAt: expect.any(Date),
          }),
        })
      )
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'accepted' })
    })

    it('translates PaymentAuthorizationExpiredError into 412 and leaves status unchanged', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        totalAmount: new Prisma.Decimal('600.00'),
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })
      payments.captureForBookingGroup.mockRejectedValueOnce(
        new PaymentAuthorizationExpiredError('pay-1')
      )

      await expect(service.acceptForProvider('pr-1', 'bg-1')).rejects.toBeInstanceOf(
        PreconditionFailedException
      )
      // Status update should NOT have been issued — booking stays in request.
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })
  })

  describe('syncPaymentForParent', () => {
    it('validates parent ownership then delegates to PaymentIntentsService.syncForBookingGroup', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({ id: 'bg-1' })
      payments.syncForBookingGroup.mockResolvedValueOnce(undefined)

      const result = await service.syncPaymentForParent('u-1', 'bg-1')

      expect(payments.syncForBookingGroup).toHaveBeenCalledWith('bg-1')
      expect(result).toEqual({ bookingGroupId: 'bg-1', synced: true })
    })

    it('rejects when the booking does not belong to the parent', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(null)

      await expect(service.syncPaymentForParent('u-1', 'bg-someone-else')).rejects.toThrow()
      expect(payments.syncForBookingGroup).not.toHaveBeenCalled()
    })
  })

  describe('declineForProvider', () => {
    it('cancels the auth before flipping status to declined and persists the controlled-list reason', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })
      payments.cancelForBookingGroup.mockResolvedValueOnce(['pay-1'])

      const result = await service.declineForProvider('pr-1', 'bg-1', {
        declineReason: BookingDeclineReason.CapacityOrScheduling,
        providerNote: 'no spots left',
      })

      expect(payments.cancelForBookingGroup).toHaveBeenCalledWith('bg-1', 'requested_by_customer')
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1' },
          data: expect.objectContaining({
            status: 'declined',
            respondedAt: expect.any(Date),
            declineReason: BookingDeclineReason.CapacityOrScheduling,
            declineReasonOther: null,
          }),
        })
      )
      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ providerNote: 'no spots left' }),
        })
      )
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'declined' })
    })

    it('leaves status as request when cancel fails (transient Stripe error)', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })
      payments.cancelForBookingGroup.mockRejectedValueOnce(new Error('Stripe down'))

      await expect(
        service.declineForProvider('pr-1', 'bg-1', {
          declineReason: BookingDeclineReason.OperationalInability,
        })
      ).rejects.toThrow('Stripe down')
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })
  })

  // The frontend hydrate flow on reload reads `payment` from this endpoint to
  // decide whether to render the Stripe form or the success panel. The shape
  // is the contract: { id, kind, status, intentType } where intentType is
  // resolved from whether the row's stripeSetupIntentId is set.
  describe('getForParent — payment summary', () => {
    function makeFindFirstResult(overrides: Partial<any> = {}) {
      return {
        id: 'bg-1',
        bookingGroupNumber: 'BG-0001',
        status: 'request',
        campId: 'c-1',
        sessionId: 's-1',
        providerId: 'pr-1',
        specialRequest: null,
        subtotalAmount: new Prisma.Decimal('600.00'),
        discountTotal: new Prisma.Decimal('0'),
        totalAmount: new Prisma.Decimal('600.00'),
        depositAmount: new Prisma.Decimal('180.00'),
        paidAmount: new Prisma.Decimal('0'),
        refundedAmount: new Prisma.Decimal('0'),
        requestedAt: new Date('2026-04-28T00:00:00Z'),
        respondedAt: null,
        expiresAt: null,
        updatedAt: new Date('2026-04-28T00:00:00Z'),
        camp: {
          id: 'c-1',
          name: 'Cool Camp',
          slug: 'cool-camp',
          photos: [],
          locationLat: null,
          locationLng: null,
          locationName: null,
          locationAddress: null,
          locationPlaceId: null,
        },
        session: {
          name: 'Summer 1',
          startDate: new Date('2026-07-01T00:00:00Z'),
          endDate: new Date('2026-07-08T00:00:00Z'),
          sessionDayType: 'full_day',
          arrivalTime: null,
          departureTime: null,
        },
        provider: { legalCompanyName: 'Cool Camp Ltd' },
        bookings: [],
        payments: [],
        ...overrides,
      }
    }

    it('returns intentType "payment_intent" when the latest Payment is for a PaymentIntent', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeFindFirstResult({
          payments: [
            {
              id: 'pay-1',
              kind: 'deposit',
              status: 'requires_capture',
              stripePaymentIntentId: 'pi_1',
              stripeSetupIntentId: null,
            },
          ],
        })
      )

      const result = await service.getForParent('u-1', 'bg-1')

      expect(result.payment).toEqual({
        id: 'pay-1',
        kind: 'deposit',
        status: 'requires_capture',
        intentType: 'payment_intent',
      })
    })

    it('returns intentType "setup_intent" when the latest Payment row was bootstrapped from a SetupIntent', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeFindFirstResult({
          payments: [
            {
              id: 'pay-2',
              kind: 'full',
              status: 'processing',
              stripePaymentIntentId: null,
              stripeSetupIntentId: 'seti_1',
            },
          ],
        })
      )

      const result = await service.getForParent('u-1', 'bg-1')

      expect(result.payment).toEqual({
        id: 'pay-2',
        kind: 'full',
        status: 'processing',
        intentType: 'setup_intent',
      })
    })

    it('returns payment: null when no Payment row exists yet (legacy or pre-submit booking)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeFindFirstResult({ payments: [] }))

      const result = await service.getForParent('u-1', 'bg-1')

      expect(result.payment).toBeNull()
    })
  })
})
