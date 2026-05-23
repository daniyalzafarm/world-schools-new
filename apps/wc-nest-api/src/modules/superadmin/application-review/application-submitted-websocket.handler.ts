import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { type WsApplicationSubmittedPayload, WsServerEvent } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { WebSocketService } from '../../websocket/websocket.service'
import { WsInternalEvent } from '../../websocket/ws-internal-events'

/**
 * Fans out `application:submitted` events to every connected superadmin user.
 *
 * No `superadmin:*` socket room exists, so we enumerate the matching user IDs
 * the same way `SuperAdminUsersService.findAll` does (system-wide roles, i.e.
 * `providerId: null`, excluding `Provider Admin` and `Parent`).
 */
@Injectable()
export class ApplicationSubmittedWebSocketHandler {
  private readonly logger = new Logger(ApplicationSubmittedWebSocketHandler.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly prisma: PrismaService
  ) {}

  @OnEvent(WsInternalEvent.ApplicationSubmitted)
  async handleApplicationSubmitted(payload: WsApplicationSubmittedPayload) {
    try {
      const userIds = await this.getSuperadminUserIds()

      for (const userId of userIds) {
        this.wsService.emitToUser(userId, WsServerEvent.ApplicationSubmitted, payload)
      }

      this.logger.log(
        `[ApplicationSubmitted] delivered to ${userIds.length} superadmin user(s) for provider ${payload.providerId}`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver application:submitted: ${msg}`)
    }
  }

  private async getSuperadminUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              providerId: null,
              name: { notIn: ['Provider Admin', 'Parent'] },
            },
          },
        },
      },
      select: { id: true },
    })
    return users.map(u => u.id)
  }
}
