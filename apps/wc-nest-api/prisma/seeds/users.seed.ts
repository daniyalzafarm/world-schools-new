import type { PrismaClient } from '../../src/generated/client/client'
import type { SeedRoleIds } from './rbac.seed'

export interface SeedUsersOptions extends SeedRoleIds {
  hashedPassword: string
  isProduction: boolean
}

export async function seedUsers(prisma: PrismaClient, options: SeedUsersOptions) {
  const { hashedPassword, superAdminRoleId, providerAdminRoleId, parentRoleId, isProduction } =
    options

  console.log('Creating super admin user...')
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

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRoleId,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRoleId,
    },
  })

  console.log('✅ Created super admin user: admin@world-camps.org / Camps@231')

  if (isProduction) {
    return
  }

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
                roleId: parentRoleId,
              },
            },
            update: {},
            create: {
              userId: parentUser.id,
              roleId: parentRoleId,
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
                roleId: providerAdminRoleId,
              },
            },
            update: {},
            create: {
              userId: providerUser.id,
              roleId: providerAdminRoleId,
            },
          }),
          tx.provider.upsert({
            where: { ownerId: providerUser.id },
            update: {},
            create: {
              ownerId: providerUser.id,
              legalCompanyName: `Test Provider ${index + 1}`,
              email,
            },
          }),
        ])
      })
    })
  )

  console.log('✅ Created 10 provider test accounts')
}
