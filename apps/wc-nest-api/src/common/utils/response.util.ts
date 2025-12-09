import type { ApiErrorResponse, ApiResponse } from '../interfaces/api-response.interface'

export class ResponseUtil {
  /**
   * Creates a successful API response
   * @param data - The data to include in the response
   * @param meta - Optional metadata (e.g., pagination info)
   * @returns Formatted success response
   */
  static success<T>(data: T, meta?: any): ApiResponse<T> {
    return {
      success: true,
      data,
      ...(meta && { meta }),
    }
  }

  /**
   * Creates an error API response
   * @param message - Error message
   * @param error - Optional error type
   * @param statusCode - Optional HTTP status code
   * @returns Formatted error response
   */
  static error(message: string, error?: string, statusCode?: number): ApiErrorResponse {
    return {
      success: false,
      data: {
        message,
        ...(error && { error }),
        ...(statusCode && { statusCode }),
      },
    }
  }
}
