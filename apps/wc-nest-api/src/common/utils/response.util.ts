import type { ApiErrorResponse, ApiResponse } from '../interfaces/api-response.interface'

export class ResponseUtil {
  /**
   * Creates a successful API response
   * @param data - The data to include in the response
   * @returns Formatted success response
   */
  static success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
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
