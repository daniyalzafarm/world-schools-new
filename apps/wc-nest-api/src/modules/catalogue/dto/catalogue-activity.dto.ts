import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  /**
   * Optional custom slug (unique within category).
   * If omitted, server will generate from name.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scaleId?: string
}

export class UpdateActivityDto {
  /**
   * Move activity to another category.
   */
  @IsOptional()
  @IsString()
  categoryId?: string

  /**
   * Update slug (unique within category).
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scaleId?: string | null

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
