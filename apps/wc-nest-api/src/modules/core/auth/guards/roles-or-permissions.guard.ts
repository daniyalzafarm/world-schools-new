import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class RolesOrPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Public endpoints bypass all role/permission checks.
    // JwtAuthGuard skips token validation for @Public() routes which means
    // request.user is never set — so role checks must be skipped too.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // If neither roles nor permissions are required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()

    if (!user) {
      throw new ForbiddenException('User not authenticated')
    }

    let hasRole = false
    let hasPermission = false
    let roleError = ''
    let permissionError = ''

    // Check roles first (if specified)
    if (requiredRoles) {
      hasRole = requiredRoles.some(role =>
        user.roles?.some((userRole: any) => userRole.name === role)
      )
      if (!hasRole) {
        roleError = `Required roles: ${requiredRoles.join(', ')}`
      }
    }

    // If role check passed, grant access immediately
    if (hasRole) {
      return true
    }

    // Check permissions (if specified)
    if (requiredPermissions) {
      hasPermission = requiredPermissions.some(permission => user.permissions?.includes(permission))
      if (!hasPermission) {
        permissionError = `Required permissions: ${requiredPermissions.join(' OR ')}`
      }
    }

    // If permission check passed, grant access
    if (hasPermission) {
      return true
    }

    // If we reach here, both checks failed
    const errors = []
    if (roleError) errors.push(`(${roleError})`)
    if (permissionError) errors.push(`(${permissionError})`)

    throw new ForbiddenException(`Access denied. User must have either: ${errors.join(' OR ')}`)
  }
}
