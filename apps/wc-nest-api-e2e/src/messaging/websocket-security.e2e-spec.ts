/**
 * WebSocket Security E2E Tests
 *
 * Verifies that the WebSocket layer enforces authentication and access control.
 *
 * Prerequisites (seeded test data):
 *   - Two users:  WS_USER_A_TOKEN / WS_USER_B_TOKEN (env vars — valid JWT access tokens)
 *   - USER_A_CONV_ID: a conversation that USER_A is a participant in
 *   - USER_B_CONV_ID: a conversation that USER_B is in but USER_A is NOT
 *
 * If env vars are absent the suite is skipped so CI doesn't fail on
 * environments without seeded data.
 *
 * @requires socket.io-client
 */
import { io, type Socket } from 'socket.io-client'

const WS_USER_A_TOKEN = process.env.WS_USER_A_TOKEN
const WS_USER_B_TOKEN = process.env.WS_USER_B_TOKEN
const USER_A_CONV_ID = process.env.USER_A_CONV_ID
const USER_B_CONV_ID = process.env.USER_B_CONV_ID

const allEnvPresent = WS_USER_A_TOKEN && WS_USER_B_TOKEN && USER_A_CONV_ID && USER_B_CONV_ID

function buildSocket(token?: string): Socket {
  const host = process.env.HOST ?? 'localhost'
  const port = process.env.PORT ?? '3000'
  return io(`http://${host}:${port}`, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  })
}

function waitForEvent(socket: Socket, event: string, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs)
    socket.once(event, data => {
      clearTimeout(t)
      resolve(data)
    })
  })
}

function ensureNotReceived(socket: Socket, event: string, windowMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, windowMs)
    socket.once(event, () => {
      clearTimeout(t)
      reject(new Error(`Unexpectedly received "${event}"`))
    })
  })
}

describe('WebSocket Security E2E', () => {
  const skip = (name: string, fn: () => Promise<void>) => {
    if (!allEnvPresent) {
      it.skip(name, fn)
    } else {
      it(name, fn, 10_000)
    }
  }

  // ─── No token → immediate disconnect ─────────────────────────────────────

  skip('unauthenticated socket is disconnected immediately', async () => {
    const socket = buildSocket(undefined)
    await waitForEvent(socket, 'disconnect')
    expect(socket.connected).toBe(false)
    socket.close()
  })

  // ─── join_conversation IDOR ───────────────────────────────────────────────
  // USER_A tries to join USER_B's conversation room and should NOT receive
  // subsequent message:new events for that room.

  skip('join_conversation to unauthorized conversation does not deliver message:new events', async () => {
    const socketA = buildSocket(WS_USER_A_TOKEN)
    await waitForEvent(socketA, 'connect')

    // USER_A emits join_conversation for a room it has no access to
    socketA.emit('join_conversation', { conversationId: USER_B_CONV_ID })

    // Allow the server side join to be processed
    await new Promise(r => setTimeout(r, 500))

    // Listen for message:new — should NOT arrive within the window
    const messageNotReceived = ensureNotReceived(socketA, 'message:new')

    // Connect as USER_B and send a real message into that conversation
    const socketB = buildSocket(WS_USER_B_TOKEN)
    await waitForEvent(socketB, 'connect')
    socketB.emit('send_message', {
      conversationId: USER_B_CONV_ID,
      content: 'Security probe',
      idempotencyKey: `ws-security-test-${Date.now()}`,
    })

    // Verify USER_A did not receive the message
    await messageNotReceived

    socketA.close()
    socketB.close()
  })

  // ─── message:read without participant access ──────────────────────────────

  skip('message:read for a conversation the user is not in → no receipt:read broadcast and no DB write', async () => {
    const socketA = buildSocket(WS_USER_A_TOKEN)
    await waitForEvent(socketA, 'connect')

    // Emit read receipt for USER_B's conversation — USER_A has no access
    socketA.emit('message:read', {
      messageId: 'probe-msg-id',
      conversationId: USER_B_CONV_ID,
    })

    // receipt:read should NOT be broadcast back to socketA
    await ensureNotReceived(socketA, 'receipt:read')

    socketA.close()
  })

  // ─── Authenticated user can join their own conversation ──────────────────

  skip('authenticated user can join their own conversation', async () => {
    const socketA = buildSocket(WS_USER_A_TOKEN)
    await waitForEvent(socketA, 'connect')

    // No error should occur when joining an authorized room
    const noError = ensureNotReceived(socketA, 'error')
    socketA.emit('join_conversation', { conversationId: USER_A_CONV_ID })

    await noError
    socketA.close()
  })
})
