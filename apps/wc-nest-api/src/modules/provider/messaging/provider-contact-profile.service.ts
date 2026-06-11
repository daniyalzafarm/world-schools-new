import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConversationsService } from '../../messaging/services/conversations.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'
import { BookingGroupStatus } from '../../../generated/client/enums'

/**
 * Booking statuses that count as a real (non-draft, non-terminal-negative)
 * relationship with the provider — used to flag a parent as "returning".
 */
const RETURNING_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.accepted,
  BookingGroupStatus.deposit_paid,
  BookingGroupStatus.fully_paid,
  BookingGroupStatus.at_camp,
  BookingGroupStatus.completed,
]

/**
 * Contact profile shown in the provider messaging right panel — the parent the
 * provider is chatting with. Shape is mirrored by the wc-provider frontend's
 * `ProviderContactProfile` type; keep the two in sync.
 */
export interface ProviderContactProfile {
  /** The conversation subject, e.g. "Asking about the French program". */
  inquirySummary: string | null
  campName: string | null
  isReturning: boolean
  user: {
    firstName: string | null
    lastName: string | null
    profilePhotoUrl: string | null
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

@Injectable()
export class ProviderContactProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly profilePhotos: ProfilePhotoService
  ) {}

  /** Resolve a stored profile-photo blob path to a usable (SAS) URL. */
  private async resolvePhotoUrl(blobPath: string | null): Promise<string | null> {
    if (!blobPath) return null
    if (/^https?:\/\//i.test(blobPath)) return blobPath
    return this.profilePhotos.generatePhotoUrl(blobPath)
  }

  /**
   * Build the contact profile for the parent in a provider↔parent conversation.
   * Returns null for non-`USER_PROVIDER` conversations (e.g. support) so the
   * frontend hides the panel. Access is gated by `ConversationAccessGuard` on
   * the controller, so the provider is already a verified participant here.
   */
  async getForProvider(
    currentUserId: string,
    providerId: string | null | undefined,
    conversationId: string
  ): Promise<ProviderContactProfile | null> {
    const conversation = await this.conversations.getConversationById(conversationId, currentUserId)
    if (conversation?.type !== 'USER_PROVIDER') return null

    // The parent participant is the one without a providerId.
    const parentUserId = conversation.participants?.find(p => p.userId && !p.providerId)?.userId
    if (!parentUserId) return null

    const [user, parent] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: parentUserId },
        select: {
          firstName: true,
          lastName: true,
          profilePhotoUrl: true,
          city: true,
          country: true,
        },
      }),
      this.prisma.parent.findUnique({
        where: { userId: parentUserId },
        select: {
          id: true,
          primaryNationality: true,
          languages: true,
          children: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              languages: true,
            },
          },
        },
      }),
    ])
    if (!user) return null

    let isReturning = false
    let reviewOfProvider: ProviderContactProfile['reviewOfProvider'] = null

    if (parent && providerId) {
      const [returningCount, review] = await Promise.all([
        this.prisma.bookingGroup.count({
          where: { parentId: parent.id, providerId, status: { in: RETURNING_STATUSES } },
        }),
        this.prisma.campReview.findFirst({
          where: { parentId: parent.id, status: 'published', camp: { providerId } },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            reviewText: true,
            publishedAt: true,
            happinessRating: true,
            safetyRating: true,
            communicationRating: true,
            asDescribedRating: true,
            growthRating: true,
            valueRating: true,
            camp: { select: { name: true } },
          },
        }),
      ])

      isReturning = returningCount > 0

      if (review) {
        const ratings = [
          review.happinessRating,
          review.safetyRating,
          review.communicationRating,
          review.asDescribedRating,
          review.growthRating,
          review.valueRating,
        ].filter((v): v is number => typeof v === 'number')
        const averageRating =
          ratings.length > 0
            ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
            : 0
        reviewOfProvider = {
          averageRating,
          reviewText: review.reviewText,
          publishedAt: review.publishedAt?.toISOString() ?? null,
          campName: review.camp.name,
        }
      }
    }

    return {
      inquirySummary: conversation.subject ?? null,
      campName: (conversation as { campName?: string | null }).campName ?? null,
      isReturning,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: await this.resolvePhotoUrl(user.profilePhotoUrl),
        city: user.city,
        country: user.country,
      },
      nationality: parent?.primaryNationality ?? null,
      languages: parent?.languages ?? [],
      children: (parent?.children ?? []).map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        dateOfBirth: c.dateOfBirth?.toISOString() ?? null,
        gender: c.gender,
        languages: c.languages ?? [],
      })),
      reviewOfProvider,
    }
  }
}
