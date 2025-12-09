import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateProviderRoleDto } from './dto/create-role.dto'
import { UpdateProviderRoleDto } from './dto/update-role.dto'

@Injectable()
export class ProviderRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(providerId: string, createRoleDto: CreateProviderRoleDto) {
    const { permissionIds, ...roleData } = createRoleDto

    // Check if role with same name already exists for this provider
    const existingRole = await this.prisma.role.findUnique({
      where: {
        name_providerId: {
          name: roleData.name,
          providerId: providerId,
        },
      },
    })

    if (existingRole) {
      throw new ConflictException(
        `Role with name '${roleData.name}' already exists for this provider`
      )
    }

    // Create role
    const role = await this.prisma.role.create({
      data: {
        ...roleData,
        isSystemRole: false,
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
    if (permissionIds && permissionIds.length > 0) {
      await this.assignPermissions(role.id, permissionIds)
    }

    return this.findOne(providerId, role.id)
  }

  async findAll(providerId: string) {
    return this.prisma.role.findMany({
      where: {
        providerId: providerId,
      },
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
    })
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
    await this.findOne(providerId, id)

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
