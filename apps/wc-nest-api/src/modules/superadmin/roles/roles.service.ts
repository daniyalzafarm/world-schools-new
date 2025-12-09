import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class SuperAdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const { permissionIds, isSystemRole, ...roleData } = createRoleDto

    // Check if role with same name already exists (system-wide)
    const existingRole = await this.prisma.role.findFirst({
      where: {
        name: roleData.name,
        providerId: null,
      },
    })

    if (existingRole) {
      throw new ConflictException(`System role with name '${roleData.name}' already exists`)
    }

    // Create role
    const role = await this.prisma.role.create({
      data: {
        ...roleData,
        isSystemRole: isSystemRole ?? false,
        providerId: null, // System-wide roles have no provider
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    // Assign permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      await this.assignPermissions(role.id, permissionIds)
    }

    return this.findOne(role.id)
  }

  async findAll(params?: {
    page?: number
    limit?: number
    search?: string
    isSystemRole?: boolean
    createdAfter?: Date
    createdBefore?: Date
  }) {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      providerId: null, // Only system-wide roles
      // Exclude ProviderAdmin and Parent roles from superadmin context
      name: {
        notIn: ['Provider Admin', 'Parent'],
      },
    }

    // Add search filter
    if (params?.search) {
      where.name = {
        ...where.name,
        contains: params.search,
        mode: 'insensitive',
      }
    }

    // Add system role filter
    if (params?.isSystemRole !== undefined) {
      where.isSystemRole = params.isSystemRole
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
    const total = await this.prisma.role.count({ where })

    // Get roles with pagination
    const roles = await this.prisma.role.findMany({
      where,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
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
      data: roles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    })

    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`)
    }

    return role
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const { permissionIds, ...roleData } = updateRoleDto

    // Verify role exists
    const role = await this.findOne(id)

    // Prevent editing Super Admin role
    if (role.name === 'Super Admin' && role.isSystemRole) {
      throw new BadRequestException('Cannot edit the Super Admin system role')
    }

    // Check if new name conflicts with existing role
    if (roleData.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: roleData.name,
          providerId: null,
          id: { not: id },
        },
      })

      if (existingRole) {
        throw new ConflictException(`System role with name '${roleData.name}' already exists`)
      }
    }

    // Update role
    await this.prisma.role.update({
      where: { id },
      data: roleData,
    })

    // Update permissions if provided
    if (permissionIds !== undefined) {
      await this.assignPermissions(id, permissionIds)
    }

    return this.findOne(id)
  }

  async remove(id: string) {
    // Verify role exists
    const role = await this.findOne(id)

    // Prevent deleting Super Admin role
    if (role.name === 'Super Admin' && role.isSystemRole) {
      throw new BadRequestException('Cannot delete the Super Admin system role')
    }

    // Check if role is assigned to any users
    const userCount = await this.prisma.userRole.count({
      where: { roleId: id },
    })

    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role '${role.name}' as it is assigned to ${userCount} user(s)`
      )
    }

    // Delete role (permissions will be cascade deleted)
    await this.prisma.role.delete({
      where: { id },
    })

    return { message: `Role '${role.name}' deleted successfully` }
  }

  private async assignPermissions(roleId: string, permissionIds: string[]) {
    // Delete existing permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleId: roleId },
    })

    // Assign new permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId: roleId,
          permissionId: permissionId,
        })),
        skipDuplicates: true,
      })
    }
  }
}
