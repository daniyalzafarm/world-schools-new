import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

/** Provider proposes a new programme start date for an accepted booking (Spec v2.5 §9.7). */
export class ProposeRescheduleDto {
  @ApiProperty({ description: 'Proposed new programme start (ISO date).' })
  @IsDateString()
  proposedStartDate!: string

  @ApiPropertyOptional({ description: 'Why the dates are changing (shown to the customer).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonText?: string
}
