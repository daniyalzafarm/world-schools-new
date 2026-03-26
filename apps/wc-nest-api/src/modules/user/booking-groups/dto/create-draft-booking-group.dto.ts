import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreateDraftBookingGroupDto {
  @IsUUID()
  campId!: string

  @IsUUID()
  sessionId!: string

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  childIds!: string[]

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  specialRequest?: string
}
