import { UnauthorizedException } from '@nestjs/common'
import { UserAuthController } from './auth.controller'
import { Prisma } from '../../../generated/client/client'

/**
 * Coverage for the reworked `POST /user/auth/google-signin` flow: server-side
 * credential verification, the `email_verified` security gate, find/link/create
 * resolution, the P2002 concurrency retry, and best-effort photo import. The
 * verifier is mocked so no real Google call is made.
 */

type AnyObj = Record<string, any>

const verifiedPayload = (over: AnyObj = {}) => ({
  sub: 'google-sub-1',
  email: 'Parent@Gmail.com',
  email_verified: true,
  given_name: 'Pat',
  family_name: 'Parent',
  ...over,
})

const makeController = (over: AnyObj = {}) => {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'new-user' }), update: jest.fn() },
    userAccount: { create: jest.fn() },
    parent: { create: jest.fn() },
    userRole: { create: jest.fn() },
  }
  const prisma = {
    userAccount: { findUnique: jest.fn().mockResolvedValue(null) },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'parent-role' }) },
    user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    parent: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    ...(over.prisma ?? {}),
  }
  const authService = {
    validateUser: jest.fn().mockResolvedValue({ id: 'resolved', roles: [{ name: 'Parent' }] }),
    generateTokensFromUser: jest
      .fn()
      .mockReturnValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
  }
  const sessionManagementService = { createSession: jest.fn().mockResolvedValue('sess-1') }
  const configService = {
    getNodeEnv: () => 'test',
    jwtConfig: { expiresIn: '15m', refreshExpiresIn: '7d', authUsingRequest: false },
  }
  const profilePhotoService = { uploadPhoto: jest.fn(), generatePhotoUrl: jest.fn() }
  const googleTokenVerifier = {
    verify: jest.fn().mockResolvedValue(verifiedPayload()),
    ...(over.googleTokenVerifier ?? {}),
  }

  const controller = new UserAuthController(
    authService as any,
    {} as any, // jwtService
    prisma as any,
    configService as any,
    {} as any, // emailVerificationService
    {} as any, // passwordResetService
    {} as any, // twoFactorAuthService
    sessionManagementService as any,
    profilePhotoService as any,
    googleTokenVerifier as any,
    {} as any // profileCompletion
  )

  const res = { cookie: jest.fn(), setHeader: jest.fn() }
  const req = { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' }

  return {
    controller,
    prisma,
    tx,
    authService,
    sessionManagementService,
    profilePhotoService,
    googleTokenVerifier,
    res,
    req,
  }
}

const call = (ctx: ReturnType<typeof makeController>, credential = 'cred') =>
  ctx.controller.googleSignIn({ credential } as any, ctx.res as any, ctx.req as any)

