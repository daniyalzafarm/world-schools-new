import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class QueryAddOnsDto {
  @ApiPropertyOptional({
    description: 'Filter by add-on type',
    enum: ['activity', 'service', 'equipment', 'language'],
  })
  @IsOptional()
  @IsEnum(['activity', 'service', 'equipment', 'language'])
  type?: 'activity' | 'service' | 'equipment' | 'language'

  @ApiPropertyOptional({
    description: 'Filter by active status',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsString()
  isActive?: string

  @ApiPropertyOptional({
    description: 'Search by name or description',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
