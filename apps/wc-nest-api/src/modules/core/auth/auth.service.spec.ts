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
