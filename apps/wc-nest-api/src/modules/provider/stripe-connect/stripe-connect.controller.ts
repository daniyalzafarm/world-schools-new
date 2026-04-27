import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { StripeConnectService } from './stripe-connect.service'

@ApiTags('Provider')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesOrPermissionsGuard)
@Roles('Provider Admin')
@Controller('provider/stripe-connect')
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post('account')
  @ApiOperation({
    summary: 'Create or retrieve Stripe Express connected account',
    description:
      'Idempotent. Creates a Stripe Express account for the provider and snapshots the ' +
      'platform commission. Only available after application approval.',
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

  @Post('login-link')
  @ApiOperation({
    summary: "Create a one-time URL into the provider's Stripe Express dashboard",
    description:
      'Returns a single-use, short-lived URL. Do not persist or cache it — request ' +
      'a fresh link every time the provider clicks the dashboard button.',
  })
  async createLoginLink(@Request() req: { user: { providerId: string } }) {
    const data = await this.stripeConnectService.createLoginLink(req.user.providerId)
    return ResponseUtil.success(data)
  }
}
