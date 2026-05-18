import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { DisputeOutcome } from '../../../../generated/client/enums'

export class ListDisputesDto {
  @ApiPropertyOptional({
    enum: DisputeOutcome,
    description: 'Filter by outcome (open/won/lost/warning_closed/other).',
  })
  @IsOptional()
  @IsEnum(DisputeOutcome)
  outcome?: DisputeOutcome

  @ApiPropertyOptional({ description: 'Page size, 1-200. Default 50.', minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @ApiPropertyOptional({ description: 'Pagination offset.', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
