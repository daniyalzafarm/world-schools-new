import apiClient from '../utils/api-client'
import type {
  Camp,
  CreateCampDto,
  UpdateCampAudienceDto,
  UpdateCampPhotosDto,
  UpdateCampProgramsDto,
} from '../types/camps'

// ============================================
// Wizard Endpoints
// ============================================

export const createCamp = (data: CreateCampDto) =>
  apiClient.post<{ camp: Camp }>('/provider/camps/create/basic-info', data)

export const updateCampAudience = (campId: string, data: UpdateCampAudienceDto) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/create/audience`, data)

export const updateCampPrograms = (campId: string, data: UpdateCampProgramsDto) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/create/programs`, data)

export const updateCampPhotos = (campId: string, data: UpdateCampPhotosDto) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/create/photos`, data)

export const uploadCampPhotos = (campId: string, files: File[], existingPhotos: any[]) => {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('photos', file)
  })
  formData.append('existingPhotos', JSON.stringify(existingPhotos))
  return apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/create/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const publishCamp = (campId: string) =>
  apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/publish`, {})

// ============================================
// Camp Management Endpoints
// ============================================

export interface GetCampsFilters {
  search?: string
  status?: 'draft' | 'published' | 'archived'
  location?: string
  type?: 'day' | 'residential'
}

export interface CampStatistics {
  totalCamps: number
  publishedCamps: number
  draftCamps: number
  archivedCamps: number
  totalBookings: number
  activeSessions: number
  averageRating: number
  reviewCount: number
  unrespondedReviews: number
  revenueTotalPaid: number
  revenueThisMonth: number
  revenueLastSeason: number
  pendingRevenue: number
  refundedTotal: number
  currency: string
}

export const getCamps = (filters?: GetCampsFilters) =>
  apiClient.get<{ camps: Camp[] }>('/provider/camps', { params: filters })

export const getCampStatistics = () =>
  apiClient.get<{ stats: CampStatistics }>('/provider/camps/statistics')

export const getCamp = (campId: string) =>
  apiClient.get<{ camp: Camp }>(`/provider/camps/${campId}`)

export const archiveCamp = (campId: string) =>
  apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/archive`, {})

export const duplicateCamp = (campId: string) =>
  apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/duplicate`, {})

export const deleteCamp = (campId: string) => apiClient.del(`/provider/camps/${campId}`)

export const checkSlugAvailability = (slug: string, campId?: string) => {
  const params = campId ? `?campId=${campId}` : ''
  return apiClient.get<{ available: boolean }>(`/provider/camps/check-slug/${slug}${params}`)
}

// ============================================
// Editor Endpoints
// ============================================

export const updateBasicInfo = (campId: string, data: Partial<Camp>) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/basic-info`, data)

export const updatePhotos = (campId: string, photos: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/photos`, { photos })

export const updateWhatsIncluded = (campId: string, whatsIncluded: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/whats-included`, { whatsIncluded })

export const updateDailySchedule = (campId: string, data: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/daily-schedule`, data)

export const updateMeals = (campId: string, meals: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/meals`, { meals })

export const updateSports = (campId: string, sportsActivities: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/sports`, { sportsActivities })

export const updateLanguages = (campId: string, languagePrograms: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/languages`, { languagePrograms })

export const updateArts = (campId: string, artsAndCrafts: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/arts`, { artsAndCrafts })

export const updateAdventure = (campId: string, adventureActivities: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/adventure`, { adventureActivities })

export const updateWater = (campId: string, waterActivities: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/water`, { waterActivities })

export const updateEnvironmental = (campId: string, environmentalActivities: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/environmental`, {
    environmentalActivities,
  })

export const updateAcademics = (campId: string, academics: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/academics`, { academics })

export const updateReligion = (campId: string, religionPrograms: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/religion`, { religionPrograms })

export const updateExcursions = (campId: string, excursionsTrips: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/excursions`, { excursionsTrips })

export const updateLocationCampus = (campId: string, campusFacilities: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/location-campus`, { campusFacilities })

export const updateAccommodation = (campId: string, accommodation: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/accommodation`, { accommodation })

export const updateGettingThere = (campId: string, gettingThere: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/getting-there`, { gettingThere })

export const updateCampFocus = (campId: string, campFocus: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/camp-focus`, { campFocus })

export const updateCampStatus = (campId: string, status: 'draft' | 'published' | 'archived') =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/status`, { status })

export const generatePreviewToken = (campId: string) =>
  apiClient.get<{ token: string }>(`/provider/camps/${campId}/preview-token`)

export const updateSafetyPolicies = (campId: string, safetySupervision: any, screenPolicy: any) =>
  apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/safety-policies`, {
    safetySupervision,
    screenPolicy,
  })

// ============================================
// Camp Eligibility (Skill Requirements)
// ============================================

export interface CampEligibilityItem {
  activityId: string
  mode: 'INFO' | 'GATE'
  minimumLevelValue: string | null
}

export const getCampEligibility = async (campId: string) => {
  const response = await apiClient.get<{ items: CampEligibilityItem[] }>(
    `/provider/camps/${campId}/eligibility`
  )
  if (!response.success) return response
  // Normalise response shape differences between API versions
  const raw = (response.data as any)?.data ?? response.data
  const items: CampEligibilityItem[] = Array.isArray(raw?.items) ? raw.items : (raw?.items ?? [])
  return { success: true as const, data: { items } }
}

export const putCampEligibility = async (campId: string, items: CampEligibilityItem[]) => {
  const response = await apiClient.patch<{ items: CampEligibilityItem[] }>(
    `/provider/camps/${campId}/eligibility`,
    { items }
  )
  if (!response.success) return response
  const raw = (response.data as any)?.data ?? response.data
  const resultItems: CampEligibilityItem[] = Array.isArray(raw?.items)
    ? raw.items
    : (raw?.items ?? [])
  return { success: true as const, data: { items: resultItems } }
}
