import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

/**
 * DTO for adding a participant to a conversation
 */
export class AddParticipantDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsUUID()
  @IsOptional()
  providerId?: string

  @IsUUID()
  @IsNotEmpty()
  addedBy: string
}

/**
 * DTO for removing a participant from a conversation
 */
export class RemoveParticipantDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string

  @IsUUID()
  @IsNotEmpty()
  userId: string

  @IsUUID()
  @IsNotEmpty()
  removedBy: string
}

/**
 * DTO for updating participant settings
 */
export class UpdateParticipantSettingsDto {
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
