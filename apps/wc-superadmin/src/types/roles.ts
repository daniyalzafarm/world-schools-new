/**
 * Roles and Permissions Types for WC Superadmin
 */

export interface Permission {
  id: string
  name: string
}

export interface Role {
  id: string
  name: string
  isSystemRole: boolean
  providerId: string | null
  createdAt: string
  updatedAt: string
  permissions: RolePermission[]
  _count?: {
    users: number
  }
}

export interface RolePermission {
  roleId: string
  permissionId: string
  permission: Permission
}

export interface CreateRoleData {
  name: string
  isSystemRole?: boolean
  permissionIds?: string[]
}

export interface UpdateRoleData {
  name?: string
  permissionIds?: string[]
}

export interface RoleFilters {
  search?: string
  isSystemRole?: boolean
  createdAfter?: string
  createdBefore?: string
}

export interface RolesState {
  roles: Role[]
  currentRole: Role | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: RoleFilters
}

export interface RolesActions {
  fetchRoles: () => Promise<boolean>
  createRole: (roleData: CreateRoleData) => Promise<boolean>
  updateRole: (id: string, roleData: UpdateRoleData) => Promise<boolean>
  deleteRole: (id: string) => Promise<boolean>
  getRoleById: (id: string) => Promise<boolean>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<RoleFilters>) => void
  clearFilters: () => void
  clearError: () => void
  setCurrentRole: (role: Role | null) => void
}

export type RolesStore = RolesState & RolesActions
