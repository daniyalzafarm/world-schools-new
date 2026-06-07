# Azure Setup for World Camps Staging Environment

This guide walks you through setting up the Azure infrastructure for the World Camps staging environment.

## Prerequisites

- Azure CLI installed and configured
- Azure subscription with appropriate permissions
- GitHub repository access

## 1. Create Resource Groups

```bash
# Create shared infrastructure resource group (for resources shared across environments)
az group create \
  --name rg-wc-infra-shared-ch-north \
  --location switzerlandnorth

# Create staging environment resource group
az group create \
  --name rg-wc-staging-ch-north \
  --location switzerlandnorth
```

## 2. Create Azure Container Registry (Shared Infrastructure)

The ACR is placed in the shared infrastructure resource group because it's used across multiple environments (staging, production, etc.).

```bash
az acr create \
  --resource-group rg-wc-infra-shared-ch-north \
  --name acrwc \
  --sku Basic \
  --admin-enabled true
```

## 3. Create PostgreSQL Database

```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --resource-group rg-wc-staging-ch-north \
  --name pg-db-wc-stg \
  --location switzerlandnorth \
  --admin-user wcadmin \
  --admin-password <STRONG_PASSWORD> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group rg-wc-staging-ch-north \
  --server-name pg-db-wc-stg \
  --database-name worldcamps
```

## 4. Create Key Vault

```bash
az keyvault create \
  --resource-group rg-wc-staging-ch-north \
  --name kv-wc-stg \
  --location switzerlandnorth
```

## 5. Create Storage Account

```bash
az storage account create \
  --resource-group rg-wc-staging-ch-north \
  --name sawcstg \
  --location switzerlandnorth \
  --sku Standard_LRS
```

## 6. Create Container App Environment

```bash
az containerapp env create \
  --resource-group rg-wc-staging-ch-north \
  --name cae-wc-stg \
  --location switzerlandnorth
```

## 7. Create Container App for API

```bash
# Get ACR credentials from shared infrastructure resource group
ACR_USERNAME=$(az acr credential show --name acrwc --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name acrwc --query passwords[0].value -o tsv)

# Create container app in staging resource group
# Note: The app is in staging RG, but pulls images from shared ACR
az containerapp create \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --environment cae-wc-stg \
  --image acrwc.azurecr.io/wc-nest-api:latest \
  --registry-server acrwc.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=secretref:database-url \
    JWT_SECRET=secretref:jwt-secret \
    JWT_REFRESH_SECRET=secretref:jwt-refresh-secret
```

## 8. Create Static Web Apps

### Superadmin Portal
```bash
az staticwebapp create \
  --resource-group rg-wc-staging-ch-north \
  --name swa-admin-wc-stg \
  --location switzerlandnorth \
  --sku Free
```

### Provider Portal
```bash
az staticwebapp create \
  --resource-group rg-wc-staging-ch-north \
  --name swa-provider-wc-stg \
  --location switzerlandnorth \
  --sku Free
```

### Booking Portal
```bash
az staticwebapp create \
  --resource-group rg-wc-staging-ch-north \
  --name swa-booking-wc-stg \
  --location switzerlandnorth \
  --sku Free
```

## 9. Configure Container App Secrets

```bash
# Get database connection string
DB_HOST=$(az postgres flexible-server show --resource-group rg-wc-staging-ch-north --name pg-db-wc-stg --query fullyQualifiedDomainName -o tsv)
DATABASE_URL="postgresql://wcadmin:<PASSWORD>@${DB_HOST}:5432/worldcamps?sslmode=require"

# Add secrets to Container App
az containerapp secret set \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --secrets \
    database-url="$DATABASE_URL" \
    jwt-secret="<GENERATE_STRONG_SECRET>" \
    jwt-refresh-secret="<GENERATE_STRONG_SECRET>"
```

## 9.1 Prisma migration Container Apps Job (`caj-migrate-wc-stg`)

