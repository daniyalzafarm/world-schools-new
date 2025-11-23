# World Camps (WC) Staging Deployment Guide

This document describes the CI/CD setup for deploying World Camps applications to the Azure staging environment.

## Overview

The deployment pipeline automatically builds and deploys all WC applications when a tag matching `wc-v*.*.*` is pushed to the repository.

### Applications Deployed

1. **wc-nest-api** - Backend API (NestJS)
2. **wc-superadmin** - Superadmin Portal (Next.js)
3. **wc-provider** - Provider Portal (Next.js)
4. **wc-booking** - User Booking Portal (Next.js)

## Azure Resources (Staging Environment)

All resources are located in **Switzerland North** region:

### Shared Infrastructure (Resource Group: `rg-wc-infra-shared-ch-north`)
- **Container Registry**: `acrwc` (shared across environments)

### Staging Environment (Resource Group: `rg-wc-staging-ch-north`)
- **Container App Environment**: `cae-wc-stg`
- **Container App (API)**: `ca-api-wc-stg`
- **Static Web App (Admin)**: `swa-admin-wc-stg`
- **Static Web App (Provider)**: `swa-provider-wc-stg`
- **Static Web App (Booking)**: `swa-booking-wc-stg`
- **PostgreSQL Server**: `pg-db-wc-stg`
- **Key Vault**: `kv-wc-stg`
- **Storage Account**: `sa-wc-stg`

## Deployment Trigger

The deployment is triggered by pushing a git tag with the pattern `wc-v*.*.*`:

```bash
# Example: Deploy version 1.0.0
git tag wc-v1.0.0
git push origin wc-v1.0.0
```

This will:
- Extract version `v1.0.0` from the tag
- Build and deploy ALL WC apps with this version
- Tag Docker images and display version in frontend UIs

## GitHub Secrets Required

Configure the following secrets in your GitHub repository settings:

### Azure Authentication
- `AZURE_CREDENTIALS` - Azure service principal credentials (JSON format)

### Static Web Apps Deployment Tokens
- `AZURE_SWA_ADMIN_TOKEN` - Deployment token for wc-superadmin
- `AZURE_SWA_PROVIDER_TOKEN` - Deployment token for wc-provider
- `AZURE_SWA_BOOKING_TOKEN` - Deployment token for wc-booking

### Environment Variables
- `WC_STAGING_API_URL` - Base URL for the staging API (e.g., `https://ca-api-wc-stg.azurecontainerapps.io/`)

## Backend Deployment (wc-nest-api)

### Docker Build Process

The backend is containerized using a multi-stage Dockerfile:

1. **Build Stage**: Uses Node.js 24, installs dependencies, generates Prisma client, and builds the NestJS app
2. **Production Stage**: Creates a minimal runtime image with Node.js 24 and only necessary files

### Startup Process

The container runs a startup script (`start.sh`) that:
1. Runs Prisma migrations (`prisma migrate deploy`)
2. Seeds the database (optional, can be disabled)
3. Starts the NestJS application

### Environment Variables

Configure these in Azure Container App settings:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `NODE_ENV` - Set to `production`
- `PORT` - Application port (default: 3000)
- `APP_VERSION` - Automatically set by CI/CD

## Frontend Deployment (Next.js Apps)

### Build Process

Each frontend app is built with:
- `NEXT_PUBLIC_API_BASE_URL` - Points to staging API
- `NEXT_PUBLIC_AUTH_USING_REQUEST` - Set to `false` (cookie-based auth)
- `NEXT_PUBLIC_APP_VERSION` - Extracted from git tag

### Version Display

The version number is displayed in the UI:
- **wc-superadmin**: Bottom of sidebar (when expanded)
- **wc-provider**: Bottom of sidebar (when expanded)
- **wc-booking**: User dropdown menu

## Manual Deployment Steps

If you need to deploy manually:

### 1. Build and Push Backend Docker Image

```bash
cd world-schools

# Build the image
docker build --platform=linux/amd64 \
  -t acrwc.azurecr.io/wc-nest-api:v0.0.1-rc1 \
  -f apps/wc-nest-api/Dockerfile \
  .

# Login to ACR (in shared infrastructure resource group)
az acr login --name acrwc

# Push the image
docker push acrwc.azurecr.io/wc-nest-api:v0.0.1-rc1

# Update Container App (in staging resource group)
az containerapp update \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north \
  --image acrwc.azurecr.io/wc-nest-api:v0.0.1-rc1
```

### 2. Build and Deploy Frontend Apps

```bash
cd world-schools

# Install dependencies
npm ci

# Build each app
export NEXT_PUBLIC_APP_VERSION=v1.0.0
export NEXT_PUBLIC_API_BASE_URL=https://ca-api-wc-stg.azurecontainerapps.io/
export NEXT_PUBLIC_AUTH_USING_REQUEST=false

npx nx build wc-superadmin
npx nx build wc-provider
npx nx build wc-booking

# Deploy using Azure Static Web Apps CLI or GitHub Actions
```

## Monitoring and Logs

### Container App Logs
```bash
az containerapp logs show \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north \
  --follow
```

### Static Web App Logs
View logs in Azure Portal under each Static Web App resource.

## Rollback Procedure

To rollback to a previous version:

```bash
# Rollback backend (image is in shared ACR, app is in staging resource group)
az containerapp update \
  --name ca-api-wc-stg \
  --resource-group rg-wc-staging-ch-north \
  --image acrwc.azurecr.io/wc-nest-api:v0.9.0

# For frontend apps, redeploy the previous version using GitHub Actions
# or manually deploy from the previous build artifacts
```

## Troubleshooting

### Backend Issues
- Check container logs for startup errors
- Verify database connection string
- Ensure Prisma migrations are applied
- Check environment variables in Container App

### Frontend Issues
- Verify API URL is correct
- Check browser console for errors
- Ensure environment variables are set during build
- Verify Static Web App deployment succeeded

## Next Steps

After successful deployment:
1. Verify all apps are accessible
2. Test authentication flow
3. Check version numbers in UI
4. Monitor application logs
5. Run smoke tests on critical features

