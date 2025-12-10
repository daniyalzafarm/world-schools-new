/**
 * User Types for WC Provider
 */

import type { Role } from './roles'

export interface UserRole {
  userId: string
  roleId: string
  role: Role
}

export interface User {
  id: string
  email: string
  passwordHash: string | null
  firstName: string | null
  lastName: string | null
  emailVerified: boolean
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  roles: UserRole[]
  ownedProvider?: {
    id: string
  } | null
}

export interface CreateUserData {
  email: string
  firstName: string
  lastName: string
  password?: string
  roleIds?: string[]
}

export interface UpdateUserData {
  email?: string
  firstName?: string
  lastName?: string
  password?: string
  roleIds?: string[]
}

export interface UserFilters {
  search?: string
  roleId?: string
  emailVerified?: boolean
  createdAfter?: string
  createdBefore?: string
}

export interface UsersState {
  users: User[]
  currentUser: User | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: UserFilters
}

export interface UsersStore extends UsersState {
  fetchUsers: () => Promise<boolean>
  getUserById: (id: string) => Promise<boolean>
  createUser: (userData: CreateUserData) => Promise<boolean>
  updateUser: (id: string, userData: UpdateUserData) => Promise<boolean>
  deleteUser: (id: string) => Promise<boolean>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<UserFilters>) => void
  clearFilters: () => void
  clearError: () => void
  setCurrentUser: (user: User | null) => void
}
