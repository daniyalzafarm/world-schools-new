import apiClient from '@/utils/api-client'
import type {
  AddDiscountEntryDto,
  GlobalDiscount,
  GlobalDiscountResponse,
  GlobalDiscountsResponse,
  UpdateDiscountEntryDto,
  UpdateGlobalDiscountDto,
} from '@/types/discounts'

const BASE_PATH = '/provider/camps'

/**
 * Get all global discounts for a camp
 */
export async function getGlobalDiscounts(campId: string): Promise<GlobalDiscount[]> {
  const response = await apiClient.get<GlobalDiscount[]>(`${BASE_PATH}/${campId}/discounts`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount[]
}

/**
 * Create a new global discount (lazy creation)
 * Creates discount with empty entries array - entries added via addDiscountEntry
 */
export async function createGlobalDiscount(
  campId: string,
  category: string,
  sortOrder: number
): Promise<GlobalDiscount> {
  const response = await apiClient.post<GlobalDiscount>(`${BASE_PATH}/${campId}/discounts`, {
    category,
    sortOrder,
  })
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount
}

/**
 * Update a global discount (enable/disable, reorder, or update entries)
 */
export async function updateGlobalDiscount(
  campId: string,
  discountId: string,
  data: UpdateGlobalDiscountDto
): Promise<GlobalDiscount> {
  const response = await apiClient.put<GlobalDiscount>(
    `${BASE_PATH}/${campId}/discounts/${discountId}`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount
}

/**
 * Add a new entry to a global discount
 */
export async function addDiscountEntry(
  campId: string,
  discountId: string,
  data: AddDiscountEntryDto
): Promise<GlobalDiscount> {
  const response = await apiClient.post<GlobalDiscount>(
    `${BASE_PATH}/${campId}/discounts/${discountId}/entries`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount
}

/**
 * Update an existing discount entry
 */
export async function updateDiscountEntry(
  campId: string,
  discountId: string,
  entryId: string,
  data: UpdateDiscountEntryDto
): Promise<GlobalDiscount> {
  const response = await apiClient.put<GlobalDiscount>(
    `${BASE_PATH}/${campId}/discounts/${discountId}/entries/${entryId}`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount
}

/**
 * Remove a discount entry
 */
export async function removeDiscountEntry(
  campId: string,
  discountId: string,
  entryId: string
): Promise<GlobalDiscount> {
  const response = await apiClient.del<GlobalDiscount>(
    `${BASE_PATH}/${campId}/discounts/${discountId}/entries/${entryId}`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as GlobalDiscount
}
