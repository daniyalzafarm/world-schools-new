import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CampAddOnItemDto {
  @ApiProperty({
    description: 'Add-on ID',
    example: 'uuid-here',
  })
  @IsString()
  addOnId: string

  @ApiProperty({
    description: 'Whether this add-on is enabled for this camp',
    example: true,
  })
  @IsBoolean()
  isEnabled: boolean

  @ApiPropertyOptional({
    description: 'Sort order for this add-on in this camp',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  sortOrder?: number
}

export class UpdateCampAddOnsDto {
  @ApiProperty({
    description: 'Array of add-ons with their enabled status and sort order',
    type: [CampAddOnItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampAddOnItemDto)
  addOns: CampAddOnItemDto[]
}
