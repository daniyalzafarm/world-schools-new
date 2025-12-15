# Deployment Sequencing Strategy

## Overview

This document explains the deployment sequencing strategy for the World Camps monorepo to ensure reliable and consistent deployments.

## Problem Statement

**Before:** Frontend applications could deploy successfully even if the backend API deployment failed, leading to:
- ❌ Users seeing deployed frontends with broken API calls
- ❌ Inconsistent deployment states
- ❌ Difficult debugging and rollback scenarios
- ❌ Poor user experience

**After:** Frontend applications only deploy if the backend API is successfully deployed AND healthy, ensuring:
- ✅ Consistent deployment state across all applications
- ✅ Users never see a frontend with a broken backend
- ✅ Clear deployment sequence and easier debugging
- ✅ Atomic deployments (all apps deploy together or none deploy)

## Deployment Flow

```
┌─────────────────────┐
│  Extract Version    │
│  (from git tag)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Build & Deploy API │
│  (wc-nest-api)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Verify API Health  │
│  (10 retries, 15s)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Build & Deploy Frontend Apps       │
│  (parallel matrix deployment)       │
│  - wc-superadmin                    │
│  - wc-provider                      │
│  - wc-booking                       │
└─────────────────────────────────────┘
```

## Implementation Details

### Job Dependencies

```yaml
jobs:
  extract-version:
    # Extracts version from git tag (e.g., wc-v1.2.3 → 1.2.3)
    
  build-and-deploy-api:
    needs: extract-version
    # Builds and deploys wc-nest-api to Azure Container Apps
    
  verify-api-health:
    needs: build-and-deploy-api
    # Verifies API is healthy before proceeding
    # - Waits 30s for Container App to restart
    # - Checks /health endpoint (10 retries, 15s delay)
    # - Validates response contains {"status":"ok"}
    
  build-and-deploy-frontends:
    needs: [extract-version, verify-api-health]
    # Only runs if API is healthy
    # Deploys all frontend apps in parallel using matrix strategy
```

### Health Check Details

**Endpoint:** `https://ca-api-wc-stg.azurecontainerapps.io/health`

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

**Retry Configuration:**
- **Max Retries:** 10 attempts
- **Retry Delay:** 15 seconds between attempts
- **Total Wait Time:** Up to 2.5 minutes (30s initial + 10 × 15s)
- **Failure Behavior:** Workflow fails if health check doesn't pass after all retries

### Frontend Matrix Strategy

The frontend deployment uses `fail-fast: false`, which means:
- All three frontend apps deploy in parallel
- If one app fails (e.g., wc-superadmin), the others continue
- This provides partial deployment capability while maintaining backend dependency

## Benefits

### 1. Deployment Safety
- Frontend apps never deploy with a broken backend
- Health check verifies API is actually responding, not just deployed

### 2. Fail-Fast Behavior
- If backend fails, workflow stops immediately
- Saves CI/CD minutes and Azure deployment costs
- No wasted frontend builds/deployments

### 3. Easier Debugging
- Clear deployment sequence in GitHub Actions logs
- If deployment fails, you know exactly which component failed
- Health check logs show API response for troubleshooting

### 4. Better User Experience
- Users never see deployed frontends with broken APIs
- Consistent deployment state across all applications
- Reduces support tickets and confusion

### 5. Atomic Deployments
- All apps deploy together or none deploy
- Easier to reason about deployment state
- Simplified rollback procedures

## Trade-offs

### Deployment Speed
- **Before:** ~5-7 minutes (parallel deployment)
- **After:** ~8-10 minutes (sequential with health checks)
- **Impact:** +3 minutes for safety and consistency

### Flexibility
- **Limitation:** Can't deploy frontends independently via this workflow
- **Workaround:** Create separate workflow for frontend-only deployments if needed
- **Recommendation:** Use this workflow for full deployments, create `wc-frontend-only-deploy.yml` for hotfixes

## Best Practices

### 1. Health Check Endpoint
- ✅ Keep `/health` endpoint simple and fast
- ✅ Don't include database checks (too slow)
- ✅ Return consistent JSON structure
- ❌ Don't add authentication to health endpoint

### 2. Retry Configuration
- ✅ Use reasonable retry counts (10 is good)
- ✅ Use exponential backoff for production (future enhancement)
- ✅ Log each retry attempt for debugging
- ❌ Don't set retries too low (Container Apps need time to restart)

### 3. Monitoring
- ✅ Monitor deployment success/failure rates
- ✅ Track health check failure reasons
- ✅ Set up alerts for repeated deployment failures
- ✅ Review GitHub Actions logs regularly

## Future Enhancements

### 1. Smoke Tests
Add smoke tests after frontend deployment:
```yaml
verify-frontend-smoke-tests:
  needs: build-and-deploy-frontends
  steps:
    - name: Test critical user flows
      run: |
        # Test login, navigation, API calls
```

### 2. Rollback Automation
Add automatic rollback on failure:
```yaml
rollback-on-failure:
  if: failure()
  needs: [build-and-deploy-api, build-and-deploy-frontends]
  steps:
    - name: Rollback to previous version
```

### 3. Deployment Notifications
Add Slack/Teams notifications:
```yaml
- name: Notify deployment status
  uses: slackapi/slack-github-action@v1
```

## Related Documentation

- [GitHub Actions Workflow](../.github/workflows/wc-staging-deploy.yml)
- [WC Deployment Quickstart](./WC_DEPLOYMENT_QUICKSTART.md)
- [Azure Setup Guide](./AZURE_SETUP_WC_STAGING.md)
- [CI/CD Setup Summary](./WC_CICD_SETUP_SUMMARY.md)

