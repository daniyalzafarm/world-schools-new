import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateProviderRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Camp Counselor',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Permission IDs to assign to this role',
    example: ['children.read', 'children.update'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permission_ids?: string[];
}

