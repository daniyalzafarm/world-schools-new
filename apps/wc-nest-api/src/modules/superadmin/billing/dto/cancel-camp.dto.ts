import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class CancelByCampDto {
  @ApiPropertyOptional({
    description:
      'Internal admin note about why the camp cancelled. Stored on the audit trail; not shown to the parent.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
