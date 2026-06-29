import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator'

/**
 * Superadmin sets a per-provider app-fee override.
 *
 * When `custom` is false the system falls back to `SystemSettings.defaultAppFee`
 * (the existing value of `appFeePercentage` is preserved on the row so toggling
 * back on retains the previous suggestion).
 *
 * Only future bookings are affected: `BookingGroup.appFeePercentageSnapshot` is
 * stamped at booking creation, so existing bookings keep their original rate.
 */
export class UpdateAppFeeDto {
  @ApiProperty({
    description:
      'Whether to use a custom per-provider app fee. When false, falls back to the system default.',
  })
  @IsBoolean()
  custom: boolean

  @ApiProperty({
    description: 'App fee percentage (0–50). Required when custom = true; ignored otherwise.',
    minimum: 0,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  appFeePercentage?: number
}
