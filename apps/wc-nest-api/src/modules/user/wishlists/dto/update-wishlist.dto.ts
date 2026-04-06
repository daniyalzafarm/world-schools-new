import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator'

export class UpdateWishlistDto {
  @ApiProperty({ description: 'Wishlist name', example: 'Summer 2026', required: false })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  @IsOptional()
  name?: string

  @ApiProperty({ description: 'Emoji icon for the wishlist', example: '☀️', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 10)
  icon?: string

  @ApiProperty({
    description: 'Child IDs to assign (replaces all existing assignments)',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  @IsOptional()
  childIds?: string[]
}
