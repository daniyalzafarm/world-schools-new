# WebSocket-First Architecture: Missing Tasks Plan

**Date:** 2026-02-17
**Source:** `WEBSOCKET_ARCHITECTURE_AUDIT_REPORT.md` Gap Analysis
**Scope:** Tasks required before enabling `WEBSOCKET_MESSAGES` feature flag in production

---

## Task Overview

| Phase | Name | Duration | Priority | Dependencies |
|-------|------|----------|----------|--------------|
| **A** | Fix Duplicate WebSocket Instances | 0.5 day | 🔴 Critical | None |
| **B** | Add Redis Pub/Sub to Global Gateway | 1–2 days | 🔴 Critical | None |
| **C** | Add Heartbeat / Connection Health | 0.5 day | ⚠️ Medium | Phase A |
| **D** | Migrate Typing/Presence to Global Gateway | 2–3 days | 🟠 High | Phase B |
| **E** | Delete Legacy Gateway & Old WS Service | 1 day | 🟠 High | Phase D |
| **F** | Rate Limiting via Redis | 0.5 day | ⚠️ Medium | Phase B |
| **G** | Monitoring & Metrics | 2–3 days | ⚠️ Medium | Phases A–C |
| **H** | Production Rollout | 1–2 weeks | ⚠️ Medium | All above |

**Total:** ~8–12 days of implementation + 1–2 weeks rollout

---

## Phase A: Fix Duplicate WebSocket Instances (0.5 day)

**Goal:** Ensure each app creates exactly ONE global WebSocket connection

**Problem:** Both `providers.tsx` and `messaging-store.ts` independently call
`createGlobalWebSocketService()`, creating two Socket.io connections per user.

**Files to Modify:**

### A.1 Update `apps/wc-booking/src/stores/messaging-store.ts`

**Current (lines 59–70):**
```typescript
// Create global WebSocket service (root namespace - for message sending via Phase 3)
const globalWsService = createGlobalWebSocketService({
  url: config.app.wsUrl.replace(/\/$/, ''),
  getAuthToken: () => {
    const tokens = apiClient.getTokens()
    return tokens.accessToken || null
  },
  debug: config.app.version === 'dev',
})

// Create messaging WebSocket adapter (decouples messaging from global WebSocket)
const messagingWebSocket = createMessagingWebSocketAdapter(globalWsService)
```

**Fix — Import from `providers.tsx` instead:**
```typescript
import { globalWsService } from '@/app/providers'

// Reuse the singleton from providers.tsx (no duplicate connection)
const messagingWebSocket = createMessagingWebSocketAdapter(globalWsService)
```

### A.2 Update `apps/wc-provider/src/stores/messaging-store.ts`

Same change — import `globalWsService` from `@/app/providers` instead of creating a new instance.

### A.3 Remove unused imports

Remove `createGlobalWebSocketService` from import statements in both store files.

**Success Criteria:**
- [ ] Only ONE `createGlobalWebSocketService()` call per app (in `providers.tsx`)
- [ ] `messaging-store.ts` imports the singleton from `providers.tsx`
- [ ] No `createGlobalWebSocketService` import in store files
- [ ] Browser DevTools shows single WebSocket connection per app

**Breaking Changes:** None

---

## Phase B: Add Redis Pub/Sub to Global Gateway (1–2 days)

**Goal:** Enable cross-replica message broadcasting via the global WebSocket gateway

**Problem:** The global `WebSocketService` only emits to locally connected sockets.
When running multiple backend replicas behind a load balancer, a user connected
to Replica A won't receive messages created on Replica B.

**Files to Modify:**

### B.1 Update `apps/wc-nest-api/src/modules/websocket/websocket.module.ts`

- Import `RedisModule` (or inject Redis service)
- Provide Redis pub/sub client to `WebSocketService`

### B.2 Update `apps/wc-nest-api/src/modules/websocket/websocket.service.ts`

Add Redis adapter for Socket.io:

```typescript
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

// In WebSocketGateway.afterInit():
const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()
await Promise.all([pubClient.connect(), subClient.connect()])
this.server.adapter(createAdapter(pubClient, subClient))
```

**Alternative:** Use the existing `RedisPubSubService` pattern from `messaging.gateway.ts`.

### B.3 Update `apps/wc-nest-api/src/modules/websocket/websocket.gateway.ts`

- Add `afterInit()` method to configure Redis adapter
- Subscribe to relevant Redis channels

