import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator'

export class UpdateDraftBookingGroupDto {
  @IsUUID()
  sessionId!: string

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  childIds!: string[]
}
