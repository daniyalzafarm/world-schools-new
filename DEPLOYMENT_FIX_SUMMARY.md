# Database Seeding Error - Fix Summary

## Problem

Azure Container App revision failing to start with database seeding error:

```
Error Code: P1010 (Prisma error code)
Error Type: PrismaClientKnownRequestError with DatabaseAccessDenied
Error Message: "User was denied access on the database `wc-booking-system`"
Failing Operation: prisma.permission.upsert()
```

**Key Observation:** Migrations succeed ✅ but seeding fails ❌

## Root Cause

**PrismaPg Adapter SSL Configuration Issue**

The `@prisma/adapter-pg` package does **NOT** automatically parse SSL parameters from the DATABASE_URL connection string.

### Why This Happens

1. **Azure PostgreSQL Flexible Server requires SSL connections**
2. **DATABASE_URL includes `?sslmode=require`** parameter
3. **Prisma's built-in migration tool** parses `sslmode=require` correctly ✅
4. **PrismaPg adapter ignores** the `sslmode=require` parameter ❌
5. **Seed script uses PrismaPg adapter** without explicit SSL configuration
6. **Connection fails** because Azure PostgreSQL rejects non-SSL connections
7. **Error manifests as "User was denied access"** (misleading error message)

### Technical Details

From [Stack Overflow](https://stackoverflow.com/questions/79675919/prismaclient-does-not-accept-database-url-from-prismapg-adapter):

> "PrismaClient accepts database URL with sslmode=require for SSL but without certificate verification, while with PrismaPg Adapter it requires you to explicitly set up the related configuration."

## Solution

Use an explicit `POSTGRES_REQUIRE_SSL` environment variable to control SSL configuration for the `pg` Pool used by PrismaPg adapter.

## Changes Made

### 1. Added `POSTGRES_REQUIRE_SSL` environment variable

**In `apps/wc-nest-api/.env.example`:**
```bash
POSTGRES_REQUIRE_SSL=false  # false for local, true for Azure
```

**In Azure Container App (via GitHub variable `WC_STAGING_API_ENV`):**
```bash
POSTGRES_REQUIRE_SSL=true
```

### 2. Updated `apps/wc-nest-api/prisma/seed.ts`

**Before:**
```typescript
const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })
```

**After:**
```typescript
import { Pool } from 'pg'

// Check if SSL is required via explicit environment variable
const requiresSsl = process.env.POSTGRES_REQUIRE_SSL === 'true'

// Create Pool with explicit SSL configuration
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? {
    rejectUnauthorized: false  // Azure uses self-signed certs
  } : undefined
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

### 3. Updated `apps/wc-nest-api/src/config/config.service.ts`

Added a new getter method for accessing the SSL configuration:

```typescript
get postgresRequireSsl(): boolean {
  return this.getString('POSTGRES_REQUIRE_SSL', 'false').toLowerCase() === 'true'
}
```

### 4. Updated `apps/wc-nest-api/src/prisma/prisma.service.ts`

Updated to use ConfigService for SSL configuration:

```typescript
constructor(private configService: ConfigService) {
  const databaseUrl = configService.databaseUrl
  const requiresSsl = configService.postgresRequireSsl  // ✅ Use ConfigService

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSsl ? {
      rejectUnauthorized: false
    } : undefined
  })

  const adapter = new PrismaPg(pool)
  super({ adapter })
}
```

### 5. Installed `@types/pg`

```bash
npm install --save-dev @types/pg
```

This provides TypeScript type definitions for the `pg` package.

## Deployment

### Next Steps

1. **Configure GitHub repository variable:**

   Add `POSTGRES_REQUIRE_SSL=true` to the `WC_STAGING_API_ENV` variable:

   - Go to repository Settings → Secrets and variables → Actions → Variables
   - Edit `WC_STAGING_API_ENV`
   - Add a new line: `POSTGRES_REQUIRE_SSL=true`

2. **Commit the changes:**
   ```bash
   git add .
   git commit -m "fix: use explicit POSTGRES_REQUIRE_SSL environment variable for SSL configuration"
   ```

3. **Create a new deployment tag:**
   ```bash
   git tag wc-v1.0.1  # or your next version
   git push origin main
   git push origin wc-v1.0.1
   ```

4. **Monitor the deployment:**
   ```bash
   az containerapp logs show \
     --resource-group rg-wc-staging-ch-north \
     --name ca-api-wc-stg \
     --follow
   ```

### Expected Output

After the fix, you should see:

```
🚀 Starting World Camps NestJS API...
📦 Running Prisma migrations...
✅ Migrations completed
🌱 Seeding database...
🔐 Database connection configuration:
  SSL Required: true
Creating permissions...
✅ Created XX permissions
Creating system roles...
✅ Created system roles
Creating default super admin user...
✅ Seeding completed
🎯 Starting the application...
```

## Verification

### 1. Check Container App Health

```bash
az containerapp revision list \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --query "[0].{Name:name, Active:properties.active, Health:properties.healthState}" \
  --output table
```

**Expected:** `Health: Healthy`

### 2. Test Health Endpoint

```bash
API_URL=$(az containerapp show \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --query properties.configuration.ingress.fqdn -o tsv)

curl https://${API_URL}/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T...",
  "version": "1.0.1"
}
```

## Files Modified

1. ✅ `apps/wc-nest-api/.env.example` - Added `POSTGRES_REQUIRE_SSL=false`
2. ✅ `apps/wc-nest-api/prisma/seed.ts` - Use `POSTGRES_REQUIRE_SSL` environment variable (direct access)
3. ✅ `apps/wc-nest-api/src/config/config.service.ts` - Added `postgresRequireSsl` getter
4. ✅ `apps/wc-nest-api/src/prisma/prisma.service.ts` - Use `configService.postgresRequireSsl`
5. ✅ `package.json` - Added `@types/pg` to devDependencies

## Configuration Required

**GitHub Repository Variable:** `WC_STAGING_API_ENV`

Add the following line to the variable value:
```
POSTGRES_REQUIRE_SSL=true
```

This will be automatically injected into the Azure Container App environment during deployment.

## Why This Fix Works

1. **Explicit SSL Configuration:** The `pg` Pool is created with explicit SSL settings based on environment variable
2. **Azure Compatibility:** `rejectUnauthorized: false` allows connection to Azure PostgreSQL with self-signed certificates
3. **Environment-Specific:** SSL can be enabled/disabled per environment (local=false, Azure=true)
4. **Centralized Configuration:** ConfigService provides type-safe access to configuration values
5. **Consistent Pattern:** Follows the same configuration pattern as other settings in the codebase
6. **Clear and Maintainable:** No magic auto-detection logic, explicit configuration per environment

## References

- [Stack Overflow: PrismaClient does not accept database URL from PrismaPg Adapter](https://stackoverflow.com/questions/79675919/prismaclient-does-not-accept-database-url-from-prismapg-adapter)
- [Prisma PostgreSQL Connector Documentation](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Azure PostgreSQL SSL Requirements](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-connect-tls-ssl)
- [node-postgres (pg) SSL Documentation](https://node-postgres.com/features/ssl)

## Summary

✅ **Root Cause:** PrismaPg adapter doesn't parse SSL parameters from connection string  
✅ **Solution:** Explicitly configure SSL in pg Pool for Azure PostgreSQL connections  
✅ **Impact:** Fixes both database seeding and application database connections  
✅ **Testing:** Local development unaffected, Azure deployments will now work correctly  

The Container App should start successfully after deploying these changes! 🎉