**Success Criteria:**
- [ ] Socket.io uses Redis adapter for cross-replica broadcasting
- [ ] Messages created on Replica A reach users connected to Replica B
- [ ] `emitToRoom()` works across replicas
- [ ] `emitToUser()` works across replicas

**Breaking Changes:** None (additive)

---

## Phase C: Add Heartbeat / Connection Health (0.5 day)

**Goal:** Detect and clean up zombie WebSocket connections

**Files to Modify:**


Already has reconnection logic. Verify Socket.io client `pingInterval` and `pingTimeout` match server.

**Success Criteria:**
- [ ] Server disconnects idle clients after 35 seconds (25s ping + 10s timeout)
- [ ] `userSockets` map is cleaned up when zombie connections are removed
- [ ] Client reconnects automatically after server-side timeout

**Breaking Changes:** None

---

## Phase D: Migrate Typing/Presence to Global Gateway (2–3 days)

**Goal:** Move typing indicators, presence updates, and read receipts from legacy
`/messages` namespace gateway to global root `/` namespace gateway

**Problem:** The legacy `messaging.gateway.ts` (669 lines) handles:
- `typing:start` / `typing:stop`
- `message:read` / `message:delivered`
- `presence:update`
- `reaction:add` / `reaction:remove`
- `conversation:join` / `conversation:leave`

These must move to the global gateway's event routing system before the legacy
gateway can be deleted.

**Files to Modify:**

### D.1 Create `apps/wc-nest-api/src/modules/messaging/handlers/typing.handler.ts`

```typescript
@Injectable()
export class TypingWebSocketHandler {
  @OnEvent('websocket:typing_start')
  async handleTypingStart(payload) { /* ... */ }

  @OnEvent('websocket:typing_stop')
  async handleTypingStop(payload) { /* ... */ }
}
```

### D.2 Create `apps/wc-nest-api/src/modules/messaging/handlers/receipts.handler.ts`

```typescript
@Injectable()
export class ReceiptsWebSocketHandler {
  @OnEvent('websocket:message_read')
  async handleMessageRead(payload) { /* ... */ }

  @OnEvent('websocket:message_delivered')
  async handleMessageDelivered(payload) { /* ... */ }
}
```

### D.3 Create `apps/wc-nest-api/src/modules/messaging/handlers/presence.handler.ts`

```typescript
@Injectable()
export class PresenceWebSocketHandler {
  @OnEvent('websocket:presence_update')
  async handlePresenceUpdate(payload) { /* ... */ }
}
```

### D.4 Update `apps/wc-nest-api/src/modules/websocket/websocket.gateway.ts`

Add `@SubscribeMessage` handlers for all events above, routing to EventEmitter2.

### D.5 Update `packages/wc-frontend-utils/src/lib/websocket/create-websocket-service.ts`

Ensure the global WS service emits typing, presence, and receipt events.

### D.6 Update `packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts`

Switch typing/presence event listeners from legacy `wsService` to global `messagingWebSocket`
adapter (or a new adapter for typing/presence).

**Success Criteria:**
- [ ] All real-time events route through global gateway
- [ ] Typing indicators work in both apps
- [ ] Read receipts work in both apps
- [ ] Presence updates work in both apps
- [ ] Legacy `/messages` namespace is no longer used by any frontend code

**Breaking Changes:**
- ⚠️ Frontend WebSocket connection must switch from `/messages` namespace to root `/`
- ⚠️ Must coordinate frontend + backend deployment

---

## Phase E: Delete Legacy Gateway & Old WS Service (1 day)

**Goal:** Remove deprecated code from both backend and frontend

**Prerequisites:** Phase D must be complete and verified in staging.

**Files to Delete:**

### Backend
- `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts` (669 lines)

### Frontend
- `packages/wc-frontend-utils/src/lib/messaging/services/create-websocket-service.ts` (574 lines)

**Files to Update:**

### E.1 `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`
- Remove `MessagingGateway` from providers (line 80)
- Remove the comment about legacy gateway

### E.2 `packages/wc-frontend-utils/src/lib/messaging/services/index.ts`
- Remove `create-websocket-service` export

### E.3 `packages/wc-frontend-utils/src/index.ts`
- Remove messaging services re-export if it includes old WS service

### E.4 Both app `messaging-store.ts` files
- Remove `createWebSocketService` import and usage
- Remove `wsService` parameter from `createMessagingStore()` call

### E.5 `packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts`
- Remove `wsService` from config interface (or make optional/deprecated)
- Move remaining legacy event listeners to global adapter

**Success Criteria:**
- [ ] No references to `createWebSocketService` (legacy) in codebase
- [ ] No references to `/messages` namespace in frontend
- [ ] `messaging.gateway.ts` deleted from backend
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors

