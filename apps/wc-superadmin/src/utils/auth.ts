import type { User } from '@/types/auth'

const SUPERADMIN_DOMAINS = ['@worldcamps.org', '@worldcamps.com', '@wc-admin.com']

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'superadmin'
}

export function isSuperAdminEmail(email: string): boolean {
  return SUPERADMIN_DOMAINS.some(domain => email.endsWith(domain))
}

export function getRoleFromEmail(email: string): 'superadmin' | 'staff' {
  return isSuperAdminEmail(email) ? 'superadmin' : 'staff'
}