A one-shot Container Apps Job that the staging workflow ([`wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml)) updates and triggers before each API deploy: its `run-staging-migrations` job sets the Job's image to the new digest (`az containerapp job update --image …@<digest>`), starts it, and waits for `Succeeded` before `deploy-api` runs. The Job runs `npx prisma migrate deploy` and exits. **Without this Job the staging deploy fails** at `run-staging-migrations` with `ResourceNotFound`.

Prisma 7's [`prisma.config.ts`](apps/wc-nest-api/prisma.config.ts) reads `env('DATABASE_URL')`, which isn't set in the container — a bare `npx prisma migrate deploy` therefore fails with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`. The API container works around this in [`start.sh`](apps/wc-nest-api/start.sh) by composing `DATABASE_URL` from the `POSTGRES_*` parts via a `/bin/sh -c` wrapper, but that approach can't be used here: `az containerapp job create --command` parses any value starting with `-` (e.g. sh's `-c`) as a flag and rejects it. So the Job is given `DATABASE_URL` directly as a secret and keeps the dash-free `--command "npx" "prisma" "migrate" "deploy"`.

This mirrors prod's `caj-migrate-wc-prod` (prod runbook § 11.6), with staging differences: `NODE_ENV=staging`, staging Postgres (`pg-db-wc-stg`, user `worldschools`), and — because staging has no Key Vault — the connection string is supplied as a literal `database-url` secret instead of a `keyvaultref`.

```bash
# Put the exact password in a var first (single quotes = no shell mangling). It's the same value
# held by the postgres-password secret on ca-api-wc-stg (and the WC_STAGING_API_SECRETS GitHub
# secret); read the live value with:
#   az containerapp secret show -g rg-wc-staging-ch-north -n ca-api-wc-stg --secret-name postgres-password --query value -o tsv
PW='<STAGING_POSTGRES_PASSWORD>'

az containerapp job create \
  -g rg-wc-staging-ch-north \
  -n caj-migrate-wc-stg \
  --environment cae-wc-stg \
  --trigger-type Manual \
  --replica-timeout 600 \
  --replica-retry-limit 0 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image acrwc.azurecr.io/wc-nest-api:0.20.0-rc1 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --command "npx" "prisma" "migrate" "deploy" \
  --cpu 0.5 --memory 1Gi \
  --secrets "database-url=postgresql://worldschools:${PW}@pg-db-wc-stg.postgres.database.azure.com:5432/world-camps?sslmode=require" \
  --env-vars NODE_ENV=staging DATABASE_URL=secretref:database-url \
  --tags env=staging app=wc managed-by=manual
```

> If the password contains URL-reserved characters (`@ / : ? # %`), percent-encode them in the
> connection string. (`start.sh` interpolates the password raw and the API works, so the current
> staging password is already URL-safe.)

The `--image` tag here is only a placeholder for creation; the workflow overwrites it with the per-deploy digest before every run. Verify the Job runs cleanly once:

```bash
az containerapp job start -g $RG -n caj-migrate-wc-stg --query name -o tsv
az containerapp job execution list -g $RG -n caj-migrate-wc-stg \
  --query "[0].{status:properties.status,start:properties.startTime}" -o table   # expect Succeeded
```

> Note: the API image also runs `prisma migrate deploy` + `prisma db seed` at startup (`apps/wc-nest-api/start.sh`), so this Job's `migrate deploy` is redundant-but-idempotent. It exists so migrations are applied (and can fail the pipeline) **before** the new API image is rolled out, matching prod.

## 10. Get Static Web App Deployment Tokens

```bash
# Get deployment token for superadmin
az staticwebapp secrets list \
  --resource-group rg-wc-staging-ch-north \
  --name swa-admin-wc-stg \
  --query properties.apiKey -o tsv

# Get deployment token for provider
az staticwebapp secrets list \
  --resource-group rg-wc-staging-ch-north \
  --name swa-provider-wc-stg \
  --query properties.apiKey -o tsv

# Get deployment token for booking
az staticwebapp secrets list \
  --resource-group rg-wc-staging-ch-north \
  --name swa-booking-wc-stg \
  --query properties.apiKey -o tsv
```

## 11. Create Service Principal for GitHub Actions

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "github-actions-wc-staging" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-wc-staging-ch-north \
  --sdk-auth

# This will output JSON credentials - save this as AZURE_CREDENTIALS secret in GitHub
```

## 12. Configure GitHub Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

1. **AZURE_CREDENTIALS**: Output from step 11
2. **AZURE_SWA_ADMIN_TOKEN**: Deployment token for wc-superadmin (from step 10)
3. **AZURE_SWA_PROVIDER_TOKEN**: Deployment token for wc-provider (from step 10)
4. **AZURE_SWA_BOOKING_TOKEN**: Deployment token for wc-booking (from step 10)
5. **WC_STAGING_API_URL**: Container App URL (get from Azure Portal or CLI)

```bash
# Get Container App URL
az containerapp show \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --query properties.configuration.ingress.fqdn -o tsv
```

## 13. CORS (application-level, not Container Apps ingress)

CORS is enforced **by the NestJS app**, not by the Container App ingress. [`main.ts`](apps/wc-nest-api/src/main.ts) calls `app.enableCors({ origin: configService.corsOrigins, credentials: true, exposedHeaders: [...] })`, reading the comma-separated `CORS_ORIGINS` env var ([config.service.ts](apps/wc-nest-api/src/config/config.service.ts)). `CORS_ORIGINS` is part of `WC_STAGING_API_ENV` and is applied to `ca-api-wc-stg` on every deploy:

```text
CORS_ORIGINS=https://booking.staging.world-camps.org,https://provider.staging.world-camps.org,https://superadmin.staging.world-camps.org
```

**Do NOT also enable the Container Apps ingress CORS policy.** Running both layers makes the ingress (Envoy) and the app each emit `Access-Control-Allow-Origin`, and a response with two ACAO values is rejected by browsers. Keep CORS in one place — the app. If the ingress policy was ever enabled on the API app, disable it so the app is the single source of truth:

```bash
az containerapp ingress cors disable -g rg-wc-staging-ch-north -n ca-api-wc-stg
# verify it's cleared:
az containerapp show -g rg-wc-staging-ch-north -n ca-api-wc-stg \
  --query "properties.configuration.ingress.corsPolicy" -o json   # expect null
```

> Why app-level, not ingress CORS: the app needs credentialed CORS plus exposed headers
> (`x-access-token`, `x-refresh-token`, `x-csrf-token`) which the NestJS config expresses precisely;
> the ingress policy is coarser, Azure-only (wouldn't apply to local dev), and duplicates the ACAO
> header. Prod (`ca-api-wc-prod`) already runs app-level only. (Note: the env var is `CORS_ORIGINS`,
> plural — not `CORS_ORIGIN`.)

## Verification

After setup, verify:
1. All resources are created in the resource group
2. Container App is running
3. Static Web Apps are accessible
4. Database is accessible from Container App
5. GitHub secrets are configured

## Cost Optimization

For staging environment:
- Use Basic tier for ACR
- Use Burstable tier for PostgreSQL
- Use Free tier for Static Web Apps
- Set appropriate min/max replicas for Container App
- Consider using Azure Dev/Test pricing if available

