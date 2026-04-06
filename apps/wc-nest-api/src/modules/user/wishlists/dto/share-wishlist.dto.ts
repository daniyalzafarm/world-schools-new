import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsOptional } from 'class-validator'
import { WishlistShareRole } from '../../../../generated/client/client'

export class ShareWishlistDto {
  @ApiProperty({ description: 'Email address to share with', example: 'parent@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'Permission role for the share',
    enum: WishlistShareRole,
    default: WishlistShareRole.viewer,
    required: false,
  })
  @IsEnum(WishlistShareRole)
  @IsOptional()
  role?: WishlistShareRole
}
