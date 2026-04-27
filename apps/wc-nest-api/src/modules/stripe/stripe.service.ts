import { Injectable, Logger } from '@nestjs/common'
import Stripe from 'stripe'
import { ConfigService } from '../../config/config.service'

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name)
  readonly client: InstanceType<typeof Stripe>

  constructor(private readonly configService: ConfigService) {
    const { secretKey, apiVersion } = this.configService.stripeConfig

    this.client = new Stripe(secretKey, {
      apiVersion,
      maxNetworkRetries: 2,
      timeout: 20_000,
      telemetry: false,
      appInfo: {
        name: 'world-camps',
        url: this.configService.appUrl,
      },
    })

    this.logger.log(`Stripe client initialized (apiVersion=${apiVersion})`)
  }
}
