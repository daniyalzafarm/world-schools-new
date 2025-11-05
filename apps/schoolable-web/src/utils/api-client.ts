import config from '@/config/config'
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

export interface ApiResponse<T = any> {
  [x: string]: any
  success: boolean
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

// Token storage for authUsingRequest mode
let accessToken: string | null = null
let refreshToken: string | null = null

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

// Initialize tokens from storage on module load
const initializeTokensFromStorage = () => {
  try {
    // Try localStorage first, then sessionStorage, then memory
    accessToken =
      localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY) || null
    refreshToken =
      localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY) || null
  } catch (error) {
    console.warn('Failed to load tokens from storage:', error)
    // Fallback to memory-only storage
    accessToken = null
    refreshToken = null
  }
}

const setTokens = (access: string | null, refresh: string | null) => {
  accessToken = access
  refreshToken = refresh

  try {
    if (access) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access)
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }

    if (refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  } catch (error) {
    console.warn('Failed to save tokens to localStorage, falling back to sessionStorage:', error)
    try {
      if (access) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, access)
      } else {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      }

      if (refresh) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh)
      } else {
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    } catch (sessionError) {
      console.warn('Failed to save tokens to sessionStorage, using memory only:', sessionError)
      // Tokens are already set in memory variables
    }
  }
}

const getTokens = () => ({ accessToken, refreshToken })

const clearTokens = () => {
  accessToken = null
  refreshToken = null

  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.warn('Failed to clear tokens from storage:', error)
  }
}

const hasValidTokens = () => {
  return !!(accessToken && refreshToken)
}

// Initialize tokens from storage when module loads
if (typeof window !== 'undefined') {
  initializeTokensFromStorage()
}

// Export token management functions for auth store
export { setTokens, getTokens, clearTokens, hasValidTokens }

const api = axios.create({
  baseURL: config.app.apiUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: !config.auth.usingRequest, // Only include cookies if not using request headers
})

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })

  failedQueue = []
}

// Request interceptor for auth
api.interceptors.request.use(
  axiosConfig => {
    if (config.auth.usingRequest && accessToken) {
      // Add Authorization header when using request-based auth
      axiosConfig.headers.Authorization = `Bearer ${accessToken}`
    }
    // Cookies are automatically included with withCredentials: true when not using request headers
    return axiosConfig
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor for token refresh and token extraction
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Extract tokens from headers if authUsingRequest is enabled
    if (config.auth.usingRequest) {
      const newAccessToken = response.headers['x-access-token']
      const newRefreshToken = response.headers['x-refresh-token']

      if (newAccessToken) {
        setTokens(newAccessToken, newRefreshToken || refreshToken)
      }
    }

    return response
  },
  async error => {
    const originalRequest = error.config

    // Prevent infinite loop
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            return api(originalRequest)
          })
          .catch(err => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        let response
        if (config.auth.usingRequest && refreshToken) {
          // Use refresh token in Authorization header
          response = await axios.post(
            `${config.app.apiUrl}auth/refresh`,
            {},
            {
              headers: {
                ['x-refresh-token']: refreshToken,
                'Content-Type': 'application/json',
              },
            }
          )
        } else {
          // Use cookie-based refresh
          response = await api.post('/auth/refresh')
        }

        if (response.data.success) {
          // Extract new tokens from response headers if using request auth
          if (config.auth.usingRequest) {
            const newAccessToken = response.headers['x-access-token']
            const newRefreshToken = response.headers['x-refresh-token']
            if (newAccessToken) {
              setTokens(newAccessToken, newRefreshToken || refreshToken)
            }
          }

          processQueue(null)
          return api(originalRequest)
        } else {
          processQueue(error, null)
          // Let the auth store handle the redirect
          return Promise.reject(error)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        // Let the auth store handle the redirect
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

const formatResponse = <T>(responseData: any): ApiResponse<T> => {
  if (
    responseData &&
    typeof responseData === 'object' &&
    'success' in responseData &&
    'data' in responseData
  ) {
    return responseData as ApiResponse<T>
  }
  return { success: true, data: responseData }
}

const formatErrorResponse = (error: any): ApiErrorResponse => {
  // If error response has the expected structure
  if (error.response?.data?.success === false && error.response?.data?.data?.message) {
    return error.response.data as ApiErrorResponse
  }

  // Otherwise, format it to match our error structure
  return {
    success: false,
    data: {
      message: error.response?.data?.message ?? error.message ?? 'An error occurred',
      error: error.response?.data?.error ?? error.name,
      statusCode: error.response?.status,
    },
  }
}

// GET request
export const get = async <T>(
  url: string,
  config?: AxiosRequestConfig,
  attachResponseHeaders = false
): Promise<ApiResult<T>> => {
  try {
    const response = await api.get(url, config)
    const formattedResponse: ApiResponse<T> = formatResponse<T>(response.data)
    if (attachResponseHeaders) {
      formattedResponse.headers = response.headers
    }

    return formattedResponse
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// POST request
export const post = async <T>(
  url: string,
  data: any,
  config?: AxiosRequestConfig,
  attachResponseHeaders = false
): Promise<ApiResult<T>> => {
  try {
    const response = await api.post(url, data, config)
    const formattedResponse: ApiResponse<T> = formatResponse<T>(response.data)
    if (attachResponseHeaders) {
      formattedResponse.headers = response.headers
    }
    return formattedResponse
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// POST method that handles file uploads.
// It constructs a FormData object, appends the file and any additional data,
// and posts it with the multipart/form-data header.
export const postFile = async <T>(
  url: string,
  file: File | Blob,
  additionalData?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<ApiResult<T>> => {
  const formData = new FormData()
  formData.append('file', file)

  if (additionalData) {
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key])
    })
  }

  // Merge config and override headers to use multipart/form-data.
  const finalConfig: AxiosRequestConfig = {
    ...config,
    headers: {
      ...(config?.headers ?? {}),
      'Content-Type': 'multipart/form-data',
    },
  }

  try {
    const response = await api.post(url, formData, finalConfig)
    return formatResponse<T>(response.data)
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// POST/PUT method that handles FormData uploads with multiple files
export const postFormData = async <T>(
  url: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
  config?: AxiosRequestConfig
): Promise<ApiResult<T>> => {
  // Merge config and override headers to use multipart/form-data.
  const finalConfig: AxiosRequestConfig = {
    ...config,
    headers: {
      ...(config?.headers ?? {}),
      'Content-Type': 'multipart/form-data',
    },
  }

  try {
    const response =
      method === 'PUT'
        ? await api.put(url, formData, finalConfig)
        : await api.post(url, formData, finalConfig)
    return formatResponse<T>(response.data)
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// PUT request
export const put = async <T>(
  url: string,
  data: any,
  config?: AxiosRequestConfig
): Promise<ApiResult<T>> => {
  try {
    const response = await api.put(url, data, config)
    return formatResponse<T>(response.data)
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// PATCH request
export const patch = async <T>(
  url: string,
  data: any,
  config?: AxiosRequestConfig
): Promise<ApiResult<T>> => {
  try {
    const response = await api.patch(url, data, config)
    return formatResponse<T>(response.data)
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}

// DELETE request
export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> => {
  try {
    const response = await api.delete(url, config)
    return formatResponse<T>(response.data)
  } catch (error: any) {
    return formatErrorResponse(error)
  }
}
