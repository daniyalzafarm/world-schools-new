import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  AddWishlistItemPayload,
  CreateWishlistPayload,
  SharedWithMeEntry,
  ShareWishlistPayload,
  UpdateShareRolePayload,
  UpdateWishlistItemPayload,
  UpdateWishlistPayload,
  Wishlist,
  WishlistDetail,
  WishlistItem,
  WishlistShare,
} from '@/types/wishlists'

export const wishlistsService = {
  // ============================================
  // My Wishlists
  // ============================================

  async getAll(): Promise<ApiResult<Wishlist[]>> {
    return apiClient.get<Wishlist[]>('/user/wishlists')
  },

  async getById(id: string): Promise<ApiResult<WishlistDetail>> {
    return apiClient.get<WishlistDetail>(`/user/wishlists/${id}`)
  },

  async create(payload: CreateWishlistPayload): Promise<ApiResult<Wishlist>> {
    return apiClient.post<Wishlist>('/user/wishlists', payload)
  },

  async update(id: string, payload: UpdateWishlistPayload): Promise<ApiResult<Wishlist>> {
    return apiClient.patch<Wishlist>(`/user/wishlists/${id}`, payload)
  },

  async remove(id: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/wishlists/${id}`)
  },

  async duplicate(id: string): Promise<ApiResult<Wishlist>> {
    return apiClient.post<Wishlist>(`/user/wishlists/${id}/duplicate`, {})
  },

  // ============================================
  // Shared With Me
  // ============================================

  async getSharedWithMe(): Promise<ApiResult<SharedWithMeEntry[]>> {
    return apiClient.get<SharedWithMeEntry[]>('/user/wishlists/shared')
  },

  async getByShareToken(token: string): Promise<ApiResult<WishlistDetail>> {
    return apiClient.get<WishlistDetail>(`/user/wishlists/shared/${token}`)
  },

  // ============================================
  // Items
  // ============================================

  async syncCampWishlists(
    campId: string,
    wishlistIds: string[]
  ): Promise<ApiResult<{ added: number; removed: number }>> {
    return apiClient.post<{ added: number; removed: number }>('/user/wishlists/items/sync', {
      campId,
      wishlistIds,
    })
  },

  async addItem(
    wishlistId: string,
    payload: AddWishlistItemPayload
  ): Promise<ApiResult<WishlistItem>> {
    return apiClient.post<WishlistItem>(`/user/wishlists/${wishlistId}/items`, payload)
  },

  async updateItem(
    wishlistId: string,
    itemId: string,
    payload: UpdateWishlistItemPayload
  ): Promise<ApiResult<WishlistItem>> {
    return apiClient.patch<WishlistItem>(`/user/wishlists/${wishlistId}/items/${itemId}`, payload)
  },

  async removeItem(wishlistId: string, itemId: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/wishlists/${wishlistId}/items/${itemId}`)
  },

  // ============================================
  // Sharing
  // ============================================

  async addShare(
    wishlistId: string,
    payload: ShareWishlistPayload
  ): Promise<ApiResult<WishlistShare>> {
    return apiClient.post<WishlistShare>(`/user/wishlists/${wishlistId}/shares`, payload)
  },

  async updateShareRole(
    wishlistId: string,
    shareId: string,
    payload: UpdateShareRolePayload
  ): Promise<ApiResult<WishlistShare>> {
    return apiClient.patch<WishlistShare>(
      `/user/wishlists/${wishlistId}/shares/${shareId}`,
      payload
    )
  },

  async removeShare(wishlistId: string, shareId: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/wishlists/${wishlistId}/shares/${shareId}`)
  },

  async toggleLinkSharing(wishlistId: string, enabled: boolean): Promise<ApiResult<Wishlist>> {
    return apiClient.patch<Wishlist>(`/user/wishlists/${wishlistId}/link-sharing`, { enabled })
  },
}
