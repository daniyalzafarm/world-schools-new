/**
 * Authentication Types for World Camps Applications
 *
 * These types are shared across all WC applications (wc-superadmin, wc-provider, wc-booking)
 * and the wc-nest-api backend.
 */

// ============================================================================
// User & Role Types
// ============================================================================

export interface Role {
  id: string
  name: string
  providerId?: string | null
  provider_id?: string | null // Deprecated: use providerId instead
  isSystemRole?: boolean
}

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  bio?: string | null
  profilePhotoUrl?: string | null
  roles: Role[]
  permissions: string[]
  passwordChangedAt?: Date | string
  /** Whether the account has a password set. False for OAuth-only (e.g. Google) users. */
  hasPassword?: boolean
}

// ============================================================================
// Authentication Request DTOs
// ============================================================================

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

export interface ForgotPasswordData {
  email: string
}

export interface ResetPasswordData {
  token: string
  newPassword: string
}

export interface RefreshTokenData {
  refreshToken?: string
}

// ============================================================================
// Authentication Response DTOs
// ============================================================================

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: User
}

export interface LoginSuccessResponse {
  message: string
  user: User
}

// ============================================================================
// JWT Payload
// ============================================================================

export interface JwtPayload {
  sub: string // user id
  email: string
  iat?: number // issued at
  exp?: number // expiry
}

// ============================================================================
// Auth State (for frontend state management)
// ============================================================================

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
  getProfile: () => Promise<boolean>
  changePassword: (data: ChangePasswordData) => Promise<boolean>
  clearError: () => void
  initialize: () => Promise<void>
}

export type AuthStore = AuthState & AuthActions

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  headers?: any
}

export interface ApiErrorResponse {
  success: false
  data: {
    message: string
    error?: string
    statusCode?: number
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse

// ============================================================================
// Security & 2FA Types
// ============================================================================

export interface TwoFactorStatus {
  enabled: boolean
  method: string | null
  enabledAt: Date | string | null
}

export interface Session {
  id: string
  deviceType: string
  deviceName: string
  browser: string
  os: string
  ipAddress: string
  location: string
  lastActiveAt: string
  createdAt: string
  isCurrent?: boolean
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AuthConfig {
  usingRequest: boolean // true = use Authorization header, false = use HTTP-only cookies
}
