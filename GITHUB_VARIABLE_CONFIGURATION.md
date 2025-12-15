# GitHub Repository Variable Configuration

## Overview

The GitHub Actions workflow for World Camps staging deployment uses repository variables to configure environment-specific settings. This guide explains how to configure the `WC_STAGING_API_ENV` variable to include the required `POSTGRES_REQUIRE_SSL=true` setting.

## Required Variable: `WC_STAGING_API_ENV`

This variable contains all runtime environment variables for the `wc-nest-api` Container App in the staging environment.

### Current Configuration

The variable should contain environment variables in the format:

```
KEY1=value1
KEY2=value2
KEY3=value3
```

### Required Addition

Add the following line to enable SSL for Azure PostgreSQL:

```
POSTGRES_REQUIRE_SSL=true
```

## How to Configure

### Option 1: Via GitHub Web UI (Recommended)

1. **Navigate to repository settings:**
   - Go to your GitHub repository
   - Click **Settings** (top menu)
   - In the left sidebar, expand **Secrets and variables**
   - Click **Actions**

2. **Edit the variable:**
   - Click on the **Variables** tab
   - Find `WC_STAGING_API_ENV` in the list
   - Click the **Edit** button (pencil icon)

3. **Add the SSL configuration:**
   - In the **Value** field, add a new line at the end:
     ```
     POSTGRES_REQUIRE_SSL=true
     ```
   - Click **Update variable**

### Option 2: Via GitHub CLI

```bash
# Get current value
gh variable get WC_STAGING_API_ENV

# Set new value (append POSTGRES_REQUIRE_SSL=true to existing value)
CURRENT_VALUE=$(gh variable get WC_STAGING_API_ENV)
NEW_VALUE="${CURRENT_VALUE}
POSTGRES_REQUIRE_SSL=true"

gh variable set WC_STAGING_API_ENV --body "$NEW_VALUE"
```

## Example Configuration

### Before

```
NODE_ENV=production
PORT=3000
POSTGRES_HOST=pg-db-wc-stg.postgres.database.azure.com
POSTGRES_PORT=5432
POSTGRES_USER=wcadmin
POSTGRES_DB=wc-booking-system
CORS_ORIGIN=https://ca-admin-wc-stg.azurecontainerapps.io,https://ca-provider-wc-stg.azurecontainerapps.io,https://ca-booking-wc-stg.azurecontainerapps.io
```

### After

```
NODE_ENV=production
PORT=3000
POSTGRES_HOST=pg-db-wc-stg.postgres.database.azure.com
POSTGRES_PORT=5432
POSTGRES_USER=wcadmin
POSTGRES_DB=wc-booking-system
POSTGRES_REQUIRE_SSL=true
CORS_ORIGIN=https://ca-admin-wc-stg.azurecontainerapps.io,https://ca-provider-wc-stg.azurecontainerapps.io,https://ca-booking-wc-stg.azurecontainerapps.io
```

## How It Works

### Workflow Integration

The GitHub Actions workflow (`.github/workflows/wc-staging-deploy.yml`) reads this variable and injects it into the Azure Container App:

```yaml
- name: Parse API runtime env
  id: api-env
  run: |
    RAW="$(echo "${{ vars.WC_STAGING_API_ENV }}" | tr '\n' ' ')"
    ENV="APP_VERSION=${{ needs.extract-version.outputs.version }} $RAW"
    echo "env=$ENV" >> $GITHUB_OUTPUT

- name: Deploy API
  run: |
    az containerapp update \
      --name ca-api-wc-stg \
      --resource-group rg-wc-staging-ch-north \
      --image acrwc.azurecr.io/wc-nest-api:${{ needs.extract-version.outputs.version }} \
      --set-env-vars ${{ steps.api-env.outputs.env }}
```

### Application Usage

The `wc-nest-api` application reads this environment variable in two places:

1. **Seed Script** (`apps/wc-nest-api/prisma/seed.ts`):
   ```typescript
   // Direct access (runs outside NestJS DI context)
   const requiresSsl = process.env.POSTGRES_REQUIRE_SSL === 'true'
   ```

2. **ConfigService** (`apps/wc-nest-api/src/config/config.service.ts`):
   ```typescript
   get postgresRequireSsl(): boolean {
     return this.getString('POSTGRES_REQUIRE_SSL', 'false').toLowerCase() === 'true'
   }
   ```

3. **PrismaService** (`apps/wc-nest-api/src/prisma/prisma.service.ts`):
   ```typescript
   // Uses ConfigService for type-safe access
   const requiresSsl = configService.postgresRequireSsl
   ```

## Verification

After configuring the variable and deploying:

### 1. Check Container App Environment Variables

```bash
az containerapp show \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --query "properties.template.containers[0].env" \
  --output table
```

Look for `POSTGRES_REQUIRE_SSL` with value `true`.

### 2. Check Application Logs

```bash
az containerapp logs show \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --follow
```

Look for the SSL configuration log during seeding:
```
🔐 Database connection configuration:
  SSL Required: true
```

## Troubleshooting

### Variable Not Applied

If the environment variable doesn't appear in the Container App:

1. **Check the GitHub variable value:**
   ```bash
   gh variable get WC_STAGING_API_ENV
   ```

2. **Trigger a new deployment:**
   ```bash
   git tag wc-v1.0.2
   git push origin wc-v1.0.2
   ```

3. **Manually update the Container App:**
   ```bash
   az containerapp update \
     --name ca-api-wc-stg \
     --resource-group rg-wc-staging-ch-north \
     --set-env-vars POSTGRES_REQUIRE_SSL=true
   ```

### SSL Connection Still Failing

If seeding still fails after setting `POSTGRES_REQUIRE_SSL=true`:

1. **Verify the DATABASE_URL secret is correct:**
   ```bash
   # Check if database-url secret exists
   az containerapp secret list \
     --resource-group rg-wc-staging-ch-north \
     --name ca-api-wc-stg \
     --query "[?name=='database-url']"
   ```

2. **Check PostgreSQL firewall rules:**
   ```bash
   az postgres flexible-server firewall-rule list \
     --resource-group rg-wc-staging-ch-north \
     --name pg-db-wc-stg
   ```

## Related Documentation

- [DATABASE_SEEDING_ERROR_FIX.md](./DATABASE_SEEDING_ERROR_FIX.md) - Detailed explanation of the SSL issue
- [DEPLOYMENT_FIX_SUMMARY.md](./DEPLOYMENT_FIX_SUMMARY.md) - Summary of all changes
- [.github/workflows/wc-staging-deploy.yml](./.github/workflows/wc-staging-deploy.yml) - Deployment workflow

