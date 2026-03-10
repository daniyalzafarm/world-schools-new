import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class SupportTicketSlaService {
  private readonly logger = new Logger(SupportTicketSlaService.name)
  private readonly timeZone = 'Europe/Zurich'
  private readonly businessStartHour = 9
  private readonly businessEndHour = 18

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute initial SLA targets (first response + resolution) in Europe/Zurich business time.
   */
  async getInitialTargets(
    tx: Prisma.TransactionClient,
    createdAt: Date,
    slaPolicyId: string | null
  ): Promise<{ firstResponseDueAt: Date | null; resolutionDueAt: Date | null }> {
    if (!slaPolicyId) {
      return { firstResponseDueAt: null, resolutionDueAt: null }
    }

    const policy = await tx.supportTicketSlaPolicy.findUnique({
      where: { id: slaPolicyId },
    })

    if (!policy) {
      this.logger.warn(`SLA policy ${slaPolicyId} not found; skipping SLA targets`)
      return { firstResponseDueAt: null, resolutionDueAt: null }
    }

    const firstResponseDueAt = this.addBusinessMinutes(createdAt, policy.firstResponseTargetMinutes)
    const resolutionDueAt = this.addBusinessMinutes(createdAt, policy.resolutionTargetMinutes)

    return { firstResponseDueAt, resolutionDueAt }
  }

  /**
   * Utility: convert a UTC Date to a Date that represents the same local time in Europe/Zurich.
   */
  toZurichDate(date: Date): Date {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = fmt.formatToParts(date).reduce(
      (acc, part) => {
        if (part.type !== 'literal') {
          acc[part.type] = parseInt(part.value, 10)
        }
        return acc
      },
      {} as Record<string, number>
    )

    const year = parts.year
    const month = parts.month
    const day = parts.day
    const hour = parts.hour ?? 0
    const minute = parts.minute ?? 0
    const second = parts.second ?? 0

    return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  }

  /**
   * Add minutes in Europe/Zurich business hours (Mon–Fri, 09:00–18:00).
   */
  private addBusinessMinutes(start: Date, minutes: number): Date {
    if (!minutes || minutes <= 0) {
      return start
    }

    let local = this.toZurichDate(start)
    let remaining = minutes

    while (remaining > 0) {
      // Move to next business day if weekend
      const day = local.getUTCDay() // 0=Sun, 6=Sat
      if (day === 0 || day === 6) {
        // Move to Monday 09:00
        const daysToAdd = day === 0 ? 1 : 2
        local = new Date(
          Date.UTC(
            local.getUTCFullYear(),
            local.getUTCMonth(),
            local.getUTCDate() + daysToAdd,
            this.businessStartHour,
            0,
            0
          )
        )
        continue
      }

      const currentMinutes = local.getUTCHours() * 60 + local.getUTCMinutes()
      const startMinutes = this.businessStartHour * 60
      const endMinutes = this.businessEndHour * 60

      if (currentMinutes < startMinutes) {
        // Before business hours: jump to start of day
        local = new Date(
          Date.UTC(
            local.getUTCFullYear(),
            local.getUTCMonth(),
            local.getUTCDate(),
            this.businessStartHour,
            0,
            0
          )
        )
      } else if (currentMinutes >= endMinutes) {
        // After business hours: move to next day 09:00
        local = new Date(
          Date.UTC(
            local.getUTCFullYear(),
            local.getUTCMonth(),
            local.getUTCDate() + 1,
            this.businessStartHour,
            0,
            0
          )
        )
        continue
      }

      const minutesUntilEndOfDay = endMinutes - (local.getUTCHours() * 60 + local.getUTCMinutes())
      const minutesToAdd = Math.min(remaining, minutesUntilEndOfDay)

      local = new Date(local.getTime() + minutesToAdd * 60 * 1000)
      remaining -= minutesToAdd

      if (remaining <= 0) {
        break
      }

      // Move to next business day at start hour
      local = new Date(
        Date.UTC(
          local.getUTCFullYear(),
          local.getUTCMonth(),
          local.getUTCDate() + 1,
          this.businessStartHour,
          0,
          0
        )
      )
    }

    // Convert back to a real UTC timestamp (local time mapping is already accounted for)
    return new Date(local.getTime())
  }
}
