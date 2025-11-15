import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class SuperAdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const { permission_ids, ...roleData } = createRoleDto

    // Check if role with same name already exists (system-wide)
    const existingRole = await this.prisma.role.findUnique({
      where: {
        name_provider_id: {
          name: roleData.name,
          provider_id: null,
        },
      },
    })

    if (existingRole) {
      throw new ConflictException(`System role with name '${roleData.name}' already exists`)
    }

    // Create role
    const role = await this.prisma.role.create({
      data: {
        ...roleData,
        is_system_role: roleData.is_system_role ?? true,
        provider_id: null, // System-wide roles have no provider
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

    return this.findOne(role.id)
  }

  async findAll() {
    return this.prisma.role.findMany({
      where: {
        provider_id: null, // Only system-wide roles
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
    const { permission_ids, ...roleData } = updateRoleDto

    // Verify role exists
    await this.findOne(id)

    // Check if new name conflicts with existing role
    if (roleData.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: roleData.name,
          provider_id: null,
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
    if (permission_ids !== undefined) {
      await this.assignPermissions(id, permission_ids)
    }

    return this.findOne(id)
  }

  async remove(id: string) {
    // Verify role exists
    const role = await this.findOne(id)

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
