'use client'

import { useEffect, useState } from 'react'
import type { ConversationResponseDto } from '@world-schools/wc-frontend-utils'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { getCampBySlug, searchCamps } from '@/services/camps.services'
import type { ParentBookingGroupDetail, ParentBookingGroupStatus } from '@/types/camp-booking'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'

/**
 * Which design state the right context panel should render for the active
 * conversation, derived from the parent's booking status with the camp.
 */
export type PanelBookingState =
  | 'request-pending'
  | 'confirmed' // accepted / deposit_paid — partial payment, balance may be due
  | 'confirmed-paid' // fully_paid
  | 'at-camp'
  | 'past' // completed
  | 'cancelled' // cancelled / declined / expired

/**
 * Camp detail-card data shared by every panel state, sourced (like the camp
 * profile page) from `getCampBySlug`: "City, Country" from the linked Google
 * Business Profile, plus the app review aggregate and the Google rating.
 */
export interface CampCardData {
  name: string
  photoUrl: string | null
  locationLabel: string | null
  appRating: number | null
  appReviewCount: number
  googleRating: number | null
  googleReviewCount: number
  googleReviewsUrl: string | null
}

export interface InquiryCampData {
  card: CampCardData
  /** Average response time in minutes, enriched on the conversation. */
  avgResponseTimeMinutes: number | null
  sessions: Session[]
  currency: string | null
  slug: string | null
}

export type ConversationContext =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'inquiry'; data: InquiryCampData }
  | {
      kind: 'booking'
      state: PanelBookingState
      detail: ParentBookingGroupDetail
      card: CampCardData
    }

function statusToPanelState(status: ParentBookingGroupStatus): PanelBookingState | null {
  switch (status) {
    case 'request':
      return 'request-pending'
    case 'accepted':
    case 'deposit_paid':
      return 'confirmed'
    case 'fully_paid':
      return 'confirmed-paid'
    case 'at_camp':
      return 'at-camp'
    case 'completed':
      return 'past'
    case 'cancelled':
    case 'declined':
    case 'expired':
      return 'cancelled'
    // `draft` has no submitted booking — treated as inquiry (no match).
    default:
      return null
  }
}

/** "City, Country" from the linked GBP, falling back to the camp's own location. */
function formatCityCountry(camp: Camp): string | null {
  const gbp = camp.provider?.googleBusinessProfile
  const cityCountry = [gbp?.city, gbp?.country].filter(Boolean).join(', ')
  return cityCountry || camp.locationName || camp.locationAddress || null
}

/** Build the shared camp card from a full `getCampBySlug` camp. Photo is passed
 * through from the per-state source already known to resolve (cover image /
 * conversation avatar). */
function buildCampCard(camp: Camp, photoUrl: string | null): CampCardData {
  const gbp = camp.provider?.googleBusinessProfile
  return {
    name: camp.name,
    photoUrl,
    locationLabel: formatCityCountry(camp),
    appRating: camp.overallRating ?? null,
    appReviewCount: camp.totalReviews ?? 0,
    googleRating: gbp?.rating != null ? Number(gbp.rating) : null,
    googleReviewCount: gbp?.reviewsCount ?? 0,
    googleReviewsUrl: gbp?.placeId
      ? `https://search.google.com/local/reviews?placeid=${gbp.placeId}`
      : null,
  }
}

/**
 * Resolves the data backing the messaging context panel for the active
 * conversation. A camp-context conversation either maps to one of the parent's
 * bookings with that camp (booking state) or, when none exists, to the camp's
 * public profile + available sessions (inquiry state). Non-camp conversations
 * (e.g. superadmin support) resolve to `none` so the panel stays hidden.
 *
 * The camp detail card (location + ratings) is sourced from `getCampBySlug` —
 * the same source the camp profile page uses — so it carries the GBP
 * "City, Country" and both the app and Google ratings.
 */
export function useConversationContext(
  conversation: ConversationResponseDto | null
): ConversationContext {
  const campId =
    conversation?.contextType === 'CAMP' && conversation?.contextId ? conversation.contextId : null
  const campName = conversation?.campName ?? null

  const [context, setContext] = useState<ConversationContext>({ kind: 'loading' })

  useEffect(() => {
    if (!conversation) {
      setContext({ kind: 'none' })
      return
    }
    if (!campId) {
      // Not a camp conversation (support, general) — no context to show.
      setContext({ kind: 'none' })
      return
    }

    let cancelled = false
    setContext({ kind: 'loading' })

    const resolve = async () => {
      // 1) Resolve the parent's primary booking with this camp in a single call.
      //    The server returns the full detail (or null) for the most relevant
      //    non-draft booking.
      const bookingRes = await bookingGroupsService.getByCamp(campId)
      if (cancelled) return
      if (bookingRes.success && bookingRes.data) {
        const detail = bookingRes.data
        const state = statusToPanelState(detail.status)
        if (state) {
          // Enrich the card (City/Country + ratings) from the public camp; fall
          // back to the booking's own camp fields if that lookup fails.
          let card: CampCardData = {
            name: detail.camp.name,
            photoUrl: detail.camp.coverImageUrl,
            locationLabel: detail.camp.locationName ?? detail.camp.locationAddress ?? null,
            appRating: null,
            appReviewCount: 0,
            googleRating: null,
            googleReviewCount: 0,
            googleReviewsUrl: null,
          }
          try {
            const camp = await getCampBySlug(detail.camp.slug)
            if (cancelled) return
            card = buildCampCard(camp, detail.camp.coverImageUrl)
          } catch {
            // keep fallback card
          }
          if (cancelled) return
          setContext({ kind: 'booking', state, detail, card })
          return
        }
        // Unmapped status (e.g. a billing edge state) — fall through to inquiry.
      }

      // 2) No booking — inquiry view. The conversation has the campId but not the
      //    slug, so resolve the slug via search, then load the full camp.
      const fallbackCard: CampCardData = {
        name: campName ?? 'Camp',
        photoUrl: conversation.campPhotoUrl ?? null,
        locationLabel: conversation.campLocation ?? null,
        appRating: null,
        appReviewCount: 0,
        googleRating: null,
        googleReviewCount: 0,
        googleReviewsUrl: null,
      }

      let camp: Camp | null = null
      try {
        const matches = campName ? await searchCamps(campName) : []
        if (cancelled) return
        const slug = matches.find(c => c.id === campId)?.slug
        if (slug) {
          camp = await getCampBySlug(slug)
          if (cancelled) return
        }
      } catch {
        // keep fallback
      }
      if (cancelled) return

      setContext({
        kind: 'inquiry',
        data: {
          card: camp ? buildCampCard(camp, conversation.campPhotoUrl ?? null) : fallbackCard,
          avgResponseTimeMinutes: conversation.avgResponseTime ?? null,
          sessions: camp?.sessions ?? [],
          currency: camp?.provider?.settings?.currency ?? null,
          slug: camp?.slug ?? null,
        },
      })
    }

    void resolve().catch(() => {
      if (!cancelled) setContext({ kind: 'none' })
    })

    return () => {
      cancelled = true
    }
    // Re-resolve when the conversation (camp) changes.
  }, [conversation, campId, campName])

  return context
}
