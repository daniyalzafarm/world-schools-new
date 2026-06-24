import { Controller, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MessagesService } from '../../messaging/services/messages.service'
import { BaseAppMessagesController } from '../../messaging/controllers/base-app-messages.controller'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { SenderType } from '../../../generated/client/client'

/**
 * Provider Messages Controller
 *
 * App-specific wrapper for messaging endpoints used by wc-provider app.
 * All endpoints are prefixed with /provider/messaging/messages so the JWT strategy
 * uses wc_provider_access_token cookie (based on /provider/* path).
 */
@ApiTags('Provider Messaging - Messages')
@Controller('provider/messaging/messages')
// Class-level guard applies to the inherited base routes (send/read/react/etc.)
// so only provider users with the Messaging permission can use them. The parent
// (user) controller subclasses the same base but is intentionally left ungated.
@UseGuards(RolesOrPermissionsGuard)
@Permissions('messages.read', 'messages.write')
export class ProviderMessagesController extends BaseAppMessagesController {
  constructor(messagesService: MessagesService) {
    super(messagesService, ProviderMessagesController.name)
  }

  protected override get appSenderType(): SenderType {
    return SenderType.PROVIDER
  }
}
