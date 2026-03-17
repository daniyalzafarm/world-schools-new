/**
 * Activity Catalogue — admin API service.
 * Endpoints: superadmin/catalogue/*
 */

import apiClient, { type ApiResult } from '@/utils/api-client'

export type ActivityCategoryStatus = 'ACTIVE' | 'DRAFT'

export interface AdminActivity {
  id: string
  slug: string
  name: string
  emoji?: string | null
  scaleId?: string | null
  order: number
  isActive: boolean
}

export interface AdminCategory {
  id: string
  slug: string
  name: string
  emoji?: string | null
  status: ActivityCategoryStatus
  surfaceParentInterests: boolean
  surfaceCampFocus: boolean
  surfaceCampInterests: boolean
  order: number
  activities: AdminActivity[]
}

export interface ScaleLevel {
  id: string
  value: string
  label: string
  order: number
}

export interface ScaleWithUsage {
  id: string
  name: string
  description?: string | null
  visualType: string
  colorKey: string
  levels: ScaleLevel[]
  usedByCount: number
}

export type ActivityScaleVisualType = 'DOT' | 'GRID'
export type ActivityScaleColorKey = 'PURPLE' | 'TEAL' | 'AMBER'

export type ScaleLevelInput = {
  value: string
  label?: string
}

export interface CreateScalePayload {
  id: string
  name: string
  description?: string
  visualType: ActivityScaleVisualType
  colorKey: ActivityScaleColorKey
  levels: ScaleLevelInput[]
}

export interface UpdateScalePayload {
  name?: string
  description?: string | null
  visualType?: ActivityScaleVisualType
  colorKey?: ActivityScaleColorKey
  levels?: ScaleLevelInput[]
}

export interface CreateCategoryPayload {
  name: string
  slug?: string
  emoji?: string
  status?: ActivityCategoryStatus
  surfaceParentInterests?: boolean
  surfaceCampFocus?: boolean
  surfaceCampInterests?: boolean
  order?: number
}

export interface UpdateCategoryPayload {
  name?: string
  slug?: string
  emoji?: string
  status?: ActivityCategoryStatus
  surfaceParentInterests?: boolean
  surfaceCampFocus?: boolean
  surfaceCampInterests?: boolean
  order?: number
}

export interface CreateActivityPayload {
  name: string
  slug?: string
  emoji?: string
  scaleId?: string
}

export interface UpdateActivityPayload {
  categoryId?: string
  slug?: string
  name?: string
  emoji?: string
  scaleId?: string | null
  isActive?: boolean
}

export type CheckSlugAvailabilityResult = {
  available: boolean
}

export const catalogueService = {
  async getCategories(): Promise<ApiResult<AdminCategory[]>> {
    return apiClient.get<AdminCategory[]>('superadmin/catalogue/categories')
  },

  async checkCategorySlugAvailability(
    slug: string,
    categoryId?: string
  ): Promise<ApiResult<CheckSlugAvailabilityResult>> {
    const queryParams = new URLSearchParams()
    if (categoryId) queryParams.append('categoryId', categoryId)

    const url = queryParams.toString()
      ? `superadmin/catalogue/categories/check-slug/${slug}?${queryParams.toString()}`
      : `superadmin/catalogue/categories/check-slug/${slug}`

    return apiClient.get<CheckSlugAvailabilityResult>(url)
  },

  async createCategory(payload: CreateCategoryPayload): Promise<ApiResult<AdminCategory>> {
    return apiClient.post<AdminCategory>('superadmin/catalogue/categories', payload)
  },

  async updateCategory(
    id: string,
    payload: UpdateCategoryPayload
  ): Promise<ApiResult<AdminCategory>> {
    return apiClient.patch<AdminCategory>(`superadmin/catalogue/categories/${id}`, payload)
  },

  async deleteCategory(id: string): Promise<ApiResult<void>> {
    return apiClient.del<void>(`superadmin/catalogue/categories/${id}`)
  },

  async addActivity(
    categoryId: string,
    payload: CreateActivityPayload
  ): Promise<ApiResult<AdminActivity>> {
    return apiClient.post<AdminActivity>(
      `superadmin/catalogue/categories/${categoryId}/activities`,
      payload
    )
  },

  async checkActivitySlugAvailability(
    slug: string,
    categoryId: string,
    activityId?: string
  ): Promise<ApiResult<CheckSlugAvailabilityResult>> {
    const queryParams = new URLSearchParams()
    queryParams.append('categoryId', categoryId)
    if (activityId) queryParams.append('activityId', activityId)
    return apiClient.get<CheckSlugAvailabilityResult>(
      `superadmin/catalogue/activities/check-slug/${slug}?${queryParams.toString()}`
    )
  },

  async updateActivity(
    id: string,
    payload: UpdateActivityPayload
  ): Promise<ApiResult<AdminActivity>> {
    return apiClient.patch<AdminActivity>(`superadmin/catalogue/activities/${id}`, payload)
  },

  async deleteActivity(id: string): Promise<ApiResult<void>> {
    return apiClient.del<void>(`superadmin/catalogue/activities/${id}`)
  },

  async getScales(): Promise<ApiResult<ScaleWithUsage[]>> {
    return apiClient.get<ScaleWithUsage[]>('superadmin/catalogue/scales')
  },

  async getScale(id: string): Promise<ApiResult<ScaleWithUsage>> {
    return apiClient.get<ScaleWithUsage>(`superadmin/catalogue/scales/${id}`)
  },

  async createScale(payload: CreateScalePayload): Promise<ApiResult<ScaleWithUsage>> {
    return apiClient.post<ScaleWithUsage>('superadmin/catalogue/scales', payload)
  },

  async updateScale(id: string, payload: UpdateScalePayload): Promise<ApiResult<ScaleWithUsage>> {
    return apiClient.patch<ScaleWithUsage>(`superadmin/catalogue/scales/${id}`, payload)
  },

  async deleteScale(id: string): Promise<ApiResult<void>> {
    return apiClient.del<void>(`superadmin/catalogue/scales/${id}`)
  },

  async checkScaleIdAvailability(id: string): Promise<ApiResult<CheckSlugAvailabilityResult>> {
    return apiClient.get<CheckSlugAvailabilityResult>(`superadmin/catalogue/scales/check-id/${id}`)
  },
}
