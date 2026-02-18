import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator'
import { CampPreferencesDto } from './camp-preferences.dto'
import { EmergencyContactDto } from './emergency-contact.dto'
import { MedicalInfoDto } from './medical-info.dto'

export class UpdateChildDto {
  // Basic info
  @ApiProperty({ description: 'First name', example: 'Emma', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string

  @ApiProperty({ description: 'Last name', example: 'Smith', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string

  @ApiProperty({ description: 'Nickname', example: 'Em', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 30)
  nickname?: string

  @ApiProperty({ description: 'Date of birth', example: '2015-05-15', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string

  @ApiProperty({
    description: 'Gender',
    example: 'girl',
    enum: ['boy', 'girl', 'non_binary', 'prefer_not_to_say'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['boy', 'girl', 'non_binary', 'prefer_not_to_say'])
  gender?: string

  @ApiProperty({ description: 'Photo URL', example: 'https://...', required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string

  @ApiProperty({ description: 'School year (normalized 1-13)', example: '7', required: false })
  @IsString()
  @IsOptional()
  schoolYear?: string

  @ApiProperty({ description: 'School country code', example: 'UK', required: false })
  @IsString()
  @IsOptional()
  schoolCountry?: string

  @ApiProperty({
    description: 'Languages spoken by the child',
    example: ['English', 'Spanish'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[]

  // Medical info
  @ApiProperty({ description: 'Medical information', required: false })
  @ValidateNested()
  @Type(() => MedicalInfoDto)
  @IsOptional()
  medicalInfo?: MedicalInfoDto

  // Emergency contacts
  @ApiProperty({ description: 'Emergency contacts (max 3)', required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContacts?: EmergencyContactDto[]

  // Camp preferences
  @ApiProperty({ description: 'Camp preferences', required: false })
  @ValidateNested()
  @Type(() => CampPreferencesDto)
  @IsOptional()
  campPreferences?: CampPreferencesDto
}
