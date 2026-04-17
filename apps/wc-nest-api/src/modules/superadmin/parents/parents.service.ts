import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { BookingGroupStatus } from '../../../generated/client/enums'
import type { GetParentsQueryDto } from './dto/get-parents-query.dto'

const INACTIVE_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.cancelled,
  BookingGroupStatus.declined,
  BookingGroupStatus.expired,
  BookingGroupStatus.draft,
]

@Injectable()
export class SuperAdminParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetParentsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Each filter is an independent condition pushed to AND array to avoid
    // accidental key overwrites (e.g. two separate `user` conditions merging badly)
    const conditions: any[] = []

    if (query.search) {
      conditions.push({
        user: {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      })
    }

    if (query.country) {
      conditions.push({
        user: { primaryNationality: { contains: query.country, mode: 'insensitive' } },
      })
    }

    // Tab filters mirror the status derivation logic exactly so counts are consistent
    if (query.tab === 'active') {
      conditions.push({ OR: [{ bookings: { some: {} } }, { user: { emailVerified: true } }] })
    } else if (query.tab === 'with_bookings') {
      conditions.push({ bookings: { some: {} } })
    } else if (query.tab === 'new_this_month') {
      conditions.push({
        AND: [
          { bookings: { none: {} } },
          { user: { emailVerified: false } },
          { createdAt: { gte: startOfMonth } },
        ],
      })
    } else if (query.tab === 'inactive') {
      conditions.push({
        AND: [
          { bookings: { none: {} } },
          { user: { emailVerified: false } },
          { createdAt: { lt: startOfMonth } },
        ],
      })
    }

    const where = conditions.length > 0 ? { AND: conditions } : {}

    const total = await this.prisma.parent.count({ where })

    // Fetch only the parent + user + children rows — no booking records in memory
    const parents = await this.prisma.parent.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true, emailVerified: true } },
        children: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    if (parents.length === 0) {
      return { data: [], page, limit, total, totalPages: Math.ceil(total / limit) }
    }

    const parentIds = parents.map(p => p.id)

    // DB-level GROUP BY: total active bookings + sum of spend per parent
    const bookingTotals = await this.prisma.booking.groupBy({
      by: ['parentId'],
      where: {
        parentId: { in: parentIds },
        bookingGroup: { status: { notIn: INACTIVE_STATUSES } },
      },
      _count: true,
      _sum: { totalPrice: true },
    })

    // DB-level GROUP BY: upcoming bookings (startDate in the future) per parent
    const upcomingTotals = await this.prisma.booking.groupBy({
      by: ['parentId'],
      where: {
        parentId: { in: parentIds },
        startDate: { gt: now },
        bookingGroup: { status: { notIn: INACTIVE_STATUSES } },
      },
      _count: true,
    })

    const bookingMap = new Map(bookingTotals.map(r => [r.parentId, r]))
    const upcomingMap = new Map(upcomingTotals.map(r => [r.parentId, r]))

    const data = parents.map(parent => {
      const booking = bookingMap.get(parent.id)
      const bookingCount = booking?._count ?? 0
      const upcomingBookingCount = upcomingMap.get(parent.id)?._count ?? 0
      const totalSpent = Number(booking?._sum.totalPrice ?? 0)
      const avgSpent = bookingCount > 0 ? totalSpent / bookingCount : 0

      let status: 'active' | 'inactive' | 'new'
      if (bookingCount > 0 || parent.user.emailVerified) {
        status = 'active'
      } else if (parent.createdAt >= startOfMonth) {
        status = 'new'
      } else {
        status = 'inactive'
      }

      return {
        id: parent.id,
        firstName: parent.user.firstName ?? '',
        lastName: parent.user.lastName ?? '',
        email: parent.user.email,
        children: parent.children.map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName ?? undefined,
          dateOfBirth: c.dateOfBirth?.toISOString() ?? undefined,
        })),
        bookingCount,
        upcomingBookingCount,
        totalSpent,
        avgSpent,
        status,
        joinedAt: parent.createdAt.toISOString(),
      }
    })

    return { data, page, limit, total, totalPages: Math.ceil(total / limit) }
  }

  async getStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalParents,
      childrenRegistered,
      activeCount,
      withBookingsCount,
      newThisMonthCount,
      inactiveCount,
    ] = await Promise.all([
      this.prisma.parent.count(),
      this.prisma.children.count(),
      this.prisma.parent.count({
        where: { OR: [{ bookings: { some: {} } }, { user: { emailVerified: true } }] },
      }),
      this.prisma.parent.count({ where: { bookings: { some: {} } } }),
      this.prisma.parent.count({
        where: {
          AND: [
            { bookings: { none: {} } },
            { user: { emailVerified: false } },
            { createdAt: { gte: startOfMonth } },
          ],
        },
      }),
      this.prisma.parent.count({
        where: {
          AND: [
            { bookings: { none: {} } },
            { user: { emailVerified: false } },
            { createdAt: { lt: startOfMonth } },
          ],
        },
      }),
    ])

    // Repeat booking rate: % of parents who have made ≥2 distinct active booking groups
    const parentsWithRepeatBookings = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT p.id) as count
      FROM parents p
      WHERE (
        SELECT COUNT(DISTINCT bg.id)
        FROM booking_groups bg
        WHERE bg.parent_id = p.id
          AND bg.status NOT IN ('cancelled', 'declined', 'expired', 'draft')
      ) >= 2
    `
    const repeatCount = Number(parentsWithRepeatBookings[0]?.count ?? 0)
    const repeatBookingRate = totalParents > 0 ? Math.round((repeatCount / totalParents) * 100) : 0

    const avgChildrenPerParent =
      totalParents > 0 ? Math.round((childrenRegistered / totalParents) * 100) / 100 : 0

    return {
      totalParents,
      childrenRegistered,
      avgChildrenPerParent,
      repeatBookingRate,
      activeCount,
      withBookingsCount,
      newThisMonthCount,
      inactiveCount,
    }
  }
}
