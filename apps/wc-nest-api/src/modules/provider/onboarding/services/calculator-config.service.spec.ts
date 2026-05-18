import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../../../generated/client/client'
import { PrismaService } from '../../../../prisma/prisma.service'
import { CalculatorConfigService } from './calculator-config.service'

describe('CalculatorConfigService', () => {
  let service: CalculatorConfigService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      provider: { findUnique: jest.fn() },
      systemSettings: { upsert: jest.fn() },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculatorConfigService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = module.get(CalculatorConfigService)
  })

  it('returns the per-provider app fee percentage when superadmin has set a custom rate', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({
      appFeeCustom: true,
      appFeePercentage: new Prisma.Decimal('15.00'),
      settings: { currency: 'eur' },
    })

    const config = await service.getConfig('prov-1')
    expect(config).toEqual({ currency: 'EUR', appFeePercentage: 15 })
    expect(prisma.systemSettings.upsert).not.toHaveBeenCalled()
  })

  it('falls back to SystemSettings.defaultAppFee when no custom override is set', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({
      appFeeCustom: false,
      appFeePercentage: null,
      settings: { currency: 'usd' },
    })
    prisma.systemSettings.upsert.mockResolvedValueOnce({
      defaultAppFee: new Prisma.Decimal('10.00'),
    })

    const config = await service.getConfig('prov-1')
    expect(config).toEqual({ currency: 'USD', appFeePercentage: 10 })
  })

  // Phase 5 audit fix A1: when `appFeeCustom=false` we must IGNORE any value
  // sitting on `Provider.appFeePercentage` (it's preserved across toggle-off
  // for re-toggle UX) and fall back to the live system default.
  it('Phase-5 A1: ignores appFeePercentage when appFeeCustom=false (toggle-off case)', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({
      appFeeCustom: false,
      appFeePercentage: new Prisma.Decimal('20'), // stale custom value, preserved on row
      settings: { currency: 'eur' },
    })
    prisma.systemSettings.upsert.mockResolvedValueOnce({
      defaultAppFee: new Prisma.Decimal('10'),
    })

    const config = await service.getConfig('prov-1')
    expect(config.appFeePercentage).toBe(10)
  })

  it('defaults currency to EUR when ProviderSettings is missing', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce({
      appFeeCustom: true,
      appFeePercentage: new Prisma.Decimal('12.5'),
      settings: null,
    })

    const config = await service.getConfig('prov-1')
    expect(config.currency).toBe('EUR')
    expect(config.appFeePercentage).toBe(12.5)
  })

  it('throws NotFoundException when the provider does not exist', async () => {
    prisma.provider.findUnique.mockResolvedValueOnce(null)
    await expect(service.getConfig('nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})
