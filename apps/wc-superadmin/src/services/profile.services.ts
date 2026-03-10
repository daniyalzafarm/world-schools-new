import apiClient from '@/utils/api-client'

export interface UserProfile {
  id: string
  email: string
  emailVerified?: boolean
  firstName?: string
  lastName?: string
  profilePhotoUrl?: string | null
  phone?: string | null
  phoneVerified?: boolean
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  roles?: Array<{
    id: string
    name: string
    providerId?: string | null
  }>
  permissions?: string[]
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
    const response = await apiClient.get('/superadmin/auth/profile')

    if (!response.success) {
      throw new Error('Failed to fetch profile')
    }

    return response.data as UserProfile
  },

  async updateProfile(data: UpdateProfileDto): Promise<UserProfile> {
    const response = await apiClient.patch('/superadmin/auth/profile', data)

    if (!response.success) {
      throw new Error('Failed to update profile')
    }

    return response.data as UserProfile
  },

  async uploadProfilePhoto(file: File): Promise<UserProfile> {
    const formData = new FormData()
    formData.append('photo', file)

    const response = await apiClient.patch('/superadmin/auth/profile/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    if (!response.success) {
      throw new Error('Failed to upload profile photo')
    }

    return response.data as UserProfile
  },

  async deleteProfilePhoto(): Promise<UserProfile> {
    const response = await apiClient.del('/superadmin/auth/profile/photo')

    if (!response.success) {
      throw new Error('Failed to delete profile photo')
    }

    return response.data as UserProfile
  },
}
