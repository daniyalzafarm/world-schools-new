import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MessagesService } from '../../messaging/services/messages.service'
import { BaseAppMessagesController } from '../../messaging/controllers/base-app-messages.controller'

/**
 * Provider Messages Controller
 *
 * App-specific wrapper for messaging endpoints used by wc-provider app.
 * All endpoints are prefixed with /provider/messaging/messages so the JWT strategy
 * uses wc_provider_access_token cookie (based on /provider/* path).
 */
@ApiTags('Provider Messaging - Messages')
@Controller('provider/messaging/messages')
export class ProviderMessagesController extends BaseAppMessagesController {
  constructor(messagesService: MessagesService) {
    super(messagesService, ProviderMessagesController.name)
  }
}
