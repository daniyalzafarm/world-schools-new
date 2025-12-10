/**
 * Navigation Permission Configuration
 *
 * This file defines the mapping between permission groups and their required navigation permissions.
 * Navigation permissions determine which sidebar menu items a user can see and access.
 *
 * The navigation permission for each group is typically the READ permission of that group.
 */

export interface NavigationPermissionConfig {
  /**
   * The permission ID required to navigate to this section
   */
  navigationPermission: string
  /**
   * Display label for the section
   */
  label: string
  /**
   * Optional: All permissions in this group
   * Used for auto-selection logic
   */
  groupPermissions?: string[]
}

/**
 * Maps permission group keys to their navigation permission configuration
 */
export const NAVIGATION_PERMISSIONS: Record<string, NavigationPermissionConfig> = {
  users: {
    navigationPermission: 'users.read',
    label: 'Users',
    groupPermissions: ['users.create', 'users.read', 'users.update', 'users.delete'],
  },
  roles: {
    navigationPermission: 'roles.read',
    label: 'Roles',
    groupPermissions: ['roles.create', 'roles.read', 'roles.update', 'roles.delete'],
  },
}

/**
 * Get all navigation permissions
 */
export function getAllNavigationPermissions(): string[] {
  return Object.values(NAVIGATION_PERMISSIONS).map(config => config.navigationPermission)
}

/**
 * Get navigation permission for a specific group
 */
export function getNavigationPermission(groupKey: string): string | null {
  return NAVIGATION_PERMISSIONS[groupKey]?.navigationPermission ?? null
}

/**
 * Check if a permission is a navigation permission
 */
export function isNavigationPermission(permissionId: string): boolean {
  return getAllNavigationPermissions().includes(permissionId)
}

/**
 * Get the group key for a given permission ID
 * @example getGroupKeyForPermission('users.create') => 'users'
 */
export function getGroupKeyForPermission(permissionId: string): string | null {
  const parts = permissionId.split('.')
  if (parts.length < 2) return null
  return parts[0] // e.g., 'users' from 'users.create'
}

/**
 * Get navigation permission for a given permission ID
 * @example getNavigationPermissionForPermission('users.create') => 'users.read'
 */
export function getNavigationPermissionForPermission(permissionId: string): string | null {
  const groupKey = getGroupKeyForPermission(permissionId)
  if (!groupKey) return null
  return getNavigationPermission(groupKey)
}

/**
 * Get all permissions that should be auto-selected when a permission from a group is selected
 * This ensures navigation permissions are always included
 */
export function getRequiredPermissionsForGroup(groupKey: string): string[] {
  const config = NAVIGATION_PERMISSIONS[groupKey]
  if (!config) return []
  return [config.navigationPermission]
}
