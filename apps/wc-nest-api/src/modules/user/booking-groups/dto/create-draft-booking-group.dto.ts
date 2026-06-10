import {
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

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

  // Mandatory legal-guardian confirmation captured on the Children step. Must be
  // true — the parent cannot create a booking without confirming guardianship.
  @IsBoolean()
  @Equals(true, { message: 'Guardian confirmation is required to book' })
  guardianConsent!: boolean

  @IsOptional()
  @IsBoolean()
  forceNew?: boolean
}
