import { IsArray, IsEmail, IsOptional, IsString, ValidateIf } from 'class-validator'

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string

  @ValidateIf(o => o.firstName !== '')
  @IsString()
  @IsOptional()
  firstName?: string

  @ValidateIf(o => o.lastName !== '')
  @IsString()
  @IsOptional()
  lastName?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roleIds?: string[]
}
