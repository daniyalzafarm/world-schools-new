import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AddRelatedArticleDto {
  @ApiProperty({
    description: 'ID of the related article',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  relatedArticleId: string

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 1,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number
}
