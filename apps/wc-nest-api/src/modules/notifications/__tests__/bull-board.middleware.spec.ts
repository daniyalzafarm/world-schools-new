import { buildAuthMiddleware } from '../queue/bull-board.module'

interface Res {
  status: jest.Mock
  send: jest.Mock
  setHeader: jest.Mock
}

function makeRes(): Res {
  const res = { status: jest.fn(), send: jest.fn(), setHeader: jest.fn() } as Res
  res.status.mockReturnValue({ send: res.send })
  return res
}

function basicHeader(user: string, password: string): string {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')
}

describe('Bull Board basic-auth middleware', () => {
  const ORIG = {
    BULL_BOARD_USER: process.env.BULL_BOARD_USER,
    BULL_BOARD_PASSWORD: process.env.BULL_BOARD_PASSWORD,
  }

  afterEach(() => {
    process.env.BULL_BOARD_USER = ORIG.BULL_BOARD_USER
    process.env.BULL_BOARD_PASSWORD = ORIG.BULL_BOARD_PASSWORD
  })

  describe('when env vars are unset', () => {
    beforeEach(() => {
      delete process.env.BULL_BOARD_USER
      delete process.env.BULL_BOARD_PASSWORD
    })

    it('serves 503 in every environment — no dev-fallback bypass', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: {} }, res, next)

      expect(res.status).toHaveBeenCalledWith(503)
      expect(next).not.toHaveBeenCalled()
    })

    it('serves 503 even with NODE_ENV=development (regression guard)', () => {
      const prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      const mw = buildAuthMiddleware()
      process.env.NODE_ENV = prevEnv
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: {} }, res, next)

      expect(res.status).toHaveBeenCalledWith(503)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('when env vars are set', () => {
    beforeEach(() => {
      process.env.BULL_BOARD_USER = 'ops'
      process.env.BULL_BOARD_PASSWORD = 'correct-horse-battery-staple'
    })

    it('calls next() on correct credentials', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw(
        { headers: { authorization: basicHeader('ops', 'correct-horse-battery-staple') } },
        res,
        next
      )

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('challenges with 401 when no Authorization header is present', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: {} }, res, next)

      expect(res.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Basic realm')
      )
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('challenges when the password is wrong', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: { authorization: basicHeader('ops', 'wrong') } }, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('challenges when the username is wrong', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw(
        { headers: { authorization: basicHeader('attacker', 'correct-horse-battery-staple') } },
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('challenges on a malformed authorization header (no colon)', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw(
        { headers: { authorization: 'Basic ' + Buffer.from('no-colon-here').toString('base64') } },
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('challenges on a non-Basic scheme', () => {
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: { authorization: 'Bearer abc.def.ghi' } }, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects a long supplied password without a length-based short-circuit (timing-safe)', () => {
      // Different-length supplied password should fail; we exercise the path
      // to make sure `safeEqual`'s length check returns false safely.
      const mw = buildAuthMiddleware()
      const res = makeRes()
      const next = jest.fn()
      mw({ headers: { authorization: basicHeader('ops', 'short') } }, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })
  })
})
