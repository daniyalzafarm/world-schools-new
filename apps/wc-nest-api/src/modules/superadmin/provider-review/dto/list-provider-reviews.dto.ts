import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { ProviderReviewStatus } from '../../../../generated/client/enums'

export class ListProviderReviewsDto {
  @ApiPropertyOptional({ enum: ProviderReviewStatus, description: 'Filter by exact status.' })
  @IsOptional()
  @IsEnum(ProviderReviewStatus)
  status?: ProviderReviewStatus

  @ApiPropertyOptional({ description: 'Page size, 1-100. Default 50.', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ description: 'Pagination offset.', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
