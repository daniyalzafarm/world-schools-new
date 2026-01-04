import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { SaveProviderSettingsDto } from '../dto/provider-settings.dto'

@Injectable()
export class ProviderSettingsService {
  private readonly logger = new Logger(ProviderSettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update provider settings
   */
  async saveSettings(providerId: string, dto: SaveProviderSettingsDto): Promise<any> {
    // Validate deposit settings
    if (dto.depositRequired) {
      if (!dto.depositType) {
        throw new BadRequestException('Deposit type is required when deposit is enabled')
      }

      if (dto.depositType === 'percentage' && !dto.depositPercentage) {
        throw new BadRequestException(
          'Deposit percentage is required when deposit type is percentage'
        )
      }

      if (dto.depositType === 'fixed' && !dto.depositFixedAmount) {
        throw new BadRequestException('Deposit fixed amount is required when deposit type is fixed')
      }
    }

    // Validate custom cancellation policy
    if (dto.cancellationPolicy === 'custom' && !dto.cancellationPolicyCustom) {
      throw new BadRequestException('Custom cancellation policy details are required')
    }

    // Create or update settings
    const settings = await this.prisma.providerSettings.upsert({
      where: { providerId },
      create: {
        providerId,
        currency: dto.currency,
        timezone: dto.timezone,
        depositRequired: dto.depositRequired,
        depositType: dto.depositType,
        depositPercentage: dto.depositPercentage,
        depositFixedAmount: dto.depositFixedAmount,
        cancellationPolicy: dto.cancellationPolicy,
        cancellationPolicyCustom: dto.cancellationPolicyCustom,
      },
      update: {
        currency: dto.currency,
        timezone: dto.timezone,
        depositRequired: dto.depositRequired,
        depositType: dto.depositType,
        depositPercentage: dto.depositPercentage,
        depositFixedAmount: dto.depositFixedAmount,
        cancellationPolicy: dto.cancellationPolicy,
        cancellationPolicyCustom: dto.cancellationPolicyCustom,
      },
    })

    return settings
  }

  /**
   * Get provider settings
   */
  async getSettings(providerId: string): Promise<any> {
    const settings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
    })

    return settings
  }
}
