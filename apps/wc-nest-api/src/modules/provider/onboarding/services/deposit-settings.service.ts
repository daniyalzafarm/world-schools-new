import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { getStripeMinimumChargeAmount } from '../../../billing/shared/money.util'
import { SaveDepositSettingsDto } from '../dto/deposit-settings.dto'
import { OnboardingService } from './onboarding.service'

@Injectable()
export class DepositSettingsService {
  private readonly logger = new Logger(DepositSettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly onboardingService: OnboardingService
  ) {}

  /**
   * Save deposit settings and advance to at least Step 6.
   */
  async saveDepositSettings(providerId: string, dto: SaveDepositSettingsDto): Promise<any> {
    // Validate that ProviderSettings exists (Step 2 must be completed first)
    const existingSettings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
    })

    if (!existingSettings) {
      throw new BadRequestException(
        'Provider settings not found. Please complete Step 2 (Find Your Camp) first.'
      )
    }

    // Validate deposit settings
    if (dto.depositRequired) {
      if (!dto.depositType) {
        throw new BadRequestException('Deposit type is required when deposit is enabled')
      }

      if (dto.depositType === 'percentage') {
        if (!dto.depositPercentage) {
          throw new BadRequestException(
            'Deposit percentage is required when deposit type is percentage'
          )
        }
        if (dto.depositPercentage < 1 || dto.depositPercentage > 100) {
          throw new BadRequestException('Deposit percentage must be between 1 and 100')
        }
      }

      if (dto.depositType === 'fixed') {
        if (!dto.depositFixedAmount) {
          throw new BadRequestException(
            'Deposit fixed amount is required when deposit type is fixed'
          )
        }
        // M2 audit fix: validate against the Stripe-imposed minimum charge
        // amount for the provider's configured currency, not a hardcoded $1.
        // A provider on JPY needs ¥50 minimum; one on EUR needs €0.50; the
        // previous "$1" would either be too loose (JPY) or impossible to
        // satisfy with sub-unit currencies. Currency is sourced from
        // ProviderSettings — the only authoritative location.
        const currency = existingSettings.currency ?? 'usd'
        const minimum = getStripeMinimumChargeAmount(currency)
        if (dto.depositFixedAmount < minimum) {
          throw new BadRequestException(
            `Deposit fixed amount must be at least ${minimum} ${currency.toUpperCase()}`
          )
        }
      }
    }

    // Update deposit settings in ProviderSettings table
    const settings = await this.prisma.providerSettings.update({
      where: { providerId },
      data: {
        depositRequired: dto.depositRequired,
        depositType: dto.depositType,
        depositPercentage: dto.depositPercentage,
        depositFixedAmount: dto.depositFixedAmount,
      },
    })

    await this.onboardingService.updateCurrentStep(providerId, 6)

    this.logger.log(
      `Deposit settings saved for provider ${providerId}; advanced to at least Step 6`
    )

    return {
      depositRequired: settings.depositRequired,
      depositType: settings.depositType,
      depositPercentage: settings.depositPercentage,
      depositFixedAmount: settings.depositFixedAmount,
    }
  }

  /**
   * Get deposit settings
   */
  async getDepositSettings(providerId: string): Promise<any> {
    const settings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
      select: {
        depositRequired: true,
        depositType: true,
        depositPercentage: true,
        depositFixedAmount: true,
      },
    })

    return settings
  }
}
