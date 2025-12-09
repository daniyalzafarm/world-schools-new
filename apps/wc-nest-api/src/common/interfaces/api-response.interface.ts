export interface ApiResponse<T = any> {
  success: boolean
  data: T
  meta?: any
}

export interface ApiErrorResponse {
  success: false
  data: {
    message: string
    error?: string
    statusCode?: number
  }
}
