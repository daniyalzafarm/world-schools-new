import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, MaxLength, ValidateIf } from 'class-validator'

export class PatchProviderBookingGroupDto {
  @ApiPropertyOptional({ description: 'Provider-only internal notes (private note).' })
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(20000)
  internalNotes?: string | null
}
