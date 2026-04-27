import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeWebhookService } from './stripe-webhook.service'

describe('StripeWebhookService', () => {
  let service: StripeWebhookService
  let prisma: {
    stripeWebhookEvent: Record<string, jest.Mock>
    provider: Record<string, jest.Mock>
  }

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeWebhookService, { provide: PrismaService, useValue: prisma }],
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
    it('clears Stripe fields on the matching provider', async () => {
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
          stripeCommissionPercentage: null,
        },
      })
    })
  })
})
