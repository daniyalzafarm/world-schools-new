import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ProviderReviewStatus, ProviderSuspensionCategory } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'

export interface EnqueueReviewInput {
  providerId: string
  suspensionType: ProviderSuspensionCategory
  reasonText: string
  affectedListingIds?: string[]
  affectedBookingCount?: number
  initiatingRefundId?: string | null
}

export interface ResolveReviewInput {
  reviewedByUserId: string
  status: ProviderReviewStatus
  decision?: string
  decisionNotes?: string
}

/**
 * Admin review queue for provider-level trust actions (Payments revamp, Spec
 * v2.3 §4). Provider cancellations and other risk signals route HERE rather
 * than auto-suspending the provider — a human triages. The queue is the single
 * source of truth for "which providers need a look and why".
 */
@Injectable()
export class ProviderAdminReviewQueueService {
  private readonly logger = new Logger(ProviderAdminReviewQueueService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Open a review for a provider. Idempotent per (provider, suspensionType):
   * if an OPEN row (pending / under_review) already exists for that pair we
   * return it instead of stacking duplicates — repeated cancellations by the
   * same provider collapse into one open review until an admin resolves it.
   */
  async enqueue(input: EnqueueReviewInput) {
    const existing = await this.prisma.providerAdminReviewQueue.findFirst({
      where: {
        providerId: input.providerId,
        suspensionType: input.suspensionType,
        status: { in: [ProviderReviewStatus.pending, ProviderReviewStatus.under_review] },
      },
    })
    if (existing) {
      // Keep the open review fresh: bump the affected-booking tally so the
      // admin sees the cumulative impact.
      if (input.affectedBookingCount) {
        return this.prisma.providerAdminReviewQueue.update({
          where: { id: existing.id },
          data: {
            affectedBookingCount: existing.affectedBookingCount + input.affectedBookingCount,
          },
        })
      }
      return existing
    }
    return this.prisma.providerAdminReviewQueue.create({
      data: {
        providerId: input.providerId,
        suspensionType: input.suspensionType,
        status: ProviderReviewStatus.pending,
        reasonText: input.reasonText,
        affectedListingIds: input.affectedListingIds ?? undefined,
        affectedBookingCount: input.affectedBookingCount ?? 0,
        initiatingRefundId: input.initiatingRefundId ?? null,
      },
    })
  }

  /** Best-effort enqueue — never throws to the caller (used after a refund commits). */
  async enqueueSafe(input: EnqueueReviewInput): Promise<void> {
    try {
      await this.enqueue(input)
    } catch (err) {
      this.logger.error(
        `enqueue review failed (provider ${input.providerId}, ${input.suspensionType}): ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  async list(filter: { status?: ProviderReviewStatus; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100)
    const offset = Math.max(filter.offset ?? 0, 0)
    const where = filter.status ? { status: filter.status } : {}
    const [rows, total] = await Promise.all([
      this.prisma.providerAdminReviewQueue.findMany({
        where,
        include: {
          provider: { select: { id: true, legalCompanyName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.providerAdminReviewQueue.count({ where }),
    ])
    return { rows, total, limit, offset }
  }

  async getById(id: string) {
    const row = await this.prisma.providerAdminReviewQueue.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, legalCompanyName: true, email: true } },
      },
    })
    if (!row) throw new NotFoundException(`Provider review ${id} not found`)
    return row
  }

  /**
   * Triage / resolve a review. `under_review` records that an admin picked it
   * up; `resolved` closes it with a decision + notes. Resolving an already
   * resolved row is rejected so an audit trail isn't silently overwritten.
   */
  async resolve(id: string, input: ResolveReviewInput) {
    const row = await this.getById(id)
    if (row.status === ProviderReviewStatus.resolved) {
      throw new BadRequestException(`Provider review ${id} is already resolved`)
    }
    return this.prisma.providerAdminReviewQueue.update({
      where: { id },
      data: {
        status: input.status,
        reviewedAt: input.status === ProviderReviewStatus.resolved ? new Date() : row.reviewedAt,
        reviewedByUserId: input.reviewedByUserId,
        decision: input.decision ?? row.decision,
        decisionNotes: input.decisionNotes ?? row.decisionNotes,
      },
    })
  }
}
