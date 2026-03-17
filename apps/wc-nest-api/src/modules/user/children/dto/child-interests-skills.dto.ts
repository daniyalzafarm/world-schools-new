import { ApiProperty } from '@nestjs/swagger'
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ChildInterestItemDto {
  @ApiProperty({
    description: 'Category ID (catalogue category slug)',
    example: 'sports',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryId!: string

  @ApiProperty({
    description: 'Specific activity IDs (catalogue activity slugs) within this category',
    example: ['football', 'swimming'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specificActivityIds?: string[]
}

export class UpdateChildInterestsDto {
  @ApiProperty({
    type: [ChildInterestItemDto],
    description:
      'Full replacement of child interests. Send the complete array; omitted categories will be removed.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildInterestItemDto)
  items!: ChildInterestItemDto[]
}

export class ChildSkillItemDto {
  @ApiProperty({
    description: 'Activity ID (catalogue activity slug)',
    example: 'football',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  activityId!: string

  @ApiProperty({
    description: 'Skill level value for the activity scale',
    example: 'Advanced',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  level!: string
}

export class UpdateChildSkillsDto {
  @ApiProperty({
    type: [ChildSkillItemDto],
    description:
      'Full replacement of child skills. Send the complete array; omitted activities will be removed.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildSkillItemDto)
  items!: ChildSkillItemDto[]
}
