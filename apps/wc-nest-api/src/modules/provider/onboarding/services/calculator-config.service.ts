import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'

export interface CalculatorConfig {
  /// ISO 4217 currency code (uppercase, for UI display) — sourced from
  /// `ProviderSettings.currency`.
  currency: string
  /// App fee percentage to use in onboarding calculator previews.
  /// When `Provider.appFeeCustom` is true, sourced from
  /// `Provider.appFeePercentage` (the superadmin-negotiated override).
  /// Otherwise falls back to `SystemSettings.defaultAppFee`. Returned as a
  /// number for direct use in JS multiplication on the frontend.
  appFeePercentage: number
}

/**
 * Returns the runtime-configured values the onboarding calculators need so
 * they no longer hardcode `serviceFee = price * 0.1` and `€` literals.
 *
 * Two callers, both on the provider onboarding screens:
 *   - `deposit-settings/page.tsx` — earnings calculator sidebar.
 *   - `payment-policies/page.tsx` — combined deposit + cancellation policy
 *     impact calculator.
 *
 * The currency comes from the provider's own `ProviderSettings.currency`
 * (set in step 2 of onboarding). The app fee rate uses the per-provider
 * override (`Provider.appFeePercentage`) only when the superadmin has
 * explicitly enabled it via `Provider.appFeeCustom = true`; otherwise we
 * fall back to the live `SystemSettings.defaultAppFee` so providers without
 * a negotiated rate always see the current platform default.
 */
@Injectable()
export class CalculatorConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(providerId: string): Promise<CalculatorConfig> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        appFeeCustom: true,
        appFeePercentage: true,
        settings: { select: { currency: true } },
      },
    })
    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`)
    }

    const currency = provider.settings?.currency?.toUpperCase() ?? 'EUR'

    let appFeePercentage: number
    if (provider.appFeeCustom && provider.appFeePercentage) {
      appFeePercentage = provider.appFeePercentage.toNumber()
    } else {
      const systemSettings = await this.prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', defaultAppFee: 10 },
        update: {},
      })
      appFeePercentage = systemSettings.defaultAppFee.toNumber()
    }

    return { currency, appFeePercentage }
  }
}
