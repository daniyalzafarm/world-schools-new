import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // The main entry for your schema
  schema: 'apps/wc-nest-api/prisma/schema.prisma',
  
  // Where migrations should be generated
  migrations: {
    path: 'apps/wc-nest-api/prisma/migrations',
    seed: 'tsx apps/wc-nest-api/prisma/seed.ts',
  },
  
  // The database URL
  datasource: {
    // Type Safe env() helper
    // Does not replace the need for dotenv
    url: env('DATABASE_URL'),
  },
})

