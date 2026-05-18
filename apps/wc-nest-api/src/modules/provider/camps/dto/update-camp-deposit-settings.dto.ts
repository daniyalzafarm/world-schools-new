import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator'

/**
 * Phase 9 — provider sets the deposit configuration for a single camp.
 *
 * Three modes:
 *  - **No deposit** (`depositRequired = false`): the parent is charged the
 *    full booking amount at booking time (or via SetupIntent for far-future
 *    bookings — `booking-snapshot.util.ts` handles the routing).
 *  - **Percentage** (`depositRequired = true, depositType = 'percentage'`):
 *    the deposit is `depositPercentage`% of the booking total. Validated
 *    1..100.
 *  - **Fixed** (`depositRequired = true, depositType = 'fixed'`): a fixed
 *    monetary amount. The service-level validation enforces that the fixed
 *    amount is strictly LESS THAN every existing session's price for this
 *    camp (per the spec: "the sessions amount should always be greater than
 *    this fixed amount").
 */
export class UpdateCampDepositSettingsDto {
  @ApiProperty({ description: 'Whether a deposit is required for bookings on this camp.' })
  @IsBoolean()
  depositRequired: boolean

  @ApiProperty({
    description: "Required when `depositRequired` is true. 'percentage' or 'fixed'.",
    enum: ['percentage', 'fixed'],
    required: false,
  })
  @IsOptional()
  @IsIn(['percentage', 'fixed'])
  depositType?: 'percentage' | 'fixed'

  @ApiProperty({
    description: 'Required when `depositType = percentage`. Integer 1..100.',
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  depositPercentage?: number

  @ApiProperty({
    description:
      'Required when `depositType = fixed`. Must be > 0 and strictly less than every session price for this camp.',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  depositFixedAmount?: number
}
