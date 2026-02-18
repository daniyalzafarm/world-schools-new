import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'
import { ResponseUtil } from '../utils/response.util'

/**
 * Global Exception Filter
 *
 * Catches all exceptions thrown in the application and formats them into
 * consistent error responses. Handles:
 * - HTTP exceptions (BadRequest, NotFound, Forbidden, etc.)
 * - Validation errors from class-validator
 * - Rate limiting errors (429)
 * - Unexpected errors (500)
 *
 * All errors are logged and returned in a standardized format using ResponseUtil.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest()

    let status: number
    let message: string | string[]
    let error: string
    const additionalData: any = {}

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any

        // Handle validation errors (class-validator)
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message
          error = 'Validation Error'
        } else {
          message = responseObj.message ?? exception.message
          error = responseObj.error ?? exception.name
        }

        // Include additional data if present (e.g., retryAfter for rate limiting)
        if (responseObj.retryAfter) {
          additionalData.retryAfter = responseObj.retryAfter
        }
        if (responseObj.statusCode) {
          status = responseObj.statusCode
        }
      } else {
        message = exceptionResponse?.toString() ?? exception.message
        error = exception.name
      }

      // Log based on severity
      if (status >= 500) {
        this.logger.error(
          `HTTP ${status} Error: ${error} - ${message}`,
          exception.stack,
          `${request.method} ${request.url}`
        )
      } else if (status >= 400) {
        this.logger.warn(
          `HTTP ${status} Error: ${error} - ${message}`,
          `${request.method} ${request.url}`
        )
      }
    } else {
      // Unexpected errors (non-HTTP exceptions)
      status = HttpStatus.INTERNAL_SERVER_ERROR
      message = 'Internal server error'
      error = 'InternalServerError'

      // Log full error details for debugging
      this.logger.error(
        `Unexpected error: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
        `${request.method} ${request.url}`
      )
    }

    // Build error response using ResponseUtil
    // Handle message being string[] by joining with comma
    const messageStr = Array.isArray(message) ? message.join(', ') : message
    const errorResponse = ResponseUtil.error(messageStr, error, status)

    // Add additional data if present
    if (Object.keys(additionalData).length > 0) {
      Object.assign(errorResponse, additionalData)
    }

    response.status(status).json(errorResponse)
  }
}
