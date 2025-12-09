import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class SuperAdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    page?: number
    limit?: number
    search?: string
    roleId?: string
    emailVerified?: boolean
    createdAfter?: Date
    createdBefore?: Date
  }) {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      roles: {
        some: {
          role: {
            // Only include users with SuperAdmin role or custom superadmin roles
            // Exclude users with only Provider Admin or Parent roles
            name: {
              notIn: ['Provider Admin', 'Parent'],
            },
            providerId: null, // Only system-wide roles
          },
        },
      },
    }

    // Add search filter (search in email, first name, last name)
    if (params?.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    // Add role filter
    if (params?.roleId) {
      where.roles = {
        some: {
          roleId: params.roleId,
        },
      }
    }

    // Add email verified filter
    if (params?.emailVerified !== undefined) {
      where.emailVerified = params.emailVerified
    }

    // Add date range filters
    if (params?.createdAfter || params?.createdBefore) {
      where.createdAt = {}
      if (params.createdAfter) {
        where.createdAt.gte = params.createdAfter
      }
      if (params.createdBefore) {
        where.createdAt.lte = params.createdBefore
      }
    }

    // Get total count for pagination
    const total = await this.prisma.user.count({ where })

    // Get users with pagination
    const users = await this.prisma.user.findMany({
      where,
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
