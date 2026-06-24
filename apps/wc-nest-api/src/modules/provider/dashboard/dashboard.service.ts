import { Injectable } from '@nestjs/common'
import { CampsService } from '../camps/camps.service'
import { SessionsService } from '../sessions/sessions.service'
import { OnboardingService } from '../onboarding/services/onboarding.service'
import { GoogleBusinessService } from '../onboarding/services/google-business.service'
import { ProviderReviewsService } from '../reviews/provider-reviews.service'
import { BookingGroupsService } from '../../booking-groups/booking-groups.service'

/**
 * Aggregates the provider dashboard snapshot in a single round-trip, replacing the ~9 client calls
 * (and the per-camp sessions N+1) the dashboard previously fanned out. Purely composes existing
 * provider services — no new business logic beyond server-side live-camp detection.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly campsService: CampsService,
    private readonly sessionsService: SessionsService,
    private readonly onboardingService: OnboardingService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly reviewsService: ProviderReviewsService,
    private readonly bookingGroupsService: BookingGroupsService
  ) {}

  async getSnapshot(providerId: string) {
    const [
      camps,
      statistics,
      onboardingStatus,
      profile,
      legalInfo,
      requests,
      upcoming,
      atCamp,
      past,
      reviews,
    ] = await Promise.all([
      this.campsService.getCamps(providerId),
      this.campsService.getCampStatistics(providerId),
      this.onboardingService.getOnboardingStatus(providerId),
      this.googleBusinessService.getBusinessProfile(providerId),
      this.onboardingService.getProviderLegalInfo(providerId),
      this.bookingGroupsService.listForProvider(providerId, { tab: 'requests', limit: 20 }),
      this.bookingGroupsService.listForProvider(providerId, { tab: 'upcoming', limit: 20 }),
      this.bookingGroupsService.listForProvider(providerId, { tab: 'at-camp', limit: 10 }),
      this.bookingGroupsService.listForProvider(providerId, { tab: 'past', limit: 10 }),
      this.reviewsService.listForProvider(providerId, { status: 'published', limit: 5 }),
    ])

    // All sessions across the provider's camps (server-side, replacing the frontend N+1).
    const sessionResults = await Promise.all(
      camps.map(camp => this.sessionsService.getFixedSessions(camp.id, providerId))
    )
    const sessions = sessionResults.flatMap(result => result.sessions)

    // Live camp: a published session currently running (now within [startDate, endDate]).
    const now = Date.now()
    const liveSession = sessions.find(
      (s: any) =>
        s.status === 'published' &&
        s.startDate != null &&
        s.endDate != null &&
        new Date(s.startDate).getTime() <= now &&
        new Date(s.endDate).getTime() >= now
    )
    const liveCamp = liveSession
      ? (camps.find(camp => camp.id === (liveSession as any).campId) ?? null)
      : null

    const businessProfile = { ...(profile ?? {}), legalInfo }
    const businessName = legalInfo?.legalCompanyName ?? (profile as any)?.businessName ?? null

    return {
      businessName,
      camps,
      statistics,
      sessions,
      bookingRequests: requests.data ?? [],
      upcomingBookings: upcoming.data ?? [],
      atCampBookings: atCamp.data ?? [],
      pastBookings: past.data ?? [],
      onboardingStatus,
      businessProfile,
      liveCamp,
      recentReviews: reviews.data ?? [],
      reviewsMeta: reviews.meta ?? { total: 0, unresponded: 0 },
    }
  }
}
