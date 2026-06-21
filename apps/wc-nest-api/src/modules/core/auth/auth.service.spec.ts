import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuthService } from './auth.service'

/**
 * Focused coverage for provider-id resolution in `buildUserResponse`. With no `profilePhotoUrl`
 * the method touches none of the injected services, so we can exercise it with stub deps.
 */
describe('AuthService.buildUserResponse — providerId resolution', () => {
  const service = new AuthService(undefined as any, undefined as any, undefined as any)
  const build = (user: any) => (service as any).buildUserResponse(user) as Promise<any>

  const base = { id: 'u1', email: 'u@example.com', profilePhotoUrl: null }
  const roleEntry = (role: any) => ({ role: { id: 'r1', permissions: [], ...role } })

  it('uses the owned provider for an owner', async () => {
    const res = await build({
      ...base,
      ownedProvider: { id: 'owned-provider' },
      roles: [roleEntry({ name: 'Provider Admin', providerId: null, isSystemRole: true })],
    })
    expect(res.providerId).toBe('owned-provider')
  })

  it('falls back to the provider-scoped role for a sub-user (member)', async () => {
    const res = await build({
      ...base,
      ownedProvider: null,
      roles: [roleEntry({ name: 'Admin', providerId: 'member-provider', isSystemRole: true })],
    })
    expect(res.providerId).toBe('member-provider')
  })

  it('leaves providerId undefined for a user with no provider association', async () => {
    const res = await build({
      ...base,
      ownedProvider: null,
      roles: [roleEntry({ name: 'Super Admin', providerId: null, isSystemRole: true })],
    })
    expect(res.providerId).toBeUndefined()
  })
})

/**
 * `getProviderAdminPermissions` powers the superadmin "Login as Provider" override: it must return
 * the seeded 'Provider Admin' system role's permission IDs (not human names), so the impersonating
 * superadmin gets full provider-app access.
 */
describe('AuthService.getProviderAdminPermissions', () => {
  it('returns the system Provider Admin role permission ids', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      permissions: [{ permissionId: 'camps.read' }, { permissionId: 'bookings.write' }],
    })
    const service = new AuthService(
      { role: { findFirst } } as any,
      undefined as any,
      undefined as any
    )

    const perms = await service.getProviderAdminPermissions()

    expect(perms).toEqual(['camps.read', 'bookings.write'])
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'Provider Admin', isSystemRole: true, providerId: null },
      })
    )
  })

  it('returns [] when the Provider Admin role is missing', async () => {
    const service = new AuthService(
      { role: { findFirst: jest.fn().mockResolvedValue(null) } } as any,
      undefined as any,
      undefined as any
    )
    expect(await service.getProviderAdminPermissions()).toEqual([])
  })
})

/**
 * `setPassword` lets a passwordless (OAuth) user set an INITIAL password without an old
 * password, but must never overwrite an existing one.
 */
describe('AuthService.setPassword', () => {
  const makeService = (user: any, update = jest.fn().mockResolvedValue({})) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user), update } }
    const configService = { jwtConfig: { bcryptSaltRounds: 4 } }
    const service = new AuthService(prisma as any, undefined as any, configService as any)
    return { service, update }
  }

  it('sets an initial password (hashed) for a passwordless user', async () => {
    const { service, update } = makeService({ id: 'u1', passwordHash: null })

    const result = await service.setPassword('u1', 'StrongPass123!')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ passwordChangedAt: expect.any(Date) }),
      })
    )
    const data = update.mock.calls[0][0].data
    expect(typeof data.passwordHash).toBe('string')
    expect(data.passwordHash).not.toBe('StrongPass123!') // stored hashed, not plaintext
    expect(result.passwordChangedAt).toBeInstanceOf(Date)
  })

  it('rejects when a password already exists (use change-password instead)', async () => {
    const { service, update } = makeService({ id: 'u1', passwordHash: 'existing-hash' })

    await expect(service.setPassword('u1', 'StrongPass123!')).rejects.toBeInstanceOf(
      BadRequestException
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('throws when the user does not exist', async () => {
    const { service } = makeService(null)

    await expect(service.setPassword('missing', 'StrongPass123!')).rejects.toBeInstanceOf(
      NotFoundException
    )
  })
})
