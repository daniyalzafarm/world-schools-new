import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Content Manager',
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'Whether this is a system-wide role',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isSystemRole?: boolean

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
