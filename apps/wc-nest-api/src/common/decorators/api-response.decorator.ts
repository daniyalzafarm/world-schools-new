import { applyDecorators, type Type } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'

export interface ApiResponseOptions {
  status?: number
  description?: string
  type?: Type<any> | string
}

export function ApiSuccessResponse(options: ApiResponseOptions = {}) {
  const { status = 200, description = 'Success', type } = options

  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: type
            ? {
                $ref: `#/components/schemas/${typeof type === 'string' ? type : (type.name ?? 'Unknown')}`,
              }
            : {
                type: 'object',
                description: 'Response data',
              },
        },
        required: ['success', 'data'],
      },
    })
  )
}

export function ApiErrorResponseDoc(options: ApiResponseOptions = {}) {
  const { status = 400, description = 'Error' } = options

  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          data: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Error message',
              },
              error: {
                type: 'string',
                example: 'BadRequestException',
              },
              statusCode: {
                type: 'number',
                example: status,
              },
            },
            required: ['message'],
          },
        },
        required: ['success', 'data'],
      },
    })
  )
}
