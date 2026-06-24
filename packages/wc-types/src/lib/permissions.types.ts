/**
 * RBAC permission catalog types (shared across World Camps frontends).
 *
 * These mirror the shape returned by `GET /{provider,superadmin}/permissions`, which the role
 * forms consume to render the permission groups.
 */

export interface Permission {
  id: string
  name: string
}

export interface PermissionGroup {
  name: string
  permissions: Permission[]
}
