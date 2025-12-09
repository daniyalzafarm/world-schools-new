import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class CommonUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate roles exist
   */
  private async validateRoles(roleIds: string[]) {
    if (!roleIds || roleIds.length === 0) return

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    })

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more invalid role IDs')
    }

    return roles
  }

  /**
   * Assign roles to user
   */
  private async assignRoles(userId: string, roleIds: string[]) {
    if (!roleIds || roleIds.length === 0) return

    // Delete existing role assignments
    await this.prisma.userRole.deleteMany({
      where: { userId },
    })

    // Create new role assignments
    await this.prisma.userRole.createMany({
      data: roleIds.map(roleId => ({
        userId,
        roleId,
      })),
    })
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserDto) {
    // Validate roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      await this.validateRoles(data.roleIds)
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw new ConflictException('Email already exists')
    }

    // Hash password if provided
    let passwordHash: string | undefined
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10)
    }

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
      },
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
    })

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      await this.assignRoles(user.id, data.roleIds)

      // Fetch user with roles
      return this.findOne(user.id)
    }

    return user
  }

  /**
   * Find all users
   */
  async findAll() {
    const users = await this.prisma.user.findMany({
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
    })

    return users
  }

  /**
   * Find one user by ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  /**
   * Update a user
   */
  async update(id: string, data: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      throw new NotFoundException('User not found')
    }

    // Validate roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      await this.validateRoles(data.roleIds)
    }

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      })

      if (emailExists) {
        throw new ConflictException('Email already exists')
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10)
    }

    // Update the user
    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName || null
    if (passwordHash) updateData.passwordHash = passwordHash

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
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
    })

    // Update roles if provided
    if (data.roleIds) {
      await this.assignRoles(user.id, data.roleIds)

      // Fetch user with updated roles
      return this.findOne(user.id)
    }

    return user
  }

  /**
   * Delete a user
   */
  async remove(id: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has SuperAdmin role
    const hasSuperAdminRole = user.roles.some(
      userRole => userRole.role.name === 'Super Admin' && userRole.role.isSystemRole
    )

    if (hasSuperAdminRole) {
      // Count how many users have the SuperAdmin role
      const superAdminCount = await this.prisma.user.count({
        where: {
          roles: {
            some: {
              role: {
                name: 'Super Admin',
                isSystemRole: true,
              },
            },
          },
        },
      })

      // Prevent deletion if this is the last SuperAdmin user
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last Super Admin user')
      }
    }

    // Delete the user (cascade will handle role assignments)
    await this.prisma.user.delete({
      where: { id },
    })

    return { message: 'User deleted successfully' }
  }
}
