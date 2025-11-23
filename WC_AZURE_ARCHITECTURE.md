# World Camps Azure Architecture

## Resource Group Strategy

The World Camps infrastructure uses a **multi-resource group architecture** to separate shared infrastructure from environment-specific resources.

### Why Multiple Resource Groups?

1. **Cost Management**: Easier to track costs per environment
2. **Access Control**: Different RBAC policies for shared vs. environment-specific resources
3. **Lifecycle Management**: Shared resources persist across environment deployments
4. **Isolation**: Environment-specific resources can be deleted/recreated without affecting shared infrastructure

## Resource Groups

### 1. Shared Infrastructure (`rg-wc-infra-shared-ch-north`)

**Purpose**: Contains resources that are shared across multiple environments (staging, production, etc.)

**Resources**:
- **Azure Container Registry (ACR)**: `acrwc`
  - Stores Docker images for all environments
  - Single source of truth for container images
  - Reduces storage costs by avoiding duplicate images
  - Simplifies image management and versioning

**Location**: Switzerland North

**Lifecycle**: Long-lived, persists across all environment deployments

### 2. Staging Environment (`rg-wc-staging-ch-north`)

**Purpose**: Contains all staging-specific resources

**Resources**:
- **Container App Environment**: `cae-wc-stg`
- **Container App (API)**: `ca-api-wc-stg`
- **Static Web Apps**:
  - `swa-admin-wc-stg` (Superadmin Portal)
  - `swa-provider-wc-stg` (Provider Portal)
  - `swa-booking-wc-stg` (Booking Portal)
- **PostgreSQL Server**: `pg-db-wc-stg`
- **Key Vault**: `kv-wc-stg`
- **Storage Account**: `sa-wc-stg`

**Location**: Switzerland North

**Lifecycle**: Can be deleted and recreated for testing or cost optimization

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  rg-wc-infra-shared-ch-north (Shared Infrastructure)       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Azure Container Registry (acrwc)                    │  │
│  │  - wc-nest-api:v1.0.0                               │  │
│  │  - wc-nest-api:v1.1.0                               │  │
│  │  - wc-nest-api:latest                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Pulls images
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  rg-wc-staging-ch-north (Staging Environment)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Container App (ca-api-wc-stg)                       │  │
│  │  Image: acrwc.azurecr.io/wc-nest-api:v1.0.0         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Static Web Apps                                     │  │
│  │  - swa-admin-wc-stg                                 │  │
│  │  - swa-provider-wc-stg                              │  │
│  │  - swa-booking-wc-stg                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (pg-db-wc-stg)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Key Vault (kv-wc-stg)                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Storage Account (sa-wc-stg)                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Future Production Environment

When setting up production, the architecture will follow the same pattern:

```
rg-wc-infra-shared-ch-north (Shared)
  └── acrwc (Container Registry - shared)

rg-wc-production-ch-north (Production)
  ├── ca-api-wc-prod (Container App)
  ├── swa-admin-wc-prod (Static Web App)
  ├── swa-provider-wc-prod (Static Web App)
  ├── swa-booking-wc-prod (Static Web App)
  ├── pg-db-wc-prod (PostgreSQL)
  ├── kv-wc-prod (Key Vault)
  └── sa-wc-prod (Storage Account)
```

## CI/CD Integration

The GitHub Actions workflow is configured to work with this architecture:

```yaml
env:
  AZURE_RESOURCE_GROUP: rg-wc-staging-ch-north      # Staging resources
  ACR_RESOURCE_GROUP: rg-wc-infra-shared-ch-north   # Shared ACR
  ACR_NAME: acrwc
```

### Deployment Flow

1. **Build & Push**: Images are built and pushed to the shared ACR (`acrwc`)
2. **Deploy**: Container App in staging resource group pulls image from shared ACR
3. **Isolation**: Each environment has its own resource group but shares the ACR

## Benefits

### Cost Optimization
- Single ACR for all environments reduces storage costs
- Environment-specific resources can be scaled independently
- Easy to delete staging resources when not needed

### Security
- Separate RBAC policies per resource group
- Shared ACR can have stricter access controls
- Environment isolation prevents accidental cross-environment changes

### Management
- Clear separation of concerns
- Easier to track costs per environment
- Simplified disaster recovery (backup/restore per environment)

### Scalability
- Easy to add new environments (dev, QA, etc.)
- Consistent architecture across environments
- Centralized image management

## Access Control (RBAC)

### Shared Infrastructure Resource Group
- **DevOps Team**: Contributor (manage ACR)
- **CI/CD Service Principal**: AcrPush (push images)
- **Staging Service Principal**: AcrPull (pull images)
- **Production Service Principal**: AcrPull (pull images)

### Staging Resource Group
- **DevOps Team**: Contributor (manage all resources)
- **Staging Service Principal**: Contributor (deploy apps)
- **Developers**: Reader (view resources)

## Naming Conventions

### Resource Groups
- Shared: `rg-wc-infra-shared-{region}`
- Environment: `rg-wc-{environment}-{region}`

### Resources
- Shared: `{resource-type}wc` (e.g., `acrwc`)
- Environment-specific: `{resource-type}-{app}-wc-{env}` (e.g., `ca-api-wc-stg`)

## Maintenance

### Shared Infrastructure
- Monitor ACR storage usage
- Clean up old/unused images periodically
- Review access policies regularly

### Environment Resources
- Staging can be stopped/started to save costs
- Database backups should be configured
- Monitor resource usage and scale as needed

