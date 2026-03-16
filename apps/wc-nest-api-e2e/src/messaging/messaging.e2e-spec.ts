import axios, { AxiosInstance } from 'axios'

/**
 * E2E tests for the Messaging module.
 *
 * - Unauthenticated requests to messaging endpoints must return 401.
 * - Conversation access: GET messages with valid JWT but for a conversation
 *   the user is not in must return 403 (covered by backend unit tests / integration).
 *
 * To run full flow (create conversation, send message, get messages) the API
 * must be running with a seeded DB and known test user credentials; then
 * call POST /user/auth/login (or provider equivalent) and use the returned
 * cookies/headers for subsequent requests.
 */
describe('Messaging E2E', () => {
  let client: AxiosInstance
  const conversationId = '00000000-0000-0000-0000-000000000001'

  beforeAll(() => {
    const host = process.env.HOST ?? 'localhost'
    const port = process.env.PORT ?? '3000'
    client = axios.create({
      baseURL: `http://${host}:${port}`,
      validateStatus: () => true,
    })
  })

  describe('Unauthenticated access', () => {
    it('GET /user/messaging/messages should return 401 without auth', async () => {
      const res = await client.get('/user/messaging/messages', {
        params: { conversationId },
      })
      expect(res.status).toBe(401)
    })

    it('POST /user/messaging/messages should return 401 without auth', async () => {
      const res = await client.post('/user/messaging/messages', {
        conversationId,
        senderId: '00000000-0000-0000-0000-000000000002',
        senderType: 'USER',
        content: 'test',
        idempotencyKey: 'e2e-test-key',
      })
      expect(res.status).toBe(401)
    })

    it('GET /provider/messaging/messages should return 401 without auth', async () => {
      const res = await client.get('/provider/messaging/messages', {
        params: { conversationId },
      })
      expect(res.status).toBe(401)
    })

    it('POST /provider/messaging/messages should return 401 without auth', async () => {
      const res = await client.post('/provider/messaging/messages', {
        conversationId,
        senderId: '00000000-0000-0000-0000-000000000002',
        senderType: 'PROVIDER',
        content: 'test',
        idempotencyKey: 'e2e-test-key',
      })
      expect(res.status).toBe(401)
    })

    it('GET /user/messaging/conversations should return 401 without auth', async () => {
      const res = await client.get('/user/messaging/conversations')
      expect(res.status).toBe(401)
    })

    it('POST /user/messaging/conversations should return 401 without auth', async () => {
      const res = await client.post('/user/messaging/conversations', {
        userId: '00000000-0000-0000-0000-000000000002',
        participantId: '00000000-0000-0000-0000-000000000003',
        participantType: 'provider',
        initialMessage: 'Hello',
      })
      expect(res.status).toBe(401)
    })
  })
})
