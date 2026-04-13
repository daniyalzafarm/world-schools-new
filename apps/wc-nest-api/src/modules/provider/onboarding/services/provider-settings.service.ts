import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '../../../../generated/client/client'
import { PrismaService } from '../../../../prisma/prisma.service'
import { SaveProviderSettingsDto } from '../dto/provider-settings.dto'

@Injectable()
export class ProviderSettingsService {
  private readonly logger = new Logger(ProviderSettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update cancellation policy settings (Step 6)
   * Note: Deposit settings are handled separately in Step 5 via DepositSettingsService
   */
  async saveSettings(providerId: string, dto: SaveProviderSettingsDto): Promise<any> {
    // Validate custom cancellation policy
    if (dto.cancellationPolicy === 'custom' && !dto.cancellationPolicyCustom) {
      throw new BadRequestException('Custom cancellation policy details are required')
    }

    // Validate that ProviderSettings exists (should be created in Step 2)
    const existingSettings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
    })

    if (!existingSettings) {
      throw new BadRequestException(
        'Provider settings not found. Please complete Step 2 (Find Your Camp) first.'
      )
    }

    // Build update data — only set cancellationPolicyAgreedAt when provider actively agrees
    const settings = await this.prisma.providerSettings.update({
      where: { providerId },
      data: {
        cancellationPolicy: dto.cancellationPolicy,
        cancellationPolicyCustom: dto.cancellationPolicyCustom ?? Prisma.JsonNull,
        cancellationPolicySpecialCircumstances:
          dto.cancellationPolicySpecialCircumstances != null
            ? (dto.cancellationPolicySpecialCircumstances as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        ...(dto.termsAgreed === true ? { cancellationPolicyAgreedAt: new Date() } : {}),
      },
      select: {
        cancellationPolicy: true,
        cancellationPolicyCustom: true,
        cancellationPolicySpecialCircumstances: true,
        cancellationPolicyAgreedAt: true,
      },
    })

    // Automatically advance to Step 7 (Review)
    await this.prisma.provider.update({
      where: { id: providerId },
      data: { onboardingCurrentStep: 7 },
    })

    return settings
  }

  /**
   * Get cancellation policy settings (Step 6)
   * Note: Deposit settings are retrieved separately via DepositSettingsService
   */
  async getSettings(providerId: string): Promise<any> {
    const settings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
      select: {
        cancellationPolicy: true,
        cancellationPolicyCustom: true,
        cancellationPolicySpecialCircumstances: true,
        cancellationPolicyAgreedAt: true,
      },
    })

    return settings
  }
}
