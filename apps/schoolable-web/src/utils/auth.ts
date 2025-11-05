import type { User } from '@/types/auth'

/**
 * Check if a user is an admin based on their role
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

/**
 * Check if an email address belongs to an admin domain
 */
export function isAdminEmail(email: string): boolean {
  return email.endsWith('@schoolableproviders.com')
}

/**
 * Get the appropriate role based on email domain
 */
export function getRoleFromEmail(email: string): 'admin' | 'student' {
  return isAdminEmail(email) ? 'admin' : 'student'
}
