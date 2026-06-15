import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { EmailService } from '@world-schools/global-utils'
import { ConfigService } from '../../../config/config.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { EmailTemplateService } from '../../common/email-templates/email-template.service'
import { GoogleBusinessService } from '../../provider/onboarding/services/google-business.service'
import { ProviderLogoService } from '../../provider/onboarding/services/provider-logo.service'
import { RedisService } from '../../redis/redis.service'
import { SuperAdminProvidersService } from './providers.service'

/**
 * Phase 5 — covers `setAppFee` and `setEarlyPayoutConfig`. The other methods
 * on this service are integration-tested via controllers and aren't exercised
 * here.
 */
describe('SuperAdminProvidersService — Phase 5 settings', () => {
  let service: SuperAdminProvidersService
  let prisma: any

  const ADMIN = 'admin-1'
  const PROVIDER = 'provider-1'

  beforeEach(async () => {
    prisma = {
      provider: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      providerSettings: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminProvidersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: EmailTemplateService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: GoogleBusinessService, useValue: {} },
        { provide: ProviderLogoService, useValue: {} },
      ],
    }).compile()

    service = module.get(SuperAdminProvidersService)

    // findOne is a private-ish helper that throws if not found; mirror it so the
    // setAppFee / setEarlyPayoutConfig pre-checks pass.
    prisma.provider.findUnique.mockImplementation((args: any) => {
      if (args?.where?.id === PROVIDER) {
        return Promise.resolve({ id: PROVIDER, businessName: 'Cool Camp' })
      }
      return Promise.resolve(null)
    })
    // Default: ProviderSettings exists (most tests assume the provider has
    // completed onboarding). The pre-onboarding-guard test overrides this.
    prisma.providerSettings.findUnique.mockResolvedValue({ id: 'settings-1' })
  })

  // ─── setAppFee ───────────────────────────────────────────────────────

  describe('setAppFee', () => {
    it('writes percentage and stamps audit when custom=true', async () => {
      prisma.provider.update.mockResolvedValueOnce({
        id: PROVIDER,
        appFeeCustom: true,
        appFeePercentage: 12.5,
        appFeeUpdatedAt: new Date(),
        appFeeUpdatedByAdminId: ADMIN,
      })

      await service.setAppFee(PROVIDER, { custom: true, appFeePercentage: 12.5 }, ADMIN)

      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: PROVIDER },
        data: expect.objectContaining({
          appFeeCustom: true,
          appFeePercentage: 12.5,
          appFeeUpdatedByAdminId: ADMIN,
        }),
        include: expect.any(Object),
      })
      // appFeeUpdatedAt is `new Date()` — just confirm a Date was passed.
      const call = prisma.provider.update.mock.calls[0][0]
      expect(call.data.appFeeUpdatedAt).toBeInstanceOf(Date)
    })

    it('rejects when custom=true with no percentage', async () => {
      await expect(service.setAppFee(PROVIDER, { custom: true }, ADMIN)).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(prisma.provider.update).not.toHaveBeenCalled()
    })

    it('flips custom=false but PRESERVES the existing percentage', async () => {
      prisma.provider.update.mockResolvedValueOnce({})

      await service.setAppFee(PROVIDER, { custom: false }, ADMIN)

      const call = prisma.provider.update.mock.calls[0][0]
      expect(call.data.appFeeCustom).toBe(false)
      // Crucial: when custom=false, the service must NOT touch appFeePercentage,
      // so toggling back on retains the previous value as a default.
      expect(call.data).not.toHaveProperty('appFeePercentage')
      expect(call.data.appFeeUpdatedByAdminId).toBe(ADMIN)
    })

    it('throws NotFoundException for an unknown provider id', async () => {
      await expect(
        service.setAppFee('does-not-exist', { custom: true, appFeePercentage: 5 }, ADMIN)
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(prisma.provider.update).not.toHaveBeenCalled()
    })
  })

  // Payments revamp (Spec v2.3): `setPayoutMode` is removed — the platform no
  // longer schedules payouts (Standard automatic payouts).
})
