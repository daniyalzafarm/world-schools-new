import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateBasicInfoDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEnum(['day', 'residential'])
  type?: 'day' | 'residential'

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(['provider', 'different'])
  locationType?: 'provider' | 'different'

  @IsOptional()
  @IsString()
  locationPlaceId?: string

  @IsOptional()
  @IsString()
  locationName?: string

  @IsOptional()
  @IsString()
  locationAddress?: string

  @IsOptional()
  locationLat?: number

  @IsOptional()
  locationLng?: number

  @IsOptional()
  @IsArray()
  ageGroups?: any[]

  @IsOptional()
  @IsArray()
  languages?: string[]

  @IsOptional()
  @IsEnum(['coed', 'boys', 'girls'])
  gender?: 'coed' | 'boys' | 'girls'

  @IsOptional()
  @IsArray()
  activities?: string[]
}

export class UpdatePhotosDto {
  @IsOptional()
  @IsObject()
  photos?: any
}

export class UpdateWhatsIncludedDto {
  @IsOptional()
  @IsObject()
  whatsIncluded?: any
}

export class UpdateDailyScheduleDto {
  @IsOptional()
  @IsObject()
  dailySchedule?: any
}

export class UpdateMealsDto {
  @IsOptional()
  @IsObject()
  meals?: any
}

export class UpdateSportsDto {
  @IsOptional()
  @IsObject()
  sportsActivities?: any
}

export class UpdateLanguagesDto {
  @IsOptional()
  @IsObject()
  languagePrograms?: any
}

export class UpdateArtsDto {
  @IsOptional()
  @IsObject()
  artsAndCrafts?: any
}

export class UpdateAdventureDto {
  @IsOptional()
  @IsObject()
  adventureActivities?: any
}

export class UpdateWaterDto {
  @IsOptional()
  @IsObject()
  waterActivities?: any
}

export class UpdateEnvironmentalDto {
  @IsOptional()
  @IsObject()
  environmentalActivities?: any
}

export class UpdateAcademicsDto {
  @IsOptional()
  @IsObject()
  academics?: any
}

export class UpdateReligionDto {
  @IsOptional()
  @IsObject()
  religionPrograms?: any
}

export class UpdateExcursionsDto {
  @IsOptional()
  @IsObject()
  excursionsTrips?: any
}

export class UpdateLocationCampusDto {
  @IsOptional()
  @IsObject()
  campusFacilities?: any
}

export class UpdateAccommodationDto {
  @IsOptional()
  @IsObject()
  accommodation?: any
}

export class UpdateGettingThereDto {
  @IsOptional()
  @IsObject()
  gettingThere?: any
}

export class UpdateCampFocusDto {
  @IsOptional()
  @IsObject()
  campFocus?: any
}

export class UpdateCampStatusDto {
  @IsEnum(['draft', 'published', 'archived'])
  status: 'draft' | 'published' | 'archived'
}
