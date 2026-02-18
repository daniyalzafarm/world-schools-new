import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Trim } from '../decorators/sanitize.decorator'

/**
 * DTO for searching messages with full-text search
 */
export class SearchMessagesDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string

  @IsUUID()
  @IsOptional()
  conversationId?: string

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
 * DTO for searching conversations
 */
export class SearchConversationsDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string

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
