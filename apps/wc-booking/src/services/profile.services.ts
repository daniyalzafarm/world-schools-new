import apiClient from '@/utils/api-client'

export interface ParentProfile {
  id: string
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  primaryNationality?: string | null
  secondaryNationality?: string | null
  languages?: string[] | null
}

export interface UserProfile {
  id: string
  email: string
  emailVerified?: boolean
  firstName?: string
  lastName?: string
  profilePhotoUrl?: string | null
  roles: Array<{
    id: string
    name: string
    providerId?: string | null
    isSystemRole?: boolean
  }>
  permissions: string[]
  parent?: ParentProfile
  phoneVerified?: boolean
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
  primaryNationality?: string
  secondaryNationality?: string
  languages?: string[]
  profilePhotoUrl?: string
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get('/user/auth/profile')

    if (!response.success) {
      throw new Error('Failed to fetch profile')
    }

    return response.data as any
  },

  async updateProfile(data: UpdateProfileDto): Promise<UserProfile> {
    const response = await apiClient.patch('/user/auth/profile', data)

    if (!response.success) {
      throw new Error('Failed to update profile')
    }

    return response.data as any
  },

  async uploadProfilePhoto(file: File): Promise<UserProfile> {
    const formData = new FormData()
    formData.append('photo', file)

    const response = await apiClient.patch('/user/auth/profile/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    if (!response.success) {
      throw new Error('Failed to upload profile photo')
    }

    return response.data as any
  },

  async deleteProfilePhoto(): Promise<UserProfile> {
    const response = await apiClient.del('/user/auth/profile/photo')

    if (!response.success) {
      throw new Error('Failed to delete profile photo')
    }

    return response.data as any
  },
}
