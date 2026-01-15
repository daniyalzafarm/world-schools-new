import { IsEnum, IsOptional, IsString } from 'class-validator'
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
    description: 'Search by name',
  })
  @IsOptional()
  @IsString()
  search?: string
}
