import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * DTO for GDPR data export request
 */
export class ExportUserDataDto {
  @ApiProperty({
    description: 'User ID to export data for',
    example: 'user-123',
  })
  @IsString()
  userId: string

  @ApiProperty({
    description: 'Optional format for export (default: json)',
    example: 'json',
    required: false,
  })
  @IsOptional()
  @IsString()
  format?: 'json' | 'csv'
}

/**
 * DTO for GDPR data deletion request
 */
export class DeleteUserDataDto {
  @ApiProperty({
    description: 'User ID to delete data for',
    example: 'user-123',
  })
  @IsString()
  userId: string

  @ApiProperty({
    description: 'Confirmation string (must be "DELETE_ALL_DATA")',
    example: 'DELETE_ALL_DATA',
  })
  @IsString()
  confirmation: string
}

/**
 * Response DTO for data export
 */
export class ExportDataResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-123',
  })
  userId: string

  @ApiProperty({
    description: 'Export timestamp',
    example: '2026-02-10T12:00:00Z',
  })
  exportedAt: string

  @ApiProperty({
    description: 'Total number of conversations',
    example: 5,
  })
  totalConversations: number

  @ApiProperty({
    description: 'Total number of messages',
    example: 150,
  })
  totalMessages: number

  @ApiProperty({
    description: 'Total number of attachments',
    example: 10,
  })
  totalAttachments: number

  @ApiProperty({
    description: 'Exported data',
    type: 'object',
    additionalProperties: true,
  })
  data: {
    conversations: any[]
    messages: any[]
    attachments: any[]
    reactions: any[]
    bookmarks: any[]
    reports: any[]
  }
}

/**
 * Response DTO for data deletion
 */
export class DeleteDataResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean

  @ApiProperty({
    description: 'User ID',
    example: 'user-123',
  })
  userId: string

  @ApiProperty({
    description: 'Deletion timestamp',
    example: '2026-02-10T12:00:00Z',
  })
  deletedAt: string

  @ApiProperty({
    description: 'Number of messages deleted',
    example: 150,
  })
  messagesDeleted: number

  @ApiProperty({
    description: 'Number of conversations removed from',
    example: 5,
  })
  conversationsRemoved: number

  @ApiProperty({
    description: 'Number of attachments deleted',
    example: 10,
  })
  attachmentsDeleted: number

  @ApiProperty({
    description: 'Deletion summary message',
    example: 'All messaging data has been permanently deleted',
  })
  message: string
}
