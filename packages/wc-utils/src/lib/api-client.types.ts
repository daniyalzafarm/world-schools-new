/**
 * API Client Types for World Camps Applications
 *
 * These types are used by the shared API client factory to provide
 * type-safe HTTP communication with the wc-nest-api backend.
 */

export interface ApiResponse<T = any> {
  [x: string]: any
  success: true
  data: T
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

/**
 * Configuration options for creating an API client instance
 */
export interface ApiClientConfig {
  /**
   * Base URL for the API (e.g., 'http://localhost:3000/')
   */
  baseURL: string

  /**
   * Whether to use request-based authentication (Authorization header)
   * or cookie-based authentication (HTTP-only cookies)
   * @default false (cookie-based)
   */
  usingRequest: boolean

  /**
   * Prefix for token storage keys in localStorage/sessionStorage
   * @example 'wc_superadmin' -> 'wc_superadmin_access_token'
   * @default 'app'
   */
  storageKeyPrefix?: string

  /**
   * Endpoint for refreshing access tokens
   * @example '/superadmin/auth/refresh' or '/auth/refresh'
   * @default '/auth/refresh'
   */
  refreshEndpoint?: string
}

/**
 * API client instance returned by createApiClient factory
 */
export interface ApiClient {
  // HTTP Methods
  get: <T>(url: string, config?: any, attachResponseHeaders?: boolean) => Promise<ApiResult<T>>
  post: <T>(
    url: string,
    data: any,
    config?: any,
    attachResponseHeaders?: boolean
  ) => Promise<ApiResult<T>>
  put: <T>(url: string, data: any, config?: any) => Promise<ApiResult<T>>
  patch: <T>(url: string, data: any, config?: any) => Promise<ApiResult<T>>
  del: <T>(url: string, config?: any) => Promise<ApiResult<T>>
  postFile: <T>(
    url: string,
    file: File | Blob,
    additionalData?: Record<string, any>,
    config?: any
  ) => Promise<ApiResult<T>>
  postFormData: <T>(
    url: string,
    formData: FormData,
    method?: 'POST' | 'PUT',
    config?: any
  ) => Promise<ApiResult<T>>

  // Token Management
  setTokens: (access: string | null, refresh: string | null) => void
  getTokens: () => { accessToken: string | null; refreshToken: string | null }
  clearTokens: () => void
  hasValidTokens: () => boolean
}
