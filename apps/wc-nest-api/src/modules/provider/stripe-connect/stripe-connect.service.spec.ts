import {
  BadRequestException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import Stripe from 'stripe'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeService } from '../../stripe/stripe.service'
import { StripeConnectService } from './stripe-connect.service'

describe('StripeConnectService', () => {
  let service: StripeConnectService
  let prisma: { provider: Record<string, jest.Mock>; systemSettings: Record<string, jest.Mock> }
  let stripe: {
    client: { accounts: Record<string, jest.Mock>; accountSessions: Record<string, jest.Mock> }
  }

  const providerId = 'prov-1'

  const baseProvider = {
    id: providerId,
    approvalStatus: 'approved' as const,
    stripeAccountId: null as string | null,
    stripeOnboardingCompleted: false,
    stripeOnboardingCompletedAt: null,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
    stripeAttentionRequired: false,
    stripeCommissionPercentage: null,
    legalCompanyName: 'Test Camp',
    website: 'https://test.camp',
    settings: { currency: 'USD' },
    owner: { email: 'owner@test.camp' },
  }

  const stripeAccount = {
    id: 'acct_123',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
  }

  beforeEach(async () => {
    prisma = {
      provider: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      systemSettings: {
        upsert: jest.fn(),
      },
    }

    stripe = {
      client: {
        accounts: {
          create: jest.fn(),
          retrieve: jest.fn(),
        },
        accountSessions: {
          create: jest.fn(),
        },
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeConnectService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
      ],
    }).compile()

    service = module.get(StripeConnectService)
    jest.clearAllMocks()
  })

  describe('createOrGetAccount', () => {
    it('throws NotFoundException when provider does not exist', async () => {
      prisma.provider.findUnique.mockResolvedValue(null)
      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when provider is not approved', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ...baseProvider, approvalStatus: 'pending' })
      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(BadRequestException)
    })

    it('returns existing status without calling Stripe when account already exists', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_existing',
      })

      const result = await service.createOrGetAccount(providerId)

      expect(result.stripeAccountId).toBe('acct_existing')
      expect(stripe.client.accounts.create).not.toHaveBeenCalled()
    })

    it('throws UnprocessableEntityException when provider has no currency', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ...baseProvider, settings: null })
      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(
        UnprocessableEntityException
      )
    })

    it('throws UnprocessableEntityException when provider currency is not on the allow-list', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        settings: { currency: 'INR' },
      })
      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(
        UnprocessableEntityException
      )
      expect(stripe.client.accounts.create).not.toHaveBeenCalled()
    })

    it('creates a Stripe account with a content-hashed idempotency key', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      stripe.client.accounts.create.mockResolvedValue(stripeAccount)
      prisma.provider.updateMany.mockResolvedValue({ count: 1 })
      prisma.provider.findUniqueOrThrow.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: stripeAccount.id,
        stripeCommissionPercentage: 10,
      })

      await service.createOrGetAccount(providerId)

      expect(stripe.client.accounts.create).toHaveBeenCalledTimes(1)
      const [, options] = stripe.client.accounts.create.mock.calls[0]
      // Key shape: `provider-account:<providerId>:<16-char hex hash>`. The
      // hash is deterministic on the request payload but its exact value is
      // an implementation detail — assert structure, not bytes.
      expect(options.idempotencyKey).toMatch(
        new RegExp(`^provider-account:${providerId}:[0-9a-f]{16}$`)
      )
      expect(prisma.provider.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: providerId, stripeAccountId: null },
        })
      )
    })

    it('produces the same idempotency key across retries with identical params', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      stripe.client.accounts.create.mockResolvedValue(stripeAccount)
      prisma.provider.updateMany.mockResolvedValue({ count: 1 })
      prisma.provider.findUniqueOrThrow.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: stripeAccount.id,
        stripeCommissionPercentage: 10,
      })

      await service.createOrGetAccount(providerId)
      // Reset the stripeAccountId so the second call goes through Stripe again.
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      await service.createOrGetAccount(providerId)

      const firstKey = stripe.client.accounts.create.mock.calls[0][1].idempotencyKey
      const secondKey = stripe.client.accounts.create.mock.calls[1][1].idempotencyKey
      expect(firstKey).toBe(secondKey)
    })

    it('produces a different idempotency key when params drift', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      stripe.client.accounts.create.mockResolvedValue(stripeAccount)
      prisma.provider.updateMany.mockResolvedValue({ count: 1 })
      prisma.provider.findUniqueOrThrow.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: stripeAccount.id,
      })
      await service.createOrGetAccount(providerId)

      // Simulate the legal name being edited between attempts (the production
      // scenario that triggered this fix).
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        legalCompanyName: 'Different Camp Inc.',
      })
      await service.createOrGetAccount(providerId)

      const firstKey = stripe.client.accounts.create.mock.calls[0][1].idempotencyKey
      const secondKey = stripe.client.accounts.create.mock.calls[1][1].idempotencyKey
      expect(firstKey).not.toBe(secondKey)
    })

    it('surfaces StripeIdempotencyError as a 503 (no silent rotation)', async () => {
      // With correct content-hashing this error should never fire — if it does,
      // it signals a regression in `stableStringify` or non-determinism in the
      // payload. We let it propagate via `mapStripeError` (transient → 503) so
      // the bug surfaces loudly instead of silently minting duplicate accounts.
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      const idempErr = new Stripe.errors.StripeIdempotencyError({
        message: 'Keys for idempotent requests can only be used with the same parameters',
        type: 'idempotency_error',
      })
      stripe.client.accounts.create.mockRejectedValue(idempErr)

      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(
        /Payment provider is unavailable/
      )
      expect(stripe.client.accounts.create).toHaveBeenCalledTimes(1)
    })

    it('maps Stripe SDK errors to Nest exceptions', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      const stripeError = new Stripe.errors.StripeInvalidRequestError({
        message: 'bad params',
        type: 'invalid_request_error',
      })
      stripe.client.accounts.create.mockRejectedValue(stripeError)

      await expect(service.createOrGetAccount(providerId)).rejects.toThrow(BadRequestException)
    })

    it('handles a concurrent caller winning the claim race (no orphan)', async () => {
      // Caller A and B both pass the findUnique stripeAccountId-null check.
      // Stripe returns the same acct_id (idempotency key). updateMany returns
      // count=0 because A already filled the row. We refetch and return.
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      stripe.client.accounts.create.mockResolvedValue(stripeAccount)
      prisma.provider.updateMany.mockResolvedValue({ count: 0 })
      prisma.provider.findUniqueOrThrow.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: stripeAccount.id, // matches what Stripe returned
        stripeCommissionPercentage: 10,
      })

      const result = await service.createOrGetAccount(providerId)

      expect(result.stripeAccountId).toBe(stripeAccount.id)
      expect(prisma.provider.findUniqueOrThrow).toHaveBeenCalled()
    })

    it('logs an error when concurrent claim resolves to a different account (orphan)', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.systemSettings.upsert.mockResolvedValue({ id: 'singleton', defaultCommission: 10 })
      stripe.client.accounts.create.mockResolvedValue({ ...stripeAccount, id: 'acct_new' })
      prisma.provider.updateMany.mockResolvedValue({ count: 0 })
      prisma.provider.findUniqueOrThrow.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_existing', // different — orphan!
        stripeCommissionPercentage: 10,
      })
      const errorSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined)

      const result = await service.createOrGetAccount(providerId)

      expect(result.stripeAccountId).toBe('acct_existing')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stripe account orphan detected')
      )
    })
  })

  describe('completeOnboarding', () => {
    it('throws when no Stripe account exists', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ...baseProvider, stripeAccountId: null })
      await expect(service.completeOnboarding(providerId)).rejects.toThrow(BadRequestException)
    })

    it('syncs capability flags from live Stripe account', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_123',
      })
      stripe.client.accounts.retrieve.mockResolvedValue({
        ...stripeAccount,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      })
      prisma.provider.update.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        stripeOnboardingCompleted: true,
      })

      const result = await service.completeOnboarding(providerId)

      expect(result.chargesEnabled).toBe(true)
      expect(result.payoutsEnabled).toBe(true)
      expect(result.onboardingCompleted).toBe(true)
      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeOnboardingCompleted: true,
            stripeOnboardingSkippedAt: null,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            stripeDetailsSubmitted: true,
          }),
        })
      )
    })
  })

  describe('skipOnboarding', () => {
    it('throws when provider does not exist', async () => {
      prisma.provider.findUnique.mockResolvedValue(null)
      await expect(service.skipOnboarding(providerId)).rejects.toThrow(NotFoundException)
    })

    it('throws when onboarding is already completed', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        stripeOnboardingCompleted: true,
      })
      await expect(service.skipOnboarding(providerId)).rejects.toThrow(BadRequestException)
    })

    it('stamps stripeOnboardingSkippedAt and returns the updated status', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider)
      prisma.provider.update.mockResolvedValue({
        ...baseProvider,
        stripeOnboardingSkippedAt: new Date('2026-04-30T12:00:00Z'),
      })

      const result = await service.skipOnboarding(providerId)

      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stripeOnboardingSkippedAt: expect.any(Date) },
        })
      )
      expect(result.onboardingSkippedAt).toBe('2026-04-30T12:00:00.000Z')
    })
  })

  describe('assertProviderPaymentReady', () => {
    it('throws NotFoundException when provider does not exist', async () => {
      prisma.provider.findUnique.mockResolvedValue(null)
      await expect(service.assertProviderPaymentReady(providerId)).rejects.toThrow(
        NotFoundException
      )
    })

    it('throws 412 with STRIPE_ACCOUNT_MISSING when no Stripe account is connected', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        id: providerId,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      })
      await expect(service.assertProviderPaymentReady(providerId)).rejects.toThrow(
        PreconditionFailedException
      )
    })

    it('throws 412 with STRIPE_CAPABILITIES_DISABLED when charges are off', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        id: providerId,
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: false,
        stripePayoutsEnabled: true,
      })
      await expect(service.assertProviderPaymentReady(providerId)).rejects.toThrow(
        PreconditionFailedException
      )
    })

    it('throws 412 with STRIPE_CAPABILITIES_DISABLED when payouts are off', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        id: providerId,
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: false,
      })
      await expect(service.assertProviderPaymentReady(providerId)).rejects.toThrow(
        PreconditionFailedException
      )
    })

    it('resolves silently when both charges and payouts are enabled', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        id: providerId,
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      })
      await expect(service.assertProviderPaymentReady(providerId)).resolves.toBeUndefined()
    })
  })

  describe('getAccountStatus', () => {
    it('returns hasAccount=false (no throw) when the provider has no Stripe account', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ...baseProvider, stripeAccountId: null })

      const result = await service.getAccountStatus(providerId)

      expect(result.hasAccount).toBe(false)
      expect(result.stripeAccountId).toBeNull()
      expect(result.requirementsCurrentlyDue).toEqual([])
      expect(stripe.client.accounts.retrieve).not.toHaveBeenCalled()
    })

    it('fetches live Stripe data and surfaces requirements', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_123',
      })
      stripe.client.accounts.retrieve.mockResolvedValue({
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          currently_due: ['external_account'],
          past_due: [],
          eventually_due: ['individual.verification.document'],
          disabled_reason: null,
        },
      })

      const result = await service.getAccountStatus(providerId)

      expect(result.hasAccount).toBe(true)
      expect(result.chargesEnabled).toBe(true)
      expect(result.payoutsEnabled).toBe(false)
      expect(result.requirementsCurrentlyDue).toEqual(['external_account'])
      expect(result.requirementsEventuallyDue).toEqual(['individual.verification.document'])
      expect(result.disabledReason).toBeNull()
    })

    it('clears the cached stripe state and reports no-account when Stripe says the account is missing', async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: 'acct_zombie',
        stripeOnboardingCompleted: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      })
      const missingError = new Stripe.errors.StripeInvalidRequestError({
        message: 'No such account',
        type: 'invalid_request_error',
        code: 'resource_missing',
      })
      stripe.client.accounts.retrieve.mockRejectedValue(missingError)
      prisma.provider.update.mockResolvedValue({
        ...baseProvider,
        stripeAccountId: null,
        stripeOnboardingCompleted: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      })

      const result = await service.getAccountStatus(providerId)

      expect(result.hasAccount).toBe(false)
      expect(result.stripeAccountId).toBeNull()
      expect(result.chargesEnabled).toBe(false)
      expect(result.payoutsEnabled).toBe(false)
      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: providerId },
          data: expect.objectContaining({
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
            stripeCommissionPercentage: null,
          }),
        })
      )
    })
  })
})
