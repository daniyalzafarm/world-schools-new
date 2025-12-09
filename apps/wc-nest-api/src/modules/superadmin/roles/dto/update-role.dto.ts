import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Content Manager',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({
    description: 'Permission IDs to assign to this role',
    example: ['users.read', 'users.create'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[]
}
