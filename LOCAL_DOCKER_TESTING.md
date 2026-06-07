# Local Docker Testing — build-once runtime config

Use this runbook to verify the new build-once Docker images work correctly **before** pushing a tag (which would build and auto-deploy to staging).

What we're validating:

1. Each frontend image builds **without** any `BUILD_ENV` arg.
2. The same image, started with different env vars, serves different config values — proving runtime injection works and nothing got baked in at build time.
3. The inline `<script>window.__APP_CONFIG__=…</script>` is present in the served HTML and is XSS-safe (`serialize-javascript` wired correctly).
4. The `/config.json` route handler returns the same shape (Channel B works for smoke-test tooling).

Everything runs on the local Docker daemon — no Azure resources are touched.

---

## Prereqs

- Docker Desktop running (or any Docker engine + buildx).
- Optional: local API running at `http://localhost:3000` (via `npx nx serve wc-nest-api`). The frontends will point at it via `host.docker.internal:3000` so the browser has a real backend to talk to. **If the local API isn't running, the frontends still serve HTML and `/config.json` correctly** — only browser network calls will fail. That's fine for verifying the runtime-config plumbing, which is the point of this test.

---

## Step 1 — Build each frontend image without `BUILD_ENV`

Run from the monorepo root:

```bash
docker build -f apps/wc-booking/Dockerfile    -t wc-booking:local    .
docker build -f apps/wc-provider/Dockerfile   -t wc-provider:local   .
docker build -f apps/wc-superadmin/Dockerfile -t wc-superadmin:local .
```

**Pass criteria:** all three builds succeed with **no** `--build-arg BUILD_ENV=…` flag. If any build fails because something reads `process.env.X` at build phase, that's a `requireEnv` slip that didn't honor `isBuildPhase` — fix and re-run.

---

## Step 2 — Run each container with runtime env vars, verify config injection

Use port mappings that don't clash with the local API on 3000.

### 2a. Booking

```bash
docker run --rm -d \
  --name wc-booking-local \
  -p 4303:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION=local-1.0.0 \
  -e APP_URL=http://localhost:4303 \
  -e API_BASE_URL=http://host.docker.internal:3000/ \
  -e WS_URL=http://host.docker.internal:3000 \
  -e STORAGE_URL=http://host.docker.internal:3000/ \
  -e AUTH_USING_REQUEST=false \
  -e GOOGLE_MAPS_API_KEY=local-test-key \
  -e STRIPE_PUBLISHABLE_KEY=pk_test_local \
  -e ENABLE_WEBSOCKET_MESSAGES=true \
  -e WEBSOCKET_FALLBACK_HTTP=true \
  wc-booking:local

# Wait ~3 seconds for next start, then verify:
curl -s http://localhost:4303/ | grep -o 'window.__APP_CONFIG__=[^<]*' | head -1
curl -s http://localhost:4303/config.json | jq
```

**Pass criteria:**

- HTML response contains `window.__APP_CONFIG__={...};` with `"appVersion":"local-1.0.0"` and `"apiBaseUrl":"http://host.docker.internal:3000/"` visible.
- `/config.json` returns the same JSON shape with matching values.

### 2b. Provider

```bash
docker run --rm -d \
  --name wc-provider-local \
  -p 4302:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION=local-1.0.0 \
  -e APP_URL=http://localhost:4302 \
  -e API_BASE_URL=http://host.docker.internal:3000/ \
  -e WS_URL=http://host.docker.internal:3000 \
  -e BOOKING_APP_URL=http://localhost:4303 \
  -e SUPERADMIN_APP_URL=http://localhost:4301 \
  -e AUTH_USING_REQUEST=false \
  -e GOOGLE_MAPS_API_KEY=local-test-key \
  -e STRIPE_PUBLISHABLE_KEY=pk_test_local \
  -e ENABLE_WEBSOCKET_MESSAGES=true \
  -e WEBSOCKET_FALLBACK_HTTP=true \
  wc-provider:local

curl -s http://localhost:4302/config.json | jq
```

### 2c. Superadmin

```bash
docker run --rm -d \
  --name wc-superadmin-local \
  -p 4301:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION=local-1.0.0 \
  -e APP_URL=http://localhost:4301 \
  -e API_BASE_URL=http://host.docker.internal:3000/ \
  -e WS_URL=http://host.docker.internal:3000 \
  -e PROVIDER_APP_URL=http://localhost:4302 \
  -e BOOKING_APP_URL=http://localhost:4303 \
  -e AUTH_USING_REQUEST=false \
  wc-superadmin:local

curl -s http://localhost:4301/config.json | jq
```

---

## Step 3 — Prove the SAME image runs in two different "envs"

This is the load-bearing test: it proves no env value got baked into the image at build time.

```bash
# Stop the booking container from step 2a
docker rm -f wc-booking-local

# Run the SAME wc-booking:local image with completely DIFFERENT env values
docker run --rm -d \
  --name wc-booking-alt \
  -p 4304:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION=alt-99.99.99 \
  -e APP_URL=https://booking.alt.example \
  -e API_BASE_URL=https://api.alt.example/ \
  -e WS_URL=https://api.alt.example \
  -e STRIPE_PUBLISHABLE_KEY=pk_live_alt_xxx \
  wc-booking:local

curl -s http://localhost:4304/config.json | jq
```

**Pass criteria:** `/config.json` now returns `"appVersion":"alt-99.99.99"`, `"apiBaseUrl":"https://api.alt.example/"`, `"stripePublishableKey":"pk_live_alt_xxx"` — proving the values come from runtime env, not the image bits. The image digest before and after is identical (`docker images --digests`).

