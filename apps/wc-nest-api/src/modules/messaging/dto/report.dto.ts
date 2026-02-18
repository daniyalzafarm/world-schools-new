import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ReportReason, ReportStatus } from '../../../generated/client/client'

/**
 * DTO for creating a message report
 */
export class CreateReportDto {
  @ApiProperty({ description: 'Message ID being reported', example: 'msg-123' })
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @ApiProperty({ description: 'User ID who is reporting', example: 'user-123' })
  @IsUUID()
  @IsNotEmpty()
  reportedBy: string

  @ApiProperty({
    description: 'Reason for reporting',
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason: ReportReason

  @ApiPropertyOptional({
    description: 'Additional details about the report',
    example: 'This message contains spam links',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string
}

/**
 * DTO for updating a report status
 */
export class UpdateReportStatusDto {
  @ApiProperty({ description: 'Report ID', example: 'report-123' })
  @IsUUID()
  @IsNotEmpty()
  reportId: string

  @ApiProperty({
    description: 'New status for the report',
    enum: ReportStatus,
    example: ReportStatus.RESOLVED,
  })
  @IsEnum(ReportStatus)
  @IsNotEmpty()
  status: ReportStatus

  @ApiProperty({ description: 'Admin user ID reviewing the report', example: 'admin-123' })
  @IsUUID()
  @IsNotEmpty()
  reviewedBy: string

  @ApiPropertyOptional({
    description: 'Review notes from the admin',
    example: 'Confirmed spam, message deleted',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewNotes?: string
}

/**
 * DTO for getting reports with filters and pagination
 */
export class GetReportsDto {
  @ApiPropertyOptional({
    description: 'Filter by report status',
    enum: ReportStatus,
    example: ReportStatus.PENDING,
  })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus

  @ApiPropertyOptional({
    description: 'Filter by report reason',
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  @IsOptional()
  reason?: ReportReason

  @ApiPropertyOptional({ description: 'Filter by reporter user ID', example: 'user-123' })
  @IsUUID()
  @IsOptional()
  reportedBy?: string

  @ApiPropertyOptional({ description: 'Filter by message ID', example: 'msg-123' })
  @IsUUID()
  @IsOptional()
  messageId?: string

  @ApiPropertyOptional({
    description: 'Filter reports created after this date',
    example: '2026-01-01T00:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date

  @ApiPropertyOptional({
    description: 'Filter reports created before this date',
    example: '2026-02-10T23:59:59Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date

  @ApiPropertyOptional({
    description: 'Number of reports to return',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20

  @ApiPropertyOptional({ description: 'Cursor for pagination', example: 'report-123' })
  @IsString()
  @IsOptional()
  cursor?: string
}

/**
 * Moderation action types
 */
export enum ModerationAction {
  DISMISS = 'DISMISS',
  DELETE_MESSAGE = 'DELETE_MESSAGE',
  WARN_USER = 'WARN_USER',
  SUSPEND_USER = 'SUSPEND_USER',
  BAN_USER = 'BAN_USER',
}

/**
 * DTO for taking moderation action on a report
 */
export class TakeModerationActionDto {
  @ApiProperty({ description: 'Report ID', example: 'report-123' })
  @IsUUID()
  @IsNotEmpty()
  reportId: string

  @ApiProperty({
    description: 'Moderation action to take',
    enum: ModerationAction,
    example: ModerationAction.DELETE_MESSAGE,
  })
  @IsEnum(ModerationAction)
  @IsNotEmpty()
  action: ModerationAction

  @ApiProperty({ description: 'Admin user ID taking the action', example: 'admin-123' })
  @IsUUID()
  @IsNotEmpty()
  moderatorId: string

  @ApiPropertyOptional({
    description: 'Reason for the moderation action',
    example: 'Message violates community guidelines',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string

  @ApiPropertyOptional({
    description: 'For SUSPEND_USER: number of days to suspend (default: 7)',
    example: 7,
    minimum: 1,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  suspensionDays?: number

  @ApiPropertyOptional({
    description: 'Whether to notify the reported user',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyUser?: boolean = true

  @ApiPropertyOptional({
    description: 'Whether to notify the reporter',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyReporter?: boolean = true
}
