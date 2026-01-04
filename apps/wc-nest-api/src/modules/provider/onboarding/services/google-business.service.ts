import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '../../../../config/config.service'
import { PrismaService } from '../../../../prisma/prisma.service'
import { GoogleBusinessSearchResultDto } from '../dto/google-business.dto'
import axios from 'axios'

@Injectable()
export class GoogleBusinessService {
  private readonly logger = new Logger(GoogleBusinessService.name)
  private readonly googlePlacesApiKey: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    this.googlePlacesApiKey = this.configService.googlePlacesApiKey
    if (!this.googlePlacesApiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not configured')
    }
  }

  /**
   * Get saved Google Business Profile for a provider
   */
  async getBusinessProfile(providerId: string): Promise<any> {
    const profile = await this.prisma.googleBusinessProfile.findUnique({
      where: { providerId },
    })

    if (!profile) {
      return null
    }

    return profile
  }

  /**
   * Search for businesses using Google Places API
   * Note: This method is kept for potential admin panel or bulk import features.
   * User-facing search in onboarding now uses Google Places Autocomplete on the frontend.
   */
  async searchBusinesses(
    query: string,
    lat?: number,
    lng?: number
  ): Promise<GoogleBusinessSearchResultDto[]> {
    if (!this.googlePlacesApiKey) {
      throw new BadRequestException('Google Places API is not configured')
    }

    try {
      // Use Google Places Text Search API
      const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
      const params: any = {
        query,
        key: this.googlePlacesApiKey,
      }

      // Add location bias if provided
      if (lat && lng) {
        params.location = `${lat},${lng}`
        params.radius = 50000 // 50km radius
      }

      const response = await axios.get(url, { params })

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        this.logger.error(`Google Places API error: ${response.data.status}`)
        throw new BadRequestException('Failed to search businesses')
      }

      // Map results to DTO
      const results: GoogleBusinessSearchResultDto[] = (response.data.results || []).map(
        (place: any) => ({
          placeId: place.place_id,
          businessName: place.name,
          formattedAddress: place.formatted_address,
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng,
          rating: place.rating,
          reviewsCount: place.user_ratings_total,
          photos: place.photos?.map((photo: any) => this.getPhotoUrl(photo.photo_reference)) || [],
          types: place.types || [],
        })
      )

      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to search businesses: ${errorMessage}`, errorStack)
      throw new BadRequestException('Failed to search businesses')
    }
  }

  /**
   * Fetch detailed business information from Google Places API
   */
  async fetchBusinessDetails(placeId: string): Promise<any> {
    if (!this.googlePlacesApiKey) {
      throw new BadRequestException('Google Places API is not configured')
    }

    try {
      const url = 'https://maps.googleapis.com/maps/api/place/details/json'
      const params = {
        place_id: placeId,
        fields:
          'place_id,name,formatted_address,address_components,geometry,rating,user_ratings_total,formatted_phone_number,website,photos,types',
        key: this.googlePlacesApiKey,
      }

      const response = await axios.get(url, { params })

      if (response.data.status !== 'OK') {
        this.logger.error(`Google Places API error: ${response.data.status}`)
        throw new NotFoundException('Business not found')
      }

      return response.data.result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to fetch business details: ${errorMessage}`, errorStack)
      throw new BadRequestException('Failed to fetch business details')
    }
  }

  /**
   * Save Google Business Profile to database
   */
  async saveBusinessProfile(providerId: string, placeId: string): Promise<any> {
    // Fetch business details from Google Places API
    const businessData = await this.fetchBusinessDetails(placeId)

    // Parse address components
    const addressComponents = this.parseAddressComponents(businessData.address_components || [])

    // Save to database
    const profile = await this.prisma.googleBusinessProfile.upsert({
      where: { providerId },
      create: {
        providerId,
        placeId: businessData.place_id,
        businessName: businessData.name,
        formattedAddress: businessData.formatted_address,
        streetNumber: addressComponents.streetNumber,
        streetName: addressComponents.streetName,
        city: addressComponents.city,
        state: addressComponents.state,
        postalCode: addressComponents.postalCode,
        country: addressComponents.country,
        lat: businessData.geometry?.location?.lat || 0,
        lng: businessData.geometry?.location?.lng || 0,
        rating: businessData.rating,
        reviewsCount: businessData.user_ratings_total,
        phone: businessData.formatted_phone_number,
        website: businessData.website,
        photos: businessData.photos?.map((photo: any) => this.getPhotoUrl(photo.photo_reference)),
        types: businessData.types,
        dataRaw: businessData,
      },
      update: {
        placeId: businessData.place_id,
        businessName: businessData.name,
        formattedAddress: businessData.formatted_address,
        streetNumber: addressComponents.streetNumber,
        streetName: addressComponents.streetName,
        city: addressComponents.city,
        state: addressComponents.state,
        postalCode: addressComponents.postalCode,
        country: addressComponents.country,
        lat: businessData.geometry?.location?.lat || 0,
        lng: businessData.geometry?.location?.lng || 0,
        rating: businessData.rating,
        reviewsCount: businessData.user_ratings_total,
        phone: businessData.formatted_phone_number,
        website: businessData.website,
        photos: businessData.photos?.map((photo: any) => this.getPhotoUrl(photo.photo_reference)),
        types: businessData.types,
        dataRaw: businessData,
      },
    })

    return profile
  }

  /**
   * Parse address components from Google Places API response
   */
  private parseAddressComponents(components: any[]): any {
    const result: any = {}

    for (const component of components) {
      if (component.types.includes('street_number')) {
        result.streetNumber = component.long_name
      } else if (component.types.includes('route')) {
        result.streetName = component.long_name
      } else if (component.types.includes('locality')) {
        result.city = component.long_name
      } else if (component.types.includes('administrative_area_level_1')) {
        result.state = component.long_name
      } else if (component.types.includes('postal_code')) {
        result.postalCode = component.long_name
      } else if (component.types.includes('country')) {
        result.country = component.long_name
      }
    }

    return result
  }

  /**
   * Get photo URL from Google Places API
   */
  private getPhotoUrl(photoReference: string): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${this.googlePlacesApiKey}`
  }
}
