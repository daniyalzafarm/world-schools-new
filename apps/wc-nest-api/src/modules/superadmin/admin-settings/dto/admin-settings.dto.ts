import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Max, Min } from 'class-validator'

export class UpdateSystemSettingsDto {
  @ApiProperty({
    description: 'Default app fee percentage applied to new providers',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultAppFee: number
}

export class SystemSettingsResponseDto {
  @ApiProperty({ description: 'Default app fee percentage', example: 10 })
  defaultAppFee: number

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: string
}
