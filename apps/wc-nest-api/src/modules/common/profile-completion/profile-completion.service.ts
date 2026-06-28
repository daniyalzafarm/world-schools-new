import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  PROFILE_COMPLETION_JOB_NAME,
  PROFILE_COMPLETION_QUEUE_NAME,
} from './profile-completion.queue'
import type { ProfileCompletionJobData } from './profile-completion.worker'

/**
 * Centralised profile-completeness scoring for the notification spec.
 *
 * Drives the `Parent_Profile_Incomplete` and `Provider_Profile_Incomplete`
 * catalog entries: each is gated on `profileCompletion < INCOMPLETE_THRESHOLD`.
 * The thresholds live alongside the catalog entries — this
 * service just owns the math and the persistence.
 *
 * Recompute pattern: call `recomputeForParent(parentId)` /
 * `recomputeForProvider(providerId)` from each domain service that mutates
 * the relevant fields (Parent CRUD, Provider CRUD, Camp publish, Stripe
 * onboarding completion, etc.). Cheap — a single SELECT + conditional
 * UPDATE per call. Avoids Prisma middleware which would re-run on every
 * write and risk surprise side-effects.
 *
 * Pre-existing `Children.profileCompletion` keeps its inline calc in
 * `ChildrenService.calculateProfileCompletion` — that one is already
 * battle-tested and the child profile-incomplete trigger isn't in the
 * spec, so no consolidation needed.
 */
@Injectable()
export class ProfileCompletionService {
  private readonly logger = new Logger(ProfileCompletionService.name)

  /** Below this score the spec considers the profile incomplete. */
  static readonly INCOMPLETE_THRESHOLD = 50

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PROFILE_COMPLETION_QUEUE_NAME)
    private readonly queue: Queue<ProfileCompletionJobData>
  ) {}

  /**
   * Preferred call from domain endpoints.
   *
   * Enqueues a recompute with `jobId: profile_parent_<id>` so multiple
   * concurrent endpoints touching the same parent collapse to one eventual
   * compute. Never throws; soft-fails to a `logger.warn` so a flaky queue
   * doesn't break the user's save. For per-row sweeps (cron over thousands
   * of rows) keep calling `recomputeForParent` directly — enqueueing per
   * row would explode the queue.
   */
  async enqueueRecomputeForParent(parentId: string): Promise<void> {
    await this.enqueueRecompute('parent', parentId)
  }

  async enqueueRecomputeForProvider(providerId: string): Promise<void> {
    await this.enqueueRecompute('provider', providerId)
  }

  private async enqueueRecompute(kind: 'parent' | 'provider', id: string): Promise<void> {
    try {
      await this.queue.add(
        PROFILE_COMPLETION_JOB_NAME,
        { kind, id },
        // '_' separators, not ':': BullMQ forbids ':' in custom job ids
        // (it throws "Custom Id cannot contain :"). Still deterministic, so
        // concurrent recomputes for the same entity still coalesce.
        { jobId: `profile_${kind}_${id}`, removeOnComplete: true }
      )
    } catch (err) {
      this.logger.warn(
        `enqueueRecompute(${kind}, ${id}) failed: ${err instanceof Error ? err.message : String(err)} — recompute skipped`
      )
    }
  }

  /**
   * Recompute and persist a parent's profile completion.
   *
   * Formula (matches the Children one in spirit — small, weighted, derived
   * from concrete fields the parent edits in their account settings):
   *  - Basic contact (35%): User.firstName + lastName + phone
   *  - Address (15%): User.address + city + country
   *  - Profile photo (10%): User.profilePhotoUrl
   *  - Nationality (15%): Parent.primaryNationality
   *  - Languages (10%): Parent.languages[].length ≥ 1
   *  - At least one child (15%): Children.count ≥ 1
   *
   * Returns the new score; null if the parent row is missing (caller can
   * treat as a no-op — happens when a brand-new sign-up hits this before
   * the Parent row exists).
   */
  async recomputeForParent(parentId: string): Promise<number | null> {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      select: {
        primaryNationality: true,
        languages: true,
        profileCompletion: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            profilePhotoUrl: true,
            address: true,
            city: true,
            country: true,
          },
        },
        _count: { select: { children: { where: { archived: false } } } },
      },
    })
    if (!parent) return null

    let score = 0
    if (parent.user.firstName && parent.user.lastName && parent.user.phone) score += 35
    if (parent.user.address && parent.user.city && parent.user.country) score += 15
    if (parent.user.profilePhotoUrl) score += 10
    if (parent.primaryNationality) score += 15
    if (parent.languages.length > 0) score += 10
    if (parent._count.children > 0) score += 15

    if (score !== parent.profileCompletion) {
      await this.prisma.parent.update({
        where: { id: parentId },
        data: { profileCompletion: score },
      })
    }
    return score
  }

  /**
   * Recompute and persist a provider's profile completion.
   *
   * Formula — heavily weighted toward "would a family booking through World
   * Camps see a credible listing?":
   *  - Basic legal + contact (25%): legalCompanyName + contactFirstName/Last/Email/Phone
   *  - Logo (10%): logoUrl
   *  - Description (15%): description has text
   *  - At least one published camp (30%): Camp.status='published' count ≥ 1
   *  - Stripe connected & charging (20%): stripeChargesEnabled
   */
  async recomputeForProvider(providerId: string): Promise<number | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        legalCompanyName: true,
        contactFirstName: true,
        contactLastName: true,
        contactEmail: true,
        contactPhone: true,
        logoUrl: true,
        description: true,
        stripeChargesEnabled: true,
        profileCompletion: true,
        _count: { select: { camps: { where: { status: 'published' } } } },
      },
    })
    if (!provider) return null

    let score = 0
    if (
      provider.legalCompanyName &&
      provider.contactFirstName &&
      provider.contactLastName &&
      provider.contactEmail &&
      provider.contactPhone
    ) {
      score += 25
    }
    if (provider.logoUrl) score += 10
    if (provider.description && provider.description.trim().length > 0) score += 15
    if (provider._count.camps > 0) score += 30
    if (provider.stripeChargesEnabled) score += 20

    if (score !== provider.profileCompletion) {
      await this.prisma.provider.update({
        where: { id: providerId },
        data: { profileCompletion: score },
      })
    }
    return score
  }
}
