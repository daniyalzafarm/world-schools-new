import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { ProviderDetail } from '../types/providers'
import { providersService } from '../services/providers.services'

interface ProvidersState {
  detail: ProviderDetail | null
  isLoading: boolean
  error: string | null
}

interface ProvidersStore extends ProvidersState {
  fetchDetail: (id: string) => Promise<void>
  clearDetail: () => void
  clearError: () => void
}

const initialState: ProvidersState = {
  detail: null,
  isLoading: false,
  error: null,
}

export const useProvidersStore = create<ProvidersStore>()(
  devtools(
    immer(set => ({
      ...initialState,

      fetchDetail: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const detail = await providersService.getDetail(id)
          set(draft => {
            draft.detail = detail
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to fetch provider details'
            draft.isLoading = false
          })
        }
      },

      clearDetail: () => {
        set(draft => {
          draft.detail = null
          draft.error = null
        })
      },

      clearError: () => {
        set(draft => {
          draft.error = null
        })
      },
    })),
    { name: 'ProvidersStore' }
  )
)
