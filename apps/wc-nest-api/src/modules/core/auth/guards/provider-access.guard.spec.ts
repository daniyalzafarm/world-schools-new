import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ProviderAccessGuard } from './provider-access.guard'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { PROVIDER_ACCESS_KEY } from '../decorators/provider-access.decorator'

function makeContext(user: any): any {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }
}

function makeReflector(opts: { isPublic?: boolean; level?: 'admin' | 'member' }): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return opts.isPublic ?? false
      if (key === PROVIDER_ACCESS_KEY) return opts.level
      return undefined
    }),
  } as unknown as Reflector
}

// Role fixtures mirroring how buildUserResponse shapes request.user.roles
const OWNER = [{ name: 'Provider Admin', providerId: null, isSystemRole: true }]
const PROVIDER_ADMIN = [{ name: 'Admin', providerId: 'p1', isSystemRole: true }]
const CUSTOM_ROLE = [{ name: 'Camp Manager', providerId: 'p1', isSystemRole: false }]
const SUPERADMIN = [{ name: 'Super Admin', providerId: null, isSystemRole: true }]

describe('ProviderAccessGuard', () => {
  describe("level 'admin'", () => {
    it.each([
      ['owner', OWNER, true],
      ['per-provider Admin', PROVIDER_ADMIN, true],
      ['custom provider role', CUSTOM_ROLE, false],
      ['superadmin', SUPERADMIN, false],
    ])('%s -> allowed=%s', (_label, roles, allowed) => {
      const guard = new ProviderAccessGuard(makeReflector({ level: 'admin' }))
      const ctx = makeContext({ roles })
      if (allowed) {
        expect(guard.canActivate(ctx)).toBe(true)
      } else {
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
      }
    })

    it('defaults to admin when no level metadata is set', () => {
      const guard = new ProviderAccessGuard(makeReflector({}))
      expect(guard.canActivate(makeContext({ roles: PROVIDER_ADMIN }))).toBe(true)
      expect(() => guard.canActivate(makeContext({ roles: CUSTOM_ROLE }))).toThrow(
        ForbiddenException
      )
    })
  })

  describe("level 'member'", () => {
    it.each([
      ['owner', OWNER, true],
      ['per-provider Admin', PROVIDER_ADMIN, true],
      ['custom provider role', CUSTOM_ROLE, true],
      ['superadmin', SUPERADMIN, false],
    ])('%s -> allowed=%s', (_label, roles, allowed) => {
      const guard = new ProviderAccessGuard(makeReflector({ level: 'member' }))
      const ctx = makeContext({ roles })
      if (allowed) {
        expect(guard.canActivate(ctx)).toBe(true)
      } else {
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
      }
    })
  })

  it('allows public routes', () => {
    const guard = new ProviderAccessGuard(makeReflector({ isPublic: true }))
    expect(guard.canActivate(makeContext(undefined))).toBe(true)
  })

  it('throws when there is no authenticated user', () => {
    const guard = new ProviderAccessGuard(makeReflector({ level: 'member' }))
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException)
  })
})
