# Version Verification in Deployment Pipeline

## Overview

The deployment pipeline now includes **version verification** to ensure that the deployed API is actually running the specific version that corresponds to the git tag that triggered the workflow.

## Problem Statement

### Before: Race Condition Risk

**Scenario:**
```
1. Workflow triggers with tag wc-v1.2.3
2. API deployment command executes (az containerapp update)
3. Azure starts pulling new image in background
4. Health check runs immediately after deployment command
5. Health check hits the OLD version (v1.2.2) still running ❌
6. Health check passes ✅ (old version is healthy)
7. Frontends deploy (expecting v1.2.3 API)
8. Azure finishes deploying v1.2.3
9. Brief period where frontends (v1.2.3) talk to API (v1.2.2) ❌
```

**The Issue:**
- ❌ Health check could pass against the **previous deployment**
- ❌ Azure Container Apps can take time to pull and deploy new images
- ❌ Frontends could deploy thinking they're compatible with v1.2.3, but API is still running v1.2.2
- ❌ Version mismatch between frontend and backend

### After: Version Verification

**Scenario:**
```
1. Workflow triggers with tag wc-v1.2.3
2. API deployment command executes (az containerapp update)
3. Azure starts pulling new image in background
4. Health check runs and gets response from OLD version (v1.2.2)
5. Health check extracts version from response: "1.2.2"
6. Health check compares: expected "1.2.3" != deployed "1.2.2" ❌
7. Health check retries (waits 15s)
8. Azure finishes deploying v1.2.3
9. Health check gets response from NEW version (v1.2.3)
10. Health check compares: expected "1.2.3" == deployed "1.2.3" ✅
11. Health check passes
12. Frontends deploy (guaranteed to talk to v1.2.3 API) ✅
```

**The Solution:**
- ✅ Health check verifies the **exact version** is deployed
- ✅ Retries until the correct version is running
- ✅ Prevents version mismatches between frontend and backend
- ✅ Guarantees atomic version deployment

## Implementation

### Part 1: Health Endpoint Returns Version

**File:** `apps/wc-nest-api/src/modules/health/health.service.ts`

```typescript
@Injectable()
export class HealthService {
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'unknown',  // ← NEW
    }
  }
}
```

