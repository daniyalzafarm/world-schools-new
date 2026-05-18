import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ReimbursementStatus } from '../../../../generated/client/enums'

export class ListReimbursementsDto {
  @ApiPropertyOptional({
    enum: ReimbursementStatus,
    description: 'Filter by exact status.',
  })
  @IsOptional()
  @IsEnum(ReimbursementStatus)
  status?: ReimbursementStatus

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
