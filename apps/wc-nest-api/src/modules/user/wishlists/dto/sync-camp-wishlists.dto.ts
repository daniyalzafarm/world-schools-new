import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator'

export class SyncCampWishlistsDto {
  @ApiProperty({ description: 'Camp ID to sync across wishlists' })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  campId: string

  @ApiProperty({
    description: 'Final desired set of wishlist IDs that should contain this camp',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  wishlistIds: string[]
}
