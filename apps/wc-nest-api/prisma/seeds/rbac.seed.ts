import type { PrismaClient } from '../../src/generated/client/client'
import {
  getAllPermissions,
  getContextPermissionIds,
  providerContext,
  superadminContext,
} from '../../src/config/permissions'

export interface SeedRoleIds {
  superAdminRoleId: string
  providerAdminRoleId: string
  parentRoleId: string
}

export async function seedRbac(prisma: PrismaClient): Promise<SeedRoleIds> {
  console.log('Creating permissions...')
  const permissions = getAllPermissions()

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { id: permission.id },
      update: {},
      create: permission,
    })
  }

  console.log(`✅ Created ${permissions.length} permissions`)
  console.log('Creating system roles...')

  let superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin', isSystemRole: true, providerId: null },
  })

  superAdminRole ??= await prisma.role.create({
    data: {
      name: 'Super Admin',
      isSystemRole: true,
      providerId: null,
    },
  })

  const superAdminPermissionIds = getContextPermissionIds(superadminContext)
  for (const permissionId of superAdminPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId,
      },
    })
  }

  let providerAdminRole = await prisma.role.findFirst({
    where: { name: 'Provider Admin', isSystemRole: true, providerId: null },
  })

  providerAdminRole ??= await prisma.role.create({
    data: {
      name: 'Provider Admin',
      isSystemRole: true,
      providerId: null,
    },
  })

  const providerAdminPermissionIds = getContextPermissionIds(providerContext)
  for (const permissionId of providerAdminPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: providerAdminRole.id,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: providerAdminRole.id,
        permissionId,
      },
    })
  }

  let parentRole = await prisma.role.findFirst({
    where: { name: 'Parent', isSystemRole: true, providerId: null },
  })

  parentRole ??= await prisma.role.create({
    data: {
      name: 'Parent',
      isSystemRole: true,
      providerId: null,
    },
  })

  // Parent role has no permissions assigned (parents access their own data through specific endpoints)
  console.log('✅ Created system roles: Super Admin, Provider Admin, Parent')

  return {
    superAdminRoleId: superAdminRole.id,
    providerAdminRoleId: providerAdminRole.id,
    parentRoleId: parentRole.id,
  }
}
