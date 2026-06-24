import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import {
  PROVIDER_ACCESS_KEY,
  type ProviderAccessLevel,
} from '../decorators/provider-access.decorator'

/**
 * Gates provider-account endpoints (onboarding, stripe-connect) by provider access level.
 *
 * A provider OWNER holds the system role named 'Provider Admin'. A full-access provider sub-admin
 * holds a per-provider system role (providerId set, isSystemRole true) — named 'Admin'. Limited
 * custom roles are provider-scoped but NOT system roles.
 *
 * - `admin`  → owner or per-provider full-access Admin (custom roles excluded)
 * - `member` → any provider user (owner or any provider-scoped role)
 *
 * The level defaults to `admin` so account endpoints fail closed unless explicitly opened.
 */
@Injectable()
export class ProviderAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const level =
      this.reflector.getAllAndOverride<ProviderAccessLevel>(PROVIDER_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'admin'

    const { user } = context.switchToHttp().getRequest()
    if (!user) {
      throw new ForbiddenException('User not authenticated')
    }

    const roles: Array<{ name?: string; providerId?: string | null; isSystemRole?: boolean }> =
      user.roles ?? []

    const isProviderUser = roles.some(r => r.name === 'Provider Admin' || r.providerId != null)
    const isProviderAdmin = roles.some(
      r => r.name === 'Provider Admin' || (r.providerId != null && r.isSystemRole === true)
    )

    const allowed = level === 'admin' ? isProviderAdmin : isProviderUser
    if (!allowed) {
      throw new ForbiddenException(
        level === 'admin'
          ? 'Access denied. Provider admin access required.'
          : 'Access denied. Provider access required.'
      )
    }

    return true
  }
}
