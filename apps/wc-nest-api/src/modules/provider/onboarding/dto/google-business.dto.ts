import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SearchGoogleBusinessDto {
  @ApiProperty({
    description: 'Search query for Google Places API',
    example: 'Summer Camp Toronto',
  })
  @IsString()
  @IsNotEmpty()
  query: string

  @ApiProperty({
    description: 'Latitude for location bias',
    example: 43.6532,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number

  @ApiProperty({
    description: 'Longitude for location bias',
    example: -79.3832,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number
}

export class SaveGoogleBusinessProfileDto {
  @ApiProperty({
    description: 'Google Place ID',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  })
  @IsString()
  @IsNotEmpty()
  placeId: string
}

export class GoogleBusinessSearchResultDto {
  @ApiProperty({ description: 'Google Place ID' })
  placeId: string

  @ApiProperty({ description: 'Business name' })
  businessName: string

  @ApiProperty({ description: 'Formatted address' })
  formattedAddress: string

  @ApiProperty({ description: 'Latitude', required: false })
  lat?: number

  @ApiProperty({ description: 'Longitude', required: false })
  lng?: number

  @ApiProperty({ description: 'Rating (0-5)', required: false })
  rating?: number

  @ApiProperty({ description: 'Number of reviews', required: false })
  reviewsCount?: number

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string

  @ApiProperty({ description: 'Website URL', required: false })
  website?: string

  @ApiProperty({ description: 'Photo URLs', type: [String], required: false })
  photos?: string[]

  @ApiProperty({ description: 'Business types', type: [String], required: false })
  types?: string[]
}
