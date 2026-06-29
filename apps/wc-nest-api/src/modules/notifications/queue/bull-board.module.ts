import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { BullBoardModule } from '@bull-board/nestjs'
import { Logger, Module } from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'
import { QUEUE_NAMES } from './queue.constants'

const logger = new Logger('BullBoard')

interface BasicAuthRequest {
  headers?: Record<string, string | string[] | undefined>
}
interface BasicAuthResponse {
  status: (code: number) => { send: (body: string) => void }
  setHeader: (name: string, value: string) => void
}
type NextFn = () => void
type ExpressMiddleware = (req: BasicAuthRequest, res: BasicAuthResponse, next: NextFn) => void

/**
 * Basic-auth gate for `/admin/queues`. Credentials come from env vars so
 * ops can rotate without a deploy.
 *
 * **Auth is enforced in every environment.** If `BULL_BOARD_USER` /
 * `BULL_BOARD_PASSWORD` are unset, the route serves a 503 — including in
 * dev, staging, and preview deployments. The previous "skip auth if no env
 * vars in non-production" shortcut was a real attacker surface on any
 * non-production URL, so it has been removed.
 *
 * Credential comparison uses `crypto.timingSafeEqual` to neutralise the
 * length-and-byte-by-byte timing side channels that `===` exposes.
 *
 * Long-term plan: replace the basic-auth gate with a Nest `JwtAuthGuard +
 * superadmin` middleware so ops console access follows the same role model
 * as the rest of the app. Deferred until someone needs SSO into Bull Board.
 */
/** Exported for unit tests; not part of the public NestJS surface. */
export function buildAuthMiddleware(): ExpressMiddleware {
  const user = process.env.BULL_BOARD_USER
  const password = process.env.BULL_BOARD_PASSWORD

  if (!user || !password) {
    logger.warn(
      'BULL_BOARD_USER / BULL_BOARD_PASSWORD not set — /admin/queues is blocked in every environment'
    )
    return (_req, res) => {
      res.status(503).send('Bull Board credentials not configured')
    }
  }

  const expectedUser = Buffer.from(user)
  const expectedPassword = Buffer.from(password)

  return (req, res, next) => {
    const header = typeof req.headers?.authorization === 'string' ? req.headers.authorization : ''
    if (!header.toLowerCase().startsWith('basic ')) {
      challenge(res)
      return
    }
    let suppliedUser = ''
    let suppliedPassword = ''
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
      const colonAt = decoded.indexOf(':')
      if (colonAt === -1) {
        challenge(res)
        return
      }
      suppliedUser = decoded.slice(0, colonAt)
      suppliedPassword = decoded.slice(colonAt + 1)
    } catch {
      challenge(res)
      return
    }

    if (!safeEqual(Buffer.from(suppliedUser), expectedUser)) {
      challenge(res)
      return
    }
    if (!safeEqual(Buffer.from(suppliedPassword), expectedPassword)) {
      challenge(res)
      return
    }
    next()
  }
}

/** Equal-length timing-safe comparison. Returns false on length mismatch
 *  WITHOUT short-circuiting on the supplied content (only on the length,
 *  which is intentionally public — see RFC 7235). */
function safeEqual(supplied: Buffer, expected: Buffer): boolean {
  if (supplied.length !== expected.length) return false
  return timingSafeEqual(supplied, expected)
}

function challenge(res: BasicAuthResponse): void {
  res.setHeader('WWW-Authenticate', 'Basic realm="wc-notifications-queue"')
  res.status(401).send('Authentication required')
}

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: buildAuthMiddleware(),
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.Notifications, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.NotificationsScheduled, adapter: BullMQAdapter }
    ),
  ],
})
export class NotificationsBullBoardModule {}