**Response Example:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "version": "1.2.3"
}
```

### Part 2: Workflow Verifies Version

**File:** `.github/workflows/wc-staging-deploy.yml`

**Changes:**
1. Added `extract-version` to `verify-api-health` job's `needs` array
2. Extract expected version from workflow context
3. Extract deployed version from health response
4. Compare versions and only pass if they match

**Key Code:**
```bash
EXPECTED_VERSION="${{ needs.extract-version.outputs.version }}"
DEPLOYED_VERSION=$(echo "$RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

if [ "$DEPLOYED_VERSION" = "$EXPECTED_VERSION" ]; then
  echo "✅ Version verification passed - API is running v${EXPECTED_VERSION}"
  exit 0
else
  echo "⚠️ Version mismatch: expected v${EXPECTED_VERSION}, got v${DEPLOYED_VERSION}"
  # Retry...
fi
```

## Health Check Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Health Check with Version Verification                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ Wait 30 seconds│
                  └────────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Attempt 1/10           │
              │ GET /health            │
              └────────┬───────────────┘
                       │
                       ▼
              ┌────────────────────────┐
              │ HTTP 200?              │
              └────┬───────────────┬───┘
                   │ Yes           │ No
                   ▼               ▼
         ┌─────────────────┐   ┌──────────┐
         │ status: "ok"?   │   │ Wait 15s │
         └────┬────────┬───┘   └────┬─────┘
              │ Yes    │ No         │
              ▼        ▼            │
    ┌──────────────┐  │             │
    │ Extract      │  │             │
    │ version      │  │             │
    └──────┬───────┘  │             │
           │          │             │
           ▼          │             │
    ┌──────────────────────┐       │
    │ version matches?     │       │
    └──┬──────────────┬────┘       │
       │ Yes          │ No         │
       ▼              ▼            │
    ┌─────┐    ┌──────────┐       │
    │ ✅  │    │ Wait 15s │       │
    │PASS │    └────┬─────┘       │
    └─────┘         │             │
                    ▼             │
              ┌────────────────┐  │
              │ Attempt 2/10   │◄─┘
              └────────────────┘
                     ...
              ┌────────────────┐
              │ Attempt 10/10  │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Still no match?│
              └────────┬───────┘
                       │
                       ▼
                    ┌─────┐
                    │ ❌  │
                    │FAIL │
                    └─────┘
```

## Example Logs

### Successful Deployment (Version Matches)

```
🏥 Checking API health at: https://ca-api-wc-stg.azurecontainerapps.io/health
🎯 Expected version: 1.2.3

Attempt 1/10...
✅ API is responding (HTTP 200)
Response: {"status":"ok","timestamp":"2025-12-15T10:30:00.000Z","version":"1.2.3"}
✅ Status is OK
📦 Deployed version: 1.2.3
✅ Version verification passed - API is running v1.2.3
```

### Deployment in Progress (Version Mismatch, Then Success)

```
🏥 Checking API health at: https://ca-api-wc-stg.azurecontainerapps.io/health
🎯 Expected version: 1.2.3

Attempt 1/10...
✅ API is responding (HTTP 200)
Response: {"status":"ok","timestamp":"2025-12-15T10:30:00.000Z","version":"1.2.2"}
✅ Status is OK
📦 Deployed version: 1.2.2
⚠️ Version mismatch: expected v1.2.3, got v1.2.2
   Container App may still be deploying the new version...
⏳ Waiting 15s before retry...

Attempt 2/10...
✅ API is responding (HTTP 200)
Response: {"status":"ok","timestamp":"2025-12-15T10:30:15.000Z","version":"1.2.3"}
✅ Status is OK
📦 Deployed version: 1.2.3
✅ Version verification passed - API is running v1.2.3
```

### Failed Deployment (Version Never Matches)

```
🏥 Checking API health at: https://ca-api-wc-stg.azurecontainerapps.io/health
🎯 Expected version: 1.2.3

Attempt 1/10...
✅ API is responding (HTTP 200)
📦 Deployed version: 1.2.2
⚠️ Version mismatch: expected v1.2.3, got v1.2.2
⏳ Waiting 15s before retry...

... (attempts 2-9 similar) ...

Attempt 10/10...
✅ API is responding (HTTP 200)
📦 Deployed version: 1.2.2
⚠️ Version mismatch: expected v1.2.3, got v1.2.2
   Container App may still be deploying the new version...

❌ API health check failed after 10 attempts
   Either the API is not healthy, or it's not running version 1.2.3
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Version Guarantee** | Frontends only deploy when API is running the exact expected version |
| **Race Condition Prevention** | Eliminates race conditions during Azure Container App deployments |
| **Atomic Deployments** | All apps deploy with matching versions |
| **Deployment Confidence** | Clear verification that the correct version is deployed |
| **Easier Debugging** | Logs show exactly which version is deployed at each retry |

## Configuration

### Retry Settings

- **Max Retries:** 10 attempts
- **Retry Delay:** 15 seconds
- **Total Max Wait:** ~2.5 minutes (30s initial + 10 × 15s)

### Why These Settings?

- **30s initial wait:** Azure Container Apps typically take 20-40s to start pulling new images
- **15s retry delay:** Balances responsiveness with avoiding excessive API calls
- **10 retries:** Provides ~2.5 minutes for Azure to deploy, which covers most scenarios

### Adjusting Settings

If deployments consistently fail due to timeout, you can adjust:

```yaml
MAX_RETRIES=15      # Increase to 15 attempts (3.75 min total)
RETRY_DELAY=20      # Increase to 20 seconds between retries
```

## Related Documentation

- [Deployment Sequencing Strategy](./DEPLOYMENT_SEQUENCING.md)
- [Workflow Changes Summary](./WORKFLOW_CHANGES_SUMMARY.md)
- [Deployment Comparison](./DEPLOYMENT_COMPARISON.md)

