import { PrismaClient } from '../src/generated/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'
import {
  getAllPermissions,
  getContextPermissionIds,
  providerContext,
  superadminContext,
} from '../src/config/permissions'
import { ConfigService } from '../src/config/config.service'

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Check if SSL is required via explicit environment variable
// Set POSTGRES_REQUIRE_SSL=true for Azure PostgreSQL or other SSL-required databases
const requiresSsl = process.env.POSTGRES_REQUIRE_SSL === 'true'

console.log('🔐 Database connection configuration:')
console.log(`  SSL Required: ${requiresSsl}`)

// Create Pool with explicit SSL configuration
// PrismaPg adapter does not automatically parse SSL parameters from connection string
// Azure PostgreSQL Flexible Server requires SSL connections
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl
    ? {
        rejectUnauthorized: false, // Azure PostgreSQL uses self-signed certificates
      }
    : undefined,
})

// Create adapter and Prisma Client
const adapter = new PrismaPg(pool)
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

  // ============================================
  // Create Test Accounts (Development Only)
  // ============================================
  const configService = new ConfigService()

  if (!configService.isProduction) {
    console.log('')
    console.log('Creating test accounts (development only)...')

    const numberWords = [
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
    ]

    // Create 10 parent test accounts (parallel — each account is independent)
    await Promise.all(
      numberWords.map((word, index) => {
        const email = `parent${index + 1}@gmail.com`
        return prisma.$transaction(async tx => {
          const parentUser = await tx.user.upsert({
            where: { email },
            update: {},
            create: {
              email,
              passwordHash: hashedPassword,
              firstName: 'Parent',
              lastName: word,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
          })

          await Promise.all([
            tx.userRole.upsert({
              where: {
                userId_roleId: {
                  userId: parentUser.id,
                  roleId: parentRole.id,
                },
              },
              update: {},
              create: {
                userId: parentUser.id,
                roleId: parentRole.id,
              },
            }),
            tx.parent.upsert({
              where: { userId: parentUser.id },
              update: {},
              create: {
                userId: parentUser.id,
              },
            }),
          ])
        })
      })
    )

    console.log('✅ Created 10 parent test accounts')

    // Create 10 provider test accounts (parallel — each account is independent)
    await Promise.all(
      numberWords.map((word, index) => {
        const email = `provider${index + 1}@gmail.com`
        return prisma.$transaction(async tx => {
          const providerUser = await tx.user.upsert({
            where: { email },
            update: {},
            create: {
              email,
              passwordHash: hashedPassword,
              firstName: 'Provider',
              lastName: word,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
          })

          await Promise.all([
            tx.userRole.upsert({
              where: {
                userId_roleId: {
                  userId: providerUser.id,
                  roleId: providerAdminRole.id,
                },
              },
              update: {},
              create: {
                userId: providerUser.id,
                roleId: providerAdminRole.id,
              },
            }),
            tx.provider.upsert({
              where: { ownerId: providerUser.id },
              update: {},
              create: {
                ownerId: providerUser.id,
                legalCompanyName: `Test Provider ${index + 1}`,
                email: email,
              },
            }),
          ])
        })
      })
    )

    console.log('✅ Created 10 provider test accounts')
  }

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
