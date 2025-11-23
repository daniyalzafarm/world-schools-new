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

## 13. Configure CORS in Container App

Update the Container App environment variables to allow CORS from Static Web Apps:

```bash
# Get Static Web App URLs
ADMIN_URL=$(az staticwebapp show --resource-group rg-wc-staging-ch-north --name swa-admin-wc-stg --query defaultHostname -o tsv)
PROVIDER_URL=$(az staticwebapp show --resource-group rg-wc-staging-ch-north --name swa-provider-wc-stg --query defaultHostname -o tsv)
BOOKING_URL=$(az staticwebapp show --resource-group rg-wc-staging-ch-north --name swa-booking-wc-stg --query defaultHostname -o tsv)

# Update Container App with CORS origins
az containerapp update \
  --resource-group rg-wc-staging-ch-north \
  --name ca-api-wc-stg \
  --set-env-vars \
    CORS_ORIGIN="https://${ADMIN_URL},https://${PROVIDER_URL},https://${BOOKING_URL}"
```

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

