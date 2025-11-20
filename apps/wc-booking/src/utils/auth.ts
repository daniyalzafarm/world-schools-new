import type { User } from '@/types/auth'

/**
 * Check if user is a Parent (system role)
 * Parents can book camps and manage their bookings
 */
export function isParent(user: User | null): boolean {
  if (!user) return false
  return user.roles?.some(role => role.name === 'Parent') ?? false
}

/**
 * Check if user is authorized to access the booking app
 * User must have Parent role
 * This matches the backend logic in user/auth/auth.controller.ts
 */
export function isAuthorizedBookingUser(user: User | null): boolean {
  if (!user) return false
  return isParent(user)
}
