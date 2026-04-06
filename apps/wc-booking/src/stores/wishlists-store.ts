import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  CreateWishlistPayload,
  SharedWithMeEntry,
  ShareWishlistPayload,
  UpdateWishlistPayload,
  Wishlist,
  WishlistDetail,
  WishlistShareRole,
} from '@/types/wishlists'
import { wishlistsService } from '@/services/wishlists.services'

interface WishlistsState {
  myWishlists: Wishlist[]
  sharedWishlists: SharedWithMeEntry[]
  activeWishlist: WishlistDetail | null
  compareIds: string[]
  isLoadingList: boolean
  isLoadingDetail: boolean
  listError: string | null
  detailError: string | null
  isCreateModalOpen: boolean
  isShareModalOpen: boolean
  isAddToWishlistModalOpen: boolean
  addToWishlistCampId: string | null
  addToWishlistCampPreview: {
    name: string
    thumbnail: string | null
    location: string | null
  } | null
}

interface WishlistsActions {
  // Fetch
  fetchMyWishlists: () => Promise<void>
  fetchSharedWithMe: () => Promise<void>
  fetchWishlistDetail: (id: string) => Promise<void>
  clearActiveWishlist: () => void

  // CRUD
  createWishlist: (payload: CreateWishlistPayload) => Promise<Wishlist | null>
  updateWishlist: (id: string, payload: UpdateWishlistPayload) => Promise<boolean>
  deleteWishlist: (id: string) => Promise<boolean>
  duplicateWishlist: (id: string) => Promise<boolean>

  // Items
  addCampToWishlist: (wishlistId: string, campId: string, sessionId?: string) => Promise<boolean>
  removeCampFromWishlist: (wishlistId: string, itemId: string) => Promise<boolean>
  syncCampWishlists: (campId: string, wishlistIds: string[]) => Promise<boolean>
  updateItemSession: (
    wishlistId: string,
    itemId: string,
    sessionId: string | null
  ) => Promise<boolean>

  // Compare
  toggleCompare: (campId: string) => void
  clearCompare: () => void

  // Sharing
  addShare: (wishlistId: string, payload: ShareWishlistPayload) => Promise<boolean>
  removeShare: (wishlistId: string, shareId: string) => Promise<boolean>
  updateShareRole: (
    wishlistId: string,
    shareId: string,
    role: WishlistShareRole
  ) => Promise<boolean>
  toggleLinkSharing: (wishlistId: string, enabled: boolean) => Promise<boolean>

  // Modals
  openCreateModal: () => void
  closeCreateModal: () => void
  openShareModal: () => void
  closeShareModal: () => void
  openAddToWishlistModal: (
    campId: string,
    preview?: { name: string; thumbnail: string | null; location: string | null }
  ) => void
  closeAddToWishlistModal: () => void

  // Helpers
  isCampInWishlist: (wishlistId: string, campId: string) => boolean
  clearError: () => void
}

type WishlistsStore = WishlistsState & WishlistsActions

