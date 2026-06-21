import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { OAuth2Client, type TokenPayload } from 'google-auth-library'
import { ConfigService } from '../../../../config/config.service'

/**
 * Verifies Google ID-token credentials issued to the booking app's OAuth client.
 *
 * `verifyIdToken` validates the token signature against Google's published keys and
 * checks `aud` (against our client ID), `iss` and `exp` for us — so callers only need
 * to assert the application-level claims (`email_verified`, presence of `email`/`sub`).
 * Wrapping the OAuth2 client in an injectable service keeps it out of the controller
 * and makes verification trivially mockable in tests.
 */
@Injectable()
export class GoogleTokenVerifierService {
  private readonly logger = new Logger(GoogleTokenVerifierService.name)
  private client: OAuth2Client | null = null

  constructor(private readonly configService: ConfigService) {}

  async verify(credential: string): Promise<TokenPayload> {
    const { clientId } = this.configService.googleOAuthConfig
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured')
    }

    this.client ??= new OAuth2Client(clientId)

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      })
      const payload = ticket.getPayload()
      if (!payload) {
        throw new UnauthorizedException('Invalid Google credential')
      }
      return payload
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      this.logger.warn(
        `Google credential verification failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      )
      throw new UnauthorizedException('Invalid Google credential')
    }
  }
}
