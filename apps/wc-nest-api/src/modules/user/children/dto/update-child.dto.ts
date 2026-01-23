import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator'

class PersonalInfoDto {
  @ApiProperty({ description: 'First name', example: 'Emma', required: false })
  @IsString()
  @IsOptional()
  firstName?: string

  @ApiProperty({ description: 'Last name', example: 'Smith', required: false })
  @IsString()
  @IsOptional()
  lastName?: string

  @ApiProperty({ description: 'Date of birth', example: '2015-05-15', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string

  @ApiProperty({ description: 'Gender', example: 'Female', required: false })
  @IsString()
  @IsOptional()
  gender?: string

  @ApiProperty({ description: 'Nationality', example: 'American', required: false })
  @IsString()
  @IsOptional()
  nationality?: string

  @ApiProperty({ description: 'Languages', example: ['English', 'Spanish'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[]
}

class AcademicPreferencesDto {
  @ApiProperty({ description: 'Current grade', example: 'Primary', required: false })
  @IsString()
  @IsOptional()
  currentGrade?: string

  @ApiProperty({
    description: 'Favorite subjects',
    example: ['Mathematics', 'Science'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favoriteSubjects?: string[]

  @ApiProperty({ description: 'Learning style', example: 'Visual', required: false })
  @IsString()
  @IsOptional()
  learningStyle?: string

  @ApiProperty({
    description: 'Languages of instruction',
    example: ['English'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languagesOfInstruction?: string[]

  @ApiProperty({ description: 'Interested in boarding', example: 'No', required: false })
  @IsString()
  @IsOptional()
  interestedInBoarding?: string
}

class ExtraCurricularDto {
  @ApiProperty({ description: 'Interests', example: ['Soccer', 'Art'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[]

  @ApiProperty({ description: 'Preferred schedule', example: 'After school', required: false })
  @IsString()
  @IsOptional()
  preferredSchedule?: string
}

class SpecialNeedsDto {
  @ApiProperty({ description: 'Areas of need', example: [], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areas?: string[]

  @ApiProperty({ description: 'Support needs', example: [], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportNeeds?: string[]

  @ApiProperty({ description: 'Additional notes', example: 'Vegetarian', required: false })
  @IsString()
  @IsOptional()
  additionalNotes?: string
}

export class UpdateChildDto {
  @ApiProperty({ description: 'Personal information', required: false })
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  @IsOptional()
  personalInfo?: PersonalInfoDto

  @ApiProperty({ description: 'Academic preferences', required: false })
  @ValidateNested()
  @Type(() => AcademicPreferencesDto)
  @IsOptional()
  academicPreferences?: AcademicPreferencesDto

  @ApiProperty({ description: 'Extra-curricular activities', required: false })
  @ValidateNested()
  @Type(() => ExtraCurricularDto)
  @IsOptional()
  extraCurricular?: ExtraCurricularDto

  @ApiProperty({ description: 'Special needs', required: false })
  @ValidateNested()
  @Type(() => SpecialNeedsDto)
  @IsOptional()
  specialNeeds?: SpecialNeedsDto
}
