import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { Request } from 'express'
import Stripe from 'stripe'
import { ConfigService } from '../../../config/config.service'
import { Public } from '../../core/auth/decorators/public.decorator'
import { StripeService } from '../stripe.service'
import { StripeWebhookService } from './stripe-webhook.service'

type StripeEvent = ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']>

@ApiExcludeController()
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name)

  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: StripeWebhookService,
    private readonly configService: ConfigService
  ) {}

  /**
   * `@Public()` bypasses the global `JwtAuthGuard` registered as `APP_GUARD`.
   * Stripe sends the webhook without an Authorization header — authentication
   * is handled by `Stripe.webhooks.constructEvent` validating the
   * `stripe-signature` header against our webhook secret. Without this
   * decorator the global guard rejects every Stripe event with 401, which
   * also breaks the `markCapturable` / `markSucceeded` flow that updates
   * Payment row status.
   *
   * **Platform endpoint** — receives events on the platform account only:
   * `account.*`, `capability.*`, `person.*`, `account.external_account.*`,
   * `payout.*`. Direct-Charges payment/charge/refund/dispute events fire on
   * the **connected** account and are delivered to `POST /stripe/webhooks/connect`
   * with its own signing secret.
   */
  @Public()
  @Post('webhooks')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ): Promise<void> {
    await this.handleSignedWebhook(req, signature, this.configService.stripeConfig.webhookSecret)
  }

  /**
   * **Connect endpoint** — receives events scoped to a connected (provider)
   * account: `payment_intent.*`, `charge.*`, `charge.dispute.*`, `refund.*`,
   * `radar.early_fraud_warning.*`. `event.account` is populated on every
   * delivery here; downstream `processEvent` dedups against the same
   * `StripeWebhookEvent` table the platform endpoint writes to.
   *
   * Separate signing secret (`STRIPE_CONNECT_WEBHOOK_SECRET`) because Stripe
   * configures Connect events under "Listen to events on Connect applications"
   * with their own endpoint URL + secret.
   */
  @Public()
  @Post('webhooks/connect')
  @HttpCode(200)
  async handleConnectWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ): Promise<void> {
    await this.handleSignedWebhook(
      req,
      signature,
      this.configService.stripeConfig.connectWebhookSecret
    )
  }

  private async handleSignedWebhook(
    req: RawBodyRequest<Request>,
    signature: string,
    signingSecret: string
  ): Promise<void> {
    const rawBody = req.rawBody

    if (!rawBody) {
      this.logger.error(
        'Webhook received without raw body — ensure rawBody: true is set in NestFactory.create'
      )
      throw new BadRequestException('Missing raw body')
    }

    let event: StripeEvent
    try {
      // H4: tolerance is the max age (in seconds) of the timestamp embedded in
      // the Stripe signature. Default is 300s in the Stripe SDK; we allow ops
      // to widen the window via `STRIPE_WEBHOOK_TOLERANCE_SECONDS` for
      // environments where retries can sit in a queue longer than 5 minutes
      // (e.g. ingress under sustained load). Servers MUST be NTP-synced —
      // a wider tolerance is not a substitute for clock skew control.
      event = this.stripeService.client.webhooks.constructEvent(
        rawBody,
        signature,
        signingSecret,
        this.configService.stripeConfig.webhookToleranceSeconds
      )
    } catch (err) {
      // Throw on signature failure so Stripe's dashboard surfaces the failure instead
      // of hiding it behind a 200. Any retried delivery will go through dedup below.
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`)
      throw new BadRequestException('Invalid signature')
    }

    // H10 audit fix: include `account` (connected-account scope) and
    // `livemode` so triage in mixed test/live environments can correlate
    // events with the right Stripe dashboard tab. `account` is null for
    // platform-account events; set for Connect events forwarded from a
    // connected account.
    this.logger.log(
      `Processing Stripe webhook event: ${event.type} [${event.id}] account=${event.account ?? 'platform'} livemode=${event.livemode}`
    )

    // Handler errors propagate as 500 so Stripe retries the event.
    // Dedup happens in the service: a row whose `processedAt` is already set is skipped.
    await this.webhookService.processEvent(event)
  }
}
