import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../prisma/prisma.service'
import { DisputesService } from '../../billing/disputes/disputes.service'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { PayoutsService } from '../../billing/payouts/payouts.service'
import { RefundsService } from '../../billing/refunds/refunds.service'
import { StripeWebhookService } from './stripe-webhook.service'

describe('StripeWebhookService', () => {
  let service: StripeWebhookService
  let prisma: {
    stripeWebhookEvent: Record<string, jest.Mock>
    provider: Record<string, jest.Mock>
  }
  let paymentIntentsService: { [k: string]: jest.Mock }
  let refundsService: { [k: string]: jest.Mock }
  let payoutsService: { [k: string]: jest.Mock }
  let disputesService: { [k: string]: jest.Mock }

  const accountUpdatedEvent = {
    id: 'evt_acct_updated',
    type: 'account.updated',
    api_version: '2026-04-22.dahlia',
    account: 'acct_123',
    data: {
      object: {
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      },
    },
  } as const

  beforeEach(async () => {
    prisma = {
      stripeWebhookEvent: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      provider: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }
    paymentIntentsService = {
      markCapturable: jest.fn(),
      markSucceeded: jest.fn(),
      markFailed: jest.fn(),
      markCanceled: jest.fn(),
      markSetupSucceeded: jest.fn(),
      markSetupFailed: jest.fn(),
      markPmDetached: jest.fn(),
    }
    refundsService = {
      markRefundCompleted: jest.fn(),
      syncFromCharge: jest.fn(),
      // The EFW handler auto-refunds actionable warnings.
      processFraudRefund: jest.fn().mockResolvedValue([]),
    }
    payoutsService = {
      recordPayoutPaid: jest.fn(),
      recordPayoutFailed: jest.fn(),
    }
    disputesService = {
      handleCreated: jest.fn(),
      handleClosed: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentIntentsService, useValue: paymentIntentsService },
        { provide: RefundsService, useValue: refundsService },
        { provide: PayoutsService, useValue: payoutsService },
        { provide: DisputesService, useValue: disputesService },
      ],
    }).compile()

    service = module.get(StripeWebhookService)
    jest.clearAllMocks()
  })

  describe('processEvent', () => {
    it('skips when upsert returns a row that is already processed', async () => {
      prisma.stripeWebhookEvent.upsert.mockResolvedValue({
        id: accountUpdatedEvent.id,
        processedAt: new Date(),
      })

      await service.processEvent(accountUpdatedEvent as never)

      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(prisma.stripeWebhookEvent.update).not.toHaveBeenCalled()
    })

    it('upserts the event row, dispatches, and marks processed on success', async () => {
      prisma.stripeWebhookEvent.upsert.mockResolvedValue({
        id: accountUpdatedEvent.id,
        processedAt: null,
      })
      prisma.provider.findUnique.mockResolvedValue({
        id: 'prov-1',
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeAttentionRequired: false,
      })
      prisma.provider.update.mockResolvedValue({})

      await service.processEvent(accountUpdatedEvent as never)

      expect(prisma.stripeWebhookEvent.upsert).toHaveBeenCalledWith({
        where: { id: accountUpdatedEvent.id },
        create: expect.objectContaining({
          id: accountUpdatedEvent.id,
          type: 'account.updated',
          accountId: 'acct_123',
          apiVersion: '2026-04-22.dahlia',
        }),
        update: {},
      })
      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeChargesEnabled: true,
            stripePayoutsEnabled: false,
            stripeDetailsSubmitted: true,
          }),
        })
      )
      expect(prisma.stripeWebhookEvent.update).toHaveBeenLastCalledWith({
        where: { id: accountUpdatedEvent.id },
        data: { processedAt: expect.any(Date), processingError: null },
      })
    })

    it('records processingError and rethrows on handler failure', async () => {
      prisma.stripeWebhookEvent.upsert.mockResolvedValue({
        id: accountUpdatedEvent.id,
        processedAt: null,
      })
      prisma.provider.findUnique.mockRejectedValue(new Error('boom'))

      await expect(service.processEvent(accountUpdatedEvent as never)).rejects.toThrow('boom')

      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: accountUpdatedEvent.id },
        data: { processingError: 'boom' },
      })
    })

    it('reprocesses when upsert returns an existing row with no processedAt', async () => {
      prisma.stripeWebhookEvent.upsert.mockResolvedValue({
        id: accountUpdatedEvent.id,
        processedAt: null,
      })
      prisma.provider.findUnique.mockResolvedValue({
        id: 'prov-1',
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeAttentionRequired: false,
      })
      prisma.provider.update.mockResolvedValue({})

      await service.processEvent(accountUpdatedEvent as never)

      expect(prisma.provider.update).toHaveBeenCalled()
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: accountUpdatedEvent.id },
        data: { processedAt: expect.any(Date), processingError: null },
      })
    })
  })

  describe('handleAccountUpdated', () => {
    it('warns and returns when account is unknown', async () => {
      prisma.provider.findUnique.mockResolvedValue(null)

      await service.handleAccountUpdated({
        id: 'acct_unknown',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      } as never)

      expect(prisma.provider.update).not.toHaveBeenCalled()
    })
  })

  describe('handleAccountDeauthorized', () => {
    it('clears Stripe fields on the matching provider but PRESERVES appFeePercentage', async () => {
      // App-fee fields are superadmin-managed and must survive a
      // deauth/reauth round-trip. The pre-fix update cleared them, which was
      // incoherent with the resource_missing scrub in StripeConnectService.
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov-1' })
      prisma.provider.update.mockResolvedValue({})

      await service.handleAccountDeauthorized('acct_123')

      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: {
          stripeAccountId: null,
          stripeOnboardingCompleted: false,
          stripeOnboardingCompletedAt: null,
          stripeOnboardingSkippedAt: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          stripeAttentionRequired: false,
        },
      })
      const data = prisma.provider.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('appFeePercentage')
      expect(data).not.toHaveProperty('appFeeCustom')
    })

    it('logs at INFO and skips when the provider was already cleared (post-scrub convergence)', async () => {
      // Receiving a deauth for an already-scrubbed account is a healthy
      // convergence outcome (the resource_missing path beat the webhook).
      // We log INFO, not WARN, so the signal doesn't collide with orphan
      // alerts.
      prisma.provider.findUnique.mockResolvedValue(null)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined)

      await service.handleAccountDeauthorized('acct_unknown')

      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('post-scrub convergence'))
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })

  describe('dispatch — billing event types', () => {
    function eventOf(type: string, object: Record<string, unknown>, account?: string) {
      return {
        id: `evt_${type}_${Math.random().toString(36).slice(2)}`,
        type,
        api_version: '2026-04-22.dahlia',
        account: account ?? null,
        data: { object },
      }
    }

    function unprocessed(id: string) {
      prisma.stripeWebhookEvent.upsert.mockResolvedValueOnce({ id, processedAt: null })
    }

    it('routes payment_intent.succeeded to PaymentIntentsService.markSucceeded', async () => {
      const ev = eventOf('payment_intent.succeeded', { id: 'pi_123' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markSucceeded).toHaveBeenCalledWith({ id: 'pi_123' })
    })

    it('routes payment_intent.amount_capturable_updated to markCapturable', async () => {
      const ev = eventOf('payment_intent.amount_capturable_updated', { id: 'pi_456' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markCapturable).toHaveBeenCalledWith({ id: 'pi_456' })
    })

    it('routes setup_intent.succeeded to markSetupSucceeded', async () => {
      const ev = eventOf('setup_intent.succeeded', { id: 'seti_1' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markSetupSucceeded).toHaveBeenCalledWith({ id: 'seti_1' })
    })

    it('routes payment_method.detached to markPmDetached', async () => {
      const ev = eventOf('payment_method.detached', { id: 'pm_1' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markPmDetached).toHaveBeenCalledWith({ id: 'pm_1' })
    })

    it('routes refund.updated to markRefundCompleted', async () => {
      const ev = eventOf('refund.updated', { id: 're_1' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(refundsService.markRefundCompleted).toHaveBeenCalledWith({ id: 're_1' })
    })

    it('routes charge.refunded to syncFromCharge', async () => {
      const ev = eventOf('charge.refunded', { id: 'ch_1', refunds: { data: [] } })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(refundsService.syncFromCharge).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ch_1' })
      )
    })

    it('routes charge.dispute.created to disputesService.handleCreated', async () => {
      const ev = eventOf('charge.dispute.created', { id: 'dp_1' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(disputesService.handleCreated).toHaveBeenCalledWith({ id: 'dp_1' })
    })

    it('routes charge.dispute.closed to disputesService.handleClosed', async () => {
      const ev = eventOf('charge.dispute.closed', { id: 'dp_2' })
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(disputesService.handleClosed).toHaveBeenCalledWith({ id: 'dp_2' })
    })

    it('routes payout.paid to recordPayoutPaid with the connected account id', async () => {
      const ev = eventOf('payout.paid', { id: 'po_1' }, 'acct_123')
      unprocessed(ev.id)
      await service.processEvent(ev as never)
      expect(payoutsService.recordPayoutPaid).toHaveBeenCalledWith({ id: 'po_1' }, 'acct_123')
    })

    it('routes payout.failed to recordPayoutFailed and skips when no account is set', async () => {
      const evWith = eventOf('payout.failed', { id: 'po_2' }, 'acct_abc')
      unprocessed(evWith.id)
      await service.processEvent(evWith as never)
      expect(payoutsService.recordPayoutFailed).toHaveBeenCalledWith({ id: 'po_2' }, 'acct_abc')

      const evWithout = eventOf('payout.failed', { id: 'po_3' }, undefined)
      unprocessed(evWithout.id)
      await service.processEvent(evWithout as never)
      expect(payoutsService.recordPayoutFailed).toHaveBeenCalledTimes(1) // unchanged
    })
  })

  describe('dispatch — Connect account event types', () => {
    function eventOf(type: string, object: Record<string, unknown>, account?: string) {
      return {
        id: `evt_${type}_${Math.random().toString(36).slice(2)}`,
        type,
        api_version: '2026-04-22.dahlia',
        account: account ?? null,
        data: { object },
      }
    }
    function unprocessed(id: string) {
      prisma.stripeWebhookEvent.upsert.mockResolvedValueOnce({ id, processedAt: null })
    }

    it('handles capability.updated as an audit-log line, leaving DB untouched', async () => {
      // The trailing `account.updated` does the canonical sync; capability
      // events are routed to a no-op handler that logs the transition for
      // operator visibility. Critically: we must NOT call provider.update from
      // this branch, otherwise concurrent capability + account.updated
      // deliveries would cause double writes.
      const ev = eventOf('capability.updated', {
        id: 'card_payments',
        account: 'acct_cap_1',
        status: 'active',
        requested: true,
      })
      unprocessed(ev.id)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

      await service.processEvent(ev as never)

      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('webhook.capability.updated'))
    })

    it('handles account.application.authorized as an audit-log line', async () => {
      // Symmetric to deauthorized; no DB mutation.
      const ev = eventOf('account.application.authorized', {}, 'acct_auth_1')
      unprocessed(ev.id)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

      await service.processEvent(ev as never)

      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('webhook.account.application.authorized')
      )
    })

    it.each([
      'account.external_account.created',
      'account.external_account.updated',
      'account.external_account.deleted',
    ])('handles %s as an audit-log line', async type => {
      const ev = eventOf(
        type,
        { id: 'ba_1', object: 'bank_account', last4: '4242', status: 'new' },
        'acct_ea_1'
      )
      unprocessed(ev.id)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

      await service.processEvent(ev as never)

      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
    })

    it.each(['person.created', 'person.updated', 'person.deleted'])(
      'handles %s as an audit-log line',
      async type => {
        const ev = eventOf(
          type,
          { id: 'person_1', verification: { status: 'verified' } },
          'acct_p_1'
        )
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

        await service.processEvent(ev as never)

        expect(prisma.provider.update).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )

    it.each(['account.tax_id.created', 'account.tax_id.updated', 'account.tax_id.deleted'])(
      'handles %s as an audit-log line',
      async type => {
        const ev = eventOf(
          type,
          { id: 'taxid_1', verification: { status: 'pending' } },
          'acct_tax_1'
        )
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

        await service.processEvent(ev as never)

        expect(prisma.provider.update).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )

    it.each(['payout.created', 'payout.updated', 'payout.canceled'])(
      'handles %s as an audit-log line (existing PayoutsService is not invoked)',
      async type => {
        const ev = eventOf(type, { id: 'po_x', status: 'pending', amount: 1000 }, 'acct_po_1')
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)

        await service.processEvent(ev as never)

        expect(payoutsService.recordPayoutPaid).not.toHaveBeenCalled()
        expect(payoutsService.recordPayoutFailed).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Coverage for the Destination Charges + Elements webhook handlers.
  // ──────────────────────────────────────────────────────────────────────────
  describe('Destination Charges + Elements', () => {
    function eventOf(type: string, object: Record<string, unknown>, account?: string) {
      return {
        id: `evt_${type}_${Math.random().toString(36).slice(2)}`,
        type,
        api_version: '2026-04-22.dahlia',
        account: account ?? null,
        data: { object },
      }
    }
    function unprocessed(id: string) {
      prisma.stripeWebhookEvent.upsert.mockResolvedValueOnce({ id, processedAt: null })
    }

    it('routes payment_intent.requires_action to PaymentIntentsService.markRequiresAction', async () => {
      const ev = eventOf('payment_intent.requires_action', {
        id: 'pi_async',
        status: 'requires_action',
      })
      unprocessed(ev.id)
      paymentIntentsService.markRequiresAction = jest.fn()
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markRequiresAction).toHaveBeenCalledWith({
        id: 'pi_async',
        status: 'requires_action',
      })
    })

    it('routes payment_intent.processing to PaymentIntentsService.markProcessing', async () => {
      const ev = eventOf('payment_intent.processing', { id: 'pi_proc' })
      unprocessed(ev.id)
      paymentIntentsService.markProcessing = jest.fn()
      await service.processEvent(ev as never)
      expect(paymentIntentsService.markProcessing).toHaveBeenCalledWith({ id: 'pi_proc' })
    })

    it('payment_intent.partially_funded is audit-logged, no DB write', async () => {
      const ev = eventOf('payment_intent.partially_funded', {
        id: 'pi_part',
        amount_received: 500,
        amount: 1000,
      })
      unprocessed(ev.id)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
      await service.processEvent(ev as never)
      expect(prisma.provider.update).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('webhook.payment_intent.partially_funded')
      )
    })

    it.each(['charge.succeeded', 'charge.captured', 'charge.failed', 'charge.updated'])(
      'P1: %s is audit-logged with chargeId + paymentIntentId',
      async type => {
        const ev = eventOf(type, {
          id: 'ch_1',
          payment_intent: 'pi_1',
          status: 'succeeded',
          amount: 1000,
          currency: 'eur',
        })
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
        await service.processEvent(ev as never)
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )

    it.each(['transfer.created', 'transfer.updated', 'transfer.reversed'])(
      'B4: %s is audit-logged with transferId + destination + amounts',
      async type => {
        const ev = eventOf(type, {
          id: 'tr_1',
          destination: 'acct_1',
          amount: 1000,
          amount_reversed: 0,
          currency: 'eur',
        })
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
        await service.processEvent(ev as never)
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )

    it.each(['application_fee.created', 'application_fee.refunded'])(
      'B5: %s is audit-logged',
      async type => {
        const ev = eventOf(type, {
          id: 'fee_1',
          account: 'acct_1',
          charge: 'ch_1',
          amount: 100,
          amount_refunded: 0,
          currency: 'eur',
        })
        unprocessed(ev.id)
        const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
        await service.processEvent(ev as never)
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`webhook.${type}`))
      }
    )

    it('application_fee.updated (SDK literal omitted) routes via prefix-match in default branch', async () => {
      const ev = eventOf('application_fee.updated', { id: 'fee_2', amount: 100 })
      unprocessed(ev.id)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined)
      await service.processEvent(ev as never)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('webhook.application_fee.updated')
      )
    })

    it('radar.early_fraud_warning.created annotates the matching Payment, emits ERROR log, AND auto-refunds when actionable=true', async () => {
      const efw = {
        id: 'efw_1',
        charge: 'ch_target',
        fraud_type: 'made_with_stolen_card',
        actionable: true,
      }
      const ev = eventOf('radar.early_fraud_warning.created', efw)
      unprocessed(ev.id)
      // Payment row is currently clean (no prior failureCode).
      ;(prisma as any).payment = {
        findFirst: jest.fn().mockResolvedValueOnce({
          id: 'pay-1',
          bookingGroupId: 'bg-1',
          failureCode: null,
        }),
        update: jest.fn(),
      }
      const errSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined)

      await service.processEvent(ev as never)

      expect((prisma as any).payment.findFirst).toHaveBeenCalledWith({
        where: { stripeChargeId: 'ch_target' },
        select: expect.any(Object),
      })
      expect((prisma as any).payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          failureCode: 'early_fraud_warning',
          failureMessage: expect.stringContaining('Stripe Radar'),
        }),
      })
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('radar.early_fraud_warning paymentId=pay-1')
      )
      // Actionable EFW triggers auto-refund on the booking.
      expect(refundsService.processFraudRefund).toHaveBeenCalledWith({ bookingGroupId: 'bg-1' })
    })

    it('radar.early_fraud_warning auto-refund swallows Stripe failures so the webhook stays green', async () => {
      // Auto-refund must NOT propagate errors back to Stripe — the alert log
      // + Payment annotation are already persisted, and an admin can retry
      // the refund manually.
      const efw = {
        id: 'efw_3',
        charge: 'ch_fail',
        fraud_type: 'misc',
        actionable: true,
      }
      const ev = eventOf('radar.early_fraud_warning.created', efw)
      unprocessed(ev.id)
      ;(prisma as any).payment = {
        findFirst: jest.fn().mockResolvedValueOnce({
          id: 'pay-fail',
          bookingGroupId: 'bg-fail',
          failureCode: null,
        }),
        update: jest.fn(),
      }
      refundsService.processFraudRefund.mockRejectedValueOnce(new Error('Stripe is down'))

      // Should NOT throw — handler is robust to refund failures.
      await expect(service.processEvent(ev as never)).resolves.toBeUndefined()
      expect(refundsService.processFraudRefund).toHaveBeenCalled()
    })

    it('radar.early_fraud_warning does NOT auto-refund when actionable=false', async () => {
      const efw = {
        id: 'efw_nonactionable',
        charge: 'ch_low_confidence',
        fraud_type: 'misc',
        actionable: false,
      }
      const ev = eventOf('radar.early_fraud_warning.created', efw)
      unprocessed(ev.id)
      ;(prisma as any).payment = {
        findFirst: jest.fn().mockResolvedValueOnce({
          id: 'pay-na',
          bookingGroupId: 'bg-na',
          failureCode: null,
        }),
        update: jest.fn(),
      }

      await service.processEvent(ev as never)

      // Payment still annotated for admin review, but no refund issued.
      expect((prisma as any).payment.update).toHaveBeenCalled()
      expect(refundsService.processFraudRefund).not.toHaveBeenCalled()
    })

    it('radar.early_fraud_warning preserves an existing failureCode on the Payment row', async () => {
      const efw = {
        id: 'efw_2',
        charge: 'ch_target',
        fraud_type: 'misc',
        actionable: false,
      }
      const ev = eventOf('radar.early_fraud_warning.created', efw)
      unprocessed(ev.id)
      ;(prisma as any).payment = {
        findFirst: jest.fn().mockResolvedValueOnce({
          id: 'pay-2',
          bookingGroupId: 'bg-2',
          failureCode: 'card_declined', // pre-existing
        }),
        update: jest.fn(),
      }

      await service.processEvent(ev as never)

      // Update was NOT called because the row already had a failureCode —
      // we don't clobber the prior decline reason.
      expect((prisma as any).payment.update).not.toHaveBeenCalled()
    })

    it('radar.early_fraud_warning with no charge or intent id logs a warn and returns', async () => {
      const ev = eventOf('radar.early_fraud_warning.created', { id: 'efw_orphan' })
      unprocessed(ev.id)
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined)

      await service.processEvent(ev as never)

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cannot correlate'))
    })
  })
})