**Breaking Changes:**
- 🔴 Major: Removes `wsService` from `MessagingStoreConfig` interface
- 🔴 Major: Removes `createWebSocketService` export from shared package
- Must be coordinated with Phase D deployment

---

## Phase F: Rate Limiting via Redis (0.5 day)

**Goal:** Replace DB-based rate limiting with Redis counter

**File to Modify:**

### F.1 `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`

**Current (L328–340):**
```typescript
const recentMessages = await this.prisma.message.count({
  where: {
    conversationId: data.conversationId,
    senderId: data.senderId,
    createdAt: { gte: new Date(Date.now() - 60000) },
  },
})
if (recentMessages > 10) {
  throw new TooManyRequestsException('Rate limit exceeded')
}
```

**Fix — Use Redis INCR with TTL:**
```typescript
const rateLimitKey = `ratelimit:msg:${data.senderId}:${data.conversationId}`
const count = await this.redis.incr(rateLimitKey)
if (count === 1) {
  await this.redis.expire(rateLimitKey, 60)
}
if (count > 10) {
  throw new TooManyRequestsException('Rate limit exceeded')
}
```

**Success Criteria:**
- [ ] Rate limiting uses Redis instead of DB query
- [ ] Latency for rate limit check < 5ms (vs ~50ms for DB query)
- [ ] TTL automatically cleans up keys

**Breaking Changes:** None

---

## Phase G: Monitoring & Metrics (2–3 days)

**Goal:** Build observability for WebSocket health before production rollout

### G.1 Backend Metrics

**File:** `apps/wc-nest-api/src/modules/websocket/websocket.service.ts`

Add counters for:
- Active connections (`ws_active_connections`)
- Messages sent via WebSocket (`ws_messages_sent_total`)
- Messages sent via HTTP fallback (`http_messages_sent_total`)
- Connection errors (`ws_connection_errors_total`)
- Rate limit violations (`ws_rate_limit_violations_total`)
- Average message latency

### G.2 Frontend Metrics

**File:** `packages/wc-frontend-utils/src/lib/websocket/create-websocket-service.ts`

Track and expose:
- Connection uptime
- Reconnection count
- Message queue size
- Fallback to HTTP count

### G.3 Dashboard

- Grafana dashboard with WebSocket health panels
- Sentry alerts for error rate spikes
- Custom logging for A/B comparison (WS vs HTTP latency)

**Success Criteria:**
- [ ] Dashboard shows WebSocket vs HTTP message counts
- [ ] Alert triggers on WebSocket error rate > 1%
- [ ] Latency comparison data available for A/B analysis

**Breaking Changes:** None

---

## Phase H: Production Rollout (1–2 weeks)

**Goal:** Gradually enable WebSocket message sending for all users

**Prerequisites:** Phases A–G complete

### H.1 Week 1: Internal Testing
```bash
# Dev/staging only
NEXT_PUBLIC_ENABLE_WEBSOCKET_MESSAGES=true
ENABLE_WEBSOCKET_MESSAGES=true
```

### H.2 Week 2: 10% of Users
- Use percentage-based feature flag (requires flag service upgrade)
- Monitor error rates and latency

### H.3 Week 3: 50% of Users
- Increase if Week 2 metrics are healthy
- Compare WS vs HTTP latency in dashboard

### H.4 Week 4: 100% of Users
- Full rollout
- Monitor for 1 week
- Remove feature flag code (optional, can keep as kill switch)

### H.5 Rollback Plan
```bash
# Immediate rollback (< 5 minutes)
NEXT_PUBLIC_ENABLE_WEBSOCKET_MESSAGES=false
ENABLE_WEBSOCKET_MESSAGES=false
# Redeploy frontend & backend
```

**Success Criteria:**
- [ ] Message send latency < 100ms (p95) via WebSocket
- [ ] WebSocket connection success rate > 99%
- [ ] Message delivery success rate > 99.9%
- [ ] Zero message loss during rollout
- [ ] Fallback to HTTP usage < 1%

---

## Summary

```
Phase A (0.5d) ──┬── Phase C (0.5d) ──── Phase G (2-3d) ──┐
                  │                                          │
Phase B (1-2d) ──┴── Phase D (2-3d) ──── Phase E (1d) ─────┼── Phase H (1-2w)
                  │                                          │
                  └── Phase F (0.5d) ────────────────────────┘
```

**Critical path:** A → B → D → E → G → H (minimum ~7–9 days before rollout begins)
