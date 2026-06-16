import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { existsSync } from 'fs'

// Use compiled seed file in production (Docker), TypeScript file in development.
// The dev (tsx) path passes --tsconfig tsconfig.base.json so the workspace
// `@world-schools/*` path mappings resolve (the seed imports config/stripe,
// which use subpath imports like `@world-schools/global-utils/currency`).
const seedCommand = existsSync('dist/prisma/seed.js')
  ? 'node dist/prisma/seed.js'
  : 'tsx --tsconfig tsconfig.base.json apps/wc-nest-api/prisma/seed.ts'

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

