import apiClient, { type ApiResult } from '@/utils/api-client'

export const contactService = {
  async requestEmailChange(newEmail: string): Promise<ApiResult<unknown>> {
    const response = await apiClient.post('/user/auth/email/change-request', { newEmail })

    if (!response.success) {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to request email change'
      throw new Error(errorMessage)
    }

    return response
  },

  async verifyEmailChange(token: string): Promise<ApiResult<unknown>> {
    const response = await apiClient.post('/user/auth/email/verify', { token })

    if (!response.success) {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to verify email change'
      throw new Error(errorMessage)
    }

    return response
  },

  async requestPhoneChange(phoneNumber: string): Promise<ApiResult<unknown>> {
    const response = await apiClient.post('/user/auth/phone/change-request', {
      phoneNumber,
    })

    if (!response.success) {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to request phone change'
      throw new Error(errorMessage)
    }

    return response
  },

  async verifyPhoneChange(code: string): Promise<ApiResult<unknown>> {
    const response = await apiClient.post('/user/auth/phone/verify', { code })

    if (!response.success) {
      const errorMessage =
        'data' in response &&
        response.data &&
        typeof response.data === 'object' &&
        'message' in response.data
          ? (response.data.message as string)
          : 'Failed to verify phone change'
      throw new Error(errorMessage)
    }

    return response
  },
}