---

## Step 4 — XSS-safe escaping test

This proves `serialize-javascript` is wired correctly and a hostile env value cannot break out of the inline `<script>`.

```bash
docker rm -f wc-booking-alt

docker run --rm -d \
  --name wc-booking-xss \
  -p 4305:3000 \
  -e NODE_ENV=production \
  -e APP_VERSION='local-xss' \
  -e APP_URL=http://localhost:4305 \
  -e API_BASE_URL=http://host.docker.internal:3000/ \
  -e GOOGLE_MAPS_API_KEY='</script><script>alert(1)</script>' \
  wc-booking:local

# Inspect the inline-script payload and assert no literal </script> appears.
# (A plain `grep -o '__APP_CONFIG__=[^"]*'` does NOT work — the JSON payload
# is full of `"` so the regex stops at the first quote and tells you nothing.)
curl -s http://localhost:4305/ | python3 - <<'PY'
import sys, re
html = sys.stdin.read()
m = re.search(r'<script[^>]*>(window\.__APP_CONFIG__=[^<]*)</script>', html)
if not m:
    print('FAIL: window.__APP_CONFIG__ <script> not found in HTML'); sys.exit(1)
payload = m.group(1)
print('--- payload (first 600 chars) ---')
print(payload[:600])
print('---')
if '</script>' in payload:
    print('FAIL: literal </script> in payload — XSS-escape did NOT work'); sys.exit(1)
print('PASS: no literal </script> in payload — serializer escaped it correctly')
PY
```

**Pass criteria:** the python check prints `PASS`. In the payload dump you should see the hostile value rendered as something like `</script><script>alert(1)</script>` (or with `<\/script>` form) inside `"googleMapsApiKey":"…"` — never a literal `</script>`.

For a visual check, open `http://localhost:4305/` in a browser. The page should load normally with no `alert(1)` popup and no JS console error.

---

## Step 5 (optional) — Full local stack including the API

The API needs Postgres + Redis to start. If your local Docker Postgres + Redis are already running, you can also build + test the API image:

```bash
docker build -f apps/wc-nest-api/Dockerfile -t wc-nest-api:local .

# Run the API pointing at host Postgres/Redis (adjust to match your local setup)
docker run --rm -d --name wc-api-local -p 3000:3000 \
  -e NODE_ENV=dev \
  -e APP_VERSION=local-1.0.0 \
  -e PORT=3000 \
  -e APP_URL=http://localhost:3000 \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wc-booking-system \
  -e POSTGRES_REQUIRE_SSL=false \
  -e JWT_SECRET=local-jwt-secret-please-change \
  -e JWT_REFRESH_SECRET=local-jwt-refresh-secret-please-change \
  -e REDIS_URL=redis://:redis_password@host.docker.internal:6379 \
  -e CORS_ORIGINS=http://localhost:4301,http://localhost:4302,http://localhost:4303 \
  -e EMAIL_HOST=smtp.example -e EMAIL_PORT=587 -e EMAIL_USER=x -e EMAIL_PASS=x -e EMAIL_FROM=x \
  -e STRIPE_PUBLISHABLE_KEY=pk_test_local -e STRIPE_SECRET_KEY=sk_test_local -e STRIPE_WEBHOOK_SECRET=whsec_local -e STRIPE_CONNECT_WEBHOOK_SECRET=whsec_local \
  -e AZURE_STORAGE_ACCOUNT_URL=http://localhost -e AZURE_STORAGE_ACCOUNT_NAME=x -e AZURE_STORAGE_ACCOUNT_KEY=x -e AZURE_STORAGE_CONTAINER_NAME=x \
  -e GOOGLE_PLACES_API_KEY=x \
  wc-nest-api:local

# Wait ~10 seconds for migrations + boot, then:
curl -s http://localhost:3000/health
```

**Pass criteria:** `{"success":true,"data":{"status":"ok","timestamp":"2026-05-21T09:51:55.002Z","version":"local-1.0.0"}}`. If this works, the frontends from steps 2a–2c can hit it via `host.docker.internal:3000`.

This step is optional because the API hasn't structurally changed — the goal of this test session is to validate the **frontend** refactor.

---

## Cleanup

```bash
docker rm -f wc-booking-local wc-booking-alt wc-booking-xss wc-provider-local wc-superadmin-local wc-api-local 2>/dev/null
docker rmi wc-booking:local wc-provider:local wc-superadmin:local wc-nest-api:local 2>/dev/null
```

---

## What this gives you

If all four steps pass:

- **Step 1** confirms the Dockerfile change works (no `BUILD_ENV` needed).
- **Steps 2a–2c** confirm runtime config flows from `-e KEY=VALUE` → inline `<script>` → `/config.json`.
- **Step 3** confirms the same image bits serve different env values (build-once is real).
- **Step 4** confirms XSS-safe serialization is wired (must-have #1).

After that, push a `wc-vX.Y.Z` tag with high confidence the staging workflow will succeed. The smoke tests in [`.github/workflows/wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml) do the same checks against the real deployed URLs.

---

## Out of scope

- Testing the staging GitHub Actions workflow end-to-end — requires pushing a tag and watching the run.
- Testing the `caj-migrate-*` Container Apps Job locally — it's an Azure-specific resource. The migration logic itself (`npx prisma migrate deploy`) can be tested against local Postgres separately, but the Job wrapper can't.
- Performance / load testing — separate concern.
