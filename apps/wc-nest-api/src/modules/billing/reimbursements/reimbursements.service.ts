import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { ReimbursementStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class ReimbursementsService {
  private readonly logger = new Logger(ReimbursementsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a Reimbursement row when a refund was issued post-`transferDate`
   * (the platform absorbed the debit under Accounts v2 `losses.payments=
   * 'application'`). The 7-day deadline mirrors the spec's Part D obligation.
   *
   * Idempotent — if a Reimbursement already exists for the (refundId), return it.
   *
   * Accepts an optional `tx` so the caller can run this inside the same
   * transaction as the Refund insert. Previously the
   * Refund row was created in a transaction but `createIfNeeded` ran outside,
   * meaning a DB blip on this call left the Refund row with
   * `requiresReimbursement=true` but no Reimbursement to track it. Caller
   * now passes the tx client so both writes commit or roll back together.
   */
  async createIfNeeded(
    input: {
      bookingGroupId: string
      refundId: string
      amountOwed: Prisma.Decimal | string
      currency: string
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? this.prisma
    const existing = await client.reimbursement.findFirst({
      where: { refundId: input.refundId },
    })
    if (existing) return existing

    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    return client.reimbursement.create({
      data: {
        bookingGroupId: input.bookingGroupId,
        refundId: input.refundId,
        amountOwed:
          input.amountOwed instanceof Prisma.Decimal
            ? input.amountOwed
            : new Prisma.Decimal(input.amountOwed),
        currency: input.currency,
        dueDate,
        status: ReimbursementStatus.pending,
      },
    })
  }

  /**
   * Marks a Reimbursement as settled by an admin (deduction from next payout
   * or direct bank transfer received). Idempotent — re-settling has no effect.
   */
  async markSettled(input: { reimbursementId: string; adminUserId: string }) {
    const row = await this.prisma.reimbursement.findUnique({
      where: { id: input.reimbursementId },
    })
    if (!row) throw new NotFoundException(`Reimbursement ${input.reimbursementId} not found`)
    if (row.status === ReimbursementStatus.settled) return row

    return this.prisma.reimbursement.update({
      where: { id: row.id },
      data: {
        status: ReimbursementStatus.settled,
        settledAt: new Date(),
        settledByUserId: input.adminUserId,
      },
    })
  }

  /**
   * Used by the daily reminder cron — finds overdue reimbursements that have
   * not been reminded recently. The cron sends emails; this method only
   * surfaces the candidates and stamps `lastReminderSentAt` on success.
   */
  async findOverdueForReminder(now: Date = new Date()) {
    const reminderCooloffMs = 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - reminderCooloffMs)
    return this.prisma.reimbursement.findMany({
      where: {
        status: ReimbursementStatus.pending,
        dueDate: { lt: now },
        OR: [{ lastReminderSentAt: null }, { lastReminderSentAt: { lt: cutoff } }],
      },
      include: { bookingGroup: { include: { provider: { include: { owner: true } } } } },
      take: 100,
    })
  }

  async stampReminderSent(reimbursementId: string): Promise<void> {
    await this.prisma.reimbursement.update({
      where: { id: reimbursementId },
      data: { lastReminderSentAt: new Date() },
    })
  }

  /**
   * Admin list — paginated. Filterable by status (single value or array).
   * Returns rows joined with the BookingGroup + provider for the admin UI
   * to render context (camp name, parent name, owed amount, due date,
   * "overdue" indicator computed client-side from dueDate).
   *
   * Default ordering is `dueDate ASC` so the admin sees the oldest pending
   * obligation at the top of the list.
   */
  async listForAdmin(input: {
    status?: ReimbursementStatus | ReimbursementStatus[]
    limit?: number
    offset?: number
  }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
    const offset = Math.max(input.offset ?? 0, 0)
    const statusFilter = Array.isArray(input.status)
      ? { in: input.status }
      : input.status
        ? { equals: input.status }
        : undefined

    const where = statusFilter ? { status: statusFilter } : {}

    const [rows, total] = await Promise.all([
      this.prisma.reimbursement.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
        include: {
          bookingGroup: {
            select: {
              id: true,
              bookingGroupNumber: true,
              status: true,
              camp: { select: { id: true, name: true } },
              parent: {
                select: {
                  user: { select: { firstName: true, lastName: true, email: true } },
                },
              },
              provider: { select: { id: true, legalCompanyName: true } },
            },
          },
          refund: {
            select: { id: true, reason: true, amount: true, succeededAt: true },
          },
        },
      }),
      this.prisma.reimbursement.count({ where }),
    ])
    return { rows, total, limit, offset }
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.reimbursement.findUnique({
      where: { id },
      include: {
        bookingGroup: {
          select: {
            id: true,
            bookingGroupNumber: true,
            status: true,
            camp: { select: { id: true, name: true } },
            parent: {
              select: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
            provider: { select: { id: true, legalCompanyName: true } },
          },
        },
        refund: { select: { id: true, reason: true, amount: true, succeededAt: true } },
      },
    })
  }

  /**
   * Admin write-off — for genuinely uncollectable reimbursements (e.g.
   * provider out of business). Final terminal state; no further reminders
   * will fire.
   */
  async writeOff(input: { reimbursementId: string; adminUserId: string }) {
    const row = await this.prisma.reimbursement.findUnique({
      where: { id: input.reimbursementId },
    })
    if (!row) throw new NotFoundException(`Reimbursement ${input.reimbursementId} not found`)
    if (row.status === ReimbursementStatus.written_off) return row

    return this.prisma.reimbursement.update({
      where: { id: row.id },
      data: {
        status: ReimbursementStatus.written_off,
        settledAt: new Date(),
        settledByUserId: input.adminUserId,
      },
    })
  }
}
