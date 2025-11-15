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
    const { permission_ids, ...roleData } = createRoleDto

    // Check if role with same name already exists for this provider
    const existingRole = await this.prisma.role.findUnique({
      where: {
        name_provider_id: {
          name: roleData.name,
          provider_id: providerId,
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
        is_system_role: false,
        provider_id: providerId,
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
    if (permission_ids && permission_ids.length > 0) {
      await this.assignPermissions(role.id, permission_ids)
    }

    return this.findOne(providerId, role.id)
  }

  async findAll(providerId: string) {
    return this.prisma.role.findMany({
      where: {
        provider_id: providerId,
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
        created_at: 'desc',
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
    if (role.provider_id !== providerId) {
      throw new ForbiddenException('You do not have permission to access this role')
    }

    return role
  }

  async update(providerId: string, id: string, updateRoleDto: UpdateProviderRoleDto) {
    const { permission_ids, ...roleData } = updateRoleDto

    // Verify role exists and belongs to provider
    await this.findOne(providerId, id)

    // Check if new name conflicts with existing role
    if (roleData.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: roleData.name,
          provider_id: providerId,
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
    if (permission_ids !== undefined) {
      await this.assignPermissions(id, permission_ids)
    }

    return this.findOne(providerId, id)
  }

  async remove(providerId: string, id: string) {
    // Verify role exists and belongs to provider
    const role = await this.findOne(providerId, id)

    // Check if role is assigned to any users
    const userCount = await this.prisma.userRole.count({
      where: { role_id: id },
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
      where: { role_id: roleId },
    })

    // Assign new permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          role_id: roleId,
          permission_id: permissionId,
        })),
        skipDuplicates: true,
      })
    }
  }
}
