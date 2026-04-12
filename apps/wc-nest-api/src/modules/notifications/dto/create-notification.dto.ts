import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateNotificationDto {
  @IsString()
  userId: string

  /** One of the NotificationType enum values from wc-types (stored as plain string) */
  @IsString()
  type: string

  @IsString()
  title: string

  @IsString()
  @IsOptional()
  body?: string

  /** Entity type for deep-linking, e.g. "booking_group", "conversation", "support_ticket" */
  @IsString()
  @IsOptional()
  entityType?: string

  /** UUID of the referenced entity */
  @IsString()
  @IsOptional()
  entityId?: string

  /** Display-layer extras: redirectUrl, campName, senderName, messagePreview, etc. */
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>
}
