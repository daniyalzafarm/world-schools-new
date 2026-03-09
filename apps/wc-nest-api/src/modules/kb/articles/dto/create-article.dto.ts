import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArticleStatus, ArticleType, Audience } from '../../../../generated/client/client'

export class CreateArticleDto {
  @ApiProperty({
    description: 'Article title',
    example: 'How to Book a Camp',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'how-to-book-a-camp',
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase, alphanumeric, and use hyphens to separate words',
  })
  slug: string

  @ApiProperty({
    description: 'Article type',
    example: 'how_to',
    enum: ArticleType,
  })
  @IsEnum(ArticleType)
  @IsNotEmpty()
  articleType: ArticleType

  @ApiProperty({
    description: 'Target audience (can be multiple)',
    example: ['parents', 'providers'],
    enum: Audience,
    isArray: true,
  })
  @IsArray()
  @IsEnum(Audience, { each: true })
  @IsNotEmpty()
  audience: Audience[]

  @ApiProperty({
    description: 'Category ID',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string

  @ApiPropertyOptional({
    description: 'Article status (defaults to draft)',
    example: 'draft',
    enum: ArticleStatus,
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus

  @ApiProperty({
    description: 'Article content as HTML (will be sanitized)',
    example: '<h2 class="kb-section-title">Getting Started</h2><p class="kb-paragraph">...</p>',
  })
  @IsString()
  @IsNotEmpty()
  contentHtml: string

  @ApiPropertyOptional({
    description: 'Brief summary/excerpt for article listings',
    example: 'Learn how to book a camp in just a few simple steps.',
  })
  @IsOptional()
  @IsString()
  summary?: string

  @ApiProperty({
    description: 'SEO meta title',
    example: 'How to Book a Camp | World-Camps Help',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  metaTitle: string

  @ApiProperty({
    description: 'SEO meta description',
    example: 'Step-by-step guide to booking a camp on World-Camps platform.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  metaDescription: string

  @ApiPropertyOptional({
    description: 'IDs of related articles (order preserved as sortOrder)',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedArticleIds?: string[]
}
