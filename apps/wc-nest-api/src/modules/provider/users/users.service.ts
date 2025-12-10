import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class ProviderUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    providerId: string,
    params?: {
      page?: number
      limit?: number
      search?: string
      roleId?: string
      emailVerified?: boolean
      createdAfter?: Date
      createdBefore?: Date
    }
  ) {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    // Get provider to access ownerId
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { ownerId: true },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    // Build where clause to include:
    // 1. Users with provider-scoped roles
    // 2. The provider owner
    const baseConditions: any[] = [
      {
        roles: {
          some: {
            role: {
              providerId: providerId,
            },
          },
        },
      },
      {
        id: provider.ownerId,
      },
    ]

    const where: any = {
      OR: baseConditions,
    }

    // Add search filter
    if (params?.search) {
      where.AND = [
        {
          OR: [
            { email: { contains: params.search, mode: 'insensitive' } },
            { firstName: { contains: params.search, mode: 'insensitive' } },
            { lastName: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    // Add role filter
    if (params?.roleId) {
      // When filtering by role, only include users with that specific role
      // (don't include owner unless they have the role)
      where.OR = [
        {
          roles: {
            some: {
              roleId: params.roleId,
              role: {
                providerId: providerId,
              },
            },
          },
        },
      ]
    }

    // Add email verified filter
    if (params?.emailVerified !== undefined) {
      if (!where.AND) {
        where.AND = []
      }
      where.AND.push({ emailVerified: params.emailVerified })
    }

    // Add date filters
    if (params?.createdAfter || params?.createdBefore) {
      if (!where.AND) {
        where.AND = []
      }
      const createdAt: any = {}
      if (params.createdAfter) {
        createdAt.gte = params.createdAfter
      }
      if (params.createdBefore) {
        createdAt.lte = params.createdBefore
      }
      where.AND.push({ createdAt })
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: {
            where: {
              role: {
                providerId: providerId,
              },
            },
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
          ownedProvider: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ])

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

  async findOne(providerId: string, id: string) {
    // Get provider to check if user is the owner
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { ownerId: true },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          where: {
            role: {
              providerId: providerId,
            },
          },
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
        ownedProvider: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`)
    }

    // Allow access if user is the provider owner OR has provider-scoped roles
    const isOwner = user.id === provider.ownerId
    const hasProviderRoles = user.roles && user.roles.length > 0

    if (!isOwner && !hasProviderRoles) {
      throw new ForbiddenException('You do not have permission to access this user')
    }

    return user
  }
}
