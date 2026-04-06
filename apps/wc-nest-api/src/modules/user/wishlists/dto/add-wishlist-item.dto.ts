import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class AddWishlistItemDto {
  @ApiProperty({ description: 'Camp ID to add to the wishlist' })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  campId: string

  @ApiProperty({ description: 'Pre-selected session ID', required: false })
  @IsString()
  @IsUUID('4')
  @IsOptional()
  sessionId?: string
}
