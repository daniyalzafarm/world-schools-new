import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ArticleStatus, ArticleType, Audience } from '../../../../generated/client/client'

export class QueryArticlesDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'published',
    enum: ArticleStatus,
  })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus

  @ApiPropertyOptional({
    description: 'Filter by audience (can be multiple)',
    example: ['parents'],
    enum: Audience,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Audience, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  audience?: Audience[]

  @ApiPropertyOptional({
    description: 'Filter by category ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string

  @ApiPropertyOptional({
    description: 'Filter by article type',
    example: 'how_to',
    enum: ArticleType,
  })
  @IsOptional()
  @IsEnum(ArticleType)
  articleType?: ArticleType

  @ApiPropertyOptional({
    description: 'Search in title, summary, and content',
    example: 'booking',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description:
      'Comma-separated field names to search in (e.g. title,summary,contentHtml). If omitted, searches title, summary, and contentHtml.',
    example: 'title',
  })
  @IsOptional()
  @IsString()
  searchBy?: string

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'publishedAt',
    default: 'createdAt',
    enum: ['createdAt', 'publishedAt', 'updatedAt', 'views', 'title'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number
}
