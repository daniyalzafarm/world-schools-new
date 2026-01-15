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

export const createCamp = async (data: CreateCampDto): Promise<Camp> => {
  const response = await apiClient.post<{ camp: Camp }>('/provider/camps/create/basic-info', data)
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateCampAudience = async (
  campId: string,
  data: UpdateCampAudienceDto
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/create/audience`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateCampPrograms = async (
  campId: string,
  data: UpdateCampProgramsDto
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/create/programs`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateCampPhotos = async (
  campId: string,
  data: UpdateCampPhotosDto
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/create/photos`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const uploadCampPhotos = async (
  campId: string,
  files: File[],
  existingPhotos: any[]
): Promise<Camp> => {
  const formData = new FormData()

  // Add files to form data
  files.forEach(file => {
    formData.append('photos', file)
  })

  // Add existing photos as JSON string
  formData.append('existingPhotos', JSON.stringify(existingPhotos))

  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/create/photos`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const publishCamp = async (campId: string): Promise<Camp> => {
  const response = await apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/publish`, {})
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

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
}

export const getCamps = async (filters?: GetCampsFilters): Promise<Camp[]> => {
  const response = await apiClient.get<{ camps: Camp[] }>('/provider/camps', { params: filters })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camps
}

export const getCampStatistics = async (): Promise<CampStatistics> => {
  const response = await apiClient.get<{ stats: CampStatistics }>('/provider/camps/statistics')
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).stats
}

export const getCamp = async (campId: string): Promise<Camp> => {
  const response = await apiClient.get<{ camp: Camp }>(`/provider/camps/${campId}`)
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const archiveCamp = async (campId: string): Promise<Camp> => {
  const response = await apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/archive`, {})
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const duplicateCamp = async (campId: string): Promise<Camp> => {
  const response = await apiClient.post<{ camp: Camp }>(`/provider/camps/${campId}/duplicate`, {})
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const deleteCamp = async (campId: string): Promise<void> => {
  const response = await apiClient.del(`/provider/camps/${campId}`)
  if (!response.success) throw new Error((response.data as any).message)
}

// ============================================
// Editor Endpoints
// ============================================

export const updateBasicInfo = async (campId: string, data: Partial<Camp>): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/basic-info`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updatePhotos = async (campId: string, photos: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/photos`, {
    photos,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateWhatsIncluded = async (campId: string, whatsIncluded: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/whats-included`,
    {
      whatsIncluded,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateDailySchedule = async (campId: string, dailySchedule: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/daily-schedule`,
    {
      dailySchedule,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateMeals = async (campId: string, meals: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/meals`, {
    meals,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateSports = async (campId: string, sportsActivities: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/sports`, {
    sportsActivities,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateLanguages = async (campId: string, languagePrograms: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/languages`, {
    languagePrograms,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateArts = async (campId: string, artsAndCrafts: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/arts`, {
    artsAndCrafts,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateAdventure = async (campId: string, adventureActivities: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/adventure`, {
    adventureActivities,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateWater = async (campId: string, waterActivities: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/water`, {
    waterActivities,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateEnvironmental = async (
  campId: string,
  environmentalActivities: any
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/environmental`,
    {
      environmentalActivities,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateAcademics = async (campId: string, academics: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/academics`, {
    academics,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateReligion = async (campId: string, religionPrograms: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/religion`, {
    religionPrograms,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateExcursions = async (campId: string, excursionsTrips: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/excursions`, {
    excursionsTrips,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateLocationCampus = async (
  campId: string,
  campusFacilities: any
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/location-campus`,
    {
      campusFacilities,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateAccommodation = async (campId: string, accommodation: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/accommodation`,
    {
      accommodation,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateGettingThere = async (campId: string, gettingThere: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(
    `/provider/camps/${campId}/getting-there`,
    {
      gettingThere,
    }
  )
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateCampFocus = async (campId: string, campFocus: any): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/camp-focus`, {
    campFocus,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}

export const updateCampStatus = async (
  campId: string,
  status: 'draft' | 'published' | 'archived'
): Promise<Camp> => {
  const response = await apiClient.patch<{ camp: Camp }>(`/provider/camps/${campId}/status`, {
    status,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return (response.data as any).camp
}
