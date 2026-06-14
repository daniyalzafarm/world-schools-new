import { BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import Stripe from 'stripe'
import { ConfigService } from '../../../config/config.service'
import { Prisma } from '../../../generated/client/client'
import { PaymentKind, PaymentStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeConnectService } from '../../provider/stripe-connect/stripe-connect.service'
import { StripeService } from '../../stripe/stripe.service'
import { PaymentAuthorizationExpiredError, PaymentIntentsService } from './payment-intents.service'

describe('PaymentIntentsService', () => {
  let service: PaymentIntentsService
  let prisma: any
  let stripe: any
  let stripeConnect: any

  function makeGroup(overrides: Partial<any> = {}) {
    return {
      id: 'bg-1',
      bookingGroupNumber: 'BG-0001',
      parentId: 'p-1',
      providerId: 'pr-1',
      totalAmount: new Prisma.Decimal('2000.00'),
      depositAmount: new Prisma.Decimal('600.00'),
      serviceFeeAmount: new Prisma.Decimal('300.00'),
      appFeePercentageSnapshot: new Prisma.Decimal('15'),
      balanceDueAt: new Date('2026-09-01T00:00:00Z'),
      parent: {
        id: 'p-1',
        userId: 'u-1',
        stripeCustomerId: 'cus_1',
        user: { email: 'a@b.c', firstName: 'Ada', lastName: 'L' },
      },
      provider: { stripeAccountId: 'acct_1', settings: { currency: 'eur' } },
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = {
      bookingGroup: { findUnique: jest.fn(), update: jest.fn() },
      payment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        // `updateMany` is the status-guarded write path used by the four
        // `mark*` webhook handlers (B1). Default `count: 1` so the
        // post-claim branch (BookingGroup increment in `markSucceeded`)
        // runs in tests that don't care about race outcomes; individual
        // tests can override to `0` to exercise the lost-race branch.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      parent: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      savedPaymentMethod: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      providerConnectCustomer: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    stripe = {
      client: {
        paymentIntents: {
          create: jest.fn(),
          capture: jest.fn(),
          cancel: jest.fn(),
          retrieve: jest.fn(),
        },
        setupIntents: { create: jest.fn(), retrieve: jest.fn(), cancel: jest.fn() },
        customers: { create: jest.fn() },
        paymentMethods: { retrieve: jest.fn() },
      },
    }
    stripeConnect = {
      assertProviderPaymentReady: jest.fn().mockResolvedValue(undefined),
      // H4 audit fix: off-session balance charge calls the live variant.
      assertProviderPaymentReadyLive: jest.fn().mockResolvedValue(undefined),
    }

    const config = {
      billingConfig: {
        maxAttempts: 2,
        retryHours: 24,
        stepUpWindowHours: 48,
        cronIntervalMinutes: 30,
        authExpiryWarnDays: 5,
        authExpiryCancelDays: 6,
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIntentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: StripeConnectService, useValue: stripeConnect },
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(PaymentIntentsService)
  })

  describe('authorizeDeposit', () => {
    it('creates a manual-capture PaymentIntent on the connected account (Direct Charges signature)', async () => {
      const group = makeGroup()
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      // Direct Charges: connect customer lookup is the first DB hit.
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 'secret_1',
        status: 'requires_payment_method',
      })
      prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' })

      const result = await service.authorizeDeposit('bg-1')

      const [params, opts] = stripe.client.paymentIntents.create.mock.calls[0]
      expect(params).toMatchObject({
        amount: 60000, // 600.00 EUR → 60000 minor units
        currency: 'eur',
        customer: 'cus_1',
        capture_method: 'manual',
        setup_future_usage: 'off_session',
        application_fee_amount: 9000, // 15% of 600 = 90.00 EUR → 9000 minor units
        // H2 audit: lock down redirect-only PMs so the deferred-flow's
        // `redirect: 'if_required'` only ever redirects for 3DS step-up.
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        statement_descriptor_suffix: 'BG-BG-0001',
        description: expect.stringContaining('World Camps booking BG-0001'),
      })
      // Direct Charges: destination-charges params are gone — the connected
      // account is on the `stripeAccount` request option, not the body.
      expect(params).not.toHaveProperty('on_behalf_of')
      expect(params).not.toHaveProperty('transfer_data')
      expect(params).not.toHaveProperty('transfer_group')
      expect(params.metadata).toMatchObject({ bookingGroupId: 'bg-1', kind: 'deposit' })
      expect(params.metadata.paymentId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      const createCall = prisma.payment.create.mock.calls[0][0]
      expect(createCall.data.id).toBe(params.metadata.paymentId)
      expect(createCall.data.stripeAccountId).toBe('acct_1')
      expect(createCall.data.providerConnectCustomerId).toBe('pcc-1')
      expect(opts.idempotencyKey).toMatch(/^pi:bg:bg-1:deposit:[0-9a-f]{16}$/)
      expect(opts.stripeAccount).toBe('acct_1')
      expect(result).toMatchObject({
        paymentIntentId: 'pi_1',
        clientSecret: 'secret_1',
        currency: 'eur',
      })
    })

    it('returns the existing intent + fresh client_secret when a non-terminal Payment exists (idempotent on retry)', async () => {
      const group = makeGroup()
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-1',
        stripePaymentIntentId: 'pi_existing',
        amount: new Prisma.Decimal('600.00'),
        currency: 'eur',
        // Direct Charges: stripeAccount needed to retrieve the existing intent.
        stripeAccountId: 'acct_1',
      })
      stripe.client.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_existing',
        client_secret: 'secret_fresh',
        status: 'requires_payment_method',
      })

      const result = await service.authorizeDeposit('bg-1')

      expect(stripe.client.paymentIntents.create).not.toHaveBeenCalled()
      expect(stripe.client.paymentIntents.retrieve).toHaveBeenCalledWith('pi_existing', undefined, {
        stripeAccount: 'acct_1',
      })
      expect(result).toMatchObject({ paymentIntentId: 'pi_existing', clientSecret: 'secret_fresh' })
    })

    it('rejects when appFeePercentageSnapshot is missing', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(
        makeGroup({ appFeePercentageSnapshot: null })
      )
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })

      await expect(service.authorizeDeposit('bg-1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('asserts provider is payment-ready before creating an intent', async () => {
      stripeConnect.assertProviderPaymentReady.mockRejectedValueOnce(new Error('not ready'))
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(makeGroup())
      await expect(service.authorizeDeposit('bg-1')).rejects.toThrow('not ready')
      expect(stripe.client.paymentIntents.create).not.toHaveBeenCalled()
    })
  })

  describe('captureForBookingGroup', () => {
    it('captures every requires_capture payment with idempotency key derived from attempt and advances BookingGroup → deposit_paid', async () => {
      // Regression for the bug where the BookingGroup status stayed at
      // `accepted` after capture: `captureForBookingGroup` used to write
      // `Payment.status = succeeded` synchronously, which then caused the
      // `payment_intent.succeeded` webhook's idempotency check
      // (`if status === succeeded return`) to short-circuit before the
      // BookingGroup advance + paidAmount increment ever ran. Now the capture
      // path delegates to `markSucceeded` so the full transition runs
      // synchronously and the eventual webhook is a true no-op.
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          bookingGroupId: 'bg-1',
          stripePaymentIntentId: 'pi_1',
          attemptCount: 0,
          stripeChargeId: null,
        },
      ])
      stripe.client.paymentIntents.capture.mockResolvedValueOnce({
        id: 'pi_1',
        status: 'succeeded',
        latest_charge: 'ch_1',
        amount: 60000,
        currency: 'eur',
      })
      // markSucceeded → findPaymentForIntent → findUnique by stripePaymentIntentId.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        status: PaymentStatus.requires_capture,
      })
      // First bookingGroup.update — increment paidAmount, return updated row.
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'accepted',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('600.00'),
        refundedAmount: new Prisma.Decimal('0'),
      })

      const result = await service.captureForBookingGroup('bg-1')

      const [, , opts] = stripe.client.paymentIntents.capture.mock.calls[0]
      expect(opts.idempotencyKey).toMatch(/^pi:capture:pay-1:[0-9a-f]{16}$/)
      // The Payment row gets the succeeded status update inside markSucceeded
      // (B1: status-guarded updateMany).
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.succeeded,
            stripeChargeId: 'ch_1',
          }),
        })
      )
      // BookingGroup is updated TWICE: first to increment paidAmount, second
      // to flip status to deposit_paid.
      const bgUpdateCalls = prisma.bookingGroup.update.mock.calls
      expect(bgUpdateCalls.length).toBeGreaterThanOrEqual(2)
      expect(bgUpdateCalls[0][0].data).toMatchObject({
        paidAmount: { increment: expect.anything() },
      })
      expect(bgUpdateCalls[1][0].data).toEqual({ status: 'deposit_paid' })
      expect(result).toEqual(['pay-1'])
    })

    it('persists requires_action without advancing BookingGroup when capture triggers a 3DS step-up', async () => {
      // Edge case: post-capture 3DS step-up. We update the row's status only;
      // the eventual `payment_intent.succeeded` webhook drives the advance.
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          bookingGroupId: 'bg-1',
          stripePaymentIntentId: 'pi_1',
          attemptCount: 0,
          stripeChargeId: null,
        },
      ])
      stripe.client.paymentIntents.capture.mockResolvedValueOnce({
        id: 'pi_1',
        status: 'requires_action',
        latest_charge: null,
      })

      const result = await service.captureForBookingGroup('bg-1')

      // B2: capture's non-succeeded branch uses status-guarded updateMany.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.requires_action }),
        })
      )
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
      expect(result).toEqual(['pay-1'])
    })

    it('returns empty array when no requires_capture payments exist (idempotent no-op)', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([])
      const result = await service.captureForBookingGroup('bg-1')
      expect(result).toEqual([])
      expect(stripe.client.paymentIntents.capture).not.toHaveBeenCalled()
    })

    it('throws PaymentAuthorizationExpiredError on stale-auth error and marks the row canceled', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          stripePaymentIntentId: 'pi_1',
          attemptCount: 0,
          stripeChargeId: null,
        },
      ])
      const stripeErr = Object.assign(
        new Stripe.errors.StripeInvalidRequestError({
          type: 'invalid_request_error',
          message: 'auth expired',
        } as never),
        { code: 'payment_intent_unexpected_state', message: 'auth expired' }
      )
      stripe.client.paymentIntents.capture.mockRejectedValueOnce(stripeErr)

      await expect(service.captureForBookingGroup('bg-1')).rejects.toBeInstanceOf(
        PaymentAuthorizationExpiredError
      )
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.canceled,
            failureCode: 'payment_intent_unexpected_state',
          }),
        })
      )
    })
  })

  describe('cancelForBookingGroup', () => {
    it('cancels real PaymentIntents and SetupIntent placeholders together (Direct Charges: both routed by stripeAccount)', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        // Real PI
        {
          id: 'pay-1',
          stripePaymentIntentId: 'pi_1',
          stripeSetupIntentId: null,
          stripeAccountId: 'acct_1',
        },
        // SetupIntent placeholder
        {
          id: 'pay-2',
          stripePaymentIntentId: null,
          stripeSetupIntentId: 'si_1',
          stripeAccountId: 'acct_1',
        },
      ])
      stripe.client.paymentIntents.cancel.mockResolvedValueOnce({ id: 'pi_1', status: 'canceled' })
      stripe.client.setupIntents.cancel.mockResolvedValueOnce({ id: 'si_1', status: 'canceled' })

      const canceled = await service.cancelForBookingGroup('bg-1', 'requested_by_customer')

      expect(canceled).toHaveLength(2)
      expect(stripe.client.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_1',
        { cancellation_reason: 'requested_by_customer' },
        expect.objectContaining({
          idempotencyKey: expect.any(String),
          stripeAccount: 'acct_1',
        })
      )
      // SetupIntents.cancel takes (id, params, options) — params is undefined,
      // options carries the connected-account header.
      expect(stripe.client.setupIntents.cancel).toHaveBeenCalledWith('si_1', undefined, {
        stripeAccount: 'acct_1',
      })
    })
  })

  describe('chargeOffSession', () => {
    function offSessionPayment(overrides: Partial<any> = {}) {
      return {
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.full,
        attemptCount: 0,
        amount: new Prisma.Decimal('1400.00'),
        applicationFeeAmount: new Prisma.Decimal('210.00'),
        currency: 'eur',
        // Direct Charges: connected-account snapshot + FK to the connect
        // customer that owns the saved PM we'll charge.
        stripeAccountId: 'acct_1',
        providerConnectCustomerId: 'pcc-1',
        bookingGroup: {
          providerId: 'pr-1',
          bookingGroupNumber: 'BG-0001',
          parent: { id: 'p-1' },
          provider: { stripeAccountId: 'acct_1' },
          status: 'deposit_paid',
        },
        ...overrides,
      }
    }

    // Default mock for the connect-customer lookup that `chargeOffSession`
    // performs after loading the Payment row. Tests override per-case.
    function mockConnectCustomer() {
      prisma.providerConnectCustomer.findUnique.mockResolvedValue({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })
    }

    it('charges with off_session+confirm and delegates to markSucceeded so BookingGroup advances', async () => {
      // Regression for the same shape of bug fixed in the Phase 2 capture
      // path: chargeOffSession used to write `Payment.status = succeeded`
      // synchronously, which then short-circuited markSucceeded's idempotency
      // check (`if status === succeeded return`) and the BookingGroup never
      // advanced. Now chargeOffSession delegates to markSucceeded, which is
      // itself idempotent on a re-run from the eventual webhook.
      prisma.payment.findUnique
        .mockResolvedValueOnce(offSessionPayment())
        // Second findUnique is for markSucceeded → findPaymentForIntent.
        .mockResolvedValueOnce({
          id: 'pay-1',
          bookingGroupId: 'bg-1',
          kind: PaymentKind.balance,
          amount: new Prisma.Decimal('1400.00'),
          status: PaymentStatus.processing,
          providerConnectCustomerId: 'pcc-1',
          stripeAccountId: 'acct_1',
        })
      mockConnectCustomer()
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({ stripePaymentMethodId: 'pm_1' })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_real',
        status: 'succeeded',
        amount: 140000,
        currency: 'eur',
        latest_charge: 'ch_real',
      })
      // markSucceeded transaction → bookingGroup.update returns the post-
      // increment row so it can decide whether to advance status.
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'deposit_paid',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('2000.00'),
        refundedAmount: new Prisma.Decimal('0'),
      })

      await service.chargeOffSession('pay-1')

      const [params, opts] = stripe.client.paymentIntents.create.mock.calls[0]
      expect(params).toMatchObject({
        off_session: true,
        confirm: true,
        capture_method: 'automatic',
        amount: 140000,
        application_fee_amount: 21000,
        customer: 'cus_1',
        payment_method: 'pm_1',
        description: expect.stringContaining('World Camps booking BG-0001'),
      })
      // Direct Charges: no `on_behalf_of`/`transfer_data`/`transfer_group`;
      // the connected account routes via `stripeAccount` on the request opts.
      expect(params).not.toHaveProperty('on_behalf_of')
      expect(params).not.toHaveProperty('transfer_data')
      expect(params).not.toHaveProperty('transfer_group')
      expect(opts.stripeAccount).toBe('acct_1')
      expect(params.metadata).toMatchObject({ paymentId: 'pay-1', attempt: '1' })

      // First update: stripePaymentIntentId + attemptCount (so the webhook
      // race fallback works and the intent is linked).
      expect(prisma.payment.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentIntentId: 'pi_real',
            stripePaymentMethodId: 'pm_1',
            attemptCount: 1,
          }),
        })
      )
      // Second update: succeeded status, set inside markSucceeded via the
      // B1 status-guarded updateMany.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.succeeded,
            stripeChargeId: 'ch_real',
          }),
        })
      )
      // BookingGroup advance: deposit_paid → fully_paid (paid 600 + 1400 = 2000 = total).
      const bgUpdates = prisma.bookingGroup.update.mock.calls
      expect(bgUpdates[0][0].data).toMatchObject({ paidAmount: { increment: expect.anything() } })
      expect(bgUpdates[1][0].data).toEqual({ status: 'fully_paid' })
    })

    it('persists requires_action without delegating to markSucceeded so the booking does not advance prematurely', async () => {
      // 3DS step-up branch: intent is pending parent action. We persist the
      // status directly (no markSucceeded call) so the BookingGroup stays
      // where it is. The recovery email path picks up the row by paymentId
      // and the parent completes the challenge via /payment/authorize.
      prisma.payment.findUnique.mockResolvedValueOnce(offSessionPayment())
      mockConnectCustomer()
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({ stripePaymentMethodId: 'pm_1' })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_step_up',
        status: 'requires_action',
        amount: 140000,
        currency: 'eur',
      })

      await service.chargeOffSession('pay-1')

      // Two updates: link intent + persist requires_action; no BookingGroup change.
      expect(prisma.payment.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentIntentId: 'pi_step_up',
            attemptCount: 1,
          }),
        })
      )
      expect(prisma.payment.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          // H8 audit: stamps processingStartedAt on transitions to
          // non-terminal states so the janitor cron can pick up stuck rows.
          data: expect.objectContaining({ status: PaymentStatus.requires_action }),
        })
      )
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })

    it('records failure metadata on a card decline and schedules retry within the 48h window', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(offSessionPayment())
      mockConnectCustomer()
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({ stripePaymentMethodId: 'pm_1' })
      const declineErr = Object.assign(
        new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'card declined',
        } as never),
        { code: 'card_declined', message: 'card declined' }
      )
      stripe.client.paymentIntents.create.mockRejectedValueOnce(declineErr)

      await service.chargeOffSession('pay-1')

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.failed,
            attemptCount: 1,
            failureCode: 'card_declined',
            nextRetryAt: expect.any(Date),
          }),
        })
      )
    })

    it('stops scheduling retry after the second attempt (48h window exhausted)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(offSessionPayment({ attemptCount: 1 }))
      mockConnectCustomer()
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({ stripePaymentMethodId: 'pm_1' })
      const declineErr = Object.assign(
        new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'card declined',
        } as never),
        { code: 'card_declined', message: 'card declined' }
      )
      stripe.client.paymentIntents.create.mockRejectedValueOnce(declineErr)

      await service.chargeOffSession('pay-1')

      const updateCall = prisma.payment.update.mock.calls.find(
        (c: any) => c[0].data?.attemptCount === 2
      )
      expect(updateCall![0].data.nextRetryAt).toBeNull()
    })

    // Phase 3 audit fix Q2: BookingGroup status guard.
    it.each(['cancelled', 'declined', 'expired', 'fully_refunded', 'payment_failed', 'disputed'])(
      'marks the Payment canceled and skips Stripe when BookingGroup is in terminal status %s',
      async terminalStatus => {
        prisma.payment.findUnique.mockResolvedValueOnce(
          offSessionPayment({
            bookingGroup: {
              status: terminalStatus,
              providerId: 'pr-1',
              parent: { id: 'p-1', stripeCustomerId: 'cus_1' },
              provider: { stripeAccountId: 'acct_1' },
            },
          })
        )

        await service.chargeOffSession('pay-1')

        expect(stripe.client.paymentIntents.create).not.toHaveBeenCalled()
        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'pay-1' },
            data: expect.objectContaining({
              status: PaymentStatus.canceled,
              failureCode: 'booking_terminal',
              canceledAt: expect.any(Date),
            }),
          })
        )
      }
    )

    // Phase 3 audit fix Q6+Q8: no-saved-PM short-circuit. Replaces the prior
    // throw, which caused the cron to log the same error every 30 min and
    // the booking to sit in `processing` forever.
    it('marks the Payment failed/MAX_ATTEMPTS without throwing when the parent has no default saved PM', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(
        offSessionPayment({
          bookingGroup: {
            status: 'deposit_paid',
            providerId: 'pr-1',
            parent: { id: 'p-1' },
            provider: { stripeAccountId: 'acct_1' },
          },
        })
      )
      mockConnectCustomer()
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce(null)

      // Importantly: does NOT throw — the cron's post-state inspection then
      // sees status=failed && attemptCount>=MAX and runs the existing
      // exhausted branch (BookingGroup → payment_failed + email).
      await expect(service.chargeOffSession('pay-1')).resolves.toBeUndefined()

      expect(stripe.client.paymentIntents.create).not.toHaveBeenCalled()
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({
            status: PaymentStatus.failed,
            attemptCount: 2, // MAX_OFF_SESSION_ATTEMPTS — disables retry pickup
            failureCode: 'no_payment_method',
          }),
        })
      )
    })
  })

  // Phase 3 audit fix Q3: stuck `requires_action` cleanup.
  describe('markStepUpAbandoned', () => {
    it('cancels the live Stripe intent on the connected account and marks the Payment failed/MAX_ATTEMPTS', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-stuck',
        bookingGroupId: 'bg-stuck',
        status: PaymentStatus.requires_action,
        stripePaymentIntentId: 'pi_stuck',
        stripeAccountId: 'acct_provider',
      })
      stripe.client.paymentIntents.cancel.mockResolvedValueOnce({
        id: 'pi_stuck',
        status: 'canceled',
      })

      await service.markStepUpAbandoned('pay-stuck')

      // Direct Charges: cancel must route to the connected account.
      expect(stripe.client.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_stuck',
        { cancellation_reason: 'abandoned' },
        { stripeAccount: 'acct_provider' }
      )
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-stuck' },
          data: expect.objectContaining({
            status: PaymentStatus.failed,
            attemptCount: 2,
            failureCode: 'step_up_abandoned',
            canceledAt: expect.any(Date),
          }),
        })
      )
    })

    it('still marks the Payment failed when Stripe cancel rejects (booking must advance regardless)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-stuck',
        bookingGroupId: 'bg-stuck',
        status: PaymentStatus.requires_action,
        stripePaymentIntentId: 'pi_stuck',
        stripeAccountId: 'acct_provider',
      })
      stripe.client.paymentIntents.cancel.mockRejectedValueOnce(new Error('Stripe down'))

      await service.markStepUpAbandoned('pay-stuck')

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.failed,
            failureCode: 'step_up_abandoned',
          }),
        })
      )
    })

    it('is a no-op when the row is already terminal (idempotent on re-run)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-already',
        status: PaymentStatus.failed,
        stripePaymentIntentId: 'pi_x',
      })

      await service.markStepUpAbandoned('pay-already')

      expect(stripe.client.paymentIntents.cancel).not.toHaveBeenCalled()
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  describe('webhook handlers', () => {
    it('markSucceeded falls back to metadata.paymentId when stripePaymentIntentId lookup misses (off-session race)', async () => {
      // First lookup (by intent id) misses — the cron's UPDATE hasn't committed yet.
      prisma.payment.findUnique.mockResolvedValueOnce(null)
      // Fallback lookup (by paymentId from metadata) hits.
      // Direct Charges: the row carries `providerConnectCustomerId` +
      // `stripeAccountId` so the saved-PM upsert path can scope to the
      // connected account.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.balance,
        amount: new Prisma.Decimal('1400.00'),
        status: PaymentStatus.processing,
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
      })
      // bookingGroup.update returns the post-increment row (used by the new
      // status-advancement logic). Balance + paidAmount=2000 ≥ totalAmount=2000
      // → status should advance to fully_paid.
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'accepted',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('2000.00'),
        refundedAmount: new Prisma.Decimal('0'),
      })
      // After-success saved-PM upsert is scoped per providerConnectCustomer.
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce(null)
      stripe.client.paymentMethods.retrieve.mockResolvedValueOnce({
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2029, funding: 'credit' },
      })

      await service.markSucceeded({
        id: 'pi_real',
        amount: 140000,
        currency: 'eur',
        latest_charge: 'ch_1',
        payment_method: 'pm_1',
        metadata: { paymentId: 'pay-1' },
      } as never)

      // Inside the $transaction we updateMany the payment row + increment paidAmount.
      // B1: status-guarded claim restricts the transition to in-flight statuses.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            status: expect.objectContaining({ in: expect.any(Array) }),
          }),
          data: expect.objectContaining({
            status: PaymentStatus.succeeded,
            stripePaymentIntentId: 'pi_real',
          }),
        })
      )
      // First bookingGroup.update is the increment; second is the status advance.
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1' },
          data: { paidAmount: { increment: expect.anything() } },
        })
      )
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1' },
          data: { status: 'fully_paid' },
        })
      )
    })

    it('markSucceeded advances accepted → deposit_paid and does NOT mint a legacy balance row (revamp Spec v2.3)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-deposit',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        status: PaymentStatus.requires_capture,
        currency: 'eur',
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
      })
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'accepted',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('600.00'),
        refundedAmount: new Prisma.Decimal('0'),
        balanceDueAt: new Date('2026-09-01T00:00:00Z'),
        appFeePercentageSnapshot: new Prisma.Decimal('15'),
      })

      await service.markSucceeded({
        id: 'pi_dep',
        amount: 60000,
        currency: 'eur',
        metadata: { paymentId: 'pay-deposit' },
      } as never)

      // Deposit capture still advances the booking lifecycle.
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'deposit_paid' },
        })
      )
      // Balance is now owned by booking_scheduled_captures — the legacy single
      // balance Payment row is NO LONGER minted here (would double-charge).
      expect(prisma.payment.create).not.toHaveBeenCalled()
    })

    it('markSucceeded for deposit is idempotent on balance creation — re-fire skips when balance row already exists', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-deposit',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        status: PaymentStatus.requires_capture,
        currency: 'eur',
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
      })
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'accepted',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('600.00'),
        refundedAmount: new Prisma.Decimal('0'),
        balanceDueAt: new Date('2026-09-01T00:00:00Z'),
        appFeePercentageSnapshot: new Prisma.Decimal('15'),
      })
      // findFirst hits — a balance row already exists from a prior re-fire.
      prisma.payment.findFirst.mockResolvedValueOnce({ id: 'pay-balance-existing' })

      await service.markSucceeded({
        id: 'pi_dep',
        amount: 60000,
        currency: 'eur',
        metadata: { paymentId: 'pay-deposit' },
      } as never)

      // Status still advances — that part is idempotent on its own.
      // But payment.create is NOT called for the balance row.
      expect(prisma.payment.create).not.toHaveBeenCalled()
    })

    it('markSucceeded for deposit skips balance creation when deposit equals total (fully_paid edge case)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-deposit-100pct',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('2000.00'),
        status: PaymentStatus.requires_capture,
        currency: 'eur',
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
      })
      // 100% deposit → BookingGroup advances directly to fully_paid.
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'accepted',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('2000.00'),
        refundedAmount: new Prisma.Decimal('0'),
        balanceDueAt: null,
        appFeePercentageSnapshot: new Prisma.Decimal('15'),
      })

      await service.markSucceeded({
        id: 'pi_dep_full',
        amount: 200000,
        currency: 'eur',
        metadata: { paymentId: 'pay-deposit-100pct' },
      } as never)

      // No balance row: nextStatus is fully_paid, not deposit_paid, so the
      // creation block is skipped (there's no balance to charge later).
      expect(prisma.payment.findFirst).not.toHaveBeenCalled()
      expect(prisma.payment.create).not.toHaveBeenCalled()
    })

    it('markSucceeded does not transition when the booking has been cancelled mid-flight', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        status: PaymentStatus.requires_capture,
      })
      // Increment-update returns a row already in `cancelled` (parent canceled
      // in the grace window before this webhook landed).
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'cancelled',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('600.00'),
        refundedAmount: new Prisma.Decimal('0'),
      })

      await service.markSucceeded({
        id: 'pi_1',
        amount: 60000,
        currency: 'eur',
        metadata: { paymentId: 'pay-1' },
      } as never)

      // First update increments paidAmount; no second status-advance update.
      const updateCalls = prisma.bookingGroup.update.mock.calls
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0][0].data).toEqual({ paidAmount: { increment: expect.anything() } })
    })

    it('markSucceeded is idempotent when status is already succeeded', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        amount: new Prisma.Decimal('1400.00'),
        status: PaymentStatus.succeeded,
      })

      await service.markSucceeded({ id: 'pi_real', amount: 140000, currency: 'eur' } as never)

      expect(prisma.payment.update).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })

    it('markCapturable updates status only when not already requires_capture (idempotent)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.requires_capture,
      })

      await service.markCapturable({ id: 'pi_1' } as never)
      // B1: the handler short-circuits before reaching the updateMany.
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })

    // ===== B1 / T1: out-of-order webhook delivery regression guards =====
    // Stripe webhooks can arrive out of order (network flap, retry storm,
    // multi-region delivery). Every status-changing webhook handler must
    // refuse to roll a row back from a terminal state.

    it('B1: markCapturable does NOT roll a `failed` row back to requires_capture (out-of-order delivery)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.failed,
      })
      // updateMany's status-guarded WHERE clause excludes `failed`, so no row
      // matches and `count` is 0. The row stays terminal.
      prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 })

      await service.markCapturable({
        id: 'pi_1',
        payment_method: 'pm_1',
        created: 1700000000,
      } as never)

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            status: expect.objectContaining({
              in: expect.not.arrayContaining([PaymentStatus.failed]),
            }),
          }),
        })
      )
    })

    it('B1: markFailed does NOT overwrite a `succeeded` row (out-of-order delivery)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.succeeded,
      })
      prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 })

      await service.markFailed({
        id: 'pi_1',
        last_payment_error: { code: 'card_declined', message: 'card declined' },
      } as never)

      // Either way (early-return for `failed`, or claim count=0 for terminal),
      // the row's terminal `succeeded` status must not be clobbered.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            status: expect.objectContaining({
              in: expect.not.arrayContaining([PaymentStatus.succeeded]),
            }),
          }),
        })
      )
    })

    it('B1: markCanceled does NOT overwrite a `succeeded` row (out-of-order delivery)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.succeeded,
      })
      prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 })

      await service.markCanceled({ id: 'pi_1' } as never)

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            status: expect.objectContaining({
              in: expect.not.arrayContaining([PaymentStatus.succeeded]),
            }),
          }),
        })
      )
    })

    it('B1: markSucceeded skips BookingGroup.paidAmount increment when the status claim returns count=0 (concurrent race)', async () => {
      // Two webhook deliveries land in parallel. The first writer succeeded
      // (status flipped) — for the second invocation, `updateMany` matches
      // zero rows because the status guard excludes `succeeded`. The handler
      // MUST NOT then increment `BookingGroup.paidAmount` a second time.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        // Cached status before the race winner committed.
        status: PaymentStatus.requires_capture,
        stripeAccountId: 'acct_1',
      })
      prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 })

      await service.markSucceeded({
        id: 'pi_1',
        amount: 60000,
        currency: 'eur',
        latest_charge: 'ch_1',
        payment_method: 'pm_1',
      } as never)

      // The transaction returned before any BookingGroup write — the increment
      // would otherwise have doubled `paidAmount`.
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
    })
  })

  describe('syncForBookingGroup', () => {
    it('retrieves the live PaymentIntent and dispatches markCapturable when status flipped to requires_capture', async () => {
      // Initial Payment row (saved by submit) is still requires_payment_method.
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          stripePaymentIntentId: 'pi_1',
          stripeSetupIntentId: null,
          status: PaymentStatus.requires_payment_method,
          // Direct Charges: retrieve must be scoped to the connected account.
          stripeAccountId: 'acct_1',
        },
      ])
      // Stripe says the live intent is now requires_capture (parent confirmed
      // the card; webhook hasn't arrived yet because we're in dev).
      stripe.client.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        status: 'requires_capture',
        payment_method: 'pm_1',
      })
      // markCapturable's lookup of the Payment by intent id.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.requires_payment_method,
      })

      await service.syncForBookingGroup('bg-1')

      expect(stripe.client.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1', undefined, {
        stripeAccount: 'acct_1',
      })
      // B1: markCapturable uses status-guarded updateMany.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-1',
            status: expect.objectContaining({ in: expect.any(Array) }),
          }),
          data: expect.objectContaining({ status: PaymentStatus.requires_capture }),
        })
      )
    })

    it('skips terminal Payments (status not in non-terminal list)', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([])

      await service.syncForBookingGroup('bg-1')

      expect(stripe.client.paymentIntents.retrieve).not.toHaveBeenCalled()
      expect(stripe.client.setupIntents.retrieve).not.toHaveBeenCalled()
    })

    it('continues to the next Payment when one Stripe retrieve throws (best-effort)', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          stripePaymentIntentId: 'pi_bad',
          stripeSetupIntentId: null,
          status: PaymentStatus.requires_payment_method,
        },
        {
          id: 'pay-2',
          stripePaymentIntentId: 'pi_good',
          stripeSetupIntentId: null,
          status: PaymentStatus.requires_payment_method,
        },
      ])
      stripe.client.paymentIntents.retrieve
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ id: 'pi_good', status: 'requires_capture' })
      // markCapturable's lookup for pay-2.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-2',
        status: PaymentStatus.requires_payment_method,
      })

      await service.syncForBookingGroup('bg-1')

      // Both were attempted; second one succeeded.
      expect(stripe.client.paymentIntents.retrieve).toHaveBeenCalledTimes(2)
      // B1: markCapturable now writes via updateMany (status-guarded).
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'pay-2',
            status: expect.objectContaining({ in: expect.any(Array) }),
          }),
          data: expect.objectContaining({ status: PaymentStatus.requires_capture }),
        })
      )
    })

    it('routes SetupIntent placeholder rows to setupIntents.retrieve and dispatches markSetupSucceeded', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-3',
          stripePaymentIntentId: null,
          stripeSetupIntentId: 'si_1',
          status: PaymentStatus.processing,
          // Direct Charges: setup intent lives on the connected account.
          stripeAccountId: 'acct_1',
        },
      ])
      stripe.client.setupIntents.retrieve.mockResolvedValueOnce({
        id: 'si_1',
        status: 'succeeded',
        payment_method: 'pm_1',
        metadata: { bookingGroupId: 'bg-1', kind: 'full' },
      })
      // markSetupSucceeded looks up the placeholder Payment row by setup
      // intent id so it can extract `providerConnectCustomerId` + `stripeAccountId`.
      prisma.payment.findFirst.mockResolvedValueOnce({
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
      })
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce(null)
      stripe.client.paymentMethods.retrieve.mockResolvedValueOnce({
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2029, funding: 'credit' },
      })

      await service.syncForBookingGroup('bg-1')

      expect(stripe.client.setupIntents.retrieve).toHaveBeenCalledWith('si_1', undefined, {
        stripeAccount: 'acct_1',
      })
      expect(prisma.savedPaymentMethod.upsert).toHaveBeenCalled()
    })
  })

  describe('upsertSavedPaymentMethod', () => {
    it('marks the card as default when no other default exists', async () => {
      stripe.client.paymentMethods.retrieve.mockResolvedValueOnce({
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2029, funding: 'credit' },
      })
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce(null)

      await service.upsertSavedPaymentMethod('pcc-1', 'pm_1', 'acct_1')

      expect(prisma.savedPaymentMethod.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isDefault: true }),
        })
      )
    })

    it('does not override an existing default when adding a new card', async () => {
      stripe.client.paymentMethods.retrieve.mockResolvedValueOnce({
        type: 'card',
        card: { brand: 'visa', last4: '1111', exp_month: 4, exp_year: 2029, funding: 'credit' },
      })
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({
        id: 'spm-old',
        stripePaymentMethodId: 'pm_old',
      })

      await service.upsertSavedPaymentMethod('pcc-1', 'pm_new', 'acct_1')

      expect(prisma.savedPaymentMethod.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isDefault: false }),
        })
      )
    })

    it('quietly returns when the PM was already detached (resource_missing)', async () => {
      const err = Object.assign(
        new Stripe.errors.StripeInvalidRequestError({
          type: 'invalid_request_error',
          message: 'gone',
        } as never),
        { code: 'resource_missing' }
      )
      stripe.client.paymentMethods.retrieve.mockRejectedValueOnce(err)

      await expect(
        service.upsertSavedPaymentMethod('pcc-1', 'pm_1', 'acct_1')
      ).resolves.toBeUndefined()
      expect(prisma.savedPaymentMethod.upsert).not.toHaveBeenCalled()
    })
  })

  // Direct Charges: the customer is per-(parent, provider) on the connected
  // account, not a single platform-side customer. The helper is renamed but
  // serves the same idempotency + race-resolution role.
  describe('ensureProviderConnectCustomer', () => {
    it('returns the existing connect-customer without calling Stripe', async () => {
      const group = makeGroup()
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-existing',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_existing',
      })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 'secret',
        status: 'requires_payment_method',
      })
      prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' })

      await service.authorizeDeposit('bg-1')

      expect(stripe.client.customers.create).not.toHaveBeenCalled()
    })

    it('uses an idempotency key keyed on (parentId, providerId) and routes customers.create to the connected account', async () => {
      const group = makeGroup()
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce(null)
      prisma.parent.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        userId: 'u-1',
        user: { email: 'a@b.c', firstName: 'Alice', lastName: 'Lovelace' },
      })
      stripe.client.customers.create.mockResolvedValueOnce({ id: 'cus_new' })
      prisma.providerConnectCustomer.create.mockResolvedValueOnce({
        id: 'pcc-new',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_new',
      })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 'secret',
        status: 'requires_payment_method',
      })
      prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' })

      await service.authorizeDeposit('bg-1')

      const [, opts] = stripe.client.customers.create.mock.calls[0]
      // Hash on (parentId, providerId). Customer is created on the connected
      // account via `stripeAccount` request option.
      expect(opts.idempotencyKey).toMatch(/^customer:connect:[0-9a-f]{16}$/)
      expect(opts.stripeAccount).toBe('acct_1')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Audit-fix coverage: tests added in the Destination Charges + Elements
  // production audit. Each test is named with the audit code (B7, H4, H6,
  // H8) so traceability between code, tests, and the audit doc is direct.
  // ──────────────────────────────────────────────────────────────────────────

  describe('audit fixes', () => {
    function makeOffSessionPayment(overrides: Partial<any> = {}) {
      return {
        id: 'pay-os-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.balance,
        stripePaymentIntentId: null,
        // Direct Charges: per-(parent,provider) customer + connected account
        // snapshot. Tests that exercise `chargeOffSession` need both populated.
        providerConnectCustomerId: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripePaymentMethodId: null,
        amount: new Prisma.Decimal('1400.00'),
        applicationFeeAmount: new Prisma.Decimal('210.00'),
        currency: 'eur',
        status: PaymentStatus.processing,
        attemptCount: 0,
        nextRetryAt: null,
        dueAt: new Date('2026-09-01T00:00:00Z'),
        failureCode: null,
        failureMessage: null,
        capturedAt: null,
        succeededAt: null,
        canceledAt: null,
        processingStartedAt: new Date('2026-08-30T00:00:00Z'),
        bookingGroup: {
          id: 'bg-1',
          bookingGroupNumber: 'BG-0001',
          status: 'request',
          parent: { id: 'p-1' },
          provider: { id: 'pr-1' },
        },
        ...overrides,
      }
    }

    it('B7: markSucceeded refuses to advance the booking when intent.amount_received differs from payment.amount', async () => {
      // Captured 50% less than authorized (e.g. someone hand-tweaked
      // amount_to_capture in the dashboard). Without this guard we'd
      // increment paidAmount by the full authorized amount.
      const payment = {
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        stripePaymentIntentId: 'pi_1',
        stripePaymentMethodId: null,
        stripeChargeId: null,
        amount: new Prisma.Decimal('600.00'),
        currency: 'eur',
        status: PaymentStatus.requires_capture,
        capturedAt: null,
      }
      prisma.payment.findUnique.mockResolvedValueOnce(payment)
      const errSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined)

      await service.markSucceeded({
        id: 'pi_1',
        amount: 60000,
        amount_received: 30000, // half of authorized 600 EUR
        currency: 'eur',
        status: 'succeeded',
      } as never)

      expect(prisma.payment.update).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.update).not.toHaveBeenCalled()
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('amount-mismatch'))
    })

    it('H4: chargeOffSession treats payment_method resource_missing as clean abandonment (single audit log, terminal failure)', async () => {
      const payment = makeOffSessionPayment()
      prisma.payment.findUnique.mockResolvedValueOnce(payment)
      // Direct Charges: connect-customer lookup before the saved-PM check.
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({
        id: 'spm-1',
        stripePaymentMethodId: 'pm_detached',
        isDefault: true,
        archivedAt: null,
      })
      stripe.client.paymentMethods.retrieve.mockRejectedValueOnce(
        new Stripe.errors.StripeInvalidRequestError({
          message: 'No such payment_method',
          type: 'invalid_request_error',
          code: 'resource_missing',
        })
      )

      await service.chargeOffSession('pay-os-1')

      // Saved-PM row was archived
      expect(prisma.savedPaymentMethod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stripePaymentMethodId: 'pm_detached' }),
          data: expect.objectContaining({ archivedAt: expect.any(Date), isDefault: false }),
        })
      )
      // Payment row marked terminal with the special failureCode
      const updateCall = prisma.payment.update.mock.calls.find(
        (call: any) => call[0]?.data?.failureCode === 'payment_method_detached'
      )
      expect(updateCall).toBeDefined()
      expect(updateCall[0].data).toMatchObject({
        status: PaymentStatus.failed,
        attemptCount: 2,
        processingStartedAt: null,
      })
      // Critically: no `paymentIntents.create` call — we short-circuited.
      expect(stripe.client.paymentIntents.create).not.toHaveBeenCalled()
    })

    it('H6: failureMessage from a card decline is PII-redacted before persisting', async () => {
      const payment = makeOffSessionPayment()
      prisma.payment.findUnique.mockResolvedValueOnce(payment)
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })
      prisma.savedPaymentMethod.findFirst.mockResolvedValueOnce({
        id: 'spm-1',
        stripePaymentMethodId: 'pm_1',
        isDefault: true,
        archivedAt: null,
      })
      stripe.client.paymentMethods.retrieve.mockResolvedValueOnce({ id: 'pm_1', type: 'card' })
      const cardError = new Stripe.errors.StripeCardError({
        message: 'Declined for card 4242424242424242 — contact alice@example.com',
        type: 'card_error',
        code: 'card_declined',
      })
      stripe.client.paymentIntents.create.mockRejectedValueOnce(cardError)

      await service.chargeOffSession('pay-os-1')

      const updateCall = prisma.payment.update.mock.calls.find(
        (call: any) => call[0]?.data?.failureCode === 'card_declined'
      )
      expect(updateCall).toBeDefined()
      expect(updateCall[0].data.failureMessage).toBe(
        'Declined for card [redacted-digits] — contact [redacted-email]'
      )
    })

    it('H8: stamps processingStartedAt on markCapturable transitions, clears it on markSucceeded', async () => {
      // requires_capture (manual-capture in-flight) — stamp the marker.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.requires_payment_method,
        processingStartedAt: null,
        stripePaymentMethodId: null,
      })
      await service.markCapturable({
        id: 'pi_1',
        payment_method: 'pm_1',
        created: 1700000000, // N1: stamp derived from intent.created
      } as never)
      // B1: markCapturable writes via status-guarded updateMany.
      const stampCall = prisma.payment.updateMany.mock.calls[0][0]
      expect(stampCall.data).toMatchObject({
        status: PaymentStatus.requires_capture,
        processingStartedAt: expect.any(Date),
      })

      // succeeded (terminal) — clear the marker.
      jest.clearAllMocks()
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        bookingGroupId: 'bg-1',
        kind: PaymentKind.deposit,
        amount: new Prisma.Decimal('600.00'),
        currency: 'eur',
        status: PaymentStatus.requires_capture,
        capturedAt: null,
        processingStartedAt: new Date(),
      })
      prisma.bookingGroup.update.mockResolvedValueOnce({
        status: 'request',
        totalAmount: new Prisma.Decimal('2000.00'),
        paidAmount: new Prisma.Decimal('600.00'),
        refundedAmount: new Prisma.Decimal('0'),
        balanceDueAt: null,
        appFeePercentageSnapshot: new Prisma.Decimal('15'),
      })
      await service.markSucceeded({
        id: 'pi_1',
        amount: 60000,
        amount_received: 60000,
        currency: 'eur',
        status: 'succeeded',
        latest_charge: 'ch_1',
        payment_method: 'pm_1',
      } as never)
      // B1: markSucceeded writes via status-guarded updateMany inside the tx.
      const clearCall = prisma.payment.updateMany.mock.calls.find(
        (call: any) => call[0]?.data?.status === PaymentStatus.succeeded
      )
      expect(clearCall).toBeDefined()
      expect(clearCall[0].data.processingStartedAt).toBeNull()
    })

    it('B2: markRequiresAction persists the new status + stamps processingStartedAt', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.processing,
        processingStartedAt: null,
      })

      await service.markRequiresAction({
        id: 'pi_1',
        status: 'requires_action',
      } as never)

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: PaymentStatus.requires_action,
          stripePaymentIntentId: 'pi_1',
          processingStartedAt: expect.any(Date),
        }),
      })
    })

    it('B2: markRequiresAction is a no-op on replay (already requires_action)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.requires_action,
        processingStartedAt: new Date(),
      })

      await service.markRequiresAction({ id: 'pi_1', status: 'requires_action' } as never)

      expect(prisma.payment.update).not.toHaveBeenCalled()
    })

    it('H1: statement_descriptor_suffix on authorizeDeposit is uppercase, ASCII, ≤22 chars', async () => {
      // Verify both the value AND the constraints — a future bookingGroupNumber
      // change must not silently push past 22 chars.
      const group = makeGroup({ bookingGroupNumber: 'BG-superlongbookingnumber-123' })
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(group)
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      prisma.providerConnectCustomer.findUnique.mockResolvedValueOnce({
        id: 'pcc-1',
        stripeAccountId: 'acct_1',
        stripeCustomerId: 'cus_1',
      })
      stripe.client.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 's',
        status: 'requires_payment_method',
      })
      prisma.payment.create.mockResolvedValueOnce({ id: 'pay-1' })

      await service.authorizeDeposit('bg-1')

      const [params] = stripe.client.paymentIntents.create.mock.calls[0]
      expect(params.statement_descriptor_suffix).toBeDefined()
      expect(params.statement_descriptor_suffix.length).toBeLessThanOrEqual(22)
      expect(params.statement_descriptor_suffix).toMatch(/^[A-Z0-9 -]+$/)
    })
  })
})
