import { IsInt, IsNotEmpty, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ReorderCategoryDto {
  @ApiProperty({
    description: 'New sort order',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  sortOrder: number
}
