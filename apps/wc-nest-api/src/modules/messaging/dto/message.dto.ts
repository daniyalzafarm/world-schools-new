import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  ContentType,
  DeletionType,
  MessagePriority,
  ReportReason,
  SenderType,
} from '../../../generated/client/client'
import { SanitizePlainText, Trim } from '../decorators/sanitize.decorator'

/**
 * DTO for sending a new message
 */
export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  senderId: string

  @IsEnum(SenderType)
  @IsNotEmpty()
  senderType: SenderType

  @SanitizePlainText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string

  @IsEnum(ContentType)
  @IsOptional()
  contentType?: ContentType

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[]

  @IsUUID()
  @IsOptional()
  replyToId?: string

  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledFor?: Date

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey: string
}

/**
 * DTO for getting messages with pagination
 */
export class GetMessagesDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number

  @IsUUID()
  @IsOptional()
  cursor?: string

  @IsEnum(['before', 'after'])
  @IsOptional()
  direction?: 'before' | 'after'
}

/**
 * DTO for editing a message
 */
export class EditMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @SanitizePlainText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  newContent: string

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  editReason?: string
}

/**
 * DTO for deleting a message
 */
export class DeleteMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsEnum(DeletionType)
  @IsOptional()
  deletionType?: DeletionType
}

/**
 * DTO for marking a message as read
 */
export class MarkAsReadDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for marking a message as delivered
 */
export class MarkAsDeliveredDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for adding a reaction to a message
 */
export class AddReactionDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^[\p{Emoji}\u200d]+$/u, {
    message: 'emoji must be a valid emoji character',
  })
  emoji: string
}

/**
 * DTO for removing a reaction from a message
 */
export class RemoveReactionDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  emoji: string
}

/**
 * DTO for bookmarking a message
 */
export class BookmarkMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string
}

/**
 * DTO for removing a bookmark from a message
 */
export class UnbookmarkMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for pinning a message
 */
export class PinMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for unpinning a message
 */
export class UnpinMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for forwarding a message
 */
export class ForwardMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  toConversationId: string

  @IsUUID()
  @IsNotEmpty()
  forwardedBy: string
}

/**
 * DTO for scheduling a message
 */
export class ScheduleMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  senderId: string

  @SanitizePlainText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  scheduledFor: Date

  @IsUUID()
  @IsNotEmpty()
  scheduledBy: string
}

/**
 * DTO for reporting a message
 */
export class ReportMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  reportedBy: string

  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason: ReportReason

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string
}
