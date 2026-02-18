# WebSocket Server Implementation & Deployment Plan

**Version:** 1.0  
**Date:** 2026-01-25  
**Target Environment:** Azure Container Apps (Staging)  
**Estimated Total Time:** 16-20 hours

---

## Table of Contents

1. [Overview](#overview)
2. [Part 1: Codebase Implementation](#part-1-codebase-implementation)
3. [Part 2: Azure Infrastructure Setup](#part-2-azure-infrastructure-setup)
4. [Part 3: Deployment Workflow](#part-3-deployment-workflow)
5. [Part 4: Integration & Testing](#part-4-integration--testing)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

This plan implements a minimal viable WebSocket server that supports:
- ✅ Real-time message delivery
- ✅ Typing indicators
- ✅ User presence tracking
- ✅ Redis pub/sub for multi-instance scaling
- ✅ JWT authentication
- ✅ Room-based message broadcasting

**Architecture:**
```
┌─────────────────┐
│  Frontend Apps  │
│  (wc-booking,   │
│   wc-provider,  │
│   wc-superadmin)│
└────────┬────────┘
         │ WebSocket (wss://)
         ▼
┌─────────────────────────────────────┐
│  Azure Front Door (Optional)        │
│  - SSL Termination                  │
│  - Sticky Sessions                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  ca-websocket-wc-stg                │
│  (Azure Container App)              │
│  - NestJS WebSocket Gateway         │
│  - Socket.io Server                 │
│  - Redis Adapter                    │
│  - Min: 1, Max: 3 replicas          │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────────┐
│ Redis  │ │ PostgreSQL       │
│ Cache  │ │ (via REST API)   │
└────────┘ └──────────────────┘
```

**Key Design Decisions:**
1. **Separate Container App**: WebSocket server runs independently from REST API for better scaling
2. **Redis Adapter**: Enables horizontal scaling across multiple Container App replicas
3. **Stateless Design**: No session state stored in memory, all state in Redis/PostgreSQL
4. **JWT Authentication**: Reuses existing authentication system
5. **Minimal Dependencies**: Start simple, add features incrementally

---

## Part 1: Codebase Implementation

### Task Checklist

#### Phase 1.1: Module Setup (2 hours)

- [ ] **Task 1.1.1**: Create messaging module structure
  - **Time**: 30 min
  - **Files**: 
    - `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`
    - `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts`
  - **Dependencies**: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `socket.io-redis`

- [ ] **Task 1.1.2**: Install required npm packages
  - **Time**: 15 min
  - **Command**: 
    ```bash
    npm install --save @nestjs/websockets @nestjs/platform-socket.io socket.io@4.7.4 socket.io-redis@6.1.1 ioredis@5.3.2
    npm install --save-dev @types/socket.io
    ```

- [ ] **Task 1.1.3**: Create WebSocket configuration service
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/config/websocket.config.ts`

- [ ] **Task 1.1.4**: Set up environment variables
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/.env.example`
  - **Variables**:
    ```
    WEBSOCKET_PORT=3001
    WEBSOCKET_MODE=false
    REDIS_URL=redis://localhost:6379
    JWT_SECRET=your-jwt-secret
    CORS_ORIGINS=http://localhost:3000,http://localhost:3001
    ```

- [ ] **Task 1.1.5**: Update main.ts to support WebSocket mode
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/src/main.ts`
  - **Changes**: Add conditional logic to run WebSocket-only mode

#### Phase 1.2: Authentication & Guards (2 hours)

- [ ] **Task 1.2.1**: Create WebSocket JWT guard
  - **Time**: 1 hour
  - **File**: `apps/wc-nest-api/src/modules/core/auth/guards/ws-jwt.guard.ts`
  - **Purpose**: Validate JWT tokens from WebSocket handshake

- [ ] **Task 1.2.2**: Create WebSocket authentication middleware
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/middleware/ws-auth.middleware.ts`

- [ ] **Task 1.2.3**: Add user decorator for WebSocket
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/src/modules/core/auth/decorators/ws-user.decorator.ts`

#### Phase 1.3: Core Services (3 hours)

- [ ] **Task 1.3.1**: Create Redis pub/sub service
  - **Time**: 1 hour
  - **File**: `apps/wc-nest-api/src/modules/messaging/services/redis-pubsub.service.ts`
  - **Purpose**: Coordinate messages across Container App replicas

- [ ] **Task 1.3.2**: Create presence service
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/services/presence.service.ts`
  - **Purpose**: Track online/offline status

- [ ] **Task 1.3.3**: Create typing indicator service
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts`
  - **Purpose**: Manage typing events with TTL

- [ ] **Task 1.3.4**: Create room management service
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/services/room.service.ts`
  - **Purpose**: Handle Socket.io room join/leave operations

#### Phase 1.4: WebSocket Gateway Implementation (3 hours)

- [ ] **Task 1.4.1**: Implement connection/disconnection handlers
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts`
  - **Events**: `connection`, `disconnect`

- [ ] **Task 1.4.2**: Implement conversation room handlers
  - **Time**: 45 min
  - **Events**: `conversation:join`, `conversation:leave`

- [ ] **Task 1.4.3**: Implement typing indicator handlers
  - **Time**: 30 min
  - **Events**: `typing:start`, `typing:stop`

- [ ] **Task 1.4.4**: Implement message event handlers
  - **Time**: 45 min
  - **Events**: `message:new`, `message:read`, `message:delivered`

- [ ] **Task 1.4.5**: Implement presence handlers
  - **Time**: 15 min
  - **Events**: `presence:update`

#### Phase 1.5: Docker & Configuration (1.5 hours)

- [ ] **Task 1.5.1**: Update Dockerfile for WebSocket mode
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/Dockerfile`
  - **Changes**: Add support for WEBSOCKET_MODE environment variable

- [ ] **Task 1.5.2**: Create docker-compose for local testing
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/docker-compose.websocket.yml`
  - **Services**: WebSocket server, Redis, PostgreSQL

- [ ] **Task 1.5.3**: Update project.json for WebSocket serve command
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/project.json`
  - **Command**: `nx serve-websocket wc-nest-api`

- [ ] **Task 1.5.4**: Create startup script for WebSocket mode
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/scripts/start-websocket.sh`

#### Phase 1.6: Testing (2 hours)

- [ ] **Task 1.6.1**: Create WebSocket gateway unit tests
  - **Time**: 1 hour
  - **File**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.spec.ts`

- [ ] **Task 1.6.2**: Create Redis pub/sub integration tests
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/services/redis-pubsub.service.spec.ts`

- [ ] **Task 1.6.3**: Create WebSocket client test script
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/scripts/test-websocket-client.ts`
  - **Purpose**: Manual testing tool for WebSocket connections

---

## Part 2: Azure Infrastructure Setup

### Task Checklist

#### Phase 2.1: Azure Cache for Redis (1 hour)

- [ ] **Task 2.1.1**: Create Redis Cache via Azure Portal
  - **Time**: 30 min
  - **Steps**:
    1. Navigate to Azure Portal → Create a resource → Azure Cache for Redis
    2. **Basics**:
       - Resource group: `rg-wc-staging-ch-north`
       - DNS name: `redis-wc-messaging-stg`
       - Location: `Switzerland North`
       - Cache type: `Premium P1` (6 GB, recommended for production-like staging)
       - Clustering: Disabled (for simplicity)
    3. **Networking**:
       - Connectivity method: `Public endpoint`
       - Firewall: Add your IP and Container Apps subnet
    4. **Advanced**:
       - Enable non-SSL port: `No` (use SSL only)
       - Minimum TLS version: `1.2`
       - Redis version: `6`
    5. **Tags**: Add appropriate tags
    6. Review + Create

- [ ] **Task 2.1.2**: Configure Redis settings
  - **Time**: 15 min
  - **Steps**:
    1. After deployment, go to Redis resource
    2. Navigate to **Settings** → **Advanced settings**
    3. Set `maxmemory-policy` to `allkeys-lru`
    4. Save changes

- [ ] **Task 2.1.3**: Retrieve Redis connection string
  - **Time**: 15 min
  - **Steps**:
    1. Go to Redis resource → **Settings** → **Access keys**
    2. Copy **Primary connection string (StackExchange.Redis)**
    3. Format: `redis-wc-messaging-stg.redis.cache.windows.net:6380,password=<key>,ssl=True,abortConnect=False`
    4. Store securely for later use

#### Phase 2.2: Container Apps Environment (30 min)

- [ ] **Task 2.2.1**: Verify existing Container Apps Environment
  - **Time**: 15 min
  - **Steps**:
    1. Navigate to `rg-wc-staging-ch-north` resource group
    2. Find `cae-wc-stg` (Container Apps Environment)
    3. Verify it's in `Switzerland North` region
    4. Note the environment ID for later use

- [ ] **Task 2.2.2**: Check networking configuration (optional)
  - **Time**: 15 min
  - **Steps**:
    1. Go to `cae-wc-stg` → **Settings** → **Networking**
    2. If using VNet integration, note the subnet details
    3. Ensure Redis is accessible from this subnet

#### Phase 2.3: WebSocket Container App Creation (1.5 hours)

- [ ] **Task 2.3.1**: Create WebSocket Container App
  - **Time**: 45 min
  - **Steps**:
    1. Navigate to `rg-wc-staging-ch-north` → **Create** → **Container App**
    2. **Basics**:
       - Container app name: `ca-websocket-wc-stg`
       - Region: `Switzerland North`
       - Container Apps Environment: Select `cae-wc-stg`
    3. **Container**:
       - Name: `websocket-server`
       - Image source: `Azure Container Registry`
       - Registry: `acrwc.azurecr.io`
       - Image: `wc-nest-api` (will be updated after build)
       - Tag: `latest-websocket`
       - CPU: `0.5`
       - Memory: `1 Gi`
    4. **Ingress**:
       - Ingress: `Enabled`
       - Ingress traffic: `Accepting traffic from anywhere`
       - Ingress type: `HTTP`
       - Target port: `3001`
       - Session affinity: `Sticky` (IMPORTANT for WebSocket)
       - Transport: `Auto`
    5. Review + Create

- [ ] **Task 2.3.2**: Configure environment variables
  - **Time**: 30 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Settings** → **Containers**
    2. Edit the container
    3. Add environment variables:
       ```
       NODE_ENV=staging
       WEBSOCKET_MODE=true
       WEBSOCKET_PORT=3001
       CORS_ORIGINS=https://wc-booking-stg.azurewebsites.net,https://wc-provider-stg.azurewebsites.net
       ```
    4. Save changes

- [ ] **Task 2.3.3**: Add secrets
  - **Time**: 15 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Settings** → **Secrets**
    2. Add secrets:
       - `redis-url`: `<Redis connection string from Task 2.1.3>`
       - `jwt-secret`: `<Copy from existing ca-api-wc-stg>`
       - `database-url`: `<Copy from existing ca-api-wc-stg>`
    3. Update container environment variables to reference secrets:
       ```
       REDIS_URL=secretref:redis-url
       JWT_SECRET=secretref:jwt-secret
       DATABASE_URL=secretref:database-url
       ```

#### Phase 2.4: Scaling Configuration (30 min)

- [ ] **Task 2.4.1**: Configure scale rules
  - **Time**: 30 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Settings** → **Scale**
    2. Set scale rules:
       - Min replicas: `1`
       - Max replicas: `3`
    3. Add HTTP scaling rule:
       - Rule name: `http-concurrent-requests`
       - Concurrent requests: `100`
    4. Save changes

#### Phase 2.5: Monitoring Setup (45 min)

- [ ] **Task 2.5.1**: Enable Application Insights
  - **Time**: 30 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Settings** → **Application Insights**
    2. Enable Application Insights
    3. Select existing workspace or create new: `appi-wc-stg`
    4. Connection string will be auto-injected as `APPLICATIONINSIGHTS_CONNECTION_STRING`

- [ ] **Task 2.5.2**: Configure log streaming
  - **Time**: 15 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Monitoring** → **Log stream**
    2. Enable console logs
    3. Test by viewing live logs

---

## Part 3: Deployment Workflow

### Task Checklist

#### Phase 3.1: Docker Build & Push (1 hour)

- [ ] **Task 3.1.1**: Build Docker image locally
  - **Time**: 30 min
  - **Commands**:
    ```bash
    # Navigate to monorepo root
    cd /Users/daniyal/files/dev/world-schools

    # Build the NestJS app
    npx nx build wc-nest-api --configuration=production

    # Build Docker image
    docker build \
      -t acrwc.azurecr.io/wc-nest-api:latest-websocket \
      -t acrwc.azurecr.io/wc-nest-api:v1.0.0-websocket \
      -f apps/wc-nest-api/Dockerfile \
      --build-arg WEBSOCKET_MODE=true \
      .
    ```

- [ ] **Task 3.1.2**: Login to Azure Container Registry
  - **Time**: 15 min
  - **Commands**:
    ```bash
    # Login to Azure CLI
    az login

    # Login to ACR
    az acr login --name acrwc
    ```

- [ ] **Task 3.1.3**: Push Docker image to ACR
  - **Time**: 15 min
  - **Commands**:
    ```bash
    # Push both tags
    docker push acrwc.azurecr.io/wc-nest-api:latest-websocket
    docker push acrwc.azurecr.io/wc-nest-api:v1.0.0-websocket
    ```

#### Phase 3.2: Container App Deployment (45 min)

- [ ] **Task 3.2.1**: Deploy via Azure Portal
  - **Time**: 30 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Application** → **Containers**
    2. Click **Edit and deploy**
    3. Update container image:
       - Image: `acrwc.azurecr.io/wc-nest-api:latest-websocket`
    4. Click **Create** to create new revision
    5. Wait for deployment to complete (2-5 minutes)

- [ ] **Task 3.2.2**: Verify deployment
  - **Time**: 15 min
  - **Steps**:
    1. Go to **Revisions and replicas**
    2. Verify new revision is active
    3. Check replica count (should be 1 initially)
    4. Note the application URL: `https://ca-websocket-wc-stg.<unique-id>.switzerlandnorth.azurecontainerapps.io`

#### Phase 3.3: Alternative: Deploy via Azure CLI (Optional)

- [ ] **Task 3.3.1**: Deploy using Azure CLI
  - **Time**: 15 min
  - **Commands**:
    ```bash
    az containerapp update \
      --name ca-websocket-wc-stg \
      --resource-group rg-wc-staging-ch-north \
      --image acrwc.azurecr.io/wc-nest-api:latest-websocket \
      --revision-suffix v1-0-0
    ```

---

## Part 4: Integration & Testing

### Task Checklist

#### Phase 4.1: Health Check & Connectivity (1 hour)

- [ ] **Task 4.1.1**: Test HTTP health endpoint
  - **Time**: 15 min
  - **Commands**:
    ```bash
    # Get the Container App URL
    WEBSOCKET_URL=$(az containerapp show \
      --name ca-websocket-wc-stg \
      --resource-group rg-wc-staging-ch-north \
      --query properties.configuration.ingress.fqdn \
      --output tsv)

    # Test health endpoint
    curl https://$WEBSOCKET_URL/health
    # Expected: {"status":"ok","timestamp":"2026-01-25T..."}
    ```

- [ ] **Task 4.1.2**: Test WebSocket connection using wscat
  - **Time**: 30 min
  - **Commands**:
    ```bash
    # Install wscat globally
    npm install -g wscat

    # Connect to WebSocket server
    wscat -c wss://$WEBSOCKET_URL/messages

    # After connection, authenticate
    > {"event":"authenticate","data":{"token":"<JWT_TOKEN>"}}

    # Expected response:
    < {"event":"authenticated","data":{"userId":"...","success":true}}
    ```

- [ ] **Task 4.1.3**: Verify Redis connectivity
  - **Time**: 15 min
  - **Steps**:
    1. Go to Container App logs
    2. Look for Redis connection messages:
       ```
       [Redis] Connected to redis-wc-messaging-stg.redis.cache.windows.net:6380
       [Redis] Subscribed to channels: messages:new, typing:events
       ```

#### Phase 4.2: Integration with REST API (1 hour)

- [ ] **Task 4.2.1**: Update REST API to publish WebSocket events
  - **Time**: 45 min
  - **File**: `apps/wc-nest-api/src/modules/messages/services/messages.service.ts`
  - **Changes**: Add Redis pub/sub calls when messages are created

- [ ] **Task 4.2.2**: Test end-to-end message flow
  - **Time**: 15 min
  - **Steps**:
    1. Connect WebSocket client
    2. Send message via REST API POST `/api/messages/conversations/:id/messages`
    3. Verify WebSocket client receives `message:new` event

#### Phase 4.3: Frontend Integration (2 hours)

- [ ] **Task 4.3.1**: Update frontend WebSocket connection URL
  - **Time**: 30 min
  - **Files**:
    - `apps/wc-booking/src/lib/config.ts`
    - `apps/wc-provider/src/lib/config.ts`
    - `apps/wc-superadmin/src/lib/config.ts`
  - **Changes**:
    ```typescript
    export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
      'wss://ca-websocket-wc-stg.<unique-id>.switzerlandnorth.azurecontainerapps.io/messages'
    ```

- [ ] **Task 4.3.2**: Update conversation store to use new WebSocket URL
  - **Time**: 30 min
  - **File**: `apps/wc-booking/src/stores/conversation-store.ts`
  - **Changes**: Update `connectSocket` method

- [ ] **Task 4.3.3**: Test real-time features in browser
  - **Time**: 1 hour
  - **Tests**:
    - [ ] Connect to WebSocket on page load
    - [ ] Send message and receive in real-time
    - [ ] Typing indicators work
    - [ ] Presence status updates
    - [ ] Reconnection after network interruption

#### Phase 4.4: CORS Configuration (30 min)

- [ ] **Task 4.4.1**: Configure CORS in WebSocket gateway
  - **Time**: 15 min
  - **File**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts`
  - **Changes**: Add CORS origins from environment variable

- [ ] **Task 4.4.2**: Update Container App environment variables
  - **Time**: 15 min
  - **Steps**:
    1. Go to `ca-websocket-wc-stg` → **Settings** → **Containers**
    2. Update `CORS_ORIGINS` to include all frontend URLs:
       ```
       CORS_ORIGINS=https://wc-booking-stg.azurewebsites.net,https://wc-provider-stg.azurewebsites.net,https://wc-superadmin-stg.azurewebsites.net
       ```

#### Phase 4.5: Load Testing (1 hour)

- [ ] **Task 4.5.1**: Create simple load test script
  - **Time**: 30 min
  - **File**: `apps/wc-nest-api/scripts/load-test-websocket.ts`
  - **Purpose**: Test 100 concurrent WebSocket connections

- [ ] **Task 4.5.2**: Run load test and monitor
  - **Time**: 30 min
  - **Steps**:
    1. Run load test script
    2. Monitor Container App metrics in Azure Portal
    3. Verify auto-scaling triggers (should scale to 2-3 replicas)
    4. Check Application Insights for errors

---

## Troubleshooting Guide

### Common Issues

#### Issue 1: WebSocket Connection Fails

**Symptoms:**
- Browser console shows `WebSocket connection failed`
- Error: `ERR_CONNECTION_REFUSED` or `ERR_CONNECTION_TIMED_OUT`

**Solutions:**
1. **Check Container App is running**:
   ```bash
   az containerapp show \
     --name ca-websocket-wc-stg \
     --resource-group rg-wc-staging-ch-north \
     --query properties.runningStatus
   ```
   Expected: `"Running"`

2. **Verify ingress is enabled**:
   - Go to Container App → **Settings** → **Ingress**
   - Ensure ingress is enabled and target port is `3001`

3. **Check logs for errors**:
   ```bash
   az containerapp logs show \
     --name ca-websocket-wc-stg \
     --resource-group rg-wc-staging-ch-north \
     --tail 50
   ```

4. **Verify sticky sessions are enabled**:
   - Go to Container App → **Settings** → **Ingress**
   - Session affinity should be `Sticky`

#### Issue 2: Authentication Fails

**Symptoms:**
- WebSocket connects but authentication event returns `success: false`
- Error: `Invalid token` or `Unauthorized`

**Solutions:**
1. **Verify JWT_SECRET matches REST API**:
   ```bash
   # Get secret from REST API
   az containerapp show \
     --name ca-api-wc-stg \
     --resource-group rg-wc-staging-ch-north \
     --query properties.template.containers[0].env \
     | grep JWT_SECRET
   ```

2. **Check token format**:
   - Token should be in format: `Bearer <token>`
   - Verify token is not expired (check `exp` claim)

3. **Test with valid token**:
   ```bash
   # Get a valid token from REST API login
   TOKEN=$(curl -X POST https://ca-api-wc-stg.../api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}' \
     | jq -r '.accessToken')

   # Use token in WebSocket connection
   wscat -c wss://ca-websocket-wc-stg.../messages \
     -H "Authorization: Bearer $TOKEN"
   ```

#### Issue 3: Redis Connection Fails

**Symptoms:**
- Container App logs show `Redis connection error`
- Error: `ECONNREFUSED` or `ETIMEDOUT`

**Solutions:**
1. **Verify Redis is running**:
   ```bash
   az redis show \
     --name redis-wc-messaging-stg \
     --resource-group rg-wc-staging-ch-north \
     --query provisioningState
   ```
   Expected: `"Succeeded"`

2. **Check firewall rules**:
   - Go to Redis → **Settings** → **Firewall**
   - Add Container Apps subnet or enable "Allow access from Azure services"

3. **Verify connection string format**:
   - Should include `:6380` (SSL port)
   - Should include `ssl=True`
   - Example: `redis-wc-messaging-stg.redis.cache.windows.net:6380,password=xxx,ssl=True`

4. **Test Redis connectivity from Container App**:
   ```bash
   # Execute command in Container App
   az containerapp exec \
     --name ca-websocket-wc-stg \
     --resource-group rg-wc-staging-ch-north \
     --command "redis-cli -h redis-wc-messaging-stg.redis.cache.windows.net -p 6380 -a <password> --tls PING"
   ```
   Expected: `PONG`

#### Issue 4: Messages Not Broadcasting Across Replicas

**Symptoms:**
- Message sent to one WebSocket connection not received by others
- Only works when all clients connect to same replica

**Solutions:**
1. **Verify Redis adapter is configured**:
   - Check logs for: `[Socket.io] Redis adapter initialized`

2. **Check Redis pub/sub channels**:
   ```bash
   # Connect to Redis
   redis-cli -h redis-wc-messaging-stg.redis.cache.windows.net -p 6380 -a <password> --tls

   # Monitor pub/sub activity
   PSUBSCRIBE *
   ```

3. **Verify RedisPubSubService is publishing**:
   - Add debug logs in `redis-pubsub.service.ts`
   - Check Application Insights for pub/sub events

#### Issue 5: High Latency or Slow Performance

**Symptoms:**
- Message delivery takes > 500ms
- Typing indicators delayed

**Solutions:**
1. **Check Container App CPU/Memory**:
   - Go to Container App → **Monitoring** → **Metrics**
   - Check CPU and memory usage
   - If > 80%, increase resources or scale out

2. **Check Redis latency**:
   ```bash
   redis-cli -h redis-wc-messaging-stg.redis.cache.windows.net -p 6380 -a <password> --tls --latency
   ```
   Expected: < 10ms

3. **Enable Application Insights profiling**:
   - Go to Application Insights → **Investigate** → **Performance**
   - Identify slow operations

4. **Optimize database queries**:
   - Check if WebSocket is making unnecessary DB calls
   - Use Redis cache for frequently accessed data

---

## Summary & Next Steps

### Implementation Timeline

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| **Phase 1: Codebase** | 1.1 - 1.6 | 13.5 hours | ⏳ Not Started |
| **Phase 2: Azure Setup** | 2.1 - 2.5 | 4 hours | ⏳ Not Started |
| **Phase 3: Deployment** | 3.1 - 3.3 | 2 hours | ⏳ Not Started |
| **Phase 4: Integration** | 4.1 - 4.5 | 5.5 hours | ⏳ Not Started |
| **Total** | | **25 hours** | |

### Quick Start Checklist

For a minimal viable WebSocket server, focus on these critical tasks:

**Day 1: Core Implementation (8 hours)**
- [ ] Task 1.1.1 - 1.1.5: Module setup
- [ ] Task 1.2.1 - 1.2.3: Authentication
- [ ] Task 1.3.1: Redis pub/sub service
- [ ] Task 1.4.1 - 1.4.2: Basic gateway handlers

**Day 2: Azure Setup & Deployment (6 hours)**
- [ ] Task 2.1.1 - 2.1.3: Create Redis
- [ ] Task 2.3.1 - 2.3.3: Create Container App
- [ ] Task 3.1.1 - 3.1.3: Build & push Docker image
- [ ] Task 3.2.1 - 3.2.2: Deploy to Container App

**Day 3: Testing & Integration (6 hours)**
- [ ] Task 4.1.1 - 4.1.3: Health checks
- [ ] Task 4.2.1 - 4.2.2: REST API integration
- [ ] Task 4.3.1 - 4.3.3: Frontend integration

### Success Criteria

✅ **Deployment Success**:
- Container App shows "Running" status
- Health endpoint returns 200 OK
- Application Insights shows telemetry data

✅ **Functionality Success**:
- WebSocket connection established from browser
- Authentication succeeds with valid JWT
- Messages broadcast in real-time
- Typing indicators work
- Reconnection works after network interruption

✅ **Performance Success**:
- Message delivery latency < 200ms
- WebSocket connection time < 500ms
- Container App auto-scales to 2-3 replicas under load
- No errors in Application Insights

### Resources

**Documentation**:
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure Cache for Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/)

**Tools**:
- [wscat](https://github.com/websockets/wscat) - WebSocket testing CLI
- [Socket.io Client Tool](https://amritb.github.io/socketio-client-tool/) - Browser-based testing
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/) - Command-line deployment

---

**Next Document**: See `WEBSOCKET_CODE_IMPLEMENTATION.md` for complete code examples and file contents.


