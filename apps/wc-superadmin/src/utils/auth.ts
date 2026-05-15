import type { User } from '@/types/auth'

/**
 * Check if user has any superadmin-context role.
 * Superadmin roles are identified by having providerId = null.
 * This allows both system roles (like "Super Admin") and custom superadmin roles.
 */
export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false
  return user.roles?.some(role => role.providerId === null) ?? false
}
