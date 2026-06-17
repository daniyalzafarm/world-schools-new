import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { getContextPermissionIds, providerContext } from '../../../config/permissions'
import { CreateProviderRoleDto } from './dto/create-role.dto'
import { UpdateProviderRoleDto } from './dto/update-role.dto'

@Injectable()
export class ProviderRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(providerId: string, createRoleDto: CreateProviderRoleDto) {
    const { permissionIds, isAdmin, ...roleData } = createRoleDto

    // Admin roles are system-managed: name is fixed to "Admin" and they get the full
    // provider-context permission set (same source as the seeder), ignoring client-sent permissionIds.
    const name = isAdmin ? 'Admin' : roleData.name
    const resolvedPermissionIds = isAdmin ? getContextPermissionIds(providerContext) : permissionIds

    // Check if role with same name already exists for this provider
    const existingRole = await this.prisma.role.findUnique({
      where: {
        name_providerId: {
          name: name,
          providerId: providerId,
        },
      },
    })

    if (existingRole) {
      throw new ConflictException(
        isAdmin
          ? 'An Admin role already exists for this provider'
          : `Role with name '${name}' already exists for this provider`
      )
    }

    // Create role
    const role = await this.prisma.role.create({
      data: {
        ...roleData,
        name: name,
        isSystemRole: isAdmin ?? false,
        providerId: providerId,
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
    if (resolvedPermissionIds && resolvedPermissionIds.length > 0) {
      await this.assignPermissions(role.id, resolvedPermissionIds)
    }

    return this.findOne(providerId, role.id)
  }

  async findAll(
    providerId: string,
    params?: {
      page?: number
      limit?: number
      search?: string
      createdAfter?: Date
      createdBefore?: Date
    }
  ) {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    const where: any = {
      providerId: providerId,
    }

    // Add search filter
    if (params?.search) {
      where.name = {
        contains: params.search,
        mode: 'insensitive',
      }
    }

    // Add date filters
    if (params?.createdAfter || params?.createdBefore) {
      where.createdAt = {}
      if (params.createdAfter) {
        where.createdAt.gte = params.createdAfter
      }
      if (params.createdBefore) {
        where.createdAt.lte = params.createdBefore
      }
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
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
      }),
      this.prisma.role.count({ where }),
    ])

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

  async findOne(providerId: string, id: string) {
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

    // Verify role belongs to this provider
    if (role.providerId !== providerId) {
      throw new ForbiddenException('You do not have permission to access this role')
    }

    return role
  }

  async update(providerId: string, id: string, updateRoleDto: UpdateProviderRoleDto) {
    const { permissionIds, ...roleData } = updateRoleDto

    // Verify role exists and belongs to provider
    const existing = await this.findOne(providerId, id)

    // System-managed roles (e.g. the "Admin" role) cannot be edited
    if (existing.isSystemRole) {
      throw new ForbiddenException('System roles cannot be edited')
    }

    // Check if new name conflicts with existing role
    if (roleData.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: roleData.name,
          providerId: providerId,
          id: { not: id },
        },
      })

      if (existingRole) {
        throw new ConflictException(
          `Role with name '${roleData.name}' already exists for this provider`
        )
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

    return this.findOne(providerId, id)
  }

  async remove(providerId: string, id: string) {
    // Verify role exists and belongs to provider
    const role = await this.findOne(providerId, id)

    // System-managed roles (e.g. the "Admin" role) cannot be deleted
    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be deleted')
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
