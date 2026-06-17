/**
 * Navigation Permission Helpers (shared across World Camps frontends)
 *
 * Navigation permissions determine which permission must accompany any other permission
 * selected within a group in the role form (you cannot grant `camps.update` without also
 * granting `camps.read`, otherwise the section would be unreachable).
 *
 * Rather than hardcoding a group -> permission map (which drifts from the backend catalog and
 * historically contained permissions that no longer exist), these helpers DERIVE the navigation
 * permission for a group from the permission groups the role form fetches from the API. By
 * convention the navigation permission of a group is its read permission (the permission whose
 * id ends in `.read`).
 */

import type { PermissionGroup } from '@world-schools/wc-types'

/**
 * The navigation permission for a group: its read permission (id ending in `.read`).
 * Returns null if the group has no read permission.
 */
export function getGroupNavigationPermission(group: PermissionGroup): string | null {
  return group.permissions.find(p => p.id.endsWith('.read'))?.id ?? null
}

/**
 * Find the group that contains a given permission id.
 */
export function findGroupForPermission(
  groups: PermissionGroup[],
  permissionId: string
): PermissionGroup | null {
  return groups.find(g => g.permissions.some(p => p.id === permissionId)) ?? null
}

/**
 * The navigation (read) permission of the group that contains the given permission.
 * @example getNavigationPermissionForPermission(groups, 'users.create') => 'users.read'
 */
export function getNavigationPermissionForPermission(
  groups: PermissionGroup[],
  permissionId: string
): string | null {
  const group = findGroupForPermission(groups, permissionId)
  return group ? getGroupNavigationPermission(group) : null
}

/**
 * Whether the given permission is the navigation (read) permission of its group.
 */
export function isGroupNavigationPermission(group: PermissionGroup, permissionId: string): boolean {
  return getGroupNavigationPermission(group) === permissionId
}
