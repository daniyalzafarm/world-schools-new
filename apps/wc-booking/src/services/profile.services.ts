import apiClient from '@/utils/api-client'

export interface ParentProfile {
  id: string
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

export interface UserProfile {
  id: string
  email: string
  firstName?: string
  lastName?: string
  roles: Array<{
    id: string
    name: string
    providerId?: string | null
    isSystemRole?: boolean
  }>
  permissions: string[]
  parent?: ParentProfile
}

export interface UpdateProfileDto {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get('/user/auth/profile')

    if (!response.success) {
      throw new Error('Failed to fetch profile')
    }

    return response.data
  },

  async updateProfile(data: UpdateProfileDto): Promise<UserProfile> {
    const response = await apiClient.patch('/user/auth/profile', data)

    if (!response.success) {
      throw new Error('Failed to update profile')
    }

    return response.data
  },
}
