# World Camps CI/CD Setup Summary

## Overview

This document summarizes the CI/CD pipeline setup for deploying World Camps applications to Azure staging environment.

## What Was Created

### 1. Docker Configuration for Backend

**File**: `world-schools/apps/wc-nest-api/Dockerfile`
- Multi-stage build for optimized image size using Node.js 24
- Prisma client generation
- Production-ready NestJS build
- Includes all necessary dependencies

**File**: `world-schools/apps/wc-nest-api/start.sh`
- Automated database migrations on startup
- Database seeding (optional)
- Application startup script

### 2. GitHub Actions Workflow

**File**: `world-schools/.github/workflows/wc-staging-deploy.yml`

**Trigger**: Git tags matching `wc-v*.*.*` (e.g., `wc-v1.0.0`)

**Jobs**:
1. **extract-version**: Extracts version number from tag
2. **build-and-deploy-api**: Builds Docker image and deploys to Azure Container App
3. **build-and-deploy-superadmin**: Builds and deploys superadmin portal
4. **build-and-deploy-provider**: Builds and deploys provider portal
5. **build-and-deploy-booking**: Builds and deploys booking portal

### 3. Version Display in Frontend Apps

**Modified Files**:
- `world-schools/apps/wc-superadmin/src/config/config.ts`
- `world-schools/apps/wc-provider/src/config/config.ts`
- `world-schools/apps/wc-booking/src/config/config.ts`
- `world-schools/apps/wc-superadmin/src/components/layout/sidebar.tsx`
- `world-schools/apps/wc-provider/src/components/layout/sidebar.tsx`
- `world-schools/apps/wc-booking/src/components/layout/top-nav.tsx`

**Version Display Locations**:
- **wc-superadmin**: Bottom of sidebar (when expanded)
- **wc-provider**: Bottom of sidebar (when expanded)
- **wc-booking**: User dropdown menu

### 4. Environment Variable Updates

**Modified Files**:
- `world-schools/apps/wc-superadmin/.env.example`
- `world-schools/apps/wc-provider/.env.example`
- `world-schools/apps/wc-booking/.env.example`

**Added Variable**: `NEXT_PUBLIC_APP_VERSION`

### 5. Documentation

**Created Files**:
1. `DEPLOYMENT_WC_STAGING.md` - Comprehensive deployment guide
2. `AZURE_SETUP_WC_STAGING.md` - Azure infrastructure setup guide
3. `WC_DEPLOYMENT_QUICKSTART.md` - Quick reference for deployments
4. `WC_CICD_SETUP_SUMMARY.md` - This file

## Azure Resources Required

### Shared Infrastructure (Switzerland North)

| Resource Type | Resource Name | Resource Group | Purpose |
|--------------|---------------|----------------|---------|
| Container Registry | `acrwc` | `rg-wc-infra-shared-ch-north` | Docker image storage (shared across environments) |

### Staging Environment (Switzerland North)

| Resource Type | Resource Name | Resource Group | Purpose |
|--------------|---------------|----------------|---------|
| Container App Environment | `cae-wc-stg` | `rg-wc-staging-ch-north` | Container hosting environment |
| Container App | `ca-api-wc-stg` | `rg-wc-staging-ch-north` | Backend API hosting |
| Static Web App | `swa-admin-wc-stg` | `rg-wc-staging-ch-north` | Superadmin portal hosting |
| Static Web App | `swa-provider-wc-stg` | `rg-wc-staging-ch-north` | Provider portal hosting |
| Static Web App | `swa-booking-wc-stg` | `rg-wc-staging-ch-north` | Booking portal hosting |
| PostgreSQL Server | `pg-db-wc-stg` | `rg-wc-staging-ch-north` | Database server |
| Key Vault | `kv-wc-stg` | `rg-wc-staging-ch-north` | Secrets management |
| Storage Account | `sa-wc-stg` | `rg-wc-staging-ch-north` | File storage |

## GitHub Secrets Required

Configure these in GitHub repository settings:

1. **AZURE_CREDENTIALS** - Azure service principal credentials (JSON)
2. **AZURE_SWA_ADMIN_TOKEN** - Deployment token for wc-superadmin
3. **AZURE_SWA_PROVIDER_TOKEN** - Deployment token for wc-provider
4. **AZURE_SWA_BOOKING_TOKEN** - Deployment token for wc-booking
5. **WC_STAGING_API_URL** - Base URL for staging API

## Deployment Flow

```
1. Developer creates tag: wc-v1.0.0
   ↓
2. Push tag to GitHub
   ↓
3. GitHub Actions triggered
   ↓
4. Extract version: v1.0.0
   ↓
5. Build & Deploy (Parallel):
   ├─ Backend API → Azure Container App
   ├─ Superadmin → Azure Static Web App
   ├─ Provider → Azure Static Web App
   └─ Booking → Azure Static Web App
   ↓
6. All apps tagged with version v1.0.0
   ↓
7. Version displayed in UI
```

## Key Features

### 1. Unified Versioning
- Single tag deploys all apps with same version
- Version displayed in all frontend UIs
- Docker images tagged with version

### 2. Automated Deployment
- No manual intervention required
- Consistent deployment process
- Parallel deployment for faster releases

### 3. Database Management
- Automatic migrations on backend startup
- Optional seeding for staging environment
- Prisma-based schema management

### 4. Environment Separation
- Staging-specific configuration
- Separate Azure resources
- Independent from production

## Next Steps

### Before First Deployment

1. **Set up Azure resources** (see `AZURE_SETUP_WC_STAGING.md`)
2. **Configure GitHub secrets**
3. **Update environment variables** in Azure Container App
4. **Test the workflow** with a test tag

### For Each Deployment

1. **Commit and push changes** to main branch
2. **Create version tag**: `git tag wc-v1.0.0`
3. **Push tag**: `git push origin wc-v1.0.0`
4. **Monitor deployment** in GitHub Actions
5. **Verify deployment** on all apps
6. **Check version display** in UIs

## Maintenance

### Regular Tasks
- Monitor deployment logs
- Update dependencies
- Review and optimize Docker images
- Update documentation as needed

### Troubleshooting Resources
- GitHub Actions logs
- Azure Container App logs
- Static Web App deployment logs
- Database connection logs

## Support Documentation

- **Deployment Guide**: `DEPLOYMENT_WC_STAGING.md`
- **Azure Setup**: `AZURE_SETUP_WC_STAGING.md`
- **Quick Start**: `WC_DEPLOYMENT_QUICKSTART.md`
- **This Summary**: `WC_CICD_SETUP_SUMMARY.md`

## Contact

For issues or questions about the CI/CD setup:
1. Check the documentation files
2. Review GitHub Actions logs
3. Consult Azure resource logs
4. Contact the DevOps team

