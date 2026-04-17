import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export type ParentTab = 'all' | 'active' | 'with_bookings' | 'new_this_month' | 'inactive'

export class GetParentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ enum: ['all', 'active', 'with_bookings', 'new_this_month', 'inactive'] })
  @IsOptional()
  @IsIn(['all', 'active', 'with_bookings', 'new_this_month', 'inactive'])
  tab?: ParentTab

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string
}