describe('UserAuthController.googleSignIn', () => {
  afterEach(() => jest.restoreAllMocks())

  it('rejects an invalid/expired credential without touching the database', async () => {
    const ctx = makeController({
      googleTokenVerifier: { verify: jest.fn().mockRejectedValue(new UnauthorizedException()) },
    })

    await expect(call(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(ctx.prisma.userAccount.findUnique).not.toHaveBeenCalled()
  })

  it('rejects when the Google email is not verified (security gate), with no DB writes', async () => {
    const ctx = makeController({
      googleTokenVerifier: {
        verify: jest.fn().mockResolvedValue(verifiedPayload({ email_verified: false })),
      },
    })

    await expect(call(ctx)).rejects.toThrow('Google email not verified')
    expect(ctx.prisma.userAccount.findUnique).not.toHaveBeenCalled()
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('creates a new pre-verified Parent user with a linked Google account', async () => {
    const ctx = makeController()

    const result = await call(ctx)

    // New user is created email-verified, password-less.
    expect(ctx.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'parent@gmail.com', // lowercased
          passwordHash: null,
          emailVerified: true,
        }),
      })
    )
    expect(ctx.tx.userAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authProvider: 'google',
          authProviderAccountId: 'google-sub-1',
        }),
      })
    )
    expect(ctx.tx.parent.create).toHaveBeenCalled()
    expect(ctx.tx.userRole.create).toHaveBeenCalled()
    // Session issued via the standard helper.
    expect(ctx.authService.validateUser).toHaveBeenCalledWith('new-user')
    expect(ctx.res.cookie).toHaveBeenCalledTimes(2)
    expect((result as any).success).toBe(true)
  })

  it('logs in a returning Google user without creating duplicates', async () => {
    const ctx = makeController({
      prisma: {
        userAccount: { findUnique: jest.fn().mockResolvedValue({ userId: 'existing-google' }) },
        role: { findFirst: jest.fn() },
        user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        $transaction: jest.fn(),
      },
    })

    await call(ctx)

    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
    expect(ctx.authService.validateUser).toHaveBeenCalledWith('existing-google')
  })

  it('auto-links Google to an existing password account with the same verified email', async () => {
    const ctx = makeController({
      prisma: {
        userAccount: { findUnique: jest.fn().mockResolvedValue(null) },
        role: { findFirst: jest.fn().mockResolvedValue({ id: 'parent-role' }) },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pw-user',
            emailVerified: false,
            roles: [],
            parentProfile: null,
          }),
          update: jest.fn(),
        },
      },
    })

    await call(ctx)

    // Links the Google account, confirms the email, and backfills Parent role + profile.
    expect(ctx.tx.userAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'pw-user' }) })
    )
    expect(ctx.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: true }) })
    )
    expect(ctx.tx.userRole.create).toHaveBeenCalled()
    expect(ctx.tx.parent.create).toHaveBeenCalled()
    expect(ctx.authService.validateUser).toHaveBeenCalledWith('pw-user')
  })

  it('retries resolution once on a P2002 race and logs in the winner', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    })
    const ctx = makeController({
      prisma: {
        userAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null) // first attempt: not found -> create path
            .mockResolvedValueOnce({ userId: 'raced-user' }), // retry: winner is now visible
        },
        role: { findFirst: jest.fn().mockResolvedValue({ id: 'parent-role' }) },
        user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        $transaction: jest.fn().mockRejectedValueOnce(p2002), // lose the create race
      },
    })

    await call(ctx)

    expect(ctx.googleTokenVerifier.verify).toHaveBeenCalledTimes(1)
    expect(ctx.prisma.userAccount.findUnique).toHaveBeenCalledTimes(2)
    expect(ctx.authService.validateUser).toHaveBeenCalledWith('raced-user')
  })

  it('never overwrites an existing photo, and survives a failed photo import', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    ;(global as any).fetch = fetchMock

    // Returning user who already has a photo -> import must skip entirely.
    const skip = makeController({
      prisma: {
        userAccount: { findUnique: jest.fn().mockResolvedValue({ userId: 'has-photo' }) },
        role: { findFirst: jest.fn() },
        user: {
          findUnique: jest.fn().mockResolvedValue({ profilePhotoUrl: 'existing-blob' }),
          update: jest.fn(),
        },
        $transaction: jest.fn(),
      },
      googleTokenVerifier: {
        verify: jest.fn().mockResolvedValue(verifiedPayload({ picture: 'https://pic/=s96-c' })),
      },
    })
    await call(skip)
    expect(skip.profilePhotoService.uploadPhoto).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()

    // New user, picture present, but upload throws -> sign-in still succeeds.
    const fail = makeController({
      prisma: {
        userAccount: { findUnique: jest.fn().mockResolvedValue(null) },
        role: { findFirst: jest.fn().mockResolvedValue({ id: 'parent-role' }) },
        user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      },
      googleTokenVerifier: {
        verify: jest.fn().mockResolvedValue(verifiedPayload({ picture: 'https://pic/=s96-c' })),
      },
    })
    fail.profilePhotoService.uploadPhoto.mockRejectedValue(new Error('azure down'))

    const result = await call(fail)
    expect((result as any).success).toBe(true)
    expect(fail.authService.validateUser).toHaveBeenCalledWith('new-user')
  })
})
