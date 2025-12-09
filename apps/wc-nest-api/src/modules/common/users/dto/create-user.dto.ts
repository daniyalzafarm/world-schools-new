import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  firstName: string

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
