import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Max, Min } from 'class-validator'

export class UpdateSystemSettingsDto {
  @ApiProperty({
    description: 'Default platform commission percentage applied to new providers',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommission: number
}

export class SystemSettingsResponseDto {
  @ApiProperty({ description: 'Default platform commission percentage', example: 10 })
  defaultCommission: number

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: string
}
