import type { User } from '@/types/auth'

const SUPERADMIN_DOMAINS = ['@worldcamps.org', '@worldcamps.com', '@wc-admin.com']

/**
 * Check if user has any superadmin-context role.
 * Superadmin roles are identified by having providerId = null.
 * This allows both system roles (like "Super Admin") and custom superadmin roles.
 */
export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false
  return user.roles?.some(role => role.providerId === null) ?? false
}

export function isSuperAdminEmail(email: string): boolean {
  return SUPERADMIN_DOMAINS.some(domain => email.endsWith(domain))
}

export function getRoleFromEmail(email: string): 'superadmin' | 'staff' {
  return isSuperAdminEmail(email) ? 'superadmin' : 'staff'
}
