/**
 * Users API Service for WC Superadmin
 */

import apiClient from '@/utils/api-client'
import type { CreateUserData, UpdateUserData } from '@/types/users'

const USERS_ENDPOINT = '/superadmin/users'

export interface GetUsersParams {
  page?: number
  limit?: number
  search?: string
  roleId?: string
  emailVerified?: boolean
  createdAfter?: string
  createdBefore?: string
}

export const getUsers = async (params?: GetUsersParams) => {
  const queryParams = new URLSearchParams()

  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.roleId) queryParams.append('roleId', params.roleId)
  if (params?.emailVerified !== undefined)
    queryParams.append('emailVerified', params.emailVerified.toString())
  if (params?.createdAfter) queryParams.append('createdAfter', params.createdAfter)
  if (params?.createdBefore) queryParams.append('createdBefore', params.createdBefore)

  const url = queryParams.toString()
    ? `${USERS_ENDPOINT}?${queryParams.toString()}`
    : USERS_ENDPOINT

  return apiClient.get(url)
}

export const getUser = async (id: string) => {
  return apiClient.get(`${USERS_ENDPOINT}/${id}`)
}

export const createUser = async (data: CreateUserData) => {
  return apiClient.post(USERS_ENDPOINT, data)
}

export const updateUser = async (id: string, data: UpdateUserData) => {
  return apiClient.patch(`${USERS_ENDPOINT}/${id}`, data)
}

export const deleteUser = async (id: string) => {
  return apiClient.del(`${USERS_ENDPOINT}/${id}`)
}
