import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'

@Injectable()
export class SuperAdminProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  async create(createProviderDto: CreateProviderDto) {
    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: createProviderDto.ownerId },
    })

    if (!owner) {
      throw new NotFoundException(`User with ID '${createProviderDto.ownerId}' not found`)
    }

    // Check if owner already has a provider
    const existingProvider = await this.prisma.provider.findUnique({
      where: { ownerId: createProviderDto.ownerId },
    })

    if (existingProvider) {
      throw new ConflictException(`User '${owner.email}' already owns a provider`)
    }

    // Create provider
    const provider = await this.prisma.provider.create({
      data: createProviderDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    return provider
  }

  async findAll() {
    return this.prisma.provider.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${id}' not found`)
    }

    return provider
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    // Verify provider exists
    await this.findOne(id)

    // Update provider
    const provider = await this.prisma.provider.update({
      where: { id },
      data: updateProviderDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    return provider
  }

  async getDetail(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        settings: true,
        verificationDocuments: true,
        camps: {
          include: {
            _count: {
              select: {
                sessions: true,
                bookingGroups: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        bookingGroups: {
          take: 5,
          orderBy: { requestedAt: 'desc' },
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            camp: {
              select: { name: true },
            },
            session: {
              select: { name: true, startDate: true, endDate: true },
            },
          },
        },
        _count: {
          select: {
            camps: true,
            bookingGroups: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${id}' not found`)
    }

    const [revenueResult, reviewResult] = await Promise.all([
      this.prisma.bookingGroup.aggregate({
        where: {
          providerId: id,
          status: { in: ['deposit_paid', 'fully_paid', 'at_camp', 'completed'] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.campReview.aggregate({
        where: { camp: { providerId: id }, status: 'published' },
        _avg: { happinessRating: true },
        _count: { _all: true },
      }),
    ])

    return {
      ...provider,
      stats: {
        activeCampsCount: provider.camps.filter(c => c.status === 'published').length,
        totalSessionsCount: provider.camps.reduce((acc, c) => acc + c._count.sessions, 0),
        totalBookingsCount: provider._count.bookingGroups,
        totalRevenue: revenueResult._sum.totalAmount ?? 0,
        averageRating: reviewResult._avg?.happinessRating ?? null,
        reviewsCount: reviewResult._count._all,
      },
    }
  }

  async remove(id: string) {
    // Verify provider exists
    const provider = await this.findOne(id)

    // Delete provider (roles will be cascade deleted)
    await this.prisma.provider.delete({
      where: { id },
    })

    return {
      message: `Provider '${provider.legalCompanyName || provider.id}' deleted successfully`,
    }
  }

  async generateImpersonationToken(
    providerId: string,
    superadmin: { id: string; email: string; firstName?: string; lastName?: string }
  ): Promise<{ token: string }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        legalCompanyName: true,
        ownerId: true,
        owner: {
          select: { id: true, email: true },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    if (!provider.ownerId) {
      throw new NotFoundException(`Provider '${providerId}' has no owner account`)
    }

    const token = crypto.randomUUID()
    const superadminName =
      [superadmin.firstName, superadmin.lastName].filter(Boolean).join(' ') || superadmin.email

    await this.redisService.set(
      `impersonate:${token}`,
      JSON.stringify({
        superadminId: superadmin.id,
        superadminEmail: superadmin.email,
        superadminName,
        providerOwnerId: provider.ownerId,
        providerId: provider.id,
      }),
      60 // 60 second TTL — single-use, tight window for redirect
    )

    return { token }
  }
}
