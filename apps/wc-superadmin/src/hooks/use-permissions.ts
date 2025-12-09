/**
 * Permissions Hook for WC Superadmin
 *
 * Provides utilities for checking user permissions
 */

import { useAuthStore } from '@/stores/auth-store'

export function usePermissions() {
  const { user } = useAuthStore()
  const permissions = user?.permissions ?? []

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some(p => permissions.includes(p))
  }

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every(p => permissions.includes(p))
  }

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
