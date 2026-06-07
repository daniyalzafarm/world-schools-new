# Must-Have Before Production

The current build-once, deploy-many plan is directionally correct, but the following items must be added before considering the deployment model production-ready.

---

## 1. Make Runtime Config Injection XSS-Safe

The current inline script approach should not use raw `JSON.stringify(config)` directly inside `dangerouslySetInnerHTML`.

### Required Change

Use a safe serializer such as `serialize-javascript`, or manually escape dangerous characters such as:

- `</script>`
- `<`
- `>`
- `&`
- Unicode line separators

Recommended pattern:

```ts
import serialize from 'serialize-javascript';

<script
  dangerouslySetInnerHTML={{
    __html: `window.__APP_CONFIG__=${serialize(config, { isJSON: true })};`,
  }}
/>
```

### Acceptance Criteria

- Runtime config cannot break out of the `<script>` tag.
- No raw unescaped config object is injected into HTML.
- All three frontends use the same safe serialization approach.

---

## 2. Ensure Runtime Config Is Truly Evaluated at Runtime

Because these are Next.js App Router apps, we must make sure the runtime config is not statically evaluated or cached at build time.

### Required Change

Add an explicit runtime/dynamic boundary around the config injection.

Example:

```ts
export const dynamic = 'force-dynamic';
```

Apply this where the root layout or config-injection component reads `process.env`.

### Acceptance Criteria

- Changing Container App runtime env vars changes the injected config after redeploying/restarting the container.
- No frontend config values are baked into the Docker image.
- `docker build` works without any environment-specific build args.

---

## 3. Add Strict Runtime Config Typing and Validation

Runtime config should fail loudly if required values are missing.

### Required Change

Define a typed runtime config shape:

```ts
export type AppRuntimeConfig = {
  apiBaseUrl: string;
  appUrl: string;
  appVersion: string;
  wsUrl?: string;
  storageUrl?: string;
  googleMapsApiKey?: string;
  stripePublishableKey?: string;
  enableWebsocketMessages: boolean;
  websocketFallbackHttp: boolean;
};
```

Add global typing for the browser object:

```ts
declare global {
  interface Window {
    __APP_CONFIG__: AppRuntimeConfig;
  }
}
```

Add required env validation:

```ts
function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required runtime env: ${name}`);
  }

  return value;
}
```

### Acceptance Criteria

- Missing required config values fail clearly.
- Client code has proper TypeScript support for `window.__APP_CONFIG__`.
- Boolean values are parsed safely instead of treated as raw strings.

---

## 4. Keep Frontend Public Config as Variables, Not Secrets

Do not treat browser-exposed values as real secrets.

Frontend values such as the following are public by nature:

- Stripe publishable key
- Google Maps browser key
- API base URL
- WebSocket URL
- App URL
- Feature flags

### Required Change

Store browser-exposed values in GitHub Variables / Container App runtime env vars, not GitHub Secrets, unless there is a very specific reason.

### Google Maps Note

The Google Maps browser key should be protected using:

- domain restrictions
- API restrictions
- quota limits

It should not be considered hidden just because it is stored as a secret.

### Acceptance Criteria

- No actual private secret is injected into `window.__APP_CONFIG__`.
- Frontend runtime config contains only browser-safe values.
- Sensitive backend-only values remain API-only.

---

## 5. Add a Production Rollback Strategy

The production plan must clearly define how rollback works.

### Required Change

Add a rollback section to the deployment plan.

Example rollback command:

```bash
gh workflow run wc-prod-deploy.yml -f tag=wc-v0.19.0
```

### Rollback Policy

- Rollback means redeploying a previous known-good application image.
- Database schema is not automatically rolled back.
- Rollback is only safe because normal DB migrations must be backward-compatible.
- The previous production tag should be visible in deployment logs or release notes.

### Acceptance Criteria

- A previous tag can be redeployed without rebuilding.
- The rollback flow uses the same production approval process unless an emergency exception is explicitly defined.
- The plan documents who can approve rollback.

---

## 6. Add a Database Migration Strategy

The current plan needs an explicit production database migration policy.

### Required Change

Add a dedicated section called `Database Migration Strategy`.

### Rules

- Migrations must be committed to the repo and reviewed with the code.
- Production must never generate migrations automatically.
- Production must never use schema sync.
- Migrations should run as a separate GitHub Actions job before API deployment.
- Normal migrations must be backward-compatible.
- Destructive migrations require a separate cleanup release.
- Rollback means rolling back application images, not automatically rolling back database schema.
- Risky changes must use the expand → migrate → contract pattern.

### Recommended Workflow Order

```txt
verify-images-exist
→ run-prod-migrations
→ deploy-api
→ verify-api-health
→ deploy-frontends
→ smoke-test
```

### Migration Classification

Every migration should be classified as one of:

```txt
1. Safe additive migration
2. Backward-compatible data migration
3. Risky/destructive migration
```

Only type 1 and type 2 migrations can run in the normal staging/prod workflow.

Type 3 migrations must be split into separate releases using:

```txt
Expand → Migrate → Contract
```

### Acceptance Criteria

- Prod deploy workflow has a controlled migration step.
- Migration failure stops deployment before API rollout.
- Destructive migrations are not shipped together with dependent application code.
- Rollback safety is documented.

---

## 7. Add Smoke Tests for All Production Apps

API health check alone is not enough.

### Required Change

After production deployment, run smoke tests for:

- API `/health`
- Booking frontend homepage
- Provider frontend homepage/login page
- SuperAdmin frontend homepage/login page
- Runtime config injection
- Version match against deployed tag

### Suggested Checks

```txt
API:
- /health returns status: ok
- API reports expected APP_VERSION

