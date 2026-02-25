import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

export class SessionSpecificDiscountDto {
  @IsString()
  @MaxLength(30)
  name: string

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed'

  @IsNumber()
  @Min(0.01)
  value: number

  @IsOptional()
  @IsDateString()
  validUntil?: string | null

  @IsArray()
  @IsString({ each: true })
  ageGroups: string[] // Empty array = applies to all ages
}

export class AddSessionDiscountDto {
  @IsString()
  @MaxLength(30)
  name: string

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed'

  @IsNumber()
  @Min(0.01)
  value: number

  @IsOptional()
  @IsDateString()
  validUntil?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ageGroups?: string[]
}

export class RemoveGlobalDiscountDto {
  @IsUUID()
  globalDiscountId: string
}

export class ApplyGlobalDiscountDto {
  @IsUUID()
  globalDiscountId: string
}
