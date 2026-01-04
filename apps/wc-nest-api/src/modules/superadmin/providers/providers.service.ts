import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'

@Injectable()
export class SuperAdminProvidersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async remove(id: string) {
    // Verify provider exists
    const provider = await this.findOne(id)

    // Delete provider (roles will be cascade deleted)
    await this.prisma.provider.delete({
      where: { id },
    })

    return { message: `Provider '${provider.name}' deleted successfully` }
  }
}
