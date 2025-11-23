import apiClient from '@/utils/api-client'

export interface Child {
  id: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  grade?: string | null
  parentId: string
  createdAt: string
  updatedAt: string
}

export interface CreateChildDto {
  firstName: string
  lastName: string
  dateOfBirth?: string
  grade?: string
}

export interface UpdateChildDto {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  grade?: string
}

export const childrenService = {
  async getAll(): Promise<Child[]> {
    const response = await apiClient.get('/user/children')
    return response.data as any
  },

  async getOne(id: string): Promise<Child> {
    const response = await apiClient.get(`/user/children/${id}`)
    return response.data as any
  },

  async create(data: CreateChildDto): Promise<Child> {
    const response = await apiClient.post('/user/children', data)
    return response.data as any
  },

  async update(id: string, data: UpdateChildDto): Promise<Child> {
    const response = await apiClient.patch(`/user/children/${id}`, data)
    return response.data as any
  },

  async delete(id: string): Promise<void> {
    console.log('Deleting child:', id)
    // await apiClient.delete(`/user/children/${id}`)
  },
}
