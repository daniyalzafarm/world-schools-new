// Stub ESM-only modules pulled in transitively by CampsService imports
// (`uuid` via PhotoUploadService, `@nestjs/jwt` for the preview-token path).
// The deposit-settings code path doesn't touch either.
jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}))
jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}))

import { BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../../generated/client/client'
import { ConfigService } from '../../../config/config.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'
import { GoogleBusinessService } from '../onboarding/services/google-business.service'
import { CampsService } from './camps.service'
import { PhotoUploadService } from './services/photo-upload.service'

/**
 * Phase 9 — focused tests for the per-camp deposit settings flow.
 *
 * Covers:
 *   - `createCamp` snapshots provider-level deposit settings onto the new camp
 *   - `updateCampDepositSettings` no-deposit mode clears related fields
 *   - `updateCampDepositSettings` percentage validation (1..100, integer)
 *   - `updateCampDepositSettings` fixed-amount must be < every session price
 *
 * Other CampsService methods are not exercised here — they're covered via
 * integration tests in the controller/e2e layer.
 */
describe('CampsService — Phase 9 deposit settings', () => {
  let service: CampsService
  let prisma: any

  const PROVIDER = 'pr-1'
  const CAMP = 'camp-1'

  beforeEach(async () => {
    prisma = {
      camp: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      providerSettings: {
        findUnique: jest.fn(),
      },
      provider: {
        findUnique: jest.fn(),
      },
      session: {
        findMany: jest.fn(),
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PhotoUploadService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: GoogleBusinessService, useValue: { findOrCreateGbp: jest.fn() } },
        {
          provide: ProfileCompletionService,
          useValue: {
            recomputeForProvider: jest.fn(),
            enqueueRecomputeForProvider: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(CampsService)
  })

  describe('createCamp — snapshots provider deposit settings', () => {
    const dto = {
      name: 'Cool Camp',
      slug: 'cool-camp',
      type: 'day' as const,
      description: 'desc',
      locationType: 'different' as const,
      locationPlaceId: 'place-1',
    }

    it('copies provider depositRequired=true + percentage onto the new camp', async () => {
      prisma.camp.findUnique.mockResolvedValueOnce(null) // slug check
      prisma.providerSettings.findUnique.mockResolvedValueOnce({
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 25,
        depositFixedAmount: null,
      })
      prisma.camp.create.mockResolvedValueOnce({ id: CAMP })

      await service.createCamp(PROVIDER, dto)

      expect(prisma.camp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositRequired: true,
            depositType: 'percentage',
            depositPercentage: 25,
            depositFixedAmount: null,
          }),
        })
      )
    })

    it('copies provider depositRequired=false (no deposit) onto the new camp', async () => {
      prisma.camp.findUnique.mockResolvedValueOnce(null)
      prisma.providerSettings.findUnique.mockResolvedValueOnce({
        depositRequired: false,
        depositType: null,
        depositPercentage: null,
        depositFixedAmount: null,
      })
      prisma.camp.create.mockResolvedValueOnce({ id: CAMP })

      await service.createCamp(PROVIDER, dto)

      expect(prisma.camp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositRequired: false,
            depositType: null,
            depositPercentage: null,
            depositFixedAmount: null,
          }),
        })
      )
    })

    it('falls back to safe defaults when provider has no ProviderSettings yet', async () => {
      prisma.camp.findUnique.mockResolvedValueOnce(null)
      prisma.providerSettings.findUnique.mockResolvedValueOnce(null)
      prisma.camp.create.mockResolvedValueOnce({ id: CAMP })

      await service.createCamp(PROVIDER, dto)

      expect(prisma.camp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositRequired: false,
            depositType: null,
            depositPercentage: null,
            depositFixedAmount: null,
          }),
        })
      )
    })
  })

  describe('updateCampDepositSettings', () => {
    function mockOwnership() {
      prisma.camp.findUnique.mockResolvedValueOnce({ id: CAMP, providerId: PROVIDER })
    }

    it('no-deposit mode clears all deposit fields', async () => {
      mockOwnership()
      prisma.camp.update.mockResolvedValueOnce({})

      await service.updateCampDepositSettings(CAMP, PROVIDER, { depositRequired: false })

      expect(prisma.camp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CAMP },
          data: {
            depositRequired: false,
            depositType: null,
            depositPercentage: null,
            depositFixedAmount: null,
          },
        })
      )
    })

    it('percentage mode writes percentage + clears fixed amount', async () => {
      mockOwnership()
      prisma.camp.update.mockResolvedValueOnce({})

      await service.updateCampDepositSettings(CAMP, PROVIDER, {
        depositRequired: true,
        depositType: 'percentage',
        depositPercentage: 30,
      })

      expect(prisma.camp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            depositRequired: true,
            depositType: 'percentage',
            depositPercentage: 30,
            depositFixedAmount: null,
          },
        })
      )
    })

    it('rejects percentage outside 1..100 (boundary)', async () => {
      mockOwnership()
      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 0,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
      mockOwnership()
      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 101,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('rejects non-integer percentage', async () => {
      mockOwnership()
      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: 25.5,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('fixed mode passes when amount < every session price', async () => {
      mockOwnership()
      prisma.session.findMany.mockResolvedValueOnce([
        {
          id: 's-1',
          name: 'Week 1',
          pricingType: 'single',
          price: new Prisma.Decimal('500.00'),
          ageGroupPrices: null,
        },
        {
          id: 's-2',
          name: 'Week 2',
          pricingType: 'single',
          price: new Prisma.Decimal('600.00'),
          ageGroupPrices: null,
        },
      ])
      prisma.camp.update.mockResolvedValueOnce({})

      await service.updateCampDepositSettings(CAMP, PROVIDER, {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: 100,
      })

      expect(prisma.camp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositRequired: true,
            depositType: 'fixed',
            depositFixedAmount: 100,
            depositPercentage: null,
          }),
        })
      )
    })

    it('fixed mode rejects when amount >= cheapest session price', async () => {
      mockOwnership()
      prisma.session.findMany.mockResolvedValueOnce([
        {
          id: 's-1',
          name: 'Cheap',
          pricingType: 'single',
          price: new Prisma.Decimal('300.00'),
          ageGroupPrices: null,
        },
        {
          id: 's-2',
          name: 'Pricey',
          pricingType: 'single',
          price: new Prisma.Decimal('600.00'),
          ageGroupPrices: null,
        },
      ])

      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'fixed',
          depositFixedAmount: 300,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('fixed mode validates against the cheapest age-group tier when applicable', async () => {
      mockOwnership()
      prisma.session.findMany.mockResolvedValueOnce([
        {
          id: 's-1',
          name: 'Mixed Ages',
          pricingType: 'age_group',
          price: null,
          ageGroupPrices: [
            { age_group_id: 'a', price: 500 },
            { age_group_id: 'b', price: 200 }, // cheapest tier
            { age_group_id: 'c', price: 700 },
          ],
        },
      ])

      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'fixed',
          depositFixedAmount: 250,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('fixed mode skips draft sessions with no price configured', async () => {
      mockOwnership()
      prisma.session.findMany.mockResolvedValueOnce([
        // Draft session with no price — should be skipped, not block the save.
        { id: 's-draft', name: 'Draft', pricingType: 'single', price: null, ageGroupPrices: null },
        {
          id: 's-priced',
          name: 'Real',
          pricingType: 'single',
          price: new Prisma.Decimal('500.00'),
          ageGroupPrices: null,
        },
      ])
      prisma.camp.update.mockResolvedValueOnce({})

      await service.updateCampDepositSettings(CAMP, PROVIDER, {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: 100,
      })

      expect(prisma.camp.update).toHaveBeenCalled()
    })

    it('rejects depositRequired=true without depositType', async () => {
      mockOwnership()
      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, { depositRequired: true } as any)
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('rejects fixed mode with amount <= 0', async () => {
      mockOwnership()
      await expect(
        service.updateCampDepositSettings(CAMP, PROVIDER, {
          depositRequired: true,
          depositType: 'fixed',
          depositFixedAmount: 0,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
