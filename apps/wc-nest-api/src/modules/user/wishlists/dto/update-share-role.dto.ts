import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { WishlistShareRole } from '../../../../generated/client/client'

export class UpdateShareRoleDto {
  @ApiProperty({ description: 'New permission role', enum: WishlistShareRole })
  @IsEnum(WishlistShareRole)
  role: WishlistShareRole
}
