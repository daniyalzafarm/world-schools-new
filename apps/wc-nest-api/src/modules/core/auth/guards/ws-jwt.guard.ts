import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import type { Socket } from 'socket.io'
import { AuthService } from '../auth.service'
import { ConfigService } from '../../../../config/config.service'

/**
 * WebSocket JWT Authentication Guard
 * Validates JWT tokens from WebSocket connections and attaches user data to socket
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name)

  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient()

      // Check if user is already authenticated (from 'authenticate' event)
      if (client.data.userId && client.data.user) {
        return true
      }

      // Try to extract token from handshake
      const token = this.extractTokenFromHandshake(client)

      if (!token) {
        throw new WsException('No authentication token provided')
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.jwtConfig.secret,
      })

      // Validate user exists
      const user = await this.authService.validateUser(payload.sub)

      if (!user) {
        throw new WsException('Invalid token: User not found')
      }

      // Attach user data to socket for future use
      client.data.userId = user.id
      client.data.user = user
      client.data.userType = payload.userType || 'user'

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`WebSocket authentication failed: ${errorMessage}`)
      throw new WsException('Authentication failed')
    }
  }

  /**
   * Extract JWT token from WebSocket handshake
   * Supports multiple methods:
   * 1. Authorization header (Bearer token)
   * 2. Query parameter (?token=xxx)
   * 3. Handshake auth object (Socket.io v4+)
   * 4. HTTP-only cookies (for cookie-based auth mode)
   */
  private extractTokenFromHandshake(client: Socket): string | null {
    // Method 1: Authorization header
    const authHeader = client.handshake.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // Method 2: Query parameter
    const queryToken = client.handshake.query.token
    if (queryToken && typeof queryToken === 'string') {
      return queryToken
    }

    // Method 3: Auth object (Socket.io v4+)
    const authToken = client.handshake.auth?.token
    if (authToken && typeof authToken === 'string') {
      return authToken
    }

    // Method 4: Extract from cookies (for cookie-based auth mode)
    const cookieToken = this.extractTokenFromCookies(client)
    if (cookieToken) {
      return cookieToken
    }

    return null
  }

  /**
   * Extract JWT token from cookies
   * Tries app-specific cookies in order of priority
   */
  private extractTokenFromCookies(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie
    if (!cookieHeader) {
      return null
    }

    // Parse cookies
    const cookies = this.parseCookies(cookieHeader)

    // Try app-specific cookies in order of priority
    return (
      cookies['wc_user_access_token'] ||
      cookies['wc_provider_access_token'] ||
      cookies['wc_superadmin_access_token'] ||
      cookies['access_token'] ||
      null
    )
  }

  /**
   * Parse cookie header string into key-value object
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {}

    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.split('=')
      const value = rest.join('=').trim()
      if (name && value) {
        cookies[name.trim()] = decodeURIComponent(value)
      }
    })

    return cookies
  }
}
