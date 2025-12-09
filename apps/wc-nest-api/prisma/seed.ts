import { PrismaClient } from '../src/generated/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcryptjs'
import {
  getAllPermissions,
  getContextPermissionIds,
  providerContext,
  superadminContext,
} from '../src/config/permissions'

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create adapter and Prisma Client
const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Create system permissions
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

  // Create system roles
  console.log('Creating system roles...')

  // Super Admin Role (has all permissions)
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

  // Assign superadmin context permissions to Super Admin
  const superAdminPermissionIds = getContextPermissionIds(superadminContext)
  for (const permissionId of superAdminPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permissionId,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permissionId,
      },
    })
  }

  // Provider Admin Role (for school owners)
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

  // Assign provider context permissions to Provider Admin
  const providerAdminPermissionIds = getContextPermissionIds(providerContext)
  for (const permissionId of providerAdminPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: providerAdminRole.id,
          permissionId: permissionId,
        },
      },
      update: {},
      create: {
        roleId: providerAdminRole.id,
        permissionId: permissionId,
      },
    })
  }

  // Parent Role (for parents)
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

  // Create a super admin user
  console.log('Creating super admin user...')
  const hashedPassword = await bcrypt.hash('Camps@231', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@world-camps.org' },
    update: {},
    create: {
      email: 'admin@world-camps.org',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
    },
  })

  // Assign Super Admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  })

  console.log('✅ Created super admin user: admin@world-camps.org / Camps@231')

  console.log('')
  console.log('🎉 Seeding completed successfully!')
  console.log('')
  console.log('📝 Login credentials:')
  console.log('   Email: admin@world-camps.org')
  console.log('   Password: Camps@231')
  console.log('')
  console.log('⚠️  Remember to change the admin password in production!')
}

main()
  .catch(e => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
