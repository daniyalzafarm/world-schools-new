# Docker Infrastructure Setup for WebSocket Server

**Date:** 2026-02-09  
**Purpose:** Set up local development infrastructure for WebSocket server implementation

---

## 1. Requirements Analysis

### Required Containers for WebSocket Development

Based on `WEBSOCKET_CODE_IMPLEMENTATION.md`, the WebSocket server requires:

1. **Redis** (Required - NEW)
   - Purpose: Pub/sub for horizontal scaling across Container App replicas
   - Image: `redis:7-alpine`
   - Port: `6379`
   - Features: Persistence with AOF (Append-Only File)
   - Health check: `redis-cli ping`

2. **PostgreSQL** (Already Running ✅)
   - Purpose: Primary database for messages, conversations, users
   - Image: `postgres:17.5-alpine`
   - Port: `5432`
   - Container: `postgres_db`
   - Status: Currently running in `/Users/daniyal/files/dev/docker/docker-compose.yml`

### Current Infrastructure Status

**Existing Containers** (from `/Users/daniyal/files/dev/docker/docker-compose.yml`):
- ✅ PostgreSQL 17.5 - Running on port 5432
- ✅ MySQL 8.0 - Running on port 3306
- ✅ MongoDB 8.0 - Running on port 27017
- ✅ Adminer - Running on port 8081

**Missing Containers**:
- ❌ Redis - Required for WebSocket pub/sub

---

## 2. File Structure Recommendation

### Option 1: Add Redis to Global Docker Compose (RECOMMENDED ✅)

**Location**: `/Users/daniyal/files/dev/docker/docker-compose.yml`

**Pros**:
- ✅ Centralized infrastructure management
- ✅ All databases in one place (PostgreSQL, MySQL, MongoDB, Redis)
- ✅ Single command to start all infrastructure: `docker-compose up -d`
- ✅ Consistent with existing setup
- ✅ Redis available for all apps in the monorepo
- ✅ Easier to manage and maintain

**Cons**:
- ⚠️ Redis runs even when not needed for non-WebSocket work
- ⚠️ Slightly larger global infrastructure footprint

### Option 2: Create App-Specific Docker Compose

**Location**: `apps/wc-nest-api/docker-compose.websocket.yml`

**Pros**:
- ✅ Isolated WebSocket development environment
- ✅ Only runs containers needed for WebSocket work
- ✅ Follows the structure suggested in implementation docs

**Cons**:
- ❌ Duplicate PostgreSQL definition (already in global compose)
- ❌ Need to manage two docker-compose files
- ❌ More complex startup (stop global, start app-specific)
- ❌ Potential port conflicts if both are running

### Option 3: Hybrid Approach

**Location**: Both files

**Setup**:
- Add Redis to `/Users/daniyal/files/dev/docker/docker-compose.yml`
- Create `apps/wc-nest-api/docker-compose.websocket.yml` with only the WebSocket server container

**Pros**:
- ✅ Infrastructure in global compose
- ✅ WebSocket server in app-specific compose
- ✅ Clear separation of concerns

**Cons**:
- ⚠️ More complex setup
- ⚠️ Need to coordinate between two files

---

## 3. Recommended Approach

**✅ RECOMMENDATION: Option 1 - Add Redis to Global Docker Compose**

### Rationale

1. **Consistency**: PostgreSQL is already in the global compose, Redis should be too
2. **Simplicity**: One command to start all infrastructure
3. **Reusability**: Redis can be used by other apps in the future (caching, sessions, etc.)
4. **Monorepo Best Practice**: Shared infrastructure at the root level
5. **Developer Experience**: Simpler mental model - all databases in one place

### Implementation Plan

1. Add Redis service to `/Users/daniyal/files/dev/docker/docker-compose.yml`
2. Update `apps/wc-nest-api/.env.example` with Redis configuration
3. Create `.env` file with Redis URL
4. Start Redis container
5. Verify connectivity

---

## 4. Redis Configuration

### Service Definition

```yaml
redis:
  image: redis:7-alpine
  container_name: redis_db
  restart: always
  command: redis-server --appendonly yes --requirepass redis_password
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  networks:
    - app_network
  healthcheck:
    test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
    interval: 10s
    timeout: 3s
    retries: 3
```

### Key Features

- **Persistence**: `--appendonly yes` enables AOF for data durability
- **Password**: `--requirepass redis_password` for basic security
- **Health Check**: Validates Redis is responding
- **Volume**: `redis_data` for persistent storage
- **Network**: `app_network` for container communication

