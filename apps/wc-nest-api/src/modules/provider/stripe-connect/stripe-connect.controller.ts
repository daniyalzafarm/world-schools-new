import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { ProviderAccessGuard } from '../../core/auth/guards/provider-access.guard'
import { ProviderAccess } from '../../core/auth/decorators/provider-access.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { StripeConnectService } from './stripe-connect.service'

@ApiTags('Provider')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProviderAccessGuard)
@ProviderAccess('admin')
@Controller('provider/stripe-connect')
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post('account')
  @ApiOperation({
    summary: 'Create or retrieve Stripe Standard connected account (Direct Charges)',
    description:
      'Idempotent. Creates a Stripe Standard connected account (Direct Charges) for the ' +
      'provider and snapshots the app fee. Only available after application approval.',
  })
  async createOrGetAccount(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.createOrGetAccount(req.user.providerId)
    return ResponseUtil.success(data)
  }

  @Get('account')
  @ApiOperation({ summary: 'Get current Stripe account status' })
  async getAccountStatus(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.getAccountStatus(req.user.providerId)
    return ResponseUtil.success(data)
  }

  @Post('account-session')
  @ApiOperation({
    summary: 'Create a single-use AccountSession for the embedded onboarding component',
    description: 'Returns a client_secret. Do not persist it — create a fresh one each time.',
  })
  async createAccountSession(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.createAccountSession(req.user.providerId)
    return ResponseUtil.success(data)
  }

  @Post('complete')
  @ApiOperation({
    summary: 'Mark Stripe onboarding as complete',
    description:
      'Call this after the embedded onboarding onExit callback fires. ' +
      'Syncs live Stripe account status and marks onboarding complete.',
  })
  async completeOnboarding(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.completeOnboarding(req.user.providerId)
    return ResponseUtil.success(data)
  }

  @Post('skip')
  @ApiOperation({
    summary: 'Skip Stripe onboarding for now',
    description:
      'Marks Stripe onboarding as skipped so the provider can finish later from ' +
      'their account settings. Bypasses the onboarding gate that would otherwise ' +
      'force them to /onboarding/stripe-connect.',
  })
  async skipOnboarding(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.skipOnboarding(req.user.providerId)
    return ResponseUtil.success(data)
  }
}
