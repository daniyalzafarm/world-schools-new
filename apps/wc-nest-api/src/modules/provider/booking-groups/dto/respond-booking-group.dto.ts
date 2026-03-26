import { IsOptional, IsString, MaxLength } from 'class-validator'

export class RespondBookingGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  providerNote?: string
}
