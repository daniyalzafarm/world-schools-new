import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { existsSync } from 'fs'

// Use compiled seed file in production (Docker), TypeScript file in development
const seedCommand = existsSync('dist/prisma/seed.js')
  ? 'node dist/prisma/seed.js'
  : 'tsx apps/wc-nest-api/prisma/seed.ts'

export default defineConfig({
  // The main entry for your schema
  schema: 'apps/wc-nest-api/prisma/schema.prisma',

  // Where migrations should be generated
  migrations: {
    path: 'apps/wc-nest-api/prisma/migrations',
    seed: seedCommand,
  },

  // The database URL
  datasource: {
    // Type Safe env() helper
    // Does not replace the need for dotenv
    url: env('DATABASE_URL'),
  },
})

