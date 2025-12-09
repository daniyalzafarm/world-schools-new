import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateProviderRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Camp Counselor',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({
    description: 'Permission IDs to assign to this role',
    example: ['children.read', 'children.update'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[]
}
