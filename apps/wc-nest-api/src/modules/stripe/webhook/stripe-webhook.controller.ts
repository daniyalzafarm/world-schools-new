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

  @Post('webhooks')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
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
      event = this.stripeService.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.stripeConfig.webhookSecret
      )
    } catch (err) {
      // Throw on signature failure so Stripe's dashboard surfaces the failure instead
      // of hiding it behind a 200. Any retried delivery will go through dedup below.
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`)
      throw new BadRequestException('Invalid signature')
    }

    this.logger.log(`Processing Stripe webhook event: ${event.type} [${event.id}]`)

    // Handler errors propagate as 500 so Stripe retries the event.
    // Dedup happens in the service: a row whose `processedAt` is already set is skipped.
    await this.webhookService.processEvent(event)
  }
}
