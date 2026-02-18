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
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ContextType, ConversationStatus, ConversationType } from '../../../generated/client/client'
import { SanitizePlainText, Trim } from '../decorators/sanitize.decorator'

/**
 * DTO for creating a new conversation
 *
 * IMPORTANT: Initial message is REQUIRED
 * - Conversations are only created when the user sends the first message
 * - This prevents empty conversations from cluttering the conversation list
 * - Follows industry best practices (WhatsApp, Slack, Discord)
 */
export class CreateConversationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsUUID()
  @IsNotEmpty()
  participantId: string

  @IsEnum(['provider', 'superadmin'])
  @IsNotEmpty()
  participantType: 'provider' | 'superadmin'

  @IsEnum(ContextType)
  @IsOptional()
  contextType?: ContextType

  @IsUUID()
  @IsOptional()
  contextId?: string

  @SanitizePlainText()
  @IsString()
  @IsNotEmpty({ message: 'Initial message is required' })
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(10000, { message: 'Message is too long' })
  initialMessage: string // ✅ No longer optional

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  subject?: string
}

/**
 * DTO for getting conversations with filters
 *
 * Note: userId is optional in the DTO because it's automatically set from
 * the authenticated user in the controller via @CurrentUser decorator.
 * The frontend should NOT send userId in the query parameters.
 */
export class GetConversationsDto {
  @IsUUID()
  @IsOptional()
  userId?: string

  @IsEnum(['all', 'unread', 'archived', 'starred', 'pinned'])
  @IsOptional()
  filter?: 'all' | 'unread' | 'archived' | 'starred' | 'pinned'

  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus

  @IsEnum(ConversationType)
  @IsOptional()
  type?: ConversationType

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

/**
 * DTO for updating conversation participant settings
 */
export class UpdateConversationSettingsDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsBoolean()
  @IsOptional()
  pinned?: boolean

  @IsBoolean()
  @IsOptional()
  starred?: boolean

  @IsBoolean()
  @IsOptional()
  muted?: boolean

  @IsBoolean()
  @IsOptional()
  archived?: boolean
}

/**
 * DTO for assigning a conversation to a user
 */
export class AssignConversationDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  assignedToId: string

  @IsUUID()
  @IsNotEmpty()
  assignedBy: string
}

/**
 * DTO for updating conversation status
 */
export class UpdateConversationStatusDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsEnum(ConversationStatus)
  @IsNotEmpty()
  status: ConversationStatus

  @IsUUID()
  @IsNotEmpty()
  userId: string
}

/**
 * DTO for adding a label to a conversation
 */
export class AddLabelDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  labelId: string
}

/**
 * DTO for removing a label from a conversation
 */
export class RemoveLabelDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  labelId: string
}

/**
 * DTO for creating a conversation label
 */
export class CreateLabelDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(7)
  color?: string // Hex color code
}

/**
 * Response DTO for conversation metrics
 */
export class ConversationMetricsDto {
  totalMessages: number
  unreadMessages: number
  lastActivityAt: Date
  averageResponseTime?: number
}