---

## 5. Environment Variables

### Update `apps/wc-nest-api/.env.example`

Add the following Redis configuration:

```bash
# Redis Configuration (for WebSocket pub/sub)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}"

# WebSocket Configuration
WEBSOCKET_MODE=false
WEBSOCKET_PORT=3001
```

---

## 6. Implementation Steps

### Step 1: Backup Existing Docker Compose

```bash
# Navigate to docker directory
cd /Users/daniyal/files/dev/docker

# Create backup
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d-%H%M%S)

# Verify backup
ls -la docker-compose.yml*
```

### Step 2: Add Redis Service

Add the Redis service definition to `/Users/daniyal/files/dev/docker/docker-compose.yml`:

**Location**: After the `postgres` service, before `mongo`

```yaml
  redis:
    image: redis:7-alpine
    container_name: redis_db
    restart: always
    command: redis-server --appendonly yes --requirepass redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

**Also add** `redis_data` to the volumes section:

```yaml
volumes:
  mysql_data:
    driver: local
  postgres_data:
    driver: local
  mongo_data:
    driver: local
  redis_data:      # ADD THIS
    driver: local
```

### Step 3: Update Environment Variables

```bash
# Navigate to wc-nest-api
cd /Users/daniyal/files/dev/world-schools/apps/wc-nest-api

# Create or update .env file
cat >> .env << 'EOF'

# Redis Configuration (for WebSocket pub/sub)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL="redis://:redis_password@localhost:6379"

# WebSocket Configuration
WEBSOCKET_MODE=false
WEBSOCKET_PORT=3001
EOF
```

### Step 4: Start Redis Container

```bash
# Navigate to docker directory
cd /Users/daniyal/files/dev/docker

# Start Redis (and all other services)
docker-compose up -d redis

# Or restart all services
docker-compose up -d
```

### Step 5: Verify Redis is Running

```bash
# Check container status
docker ps | grep redis

# Expected output:
# redis_db   redis:7-alpine   "docker-entrypoint.s…"   Up X seconds   0.0.0.0:6379->6379/tcp

# Check health status
docker inspect redis_db --format='{{.State.Health.Status}}'

# Expected output: healthy

# View logs
docker logs redis_db --tail 20
```

### Step 6: Test Redis Connectivity

```bash
# Test Redis connection with password
docker exec -it redis_db redis-cli -a redis_password ping

# Expected output: PONG

# Test basic operations
docker exec -it redis_db redis-cli -a redis_password SET test "Hello Redis"
docker exec -it redis_db redis-cli -a redis_password GET test

# Expected output: "Hello Redis"

# Check Redis info
docker exec -it redis_db redis-cli -a redis_password INFO server | grep redis_version
```

### Step 7: Test from Host Machine (Optional)

If you have `redis-cli` installed locally:

```bash
# Install redis-cli (macOS)
brew install redis

# Test connection from host
redis-cli -h localhost -p 6379 -a redis_password ping

# Expected output: PONG
```

### Step 8: Update .env.example

```bash
# Navigate to wc-nest-api
cd /Users/daniyal/files/dev/world-schools/apps/wc-nest-api

# Add Redis configuration to .env.example
# (This will be done via str-replace-editor in the next step)
```

---

## 7. Complete Updated docker-compose.yml

Here's the complete updated file for reference:

```yaml
# Docker Compose to run services locally
services:
  mysql:
    image: mysql:8.0
    container_name: mysql_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app_network

  postgres:
    image: postgres:17.5-alpine
    container_name: postgres_db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network

  redis:
    image: redis:7-alpine
    container_name: redis_db
    restart: always
    command: redis-server --appendonly yes --requirepass redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  mongo:
    image: mongo:8.0
    container_name: mongo_db
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - app_network

  adminer:
    image: adminer
    container_name: adminer
    restart: always
    ports:
      - "8081:8080"
    networks:
      - app_network

volumes:
  mysql_data:
    driver: local
  postgres_data:
    driver: local
  redis_data:
    driver: local
  mongo_data:
    driver: local

networks:
  app_network:
    driver: bridge