export const useWishlistsStore = create<WishlistsStore>()(
  immer((set, get) => ({
    // Initial state
    myWishlists: [],
    sharedWishlists: [],
    activeWishlist: null,
    compareIds: [],
    isLoadingList: false,
    isLoadingDetail: false,
    listError: null,
    detailError: null,
    isCreateModalOpen: false,
    isShareModalOpen: false,
    isAddToWishlistModalOpen: false,
    addToWishlistCampId: null,
    addToWishlistCampPreview: null,

    // ============================================
    // Fetch Actions
    // ============================================

    fetchMyWishlists: async () => {
      set(state => {
        state.isLoadingList = true
        state.listError = null
      })
      const response = await wishlistsService.getAll()
      if (response.success) {
        set(state => {
          state.myWishlists = response.data
          state.isLoadingList = false
        })
      } else {
        set(state => {
          state.listError = (response.data as any)?.message || 'Failed to fetch wishlists'
          state.isLoadingList = false
        })
      }
    },

    fetchSharedWithMe: async () => {
      set(state => {
        state.isLoadingList = true
        state.listError = null
      })
      const response = await wishlistsService.getSharedWithMe()
      if (response.success) {
        set(state => {
          state.sharedWishlists = response.data
          state.isLoadingList = false
        })
      } else {
        set(state => {
          state.listError = (response.data as any)?.message || 'Failed to fetch shared wishlists'
          state.isLoadingList = false
        })
      }
    },

    fetchWishlistDetail: async (id: string) => {
      set(state => {
        state.isLoadingDetail = true
        state.detailError = null
      })
      const response = await wishlistsService.getById(id)
      if (response.success) {
        set(state => {
          state.activeWishlist = response.data
          state.isLoadingDetail = false
        })
      } else {
        set(state => {
          state.detailError = (response.data as any)?.message || 'Failed to fetch wishlist'
          state.isLoadingDetail = false
        })
      }
    },

    clearActiveWishlist: () => {
      set(state => {
        state.activeWishlist = null
        state.compareIds = []
      })
    },

    // ============================================
    // CRUD Actions
    // ============================================

    createWishlist: async (payload: CreateWishlistPayload) => {
      const response = await wishlistsService.create(payload)
      if (response.success) {
        set(state => {
          state.myWishlists.unshift(response.data)
          state.isCreateModalOpen = false
        })
        return response.data
      }
      return null
    },

    updateWishlist: async (id: string, payload: UpdateWishlistPayload) => {
      const response = await wishlistsService.update(id, payload)
      if (response.success) {
        set(state => {
          const idx = state.myWishlists.findIndex(w => w.id === id)
          if (idx !== -1) state.myWishlists[idx] = response.data
          if (state.activeWishlist?.id === id) {
            Object.assign(state.activeWishlist, response.data)
          }
        })
        return true
      }
      return false
    },

    deleteWishlist: async (id: string) => {
      const response = await wishlistsService.remove(id)
      if (response.success) {
        set(state => {
          state.myWishlists = state.myWishlists.filter(w => w.id !== id)
          if (state.activeWishlist?.id === id) state.activeWishlist = null
        })
        return true
      }
      return false
    },

    duplicateWishlist: async (id: string) => {
      const response = await wishlistsService.duplicate(id)
      if (response.success) {
        set(state => {
          state.myWishlists.unshift(response.data)
        })
        return true
      }
      return false
    },

    // ============================================
    // Item Actions
    // ============================================

    addCampToWishlist: async (wishlistId: string, campId: string, sessionId?: string) => {
      const response = await wishlistsService.addItem(wishlistId, { campId, sessionId })
      if (response.success) {
        // Update camp count and campIds on the wishlist summary
        set(state => {
          const idx = state.myWishlists.findIndex(w => w.id === wishlistId)
          if (idx !== -1) {
            if (!state.myWishlists[idx].campIds.includes(campId)) {
              state.myWishlists[idx].campIds.push(campId)
              state.myWishlists[idx].campCount += 1
            }
          }
        })
        // Refetch detail if this wishlist is active
        if (get().activeWishlist?.id === wishlistId) {
          await get().fetchWishlistDetail(wishlistId)
        }
        return true
      }
      return false
    },

    removeCampFromWishlist: async (wishlistId: string, itemId: string) => {
      const response = await wishlistsService.removeItem(wishlistId, itemId)
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            state.activeWishlist.items = state.activeWishlist.items.filter(i => i.id !== itemId)
            state.activeWishlist.campCount = state.activeWishlist.items.length
          }
          const idx = state.myWishlists.findIndex(w => w.id === wishlistId)
          if (idx !== -1 && state.myWishlists[idx].campCount > 0) {
            state.myWishlists[idx].campCount -= 1
          }
        })
        return true
      }
      return false
    },

    syncCampWishlists: async (campId: string, wishlistIds: string[]) => {
      const response = await wishlistsService.syncCampWishlists(campId, wishlistIds)
      if (response.success) {
        // Reconcile campIds on each list entry to reflect the new desired state
        set(state => {
          state.myWishlists.forEach(w => {
            const shouldHave = wishlistIds.includes(w.id)
            const hasIt = w.campIds.includes(campId)
            if (shouldHave && !hasIt) {
              w.campIds.push(campId)
              w.campCount += 1
            } else if (!shouldHave && hasIt) {
              w.campIds = w.campIds.filter(id => id !== campId)
              if (w.campCount > 0) w.campCount -= 1
            }
          })
          // If the active wishlist was affected, refetch it (handled after set)
        })
        // Refetch active wishlist if it was modified
        const active = get().activeWishlist
        if (
          active &&
          (wishlistIds.includes(active.id) || active.items.some(i => i.campId === campId))
        ) {
          await get().fetchWishlistDetail(active.id)
        }
        return true
      }
      return false
    },

    updateItemSession: async (wishlistId: string, itemId: string, sessionId: string | null) => {
      const response = await wishlistsService.updateItem(wishlistId, itemId, { sessionId })
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            const item = state.activeWishlist.items.find(i => i.id === itemId)
            if (item) {
              item.sessionId = response.data.sessionId
              item.selectedSession = response.data.selectedSession
            }
          }
        })
        return true
      }
      return false
    },

    // ============================================
    // Compare Actions
    // ============================================

    toggleCompare: (campId: string) => {
      set(state => {
        const idx = state.compareIds.indexOf(campId)
        if (idx !== -1) {
          state.compareIds.splice(idx, 1)
        } else if (state.compareIds.length < 4) {
          state.compareIds.push(campId)
        }
      })
    },

    clearCompare: () => {
      set(state => {
        state.compareIds = []
      })
    },

    // ============================================
    // Sharing Actions
    // ============================================

    addShare: async (wishlistId: string, payload: ShareWishlistPayload) => {
      const response = await wishlistsService.addShare(wishlistId, payload)
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            const existingIdx = state.activeWishlist.shares.findIndex(
              s => s.id === response.data.id
            )
            if (existingIdx !== -1) {
              state.activeWishlist.shares[existingIdx] = response.data
            } else {
              state.activeWishlist.shares.push(response.data)
              state.activeWishlist.shareCount += 1
            }
          }
        })
        return true
      }
      return false
    },

    removeShare: async (wishlistId: string, shareId: string) => {
      const response = await wishlistsService.removeShare(wishlistId, shareId)
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            state.activeWishlist.shares = state.activeWishlist.shares.filter(s => s.id !== shareId)
            state.activeWishlist.shareCount = state.activeWishlist.shares.length
          }
        })
        return true
      }
      return false
    },

    updateShareRole: async (wishlistId: string, shareId: string, role: WishlistShareRole) => {
      const response = await wishlistsService.updateShareRole(wishlistId, shareId, { role })
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            const share = state.activeWishlist.shares.find(s => s.id === shareId)
            if (share) share.role = response.data.role
          }
        })
        return true
      }
      return false
    },

    toggleLinkSharing: async (wishlistId: string, enabled: boolean) => {
      const response = await wishlistsService.toggleLinkSharing(wishlistId, enabled)
      if (response.success) {
        set(state => {
          if (state.activeWishlist?.id === wishlistId) {
            state.activeWishlist.isLinkSharingEnabled = response.data.isLinkSharingEnabled
            state.activeWishlist.shareToken = response.data.shareToken
          }
          const idx = state.myWishlists.findIndex(w => w.id === wishlistId)
          if (idx !== -1) {
            state.myWishlists[idx].isLinkSharingEnabled = response.data.isLinkSharingEnabled
            state.myWishlists[idx].shareToken = response.data.shareToken
          }
        })
        return true
      }
      return false
    },

    // ============================================
    // Modal Actions
    // ============================================

    openCreateModal: () =>
      set(state => {
        state.isCreateModalOpen = true
      }),
    closeCreateModal: () =>
      set(state => {
        state.isCreateModalOpen = false
      }),
    openShareModal: () =>
      set(state => {
        state.isShareModalOpen = true
      }),
    closeShareModal: () =>
      set(state => {
        state.isShareModalOpen = false
      }),

    openAddToWishlistModal: (campId, preview) => {
      set(state => {
        state.isAddToWishlistModalOpen = true
        state.addToWishlistCampId = campId
        state.addToWishlistCampPreview = preview ?? null
      })
      // Ensure wishlists are loaded for the modal
      if (get().myWishlists.length === 0 && !get().isLoadingList) {
        void get().fetchMyWishlists()
      }
    },

    closeAddToWishlistModal: () => {
      set(state => {
        state.isAddToWishlistModalOpen = false
        state.addToWishlistCampId = null
        state.addToWishlistCampPreview = null
      })
    },

    // ============================================
    // Helpers
    // ============================================

    isCampInWishlist: (wishlistId: string, campId: string) => {
      const wishlist = get().myWishlists.find(w => w.id === wishlistId)
      if (!wishlist) return false
      return wishlist.campIds.includes(campId)
    },

    clearError: () => {
      set(state => {
        state.listError = null
        state.detailError = null
      })
    },
  }))
)
