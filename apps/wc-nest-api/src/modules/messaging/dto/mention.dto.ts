import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * DTO for creating a mention in a message
 */
export class CreateMentionDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number
}

/**
 * DTO for getting mentions for a user
 */
export class GetMentionsDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string

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
