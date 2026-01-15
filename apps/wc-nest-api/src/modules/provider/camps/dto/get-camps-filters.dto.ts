import { IsEnum, IsOptional, IsString } from 'class-validator'

export class GetCampsFiltersDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived'

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsEnum(['day', 'residential'])
  type?: 'day' | 'residential'
}
