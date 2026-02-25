import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import UAParser from 'ua-parser-js'

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name)
  private readonly SESSION_EXPIRY_DAYS = 30

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse user agent to extract device info
   */
  private parseUserAgent(userAgent: string): {
    deviceType: string
    deviceName: string
    browser: string
    os: string
  } {
    const parser = new (UAParser as any)(userAgent)
    const result = parser.getResult()

    const deviceType = result.device.type ?? 'desktop'
    const browser = result.browser.name ?? 'Unknown'
    const os = result.os.name ?? 'Unknown'
    const deviceName = `${browser} on ${os}`

    return { deviceType, deviceName, browser, os }
  }

  /**
   * Create new session
   * Returns the generated sessionId to be included in JWT payload
   */
  async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const deviceInfo = userAgent
      ? this.parseUserAgent(userAgent)
      : {
          deviceType: 'unknown',
          deviceName: 'Unknown Device',
          browser: 'Unknown',
          os: 'Unknown',
        }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRY_DAYS)

    // Generate unique session ID (NOT the JWT token)
    const sessionId = crypto.randomUUID()

    await this.prisma.userSession.create({
      data: {
        userId,
        sessionId, // Store session ID, not JWT
        ...deviceInfo,
        ipAddress,
        expiresAt,
      },
    })

    this.logger.log(`Session ${sessionId} created for user ${userId}`)

    // Return sessionId to be included in JWT payload
    return sessionId
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }, // Only non-expired sessions
        isRevoked: false, // Only active (non-revoked) sessions
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
    })

    return sessions.map(session => ({
      id: session.id,
      sessionId: session.sessionId,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location ?? 'Unknown',
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: currentSessionId ? session.sessionId === currentSessionId : false,
    }))
  }

  /**
   * Update session last active time
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { sessionId },
      data: { lastActiveAt: new Date() },
    })
  }

  /**
   * Revoke specific session (soft delete - mark as revoked)
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        sessionId,
        userId, // Ensure user owns this session
      },
      data: {
        isRevoked: true,
      },
    })

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`)
  }

  /**
   * Revoke all other sessions (except current)
   */
  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        sessionId: { not: currentSessionId },
        isRevoked: false, // Only revoke active sessions
      },
      data: {
        isRevoked: true,
      },
    })

    this.logger.log(`All other sessions revoked for user ${userId}`)
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    this.logger.log(`Cleaned up ${result.count} expired sessions`)
  }
}
