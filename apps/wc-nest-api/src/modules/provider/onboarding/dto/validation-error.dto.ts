import { ApiProperty } from '@nestjs/swagger'

export class ValidationErrorDto {
  @ApiProperty({ example: 1 })
  step: number

  @ApiProperty({ example: 'Find Your Camp' })
  stepName: string

  @ApiProperty({ example: 'googleBusinessProfile' })
  field: string

  @ApiProperty({ example: 'Google Business Profile must be selected and saved' })
  message: string

  @ApiProperty({ example: '/onboarding/find-your-camp' })
  path: string
}

export class ValidationResultDto {
  @ApiProperty({ example: false })
  isValid: boolean

  @ApiProperty({ type: [ValidationErrorDto] })
  errors: ValidationErrorDto[]
}
