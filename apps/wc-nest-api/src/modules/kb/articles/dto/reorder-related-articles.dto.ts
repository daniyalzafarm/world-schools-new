import { IsArray, IsInt, IsNotEmpty, IsUUID, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

class RelatedArticleOrder {
  @ApiProperty({
    description: 'Related article ID',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  relatedArticleId: string

  @ApiProperty({
    description: 'New sort order',
    example: 1,
  })
  @IsInt()
  @Min(0)
  sortOrder: number
}

export class ReorderRelatedArticlesDto {
  @ApiProperty({
    description: 'Array of related articles with new sort orders',
    type: [RelatedArticleOrder],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedArticleOrder)
  relatedArticles: RelatedArticleOrder[]
}
