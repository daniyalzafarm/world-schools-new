import { Type } from 'class-transformer'
import {
  IsArray,
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
  ValidateIf,
} from 'class-validator'
import {
  ContentType,
  SenderType,
  SupportTicketPriority,
  SupportTicketRequesterType,
  SupportTicketSourceApp,
  SupportTicketStatus,
} from '../../../generated/client/client'

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketRequesterType)
  requesterType!: SupportTicketRequesterType

  @IsUUID()
  @IsOptional()
  requesterUserId?: string

  @IsUUID()
  @IsOptional()
  requesterProviderId?: string

  @IsEnum(SupportTicketSourceApp)
  sourceApp!: SupportTicketSourceApp

  @IsString()
  @IsNotEmpty()
  categoryKey!: string

  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority

  @IsString()
  @MaxLength(255)
  subject!: string

  @IsString()
  @IsNotEmpty()
  description!: string

  @IsArray()
  @IsOptional()
  attachmentIds?: string[]

  @IsUUID()
  @IsOptional()
  bookingId?: string

  @IsUUID()
  @IsOptional()
  campId?: string

  @IsUUID()
  @IsOptional()
  sessionId?: string
}

export class GetSupportTicketsDto {
  @IsEnum(SupportTicketStatus)
  @IsOptional()
  status?: SupportTicketStatus

  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority

  @IsUUID()
  @IsOptional()
  assignedToUserId?: string

  @IsEnum(SupportTicketRequesterType)
  @IsOptional()
  requesterType?: SupportTicketRequesterType

  @IsUUID()
  @IsOptional()
  requesterUserId?: string

  @IsUUID()
  @IsOptional()
  requesterProviderId?: string

  @IsString()
  @IsOptional()
  categoryKey?: string

  @IsEnum(SupportTicketSourceApp)
  @IsOptional()
  sourceApp?: SupportTicketSourceApp

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdFrom?: Date

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdTo?: Date

  @IsString()
  @IsOptional()
  searchTerm?: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number
}

export class UpdateSupportTicketDto {
  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority

  @IsString()
  @IsOptional()
  categoryKey?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]

  @IsUUID()
  @IsOptional()
  bookingId?: string

  @IsUUID()
  @IsOptional()
  campId?: string

  @IsUUID()
  @IsOptional()
  sessionId?: string
}

export class UpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus
}

export class AssignSupportTicketDto {
  @IsUUID()
  @IsOptional()
  assignedToUserId?: string | null
}

export class ReopenSupportTicketDto {
  @IsString()
  @IsOptional()
  reason?: string
}

export class CreateTicketReplyDto {
  @IsUUID()
  ticketId!: string

  @IsUUID()
  senderId!: string

  @IsEnum(SenderType)
  senderType!: SenderType

  @ValidateIf(o => !o.attachmentIds || o.attachmentIds.length === 0)
  @IsString()
  @IsNotEmpty()
  content!: string

  @IsEnum(ContentType)
  @IsOptional()
  contentType?: ContentType

  @IsArray()
  @IsOptional()
  attachmentIds?: any[]
}

/** Self-service reply: only content; senderId/senderType set by controller from current user. */
export class AddTicketReplyDto {
  @ValidateIf(o => !o.attachmentIds || o.attachmentIds.length === 0)
  @IsString()
  @IsNotEmpty()
  content!: string

  @IsArray()
  @IsOptional()
  attachmentIds?: string[]
}
