import apiClient from '@/utils/api-client'

/**
 * Contact profile for the parent in a provider↔parent conversation, shown in
 * the messaging right-hand panel. Mirrors the backend
 * `ProviderContactProfile` (provider-contact-profile.service.ts) — keep in sync.
 */
export interface ProviderContactProfile {
  campName: string | null
  isReturning: boolean
  user: {
    firstName: string | null
    lastName: string | null
    profilePhotoUrl: string | null
    bio: string | null
    city: string | null
    /** ISO 3166-1 alpha-2 country code. */
    country: string | null
  }
  /** Parent's primary nationality — ISO 3166-1 alpha-2 code. */
  nationality: string | null
  /** Spoken languages — ISO 639-1 codes. */
  languages: string[]
  children: Array<{
    id: string
    firstName: string
    lastName: string | null
    dateOfBirth: string | null
    gender: string | null
    languages: string[]
  }>
  reviewOfProvider: {
    averageRating: number
    reviewText: string | null
    publishedAt: string | null
    campName: string
  } | null
}

/**
 * Fetch the contact profile for a conversation. Returns null for non
 * provider↔parent conversations (e.g. support) or on failure.
 */
export async function getContactProfile(
  conversationId: string
): Promise<ProviderContactProfile | null> {
  const res = await apiClient.get<ProviderContactProfile | null>(
    `provider/messaging/conversations/${conversationId}/contact-profile`
  )
  if (!res.success) return null
  // apiClient unwraps the `{ success, data }` envelope; tolerate a double-wrap.
  const payload = res.data as ProviderContactProfile | { data?: ProviderContactProfile } | null
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: ProviderContactProfile }).data ?? null
  }
  return (payload as ProviderContactProfile | null) ?? null
}
