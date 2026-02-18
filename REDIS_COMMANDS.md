# Redis Commands Reference - WC Nest API Messaging Module

Quick reference guide for Redis operations during local development and testing of the messaging module's cache invalidation logic.

## Table of Contents
- [Cache Clearing Commands](#cache-clearing-commands)
- [Cache Verification Commands](#cache-verification-commands)
- [Cache Monitoring Commands](#cache-monitoring-commands)
- [Cache Inspection Commands](#cache-inspection-commands)
- [Troubleshooting Commands](#troubleshooting-commands)
- [Cache Key Patterns Reference](#cache-key-patterns-reference)

---

## Cache Clearing Commands

### FLUSHALL vs FLUSHDB Comparison

| Command | Scope | Use Case | Safety |
|---------|-------|----------|--------|
| `FLUSHALL` | All databases (0-15) | ✅ **Recommended for local dev** - Complete cleanup | Safe for local dev |
| `FLUSHDB` | Current database only (default: DB 0) | Use when preserving other DBs | Safe for local dev |

### Complete Cache Flush

```bash
# Flush all databases (recommended for testing)
docker exec -it redis_db redis-cli -a redis_password FLUSHALL

# Expected output:
# OK

# Flush only current database (DB 0)
docker exec -it redis_db redis-cli -a redis_password FLUSHDB

# Expected output:
# OK
```

### Selective Pattern-Based Clearing

```bash
# Clear all conversations cache
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversations:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear all messages cache
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'messages:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear all typing indicators
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'typing:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear all presence data
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'presence:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear idempotency keys
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'message:idempotency:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear bookmarks cache
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'bookmarks:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear pinned messages cache
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'messages:pinned:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear conversation metrics cache
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversation:metrics:*' | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}
```

### Clear Cache for Specific User

```bash
# Clear all conversations for a specific user
USER_ID="user-123"
docker exec -it redis_db redis-cli -a redis_password --scan --pattern "conversations:${USER_ID}:*" | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear all bookmarks for a specific user
docker exec -it redis_db redis-cli -a redis_password --scan --pattern "bookmarks:${USER_ID}:*" | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear presence for a specific user
docker exec -it redis_db redis-cli -a redis_password DEL "presence:${USER_ID}"
```

### Clear Cache for Specific Conversation

```bash
# Clear all messages for a specific conversation
CONVERSATION_ID="conv-456"
docker exec -it redis_db redis-cli -a redis_password --scan --pattern "messages:${CONVERSATION_ID}:*" | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear typing indicators for a specific conversation
docker exec -it redis_db redis-cli -a redis_password --scan --pattern "typing:${CONVERSATION_ID}:*" | \
  xargs -I {} docker exec -i redis_db redis-cli -a redis_password DEL {}

# Clear metrics for a specific conversation
docker exec -it redis_db redis-cli -a redis_password DEL "conversation:metrics:${CONVERSATION_ID}"

# Clear pinned messages for a specific conversation
docker exec -it redis_db redis-cli -a redis_password DEL "messages:pinned:${CONVERSATION_ID}"
```

---

## Cache Verification Commands

### Check Total Key Count

```bash
# Get total number of keys in current database
docker exec -it redis_db redis-cli -a redis_password DBSIZE

# Expected output (after FLUSHALL):
# (integer) 0

# Expected output (with cached data):
# (integer) 1247
```

### List All Keys

```bash
# List all keys (WARNING: Use only in development, blocking operation)
docker exec -it redis_db redis-cli -a redis_password KEYS '*'

# Expected output (empty cache):
# (empty array)

# Expected output (with data):
# 1) "conversations:user-123:all:20:0:none"
# 2) "messages:conv-456:50:null:desc"
# 3) "typing:conv-456:user-789"
```

### Check Specific Cache Patterns

```bash
# Check conversations cache
docker exec -it redis_db redis-cli -a redis_password KEYS 'conversations:*'

# Check messages cache
docker exec -it redis_db redis-cli -a redis_password KEYS 'messages:*'

# Check typing indicators
docker exec -it redis_db redis-cli -a redis_password KEYS 'typing:*'

# Check presence data
docker exec -it redis_db redis-cli -a redis_password KEYS 'presence:*'

# Check idempotency keys
docker exec -it redis_db redis-cli -a redis_password KEYS 'message:idempotency:*'

# Check bookmarks
docker exec -it redis_db redis-cli -a redis_password KEYS 'bookmarks:*'

# Check pinned messages
docker exec -it redis_db redis-cli -a redis_password KEYS 'messages:pinned:*'

# Check conversation metrics
docker exec -it redis_db redis-cli -a redis_password KEYS 'conversation:metrics:*'
```

### Count Keys by Pattern (Non-Blocking)

```bash
# Count conversations cache keys
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversations:*' | wc -l

# Count messages cache keys
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'messages:*' | wc -l

# Count typing indicators
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'typing:*' | wc -l
```

### Get Cache Statistics and Memory Usage

```bash
# Get comprehensive Redis info
docker exec -it redis_db redis-cli -a redis_password INFO

# Get memory statistics only
docker exec -it redis_db redis-cli -a redis_password INFO memory

# Expected output:
# used_memory:1048576
# used_memory_human:1.00M
# used_memory_rss:2097152
# used_memory_peak:3145728
# used_memory_peak_human:3.00M
# mem_fragmentation_ratio:2.00

# Get keyspace statistics
docker exec -it redis_db redis-cli -a redis_password INFO keyspace

# Expected output:
# db0:keys=1247,expires=856,avg_ttl=285432

# Get stats section
docker exec -it redis_db redis-cli -a redis_password INFO stats

# Expected output includes:
# total_connections_received:1523
# total_commands_processed:45678
# instantaneous_ops_per_sec:42
# keyspace_hits:12345
# keyspace_misses:678
```

---

## Cache Monitoring Commands

### Real-Time Command Monitoring

```bash
# Monitor all Redis commands in real-time (Ctrl+C to stop)
docker exec -it redis_db redis-cli -a redis_password MONITOR

# Expected output (live stream):
# 1613472123.456789 [0 172.17.0.1:54321] "GET" "conversations:user-123:all:20:0:none"
# 1613472123.567890 [0 172.17.0.1:54322] "SET" "messages:conv-456:50:null:desc" "..."
# 1613472123.678901 [0 172.17.0.1:54323] "DEL" "typing:conv-456:user-789"
```

### Cache Hit/Miss Tracking

```bash
# Get current hit/miss statistics
docker exec -it redis_db redis-cli -a redis_password INFO stats | grep keyspace

# Expected output:
# keyspace_hits:12345
# keyspace_misses:678

# Calculate hit rate
docker exec -it redis_db redis-cli -a redis_password INFO stats | \
  awk '/keyspace_hits/{hits=$2} /keyspace_misses/{misses=$2} END{print "Hit Rate:", (hits/(hits+misses)*100)"%"}'

# Expected output:
# Hit Rate: 94.78%
```

### Memory Usage and Fragmentation

```bash
# Check memory usage
docker exec -it redis_db redis-cli -a redis_password MEMORY USAGE conversations:user-123:all:20:0:none

# Expected output:
# (integer) 2048

# Get memory stats summary
docker exec -it redis_db redis-cli -a redis_password MEMORY STATS

# Expected output:
# 1) "peak.allocated"
# 2) (integer) 3145728
# 3) "total.allocated"
# 4) (integer) 1048576
# 5) "startup.allocated"
# 6) (integer) 524288
# 7) "replication.backlog"
# 8) (integer) 0
# 9) "clients.slaves"
# 10) (integer) 0
# 11) "clients.normal"
# 12) (integer) 16384
# 13) "aof.buffer"
# 14) (integer) 0
# 15) "db.0"
# 16) 1) "overhead.hashtable.main"
#     2) (integer) 72
#     3) "overhead.hashtable.expires"
#     4) (integer) 32

# Check fragmentation ratio
docker exec -it redis_db redis-cli -a redis_password INFO memory | grep fragmentation

# Expected output:
# mem_fragmentation_ratio:1.23
```

### Key Expiration Monitoring

```bash
# Check TTL for a specific key
docker exec -it redis_db redis-cli -a redis_password TTL conversations:user-123:all:20:0:none

# Expected output:
# (integer) 287  # seconds remaining
# (integer) -1   # key exists but has no expiration
# (integer) -2   # key does not exist

# Check TTL for multiple keys
for key in $(docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversations:*' | head -5); do
  echo "Key: $key"
  docker exec -it redis_db redis-cli -a redis_password TTL "$key"
done

# Monitor keys with expiration
docker exec -it redis_db redis-cli -a redis_password INFO keyspace | grep expires

# Expected output:
# db0:keys=1247,expires=856,avg_ttl=285432
```

---

## Cache Inspection Commands

### Get Specific Key Values

```bash
# Get conversation cache value
docker exec -it redis_db redis-cli -a redis_password GET conversations:user-123:all:20:0:none

# Expected output (JSON string):
# "[{\"id\":\"conv-1\",\"type\":\"USER_PROVIDER\",\"participants\":[...]}]"

# Get and pretty-print JSON value
docker exec -it redis_db redis-cli -a redis_password GET conversations:user-123:all:20:0:none | jq .

# Get message cache value
docker exec -it redis_db redis-cli -a redis_password GET messages:conv-456:50:null:desc

# Get typing indicator value
docker exec -it redis_db redis-cli -a redis_password GET typing:conv-456:user-789

# Expected output:
# "1613472123456"  # timestamp in milliseconds

# Get presence value
docker exec -it redis_db redis-cli -a redis_password GET presence:user-123

# Expected output:
# "online" or "offline"

# Get idempotency key value
docker exec -it redis_db redis-cli -a redis_password GET message:idempotency:abc-123-def-456

# Expected output:
# "{\"messageId\":\"msg-789\",\"createdAt\":\"2024-01-15T10:30:00Z\"}"
```

### Check Key TTL

```bash
# Check TTL in seconds
docker exec -it redis_db redis-cli -a redis_password TTL conversations:user-123:all:20:0:none

# Check TTL in milliseconds
docker exec -it redis_db redis-cli -a redis_password PTTL conversations:user-123:all:20:0:none

# Expected output:
# (integer) 287456  # milliseconds remaining
```

### Inspect Key Types

```bash
# Check key type
docker exec -it redis_db redis-cli -a redis_password TYPE conversations:user-123:all:20:0:none

# Expected output:
# string

# Check if key exists
docker exec -it redis_db redis-cli -a redis_password EXISTS conversations:user-123:all:20:0:none

# Expected output:
# (integer) 1  # exists
# (integer) 0  # does not exist

# Get key information
docker exec -it redis_db redis-cli -a redis_password OBJECT ENCODING conversations:user-123:all:20:0:none

# Expected output:
# "embstr" or "raw"
```

### View Cache Key Patterns Used by Messaging Module

```bash
# Sample all cache key patterns (first 10 of each type)
echo "=== Conversations Cache ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversations:*' | head -10

echo "=== Messages Cache ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'messages:*' | head -10

echo "=== Typing Indicators ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'typing:*' | head -10

echo "=== Presence Data ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'presence:*' | head -10

echo "=== Idempotency Keys ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'message:idempotency:*' | head -10

echo "=== Bookmarks ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'bookmarks:*' | head -10

echo "=== Pinned Messages ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'messages:pinned:*' | head -10

echo "=== Conversation Metrics ==="
docker exec -it redis_db redis-cli -a redis_password --scan --pattern 'conversation:metrics:*' | head -10
```

---

## Troubleshooting Commands

### Check Redis Connection

```bash
# Test Redis connection
docker exec -it redis_db redis-cli -a redis_password PING

# Expected output:
# PONG

# Check if Redis container is running
docker ps | grep redis_db

# Expected output:
# abc123def456   redis:latest   "docker-entrypoint.s…"   2 hours ago   Up 2 hours   0.0.0.0:6379->6379/tcp   redis_db

# Check Redis container status
docker inspect redis_db | jq '.[0].State'

# Expected output:
# {
#   "Status": "running",
#   "Running": true,
#   "Paused": false,
#   "Restarting": false,
#   "OOMKilled": false,
#   "Dead": false,
#   "Pid": 12345,
#   "ExitCode": 0,
#   "Error": "",
#   "StartedAt": "2024-01-15T10:00:00.123456789Z",
#   "FinishedAt": "0001-01-01T00:00:00Z"
# }
```

### View Redis Logs

```bash
# View Redis container logs (last 100 lines)
docker logs redis_db --tail 100

# Follow Redis logs in real-time (Ctrl+C to stop)
docker logs redis_db --follow

# View logs with timestamps
docker logs redis_db --timestamps --tail 50

# Search for errors in logs
docker logs redis_db 2>&1 | grep -i error

# Search for warnings in logs
docker logs redis_db 2>&1 | grep -i warning
```

### Restart Redis Container

```bash
# Restart Redis container
docker restart redis_db

# Expected output:
# redis_db

# Verify Redis is running after restart
docker exec -it redis_db redis-cli -a redis_password PING

# Expected output:
# PONG

# Check uptime after restart
docker exec -it redis_db redis-cli -a redis_password INFO server | grep uptime

# Expected output:
# uptime_in_seconds:45
# uptime_in_days:0
```

### Common Error Scenarios and Solutions

#### Error: "NOAUTH Authentication required"

```bash
# Problem: Missing password authentication
# Solution: Add -a redis_password to command

# ❌ WRONG
docker exec -it redis_db redis-cli PING

# ✅ CORRECT
docker exec -it redis_db redis-cli -a redis_password PING
```

#### Error: "Could not connect to Redis"

```bash
# Check if Redis container is running
docker ps | grep redis_db

# If not running, start it
docker start redis_db

# Check Redis logs for errors
docker logs redis_db --tail 50
```

#### Error: "OOM command not allowed when used memory > 'maxmemory'"

```bash
# Check current memory usage
docker exec -it redis_db redis-cli -a redis_password INFO memory | grep used_memory_human

# Check maxmemory setting
docker exec -it redis_db redis-cli -a redis_password CONFIG GET maxmemory

# Solution 1: Increase maxmemory (temporary)
docker exec -it redis_db redis-cli -a redis_password CONFIG SET maxmemory 2gb

# Solution 2: Clear old cache data
docker exec -it redis_db redis-cli -a redis_password FLUSHDB

# Solution 3: Check eviction policy
docker exec -it redis_db redis-cli -a redis_password CONFIG GET maxmemory-policy

# Set eviction policy to remove least recently used keys
docker exec -it redis_db redis-cli -a redis_password CONFIG SET maxmemory-policy allkeys-lru
```

#### Error: "MISCONF Redis is configured to save RDB snapshots"

```bash
# Check Redis configuration
docker exec -it redis_db redis-cli -a redis_password CONFIG GET save

# Disable RDB snapshots (for local dev only)
docker exec -it redis_db redis-cli -a redis_password CONFIG SET save ""

# Or fix disk write permissions
docker exec -it redis_db sh -c "chmod 777 /data"
```

#### Slow Cache Operations

```bash
# Check slow log
docker exec -it redis_db redis-cli -a redis_password SLOWLOG GET 10

# Expected output:
# 1) 1) (integer) 14
#    2) (integer) 1613472123
#    3) (integer) 15000  # execution time in microseconds
#    4) 1) "KEYS"
#       2) "conversations:*"

# Check if KEYS command is being used (should use SCAN instead)
docker exec -it redis_db redis-cli -a redis_password MONITOR | grep KEYS

# Check current connections
docker exec -it redis_db redis-cli -a redis_password CLIENT LIST

# Check command statistics
docker exec -it redis_db redis-cli -a redis_password INFO commandstats
```

#### Cache Invalidation Not Working

```bash
# Verify Pub/Sub channels are active
docker exec -it redis_db redis-cli -a redis_password PUBSUB CHANNELS

# Expected output:
# 1) "cache:invalidate:conversations"
# 2) "cache:invalidate:messages"
# 3) "cache:invalidate:metrics"

# Check Pub/Sub subscribers
docker exec -it redis_db redis-cli -a redis_password PUBSUB NUMSUB cache:invalidate:conversations cache:invalidate:messages cache:invalidate:metrics

# Expected output:
# 1) "cache:invalidate:conversations"
# 2) (integer) 3  # number of subscribers
# 3) "cache:invalidate:messages"
# 4) (integer) 3
# 5) "cache:invalidate:metrics"
# 6) (integer) 3

# Monitor Pub/Sub messages in real-time
docker exec -it redis_db redis-cli -a redis_password SUBSCRIBE cache:invalidate:conversations cache:invalidate:messages cache:invalidate:metrics

# Expected output (when messages are published):
# 1) "subscribe"
# 2) "cache:invalidate:conversations"
# 3) (integer) 1
# 1) "message"
# 2) "cache:invalidate:conversations"
# 3) "{\"userId\":\"user-123\",\"providerId\":null}"
```

---

## Cache Key Patterns Reference

### Conversations Cache

```
Pattern: conversations:{userId}:{filter}:{limit}:{offset}:{providerId|none}
TTL: 300 seconds (5 minutes)
Type: string (JSON array)
Example: conversations:user-123:all:20:0:none
Example: conversations:user-456:unread:50:0:provider-789
```

### Conversation Count Cache

```
Pattern: conversations:count:{userId}:{filter}:{providerId|none}
TTL: 300 seconds (5 minutes)
Type: string (integer)
Example: conversations:count:user-123:all:none
Example: conversations:count:user-456:unread:provider-789
```

### Messages Cache

```
Pattern: messages:{conversationId}:{limit}:{cursor}:{direction}
TTL: 300 seconds (5 minutes)
Type: string (JSON array)
Example: messages:conv-456:50:null:desc
Example: messages:conv-789:20:msg-123:asc
```

### Individual Message Cache

```
Pattern: message:{messageId}
TTL: 300 seconds (5 minutes)
Type: string (JSON object)
Example: message:msg-123
```

### Conversation Metrics Cache

```
Pattern: conversation:metrics:{conversationId}
TTL: 300 seconds (5 minutes)
Type: string (JSON object)
Example: conversation:metrics:conv-456
```

### Idempotency Keys

```
Pattern: message:idempotency:{idempotencyKey}
TTL: 86400 seconds (24 hours)
Type: string (JSON object)
Example: message:idempotency:abc-123-def-456
```

### Pinned Messages Cache

```
Pattern: messages:pinned:{conversationId}
TTL: 300 seconds (5 minutes)
Type: string (JSON array)
Example: messages:pinned:conv-456
```

### Bookmarks Cache

```
Pattern: bookmarks:{userId}:{limit}:{offset}
TTL: 300 seconds (5 minutes)
Type: string (JSON array)
Example: bookmarks:user-123:20:0
```

### Typing Indicators

```
Pattern: typing:{conversationId}:{userId}
TTL: 10 seconds (auto-expires)
Type: string (timestamp)
Example: typing:conv-456:user-789
```

### Presence Data

```
Pattern: presence:{userId}
TTL: 300 seconds (5 minutes, refreshed on activity)
Type: string (status)
Example: presence:user-123
Values: "online" | "offline" | "away"
```

---

## Quick Reference: Common Development Workflows

### Fresh Testing Workflow

```bash
# 1. Clear all cache
docker exec -it redis_db redis-cli -a redis_password FLUSHALL

# 2. Verify cache is empty
docker exec -it redis_db redis-cli -a redis_password DBSIZE

# 3. Monitor cache operations in real-time
docker exec -it redis_db redis-cli -a redis_password MONITOR

# 4. Run your tests
# (in another terminal)

# 5. Verify cache keys were created
docker exec -it redis_db redis-cli -a redis_password KEYS '*'
```

### Cache Invalidation Testing Workflow

```bash
# 1. Monitor Pub/Sub messages
docker exec -it redis_db redis-cli -a redis_password SUBSCRIBE cache:invalidate:conversations cache:invalidate:messages cache:invalidate:metrics

# 2. In another terminal, perform actions that should invalidate cache
# (send message, mark as read, etc.)

# 3. Verify invalidation messages are published
# (check terminal from step 1)

# 4. Verify cache keys were deleted
docker exec -it redis_db redis-cli -a redis_password KEYS 'conversations:*'
docker exec -it redis_db redis-cli -a redis_password KEYS 'messages:*'
```

### Performance Testing Workflow

```bash
# 1. Clear cache and reset stats
docker exec -it redis_db redis-cli -a redis_password FLUSHALL
docker exec -it redis_db redis-cli -a redis_password CONFIG RESETSTAT

# 2. Run performance tests
# (in another terminal)

# 3. Check cache hit rate
docker exec -it redis_db redis-cli -a redis_password INFO stats | grep keyspace

# 4. Check slow operations
docker exec -it redis_db redis-cli -a redis_password SLOWLOG GET 10

# 5. Check memory usage
docker exec -it redis_db redis-cli -a redis_password INFO memory | grep used_memory_human
```

### Debugging Cache Issues Workflow

```bash
# 1. Check if key exists
docker exec -it redis_db redis-cli -a redis_password EXISTS conversations:user-123:all:20:0:none

# 2. Check TTL
docker exec -it redis_db redis-cli -a redis_password TTL conversations:user-123:all:20:0:none

# 3. Get key value
docker exec -it redis_db redis-cli -a redis_password GET conversations:user-123:all:20:0:none | jq .

# 4. Monitor operations on this key
docker exec -it redis_db redis-cli -a redis_password MONITOR | grep conversations:user-123

# 5. Check Pub/Sub for invalidation messages
docker exec -it redis_db redis-cli -a redis_password SUBSCRIBE cache:invalidate:conversations
```

---

## Additional Resources

### Related Documentation
- **Messaging Module Implementation:** `apps/wc-nest-api/src/modules/messaging/`
- **Cache Strategy Audit:** `ai-docs/messages/CACHE_STRATEGY_AUDIT.md`
- **Implementation Plan:** `ai-docs/messages/CONSOLIDATED_CACHE_IMPLEMENTATION_PLAN.md`
- **Verification Report:** `ai-docs/messages/IMPLEMENTATION_VERIFICATION_REPORT.md`

### Redis Documentation
- [Redis Commands Reference](https://redis.io/commands)
- [Redis Pub/Sub](https://redis.io/topics/pubsub)
- [Redis Memory Optimization](https://redis.io/topics/memory-optimization)
- [Redis Persistence](https://redis.io/topics/persistence)

### Docker Commands
- [Docker Exec Reference](https://docs.docker.com/engine/reference/commandline/exec/)
- [Docker Logs Reference](https://docs.docker.com/engine/reference/commandline/logs/)
- [Docker Restart Reference](https://docs.docker.com/engine/reference/commandline/restart/)

---

## Notes

- **Container Name:** `redis_db` (as configured in Docker Compose)
- **Password:** `redis_password` (for local development)
- **Default Database:** DB 0 (used by wc-nest-api)
- **Port:** 6379 (default Redis port)
- **Cache TTL:** 5 minutes (300 seconds) for most caches, 24 hours for idempotency keys
- **Eviction Policy:** Recommended `allkeys-lru` for local development

**⚠️ Important:** These commands are for **local development only**. Do NOT use `FLUSHALL`, `FLUSHDB`, or `KEYS` commands in production environments.

**✅ Production-Safe Commands:** `SCAN`, `TTL`, `EXISTS`, `GET`, `INFO`, `MONITOR` (use sparingly)

---

**Last Updated:** 2024-01-15
**Maintained By:** WC Nest API Team


