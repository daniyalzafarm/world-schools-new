import axios, { AxiosInstance } from 'axios'

/**
 * Provider Org Isolation E2E Tests
 *
 * Verifies that Provider A cannot access Provider B's conversations or send
 * messages into them.
 *
 * Prerequisites (seeded test data):
 *   - Two provider users:  PROVIDER_A_EMAIL / PROVIDER_B_EMAIL (env vars)
 *   - Each provider has at least one conversation in the DB
 *   - Conversation IDs are injected via PROVIDER_A_CONV_ID / PROVIDER_B_CONV_ID env vars
 *
 * If the env vars are absent the suite is skipped so CI doesn't fail on
 * environments without seeded isolation data.
 */
describe('Provider Org Isolation E2E', () => {
  let providerAClient: AxiosInstance
  let providerBClient: AxiosInstance
  let baseURL: string

  const PROVIDER_A_EMAIL = process.env.PROVIDER_A_EMAIL
  const PROVIDER_A_PASSWORD = process.env.PROVIDER_A_PASSWORD
  const PROVIDER_B_EMAIL = process.env.PROVIDER_B_EMAIL
  const PROVIDER_B_PASSWORD = process.env.PROVIDER_B_PASSWORD
  const PROVIDER_A_CONV_ID = process.env.PROVIDER_A_CONV_ID
  const PROVIDER_B_CONV_ID = process.env.PROVIDER_B_CONV_ID

  const allEnvPresent =
    PROVIDER_A_EMAIL &&
    PROVIDER_A_PASSWORD &&
    PROVIDER_B_EMAIL &&
    PROVIDER_B_PASSWORD &&
    PROVIDER_A_CONV_ID &&
    PROVIDER_B_CONV_ID

  beforeAll(async () => {
    if (!allEnvPresent) return

    const host = process.env.HOST ?? 'localhost'
    const port = process.env.PORT ?? '3000'
    baseURL = `http://${host}:${port}`

    // Authenticate Provider A
    const loginA = await axios.post(
      `${baseURL}/provider/auth/login`,
      { email: PROVIDER_A_EMAIL, password: PROVIDER_A_PASSWORD },
      { validateStatus: () => true }
    )
    const cookiesA = loginA.headers['set-cookie']?.join('; ') ?? ''

    providerAClient = axios.create({
      baseURL,
      validateStatus: () => true,
      headers: { Cookie: cookiesA },
    })

    // Authenticate Provider B
    const loginB = await axios.post(
      `${baseURL}/provider/auth/login`,
      { email: PROVIDER_B_EMAIL, password: PROVIDER_B_PASSWORD },
      { validateStatus: () => true }
    )
    const cookiesB = loginB.headers['set-cookie']?.join('; ') ?? ''

    providerBClient = axios.create({
      baseURL,
      validateStatus: () => true,
      headers: { Cookie: cookiesB },
    })
  })

  const skip = (name: string, fn: () => Promise<void>) => {
    if (!allEnvPresent) {
      it.skip(name, fn)
    } else {
      it(name, fn)
    }
  }

  // ─── Provider A cannot read Provider B's messages ────────────────────────

  skip(
    'Provider A cannot GET messages from Provider B conversation → 403',
    async () => {
      const res = await providerAClient.get('/provider/messaging/messages', {
        params: { conversationId: PROVIDER_B_CONV_ID },
      })
      expect(res.status).toBe(403)
    }
  )

  // ─── Provider A cannot send into Provider B's conversation ───────────────

  skip(
    'Provider A cannot POST a message into Provider B conversation → 403',
    async () => {
      const res = await providerAClient.post('/provider/messaging/messages', {
        conversationId: PROVIDER_B_CONV_ID,
        content: 'Cross-provider injection attempt',
        idempotencyKey: `isolation-test-${Date.now()}`,
      })
      expect(res.status).toBe(403)
    }
  )

  // ─── Provider A can access its own conversations ─────────────────────────

  skip(
    'Provider A CAN GET messages from its own conversation → 200',
    async () => {
      const res = await providerAClient.get('/provider/messaging/messages', {
        params: { conversationId: PROVIDER_A_CONV_ID },
      })
      expect(res.status).toBe(200)
    }
  )

  // ─── Provider B can access its own conversations ─────────────────────────

  skip(
    'Provider B CAN GET messages from its own conversation → 200',
    async () => {
      const res = await providerBClient.get('/provider/messaging/messages', {
        params: { conversationId: PROVIDER_B_CONV_ID },
      })
      expect(res.status).toBe(200)
    }
  )
})
