import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MessagesService } from '../../messaging/services/messages.service'
import { BaseAppMessagesController } from '../../messaging/controllers/base-app-messages.controller'

/**
 * User Messages Controller
 *
 * App-specific wrapper for messaging endpoints used by wc-booking (user) app.
 * All endpoints are prefixed with /user/messaging/messages so the JWT strategy
 * uses wc_user_access_token cookie (based on /user/* path).
 */
@ApiTags('User Messaging - Messages')
@Controller('user/messaging/messages')
export class UserMessagesController extends BaseAppMessagesController {
  constructor(messagesService: MessagesService) {
    super(messagesService, UserMessagesController.name)
  }
}
