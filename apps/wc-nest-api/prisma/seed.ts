import { PrismaClient } from '../src/generated/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'
import { ConfigService } from '../src/config/config.service'
import { requiresPostgresSsl } from '../src/config/requires-postgres-ssl'
import { seedRbac } from './seeds/rbac.seed'
import { seedUsers } from './seeds/users.seed'
import { seedSupportTicketing } from './seeds/support.seed'

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// SSL detection is shared with ConfigService — covers both the env var
// (case-insensitive) and `sslmode=…` in the URL that start.sh injects.
const requiresSsl = requiresPostgresSsl(process.env, databaseUrl)

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

  // RBAC Seeder
  const roleIds = await seedRbac(prisma)

  // Users Seeder
  const configService = new ConfigService()
  const hashedPassword = await bcrypt.hash('Camps@231', 10)
  await seedUsers(prisma, {
    ...roleIds,
    hashedPassword,
    isProduction: configService.isProduction,
  })

  // Support Ticketing Seeder
  await seedSupportTicketing(prisma)

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
