// Import User type for use in SuperAdminUser interface
import type { User } from '@world-schools/wc-types'

// Re-export shared types from wc-types package
export type {
  User,
  LoginCredentials,
  AuthState,
  AuthActions,
  AuthStore,
  ChangePasswordData,
  AuthResponse,
  JwtPayload,
} from '@world-schools/wc-types'

// Local extensions for wc-superadmin specific needs
export interface SuperAdminUser extends Omit<User, 'roles'> {
  role: string
  orgId?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}
