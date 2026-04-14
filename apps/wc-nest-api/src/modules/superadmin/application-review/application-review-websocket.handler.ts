import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { WebSocketService } from '../../websocket/websocket.service'
import { type WsOnboardingStatusChangedPayload, WsServerEvent } from '@world-schools/wc-types'
import { WsInternalEvent } from '../../websocket/ws-internal-events'

/**
 * Handles real-time WebSocket delivery for onboarding status change events.
 *
 * Listens to the internal EventEmitter2 event emitted by ApplicationReviewService
 * after each approval decision (approve / reject / info_requested / suspend) and
 * delivers the update to all of the provider's connected users so the status page
 * refreshes instantly without polling.
 */
@Injectable()
export class ApplicationReviewWebSocketHandler {
  private readonly logger = new Logger(ApplicationReviewWebSocketHandler.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly prisma: PrismaService
  ) {}

  @OnEvent(WsInternalEvent.OnboardingStatusChanged)
  async handleOnboardingStatusChanged(payload: WsOnboardingStatusChangedPayload) {
    try {
      const userIds = await this.getProviderUserIds(payload.providerId)

      for (const userId of userIds) {
        this.wsService.emitToUser(userId, WsServerEvent.OnboardingStatusChanged, payload)
      }

      this.logger.log(
        `[Onboarding] status_changed ${payload.previousStatus} → ${payload.newStatus} ` +
          `delivered to ${userIds.length} user(s) for provider ${payload.providerId}`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver onboarding:status_changed: ${msg}`)
    }
  }

  /**
   * Returns all user IDs associated with a provider (staff roles + owner).
   * Mirrors the same query used in BookingWebSocketHandler.
   */
  private async getProviderUserIds(providerId: string): Promise<string[]> {
    const [users, provider] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { role: { providerId } } } },
        select: { id: true },
      }),
      this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { ownerId: true },
      }),
    ])

    const ids = new Set(users.map(u => u.id))
    if (provider?.ownerId) ids.add(provider.ownerId)
    return Array.from(ids)
  }
}