```

---

## 8. Verification Checklist

After completing the setup, verify the following:

- [ ] Redis container is running: `docker ps | grep redis_db`
- [ ] Redis health check is passing: `docker inspect redis_db --format='{{.State.Health.Status}}'`
- [ ] Redis responds to PING: `docker exec -it redis_db redis-cli -a redis_password ping`
- [ ] Redis persistence is enabled: `docker exec -it redis_db redis-cli -a redis_password CONFIG GET appendonly`
- [ ] Redis data volume exists: `docker volume ls | grep redis_data`
- [ ] Environment variables are set in `apps/wc-nest-api/.env`
- [ ] `.env.example` is updated with Redis configuration

---

## 9. Common Commands

### Start/Stop Services

```bash
# Start all services
cd /Users/daniyal/files/dev/docker
docker-compose up -d

# Start only Redis
docker-compose up -d redis

# Stop all services
docker-compose down

# Stop Redis only
docker-compose stop redis

# Restart Redis
docker-compose restart redis
```

### Monitor Services

```bash
# View all running containers
docker ps

# View Redis logs
docker logs redis_db -f

# View Redis stats
docker stats redis_db

# Check Redis memory usage
docker exec -it redis_db redis-cli -a redis_password INFO memory
```

### Redis Operations

```bash
# Connect to Redis CLI
docker exec -it redis_db redis-cli -a redis_password

# Monitor Redis commands in real-time
docker exec -it redis_db redis-cli -a redis_password MONITOR

# Check connected clients
docker exec -it redis_db redis-cli -a redis_password CLIENT LIST

# Flush all data (CAUTION!)
docker exec -it redis_db redis-cli -a redis_password FLUSHALL
```

---

## 10. Troubleshooting

### Issue 1: Redis Container Won't Start

**Symptoms**: `docker-compose up -d redis` fails

**Solutions**:
1. Check if port 6379 is already in use:
   ```bash
   lsof -i :6379
   ```
2. Check Docker logs:
   ```bash
   docker logs redis_db
   ```
3. Verify docker-compose.yml syntax:
   ```bash
   docker-compose config
   ```

### Issue 2: Health Check Failing

**Symptoms**: `docker inspect redis_db --format='{{.State.Health.Status}}'` shows `unhealthy`

**Solutions**:
1. Check Redis logs:
   ```bash
   docker logs redis_db --tail 50
   ```
2. Test Redis manually:
   ```bash
   docker exec -it redis_db redis-cli -a redis_password ping
   ```
3. Restart container:
   ```bash
   docker-compose restart redis
   ```

### Issue 3: Connection Refused from Application

**Symptoms**: NestJS app can't connect to Redis

**Solutions**:
1. Verify Redis is running:
   ```bash
   docker ps | grep redis_db
   ```
2. Check REDIS_URL in .env:
   ```bash
   cat apps/wc-nest-api/.env | grep REDIS_URL
   ```
3. Test connection from host:
   ```bash
   redis-cli -h localhost -p 6379 -a redis_password ping
   ```
4. Verify network connectivity:
   ```bash
   docker network inspect docker_app_network
   ```

### Issue 4: Data Not Persisting

**Symptoms**: Redis data lost after container restart

**Solutions**:
1. Verify AOF is enabled:
   ```bash
   docker exec -it redis_db redis-cli -a redis_password CONFIG GET appendonly
   ```
2. Check volume mount:
   ```bash
   docker inspect redis_db --format='{{json .Mounts}}' | jq
   ```
3. Verify volume exists:
   ```bash
   docker volume ls | grep redis_data
   ```

---

## 11. Next Steps

After completing this infrastructure setup:

1. ✅ **Infrastructure Ready**: Redis and PostgreSQL are running
2. ⏭️ **Implement WebSocket Code**: Follow `WEBSOCKET_CODE_IMPLEMENTATION.md`
3. ⏭️ **Test Locally**: Use `docker-compose.websocket.yml` for full stack testing
4. ⏭️ **Deploy to Azure**: Follow `WEBSOCKET_IMPLEMENTATION_PLAN.md`

---

## Summary

**What Was Done**:
- ✅ Analyzed WebSocket infrastructure requirements
- ✅ Identified Redis as the only missing component
- ✅ Recommended adding Redis to global docker-compose.yml
- ✅ Provided complete Redis configuration with persistence and health checks
- ✅ Created step-by-step implementation guide
- ✅ Included verification and troubleshooting steps

**Infrastructure Status**:
- ✅ PostgreSQL: Already running
- ⏳ Redis: Ready to be added (follow Step 2-6)

**Ready for**: WebSocket server code implementation
