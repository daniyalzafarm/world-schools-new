import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator'

/**
 * Body for `POST /user/booking-groups/eligibility-check` — non-mutating
 * pre-validation of the parent's selected children against a camp/session.
 */
export class CheckEligibilityDto {
  @IsString()
  @IsUUID()
  campId!: string

  @IsString()
  @IsUUID()
  sessionId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  childIds!: string[]
}