Frontend:
- HTTP 200 from each frontend domain
- HTML contains window.__APP_CONFIG__
- Injected APP_VERSION matches deployed tag
- Injected API_BASE_URL points to production API
```

### Acceptance Criteria

- Production deployment fails if smoke tests fail.
- Logs clearly show which app failed.
- Smoke tests verify both availability and correct runtime config.

---

## 8. Deploy by Image Digest or Record Image Digests

Tags are convenient but mutable. For stronger production integrity, record image digests during staging build and use them during production deployment where possible.

### Required Change

At minimum:

- Record the image digest for each built image in staging logs/workflow summary.
- Verify the digest before production deployment.

Preferred:

- Deploy production using image digest instead of only tag.

Example:

```bash
acrwc.azurecr.io/wc-booking@sha256:<digest>
```

Instead of:

```bash
acrwc.azurecr.io/wc-booking:0.20.0
```

### Acceptance Criteria

- The production workflow verifies it is deploying the exact image built during staging.
- Image digests are visible in workflow logs or deployment summary.
- Tags are not the only source of artifact identity.

---

## 9. Add Image Scanning and CI Safety Checks

Before production deployment, images should pass basic security and quality checks.

### Required Change

Add checks such as:

- Docker image vulnerability scan.
- Dependency audit where practical.
- Build provenance or artifact summary.
- Minimized GitHub Actions permissions per job.

### Acceptance Criteria

- Critical image vulnerabilities block production deployment or require explicit override.
- GitHub Actions permissions are scoped to the minimum needed.
- Production workflow does not use broader permissions than required.

---

## 10. Add Deployment Summary and Notifications

Production deployments should leave a clear audit trail.

### Required Change

After deployment, write a GitHub Actions summary containing:

- Deployed tag
- Deployed image names
- Image digests
- Production environment
- Approval status
- API health result
- Frontend smoke test results
- Rollback command

Optional but recommended:

- Send Slack notification after successful or failed production deploy.

### Acceptance Criteria

- Anyone can inspect the workflow run and understand what was deployed.
- Rollback command is visible in the deployment summary.
- Failed deployments clearly identify the failing step/app.

---

# Final Production-Ready Flow

The production deployment flow should become:

```txt
Tag wc-vX.Y.Z pushed
  → staging workflow builds images once
  → staging workflow records image digests
  → staging workflow runs staging migrations
  → staging workflow deploys staging
  → staging health checks and smoke tests pass

Manual production dispatch with same tag
  → verify images exist
  → verify/record image digests
  → production reviewer approval
  → run backward-compatible production migrations
  → deploy API using existing image
  → verify API health
  → deploy frontends using existing images
  → verify frontend smoke tests
  → write deployment summary
  → notify team
```

---

# Key Policy

```txt
Application images can be rolled back quickly.
Database schema usually cannot.
Therefore, all normal production migrations must be backward-compatible.
```

---

# Notes for Implementation

## Frontend Runtime Config

The runtime config helper should be implemented consistently across:

- `apps/wc-booking`
- `apps/wc-provider`
- `apps/wc-superadmin`

Avoid reading runtime config at module initialization time where possible. Prefer reading config inside functions, hooks, providers, or components after the inline config script has executed.

## Database Migrations

CI/CD should only run already committed migrations.

Bad production behavior:

```bash
prisma migrate dev
```

Good production behavior:

```bash
prisma migrate deploy
```

For TypeORM-based setups:

```bash
npm run migration:run
```

Production must not use automatic schema synchronization.

If TypeORM is used, production config should include:

```ts
synchronize: false
```

## Rollback Expectations

Rollback should not attempt to reverse database migrations automatically.

Rollback should mean:

```txt
Redeploy previous known-good application image.
```

This works only if database migrations are backward-compatible.

## Destructive Migration Examples

These should not run in the normal deployment flow without being split into safe phases:

```sql
DROP COLUMN status;
```

```sql
ALTER TABLE bookings RENAME COLUMN status TO booking_status;
```

```sql
ALTER TABLE bookings ALTER COLUMN payment_intent_id SET NOT NULL;
```

```sql
DROP TABLE old_provider_profiles;
```

## Safe Migration Examples

These are generally safe if the application remains backward-compatible:

```sql
ALTER TABLE bookings ADD COLUMN notes TEXT;
```

```sql
ALTER TABLE providers ADD COLUMN stripe_account_status VARCHAR(50);
```

```sql
CREATE INDEX CONCURRENTLY idx_bookings_user_id ON bookings(user_id);
```

```sql
ALTER TABLE camps ADD COLUMN is_featured BOOLEAN DEFAULT false;
```
