import {
  BadRequestException,
  ConflictException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../generated/client/client'
import { PaymentMode } from '../../generated/client/enums'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'
import { PaymentIntentsService } from '../billing/intents/payment-intents.service'
import { CaptureSchedulerService } from '../billing/captures/capture-scheduler.service'
import { RedisService } from '../redis/redis.service'
import { RefundsService } from '../billing/refunds/refunds.service'
import { RefundsNotificationsService } from '../billing/refunds/notifications/refunds-notifications.service'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import { BookingDeclineReason } from '@world-schools/wc-types'
import { BookingGroupsService, type BookingSubmitConsent } from './booking-groups.service'
import { EligibilityService } from './eligibility.service'

// Payments revamp (Spec v2.3): submit now carries checkout consent. Default
// fixture acknowledges it (the happy path); the consent-rejection test overrides.
const CONSENT: BookingSubmitConsent = {
  consentAcknowledged: true,
  policyTextShown: 'Cancellation policy + charge schedule shown at checkout',
  schemaVersion: 1,
  ipAddress: '203.0.113.7',
  userAgent: 'jest-test-agent',
}

/**
 * Phase 2 wiring tests. Focuses on the new submit → authorize → capture →
 * decline-cancel paths added in Phase 2; the existing draft/list/get tests
 * are covered separately at higher levels.
 */
describe('BookingGroupsService — Phase 2 billing wiring', () => {
  let service: BookingGroupsService
  let prisma: any
  let payments: any
  let refunds: any
  let refundsNotifications: any
  let eventEmitter: any
  let eligibilityService: any
  let captureScheduler: any

  function makeBookingGroup(overrides: Partial<any> = {}) {
    return {
      id: 'bg-1',
      bookingGroupNumber: 'BG-0001',
      status: 'draft',
      campId: 'camp-1',
      providerId: 'pr-1',
      parentId: 'p-1',
      sessionId: 'sess-1',
      totalAmount: new Prisma.Decimal('2000.00'),
      expiresAt: null,
      // Guardrails audit: submit/accept now read the children (eligibility gate
      // + per-age-group capacity tally), camp status/ageGroups, and session
      // status/endDate. Defaults: one child, published camp/session.
      bookings: [{ childId: 'child-1' }],
      camp: {
        name: 'Cool Camp',
        status: 'published',
        ageGroups: [{ min: 5, max: 18 }],
        // Payments revamp (Spec v2.3): per-Listing deposit toggle (default on).
        depositEnabled: true,
      },
      // C4 audit fix: session capacity fields are now selected by submit
      // so it can re-check availability. Default: 20-spot single-cohort
      // session — generous so existing fixtures aren't accidentally at-cap.
      session: {
        startDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 207 * 24 * 60 * 60 * 1000),
        status: 'published',
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
          // Deposit settings are the provider's (single source of truth).
          // Default fixture: 30% deposit.
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 30,
          depositFixedAmount: null,
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
        // Phase 8: submitForParent does a `count(where: providerId)` to
        // detect a provider's very first booking and dispatch the
        // `ProviderFirstBooking` notification. Default `2` so the
        // existing tests don't accidentally tip the count to 1.
        count: jest.fn().mockResolvedValue(2),
        // listForProvider lists rows + a global status groupBy for tab counts.
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        // Guardrails audit: capacity is now evaluated via `findMany` (child
        // DOBs for per-age-group tally). Default: no existing/incoming rows so
        // canonical fixtures aren't at-cap. Per-test mocks override.
        findMany: jest.fn().mockResolvedValue([]),
      },
      children: { findMany: jest.fn().mockResolvedValue([]) },
      payment: {
        findUniqueOrThrow: jest.fn(),
        // G2 accept guard: a live authorization must exist. Default: one
        // requires_capture payment (the happy path).
        findMany: jest.fn().mockResolvedValue([{ status: 'requires_capture' }]),
      },
      systemSettings: {
        upsert: jest.fn().mockResolvedValue({ defaultAppFee: new Prisma.Decimal('10') }),
      },
      // Payments revamp (Spec v2.3): consent snapshot written in the submit tx;
      // removed in the authorize-failure rollback.
      bookingConsentSnapshot: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Submit locks the session row FOR UPDATE before the capacity recount.
      $queryRaw: jest.fn().mockResolvedValue([]),
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
    // Payments revamp (Spec v2.3): deposit acceptance materialises + dispatches
    // the capture schedule via this service instead of the payout engine.
    captureScheduler = { materializeForBooking: jest.fn().mockResolvedValue(undefined) }
    refunds = {
      previewParentCancel: jest.fn(),
      cancelForParent: jest.fn(),
    }
    refundsNotifications = {
      notifyParentCancelled: jest.fn().mockResolvedValue(undefined),
    }
    eventEmitter = { emit: jest.fn() }
    // Guardrails audit: default to all-eligible so billing-wiring tests aren't
    // blocked by the eligibility gate. Eligibility-specific tests override this.
    eligibilityService = { evaluateChildren: jest.fn().mockResolvedValue([]) }

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
        { provide: RefundsService, useValue: refunds },
        { provide: RefundsNotificationsService, useValue: refundsNotifications },
        { provide: RedisService, useValue: redis },
        { provide: EligibilityService, useValue: eligibilityService },
        { provide: CaptureSchedulerService, useValue: captureScheduler },
      ],
    }).compile()
    service = module.get(BookingGroupsService)
    // Expose redisClient to tests that need to override the lock behavior.
    ;(service as any)._testRedisClient = redisClient
  })

  describe('submitForParent', () => {
    it('rejects a draft submit without consent acknowledgement (revamp Spec v2.3)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())

      await expect(
        service.submitForParent('u-1', 'bg-1', { ...CONSENT, consentAcknowledged: false })
      ).rejects.toBeInstanceOf(BadRequestException)

      // Never transitions / authorizes a payment without consent.
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
    })

    it('persists a consent snapshot (policy text + IP + charge schedule) in the submit transaction', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())
      payments.authorizeDeposit.mockResolvedValueOnce({
        paymentId: 'pay-1',
        paymentIntentId: 'pi_1',
        clientSecret: 'secret_1',
        amount: '600.00',
        currency: 'eur',
      })

      await service.submitForParent('u-1', 'bg-1', CONSENT)

      expect(prisma.bookingConsentSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingGroupId: 'bg-1',
            ipAddress: '203.0.113.7',
            gracePeriodHours: 24,
            chargeSchedule: expect.objectContaining({
              events: expect.any(Array),
            }),
          }),
        })
      )
    })

    it('writes app fee/deposit/balance snapshots and authorizes a deposit PaymentIntent', async () => {
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

      const result = await service.submitForParent('u-1', 'bg-1', CONSENT)

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
            // Frozen deposit terms snapshot (provider's 30% default fixture).
            depositSnapshot: expect.objectContaining({
              depositType: 'percentage',
              depositPercentage: 30,
              resolvedAmount: '600',
              schemaVersion: 1,
            }),
            paymentMode: PaymentMode.deposit_then_balance,
            balanceDueAt: expect.any(Date),
            // Payments revamp (Spec v2.3): request-anchored grace; no payout snapshot.
            graceDeadline: expect.any(Date),
            expiresAt: expect.any(Date),
          }),
        })
      )
      // Revamp: payout-mode snapshot is gone (Standard automatic payouts).
      const submitData = prisma.bookingGroup.updateMany.mock.calls[0][0].data
      expect(submitData).not.toHaveProperty('payoutMode')
      expect(submitData).not.toHaveProperty('transferDate')

      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
      expect(eventEmitter.emit).toHaveBeenCalled()

      expect(result.payment).toMatchObject({
        intentType: 'payment_intent',
        kind: 'deposit',
        clientSecret: 'secret_1',
        currency: 'eur',
      })
    })

    it('uses createSetupIntent for near-term no-deposit bookings (revamp Spec v2.3: full_at_booking unified onto SetupIntent)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
            status: 'published',
            availabilityType: 'single',
            totalSpots: 20,
            ageGroupSpots: null,
          },
          camp: {
            name: 'Cool Camp',
            status: 'published',
            ageGroups: [{ min: 5, max: 18 }],
            depositEnabled: true,
          },
          provider: {
            appFeePercentage: new Prisma.Decimal('10'),
            settings: {
              payoutMode: 'default_after_start',
              earlyPayoutOffsetDays: null,
              timezone: null,
              depositRequired: false,
              depositType: null,
              depositPercentage: null,
              depositFixedAmount: null,
            },
          },
        })
      )
      prisma.systemSettings.upsert.mockResolvedValueOnce({
        defaultAppFee: new Prisma.Decimal('10'),
      })
      payments.createSetupIntent.mockResolvedValueOnce({
        paymentId: 'pay-2',
        setupIntentId: 'si_2',
        clientSecret: 'secret_si2',
      })
      prisma.payment.findUniqueOrThrow.mockResolvedValueOnce({ currency: 'eur' })

      const result = await service.submitForParent('u-1', 'bg-1', CONSENT)

      // Near-term no-deposit no longer charges on-session at acceptance — it
      // saves the card and the engine captures off-session at the boundaries.
      expect(payments.createSetupIntent).toHaveBeenCalledWith('bg-1')
      expect(payments.authorizeFull).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(result.payment).toMatchObject({ intentType: 'setup_intent', kind: 'setup' })
    })

    it('uses createSetupIntent when no deposit and session start ≥90 days', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 127 * 24 * 60 * 60 * 1000),
            status: 'published',
            availabilityType: 'single',
            totalSpots: 20,
            ageGroupSpots: null,
          },
          camp: {
            name: 'Cool Camp',
            status: 'published',
            ageGroups: [{ min: 5, max: 18 }],
          },
          provider: {
            appFeePercentage: new Prisma.Decimal('10'),
            settings: {
              payoutMode: 'default_after_start',
              earlyPayoutOffsetDays: null,
              timezone: null,
              depositRequired: false,
              depositType: null,
              depositPercentage: null,
              depositFixedAmount: null,
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

      const result = await service.submitForParent('u-1', 'bg-1', CONSENT)

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

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toThrow('stripe down')

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

      const result = await service.submitForParent('u-1', 'bg-1', CONSENT)

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
      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('rejects when booking is in a non-resumable status (e.g. completed)', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup({ status: 'completed' }))
      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    // Payments revamp (Spec v2.3): the payout-mode snapshot at submit is removed
    // (the platform no longer schedules payouts — Standard automatic payouts).

    // ─── C4 audit fix: session-capacity recheck at submit ───

    it('throws ConflictException when the session is at capacity by the time submit runs', async () => {
      const dayMs = 24 * 60 * 60 * 1000
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        // 5-spot session.
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() + 200 * dayMs),
            endDate: new Date(Date.now() + 207 * dayMs),
            status: 'published',
            availabilityType: 'single',
            totalSpots: 5,
            ageGroupSpots: null,
          },
        })
      )
      // 1 participant on this draft; 5 already booked by other parents
      // → 5+1 > 5 → conflict. Capacity now counts child rows via findMany
      // (incoming first, then existing).
      prisma.booking.findMany = jest
        .fn()
        .mockResolvedValueOnce([{ child: { dateOfBirth: null } }]) // incoming: 1
        .mockResolvedValueOnce(Array.from({ length: 5 }, () => ({ child: { dateOfBirth: null } }))) // existing: 5

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toThrow(
        /Session is now full/
      )
      // Stripe call MUST NOT fire — capacity check runs before authorize.
      // Likewise, the status flip (`updateMany`) must not happen.
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('throws ConflictException when an age-group is exhausted', async () => {
      const dayMs = 24 * 60 * 60 * 1000
      // Children born ~2014 → ~12 at session start (in the 10-13 group).
      const olderDob = new Date('2014-01-01')
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          camp: {
            name: 'Cool Camp',
            status: 'published',
            ageGroups: [
              { min: 6, max: 9 },
              { min: 10, max: 13 },
            ],
          },
          session: {
            startDate: new Date(Date.now() + 200 * dayMs),
            endDate: new Date(Date.now() + 207 * dayMs),
            status: 'published',
            availabilityType: 'age_group',
            totalSpots: null,
            // 10-13 group has 1 spot; it is already taken → adding another
            // 12-year-old overflows that group.
            ageGroupSpots: [
              { ageGroupId: '6-9', spots: 3 },
              { ageGroupId: '10-13', spots: 1 },
            ],
          },
        })
      )
      prisma.booking.findMany = jest
        .fn()
        .mockResolvedValueOnce([{ child: { dateOfBirth: olderDob } }]) // incoming: 1 in 10-13
        .mockResolvedValueOnce([{ child: { dateOfBirth: olderDob } }]) // existing: 1 in 10-13

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toThrow(/10-13/)
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

      await service.submitForParent('u-1', 'bg-1', CONSENT)

      // No capacity check → no booking.count call, authorize proceeds.
      expect(prisma.booking.count).not.toHaveBeenCalled()
      expect(payments.authorizeDeposit).toHaveBeenCalledWith('bg-1')
    })

    // ─── C5 audit fix: submit-lock serializes concurrent retries ───

    it('throws ConflictException when another submit for the same booking is in flight (Redis lock contended)', async () => {
      // Override the default lock-acquire success with a `null` result —
      // mimicking another in-flight submit holding the SET-NX lock.
      ;(service as any)._testRedisClient.set.mockResolvedValueOnce(null)

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toThrow(
        /already in progress/
      )
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

      await service.submitForParent('u-1', 'bg-1', CONSENT)

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

      const result = await service.submitForParent('u-1', 'bg-1', CONSENT)

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
    it('flips first then materialises (revamp Spec v2.3: no capture-before-flip)', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        totalAmount: new Prisma.Decimal('600.00'),
        paymentMode: PaymentMode.deposit_then_balance,
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })

      const result = await service.acceptForProvider('pr-1', 'bg-1')

      // Flip-first + accept-and-retry: the engine drives the capture, not a
      // pre-flip capture call.
      expect(payments.captureForBookingGroup).not.toHaveBeenCalled()
      expect(captureScheduler.materializeForBooking).toHaveBeenCalledWith('bg-1', expect.any(Date))
      // Status-guarded transition (only flips from `request`).
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', status: 'request' },
          data: expect.objectContaining({
            status: 'accepted',
            respondedAt: expect.any(Date),
          }),
        })
      )
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'accepted' })
    })

    it('deposit booking (revamp Spec v2.3): flips first, then materialises the capture schedule (no capture-before-flip, no payout schedule)', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        totalAmount: new Prisma.Decimal('2000.00'),
        // Deposit flow → new capture engine.
        paymentMode: PaymentMode.deposit_then_balance,
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'GBP' } },
      })

      const result = await service.acceptForProvider('pr-1', 'bg-1')

      // Flip-first: no capture before the status transition (engine drives it).
      expect(payments.captureForBookingGroup).not.toHaveBeenCalled()
      // Engine materialisation replaces the legacy payout-schedule generation.
      expect(captureScheduler.materializeForBooking).toHaveBeenCalledWith('bg-1', expect.any(Date))
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', status: 'request' },
          data: expect.objectContaining({ status: 'accepted', respondedAt: expect.any(Date) }),
        })
      )
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'accepted' })
    })

    it('no-deposit booking (revamp Spec v2.3): also materialises via the engine (full_at_due unified)', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        totalAmount: new Prisma.Decimal('1500.00'),
        paymentMode: PaymentMode.full_at_due,
        camp: { name: 'C' },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-12-01T00:00:00Z'),
          endDate: new Date('2026-12-08T00:00:00Z'),
        },
        provider: { settings: { currency: 'EUR' } },
      })

      const result = await service.acceptForProvider('pr-1', 'bg-1')

      expect(payments.captureForBookingGroup).not.toHaveBeenCalled()
      expect(captureScheduler.materializeForBooking).toHaveBeenCalledWith('bg-1', expect.any(Date))
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'accepted' })
    })

    // Payments revamp (Spec v2.3): the capture-before-flip 412 stale-auth path is
    // removed (flip-first + accept-and-retry). A stale auth surfaces as a failed
    // scheduled capture with a 48h retry, not a blocked acceptance.
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
      // Status-guarded transition (only flips from `request`).
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', status: 'request' },
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
          declineReasonOther: 'Cannot provide 1:1 supervision for this activity',
        })
      ).rejects.toThrow('Stripe down')
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('rejects a required-note reason when the note is missing or too short, before any Stripe call', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValue({
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

      await expect(
        service.declineForProvider('pr-1', 'bg-1', {
          declineReason: BookingDeclineReason.SafeguardingConcerns,
        })
      ).rejects.toThrow(/at least 10 characters/)
      await expect(
        service.declineForProvider('pr-1', 'bg-1', {
          declineReason: BookingDeclineReason.Other,
          declineReasonOther: 'too short',
        })
      ).rejects.toThrow(/at least 10 characters/)
      await expect(
        service.declineForProvider('pr-1', 'bg-1', {
          declineReason: BookingDeclineReason.EligibilityCriteriaNotMet,
        })
      ).rejects.toThrow(/at least 10 characters/)
      await expect(
        service.declineForProvider('pr-1', 'bg-1', {
          declineReason: BookingDeclineReason.IncompleteInformation,
          declineReasonOther: 'too short',
        })
      ).rejects.toThrow(/at least 10 characters/)

      expect(payments.cancelForBookingGroup).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('persists the contextual note for a non-other reason (e.g. safety concern)', async () => {
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

      await service.declineForProvider('pr-1', 'bg-1', {
        declineReason: BookingDeclineReason.SafeguardingConcerns,
        declineReasonOther: '  Prior safeguarding incident on file  ',
      })

      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            declineReason: BookingDeclineReason.SafeguardingConcerns,
            declineReasonOther: 'Prior safeguarding incident on file',
          }),
        })
      )
    })

    it('accepts the incomplete_information reason with its now-mandatory note', async () => {
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
        declineReason: BookingDeclineReason.IncompleteInformation,
        declineReasonOther: 'Emergency contact details are missing',
      })

      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            declineReason: BookingDeclineReason.IncompleteInformation,
            declineReasonOther: 'Emergency contact details are missing',
          }),
        })
      )
      expect(result).toEqual({ bookingGroupId: 'bg-1', status: 'declined' })
    })
  })

  describe('listForProvider tabs', () => {
    const findManyWhere = () => prisma.bookingGroup.findMany.mock.calls[0][0].where

    it('the "all" tab queries every non-draft booking and counts include edge billing states', async () => {
      prisma.bookingGroup.groupBy.mockResolvedValueOnce([
        { status: 'request', _count: { id: 3 } },
        { status: 'completed', _count: { id: 5 } },
        { status: 'expired', _count: { id: 2 } },
        { status: 'declined', _count: { id: 1 } },
        { status: 'disputed', _count: { id: 4 } }, // edge state — only surfaces under "All"
      ])

      const result = await service.listForProvider('pr-1', { tab: 'all' })

      // "All" = every non-draft booking (future-proof, includes edge states).
      expect(findManyWhere()).toEqual({ providerId: 'pr-1', status: { not: 'draft' } })
      expect(result.meta.tabCounts).toEqual({
        all: 15, // 3 + 5 + 2 + 1 + 4 (incl. the disputed edge state)
        requests: 3,
        upcoming: 0,
        atCamp: 0,
        past: 5, // completed only
        expired: 2,
        declined: 1,
        cancelled: 0,
      })
    })

    it('the "past" tab filters to completed only (declined/expired are separate tabs now)', async () => {
      await service.listForProvider('pr-1', { tab: 'past' })
      expect(findManyWhere()).toEqual({ providerId: 'pr-1', status: { in: ['completed'] } })
    })

    it('the "expired" and "declined" tabs filter to their own status', async () => {
      await service.listForProvider('pr-1', { tab: 'expired' })
      expect(findManyWhere()).toEqual({ providerId: 'pr-1', status: { in: ['expired'] } })

      prisma.bookingGroup.findMany.mockClear()
      await service.listForProvider('pr-1', { tab: 'declined' })
      expect(findManyWhere()).toEqual({ providerId: 'pr-1', status: { in: ['declined'] } })
    })

    it('rejects a status that does not belong to the selected tab', async () => {
      await expect(
        service.listForProvider('pr-1', { tab: 'past', status: 'expired' as any })
      ).rejects.toThrow('Status does not match the selected tab')
    })
  })

  // ─── Guardrails audit: eligibility, camp/session gates, accept guards ───
  describe('booking guardrails', () => {
    it('submit blocks an ineligible child with a 422 and never authorizes a card', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())
      eligibilityService.evaluateChildren.mockResolvedValueOnce([
        {
          childId: 'child-1',
          eligible: false,
          failures: [{ code: 'age_out_of_range', message: 'Too old' }],
        },
      ])

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        UnprocessableEntityException
      )
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('submit blocks a child who already has an overlapping booking with a 422', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(makeBookingGroup())
      eligibilityService.evaluateChildren.mockResolvedValueOnce([
        {
          childId: 'child-1',
          eligible: false,
          failures: [
            {
              code: 'existing_booking_same_dates',
              message: 'This child already has a booking that overlaps these dates.',
            },
          ],
        },
      ])

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        UnprocessableEntityException
      )
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('submit blocks when the camp is not published', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          camp: {
            name: 'Cool Camp',
            status: 'archived',
            ageGroups: [{ min: 5, max: 18 }],
          },
        })
      )

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
    })

    it('submit blocks when the session has already started', async () => {
      const dayMs = 24 * 60 * 60 * 1000
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      prisma.bookingGroup.findFirst.mockResolvedValueOnce(
        makeBookingGroup({
          session: {
            startDate: new Date(Date.now() - 2 * dayMs), // already started
            endDate: new Date(Date.now() + 5 * dayMs),
            status: 'published',
            availabilityType: 'single',
            totalSpots: 20,
            ageGroupSpots: null,
          },
        })
      )

      await expect(service.submitForParent('u-1', 'bg-1', CONSENT)).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(payments.authorizeDeposit).not.toHaveBeenCalled()
    })

    it('accept rejects a request past its expiry deadline', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        sessionId: 'sess-1',
        totalAmount: new Prisma.Decimal('600.00'),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        camp: { name: 'C', ageGroups: [{ min: 5, max: 18 }] },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
          availabilityType: 'single',
          totalSpots: 20,
          ageGroupSpots: null,
        },
        provider: { settings: { currency: 'GBP' } },
      })

      await expect(service.acceptForProvider('pr-1', 'bg-1')).rejects.toBeInstanceOf(
        ConflictException
      )
      expect(payments.captureForBookingGroup).not.toHaveBeenCalled()
    })

    it('accept rejects when there is no live payment authorization', async () => {
      prisma.bookingGroup.findFirst.mockResolvedValueOnce({
        id: 'bg-1',
        status: 'request',
        bookingGroupNumber: 'BG-0001',
        parentId: 'p-1',
        sessionId: 'sess-1',
        totalAmount: new Prisma.Decimal('600.00'),
        expiresAt: null,
        camp: { name: 'C', ageGroups: [{ min: 5, max: 18 }] },
        parent: { userId: 'u-1' },
        session: {
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-08T00:00:00Z'),
          availabilityType: 'single',
          totalSpots: 20,
          ageGroupSpots: null,
        },
        provider: { settings: { currency: 'GBP' } },
      })
      prisma.payment.findMany.mockResolvedValueOnce([]) // no payment rows at all

      await expect(service.acceptForProvider('pr-1', 'bg-1')).rejects.toBeInstanceOf(
        PreconditionFailedException
      )
      expect(payments.captureForBookingGroup).not.toHaveBeenCalled()
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
        provider: {
          legalCompanyName: 'Cool Camp Ltd',
          settings: { currency: 'EUR' },
        },
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
