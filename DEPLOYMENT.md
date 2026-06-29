# Deployment

The World Schools (`wc-*`) apps deploy to **Azure Container Apps** via GitHub
Actions. There are two pipelines:

- **Staging** ([.github/workflows/wc-staging-deploy.yml](.github/workflows/wc-staging-deploy.yml)) —
  runs automatically when a `wc-v*.*.*` tag is pushed. It **builds and pushes** all
  four images (API + 3 frontends) to the shared registry, runs DB migrations, and
  deploys to the staging environment.
- **Production** ([.github/workflows/wc-prod-deploy.yml](.github/workflows/wc-prod-deploy.yml)) —
  manual (`workflow_dispatch`) **against a final tag ref** (`wc-vX.Y.Z`, no `-rc`).
  It does **not** rebuild: it promotes the exact images staging already built, by
  digest. It is gated by the `production` GitHub Environment (required reviewer)
  and a `wc-v*` deployment-tag policy, so prod can only ever deploy from a tag.

Both pipelines authenticate with `azure/login@v2`, deploy by image **digest**
(immutable), run a one-shot **Container Apps Job** for Prisma migrations, then run
health/smoke checks. Frontends bake **no** env into their images — runtime config
is set as Container App env vars at deploy time and read per request.

## Azure infrastructure

| Resource             | Staging                  | Production               |
| -------------------- | ------------------------ | ------------------------ |
| Region               | `switzerlandnorth`       | `switzerlandnorth`       |
| Resource group       | `rg-wc-staging-ch-north` | `rg-wc-prod-ch-north`    |
| Container App env    | `cae-wc-stg`             | `cae-wc-prod`            |
| API container app    | `ca-api-wc-stg`          | `ca-api-wc-prod`         |
| Booking container app| (staging equivalent)     | `ca-booking-wc-prod`     |
| Provider container app| (staging equivalent)    | `ca-provider-wc-prod`    |
| Superadmin container app| (staging equivalent)  | `ca-admin-wc-prod`       |
| Migration job        | `caj-migrate-wc-stg`     | `caj-migrate-wc-prod`    |

Container registry is **shared** across both: `acrwc` (in
`rg-wc-infra-shared-ch-north`). These names are defined as `env:` at the top of
each workflow — update them there if your infrastructure differs.

The migration Container Apps Job and the Container App resources are provisioned
**out of band** (not by these workflows). The pipelines only update the job's
image to the new API digest and start it. Provision the resource groups, the
Container App environment, the four Container Apps, and the migration job once,
up front, before the first deploy.

## GitHub configuration

Configure these under **Settings → Secrets and variables → Actions**. Each value
is documented by a matching `*.example` file in
[.github/workflows/](.github/workflows/) — copy the body, fill in real values, and
paste.

**Secrets**

| Secret                     | Purpose                                              | Reference example                      |
| -------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `AZURE_CREDENTIALS_PROD`   | Service-principal JSON used by `azure/login` (prod)  | `AZURE_CREDENTIALS_PROD.example`       |
| `AZURE_CREDENTIALS_STAGING`| Service-principal JSON used by `azure/login` (staging)| `AZURE_CREDENTIALS_STAGING.example`   |
| `WC_PROD_API_SECRETS`      | Sensitive API env (JWT secrets, DB password, Stripe keys, …) — set as Container App secrets | `WC_PROD_API_SECRETS.example` |
| `WC_STAGING_API_SECRETS`   | Same, for staging                                    | `WC_STAGING_API_SECRETS.example`       |

**Variables** (non-secret env passed to `--set-env-vars`)

| Variable                                                   | Purpose                                    | Reference example          |
| ---------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| `WC_PROD_API_ENV` / `WC_STAGING_API_ENV`                   | Non-secret API runtime env                 | `WC_PROD_API_ENV.example`  |
| `PROD_BOOKING_ENV` / `PROD_PROVIDER_ENV` / `PROD_SUPERADMIN_ENV` | Per-frontend runtime env             | `PROD_*_ENV.example`       |
| `SLACK_DEPLOY_WEBHOOK_URL`                                  | Optional — deploy notifications            | —                          |

### Minting the Azure service principal

Create a principal scoped **Contributor** on the target resource group and grant
it **AcrPull** on the shared registry (prod reuses staging-built images, so pull
is sufficient). The full commands are in `AZURE_CREDENTIALS_PROD.example`. Paste
the entire `--json-auth` output as the secret value. Day-2 hardening: switch to
OIDC / federated credentials and drop the static secret.

## Release flow

```text
1. Tag a release:           git tag wc-v1.2.3 && git push origin wc-v1.2.3
2. Staging auto-deploys:    builds + pushes images, migrates, deploys to *-stg
3. Verify on staging.
4. Promote to production:   gh workflow run wc-prod-deploy.yml --ref wc-v1.2.3
                            (or Actions → Run workflow → pick the tag)
5. Approve the production environment gate when prompted.
```

Production runs: validate tag + resolve digests → migrate → deploy API → health
check → deploy frontends → smoke test → summary (+ optional Slack).

## Rollback

Re-dispatch the production workflow against the previous known-good tag:

```bash
gh workflow run wc-prod-deploy.yml --ref wc-vX.Y.Z
```

Only images roll back — the database schema does **not** roll back automatically.
Keep migrations backward-compatible so an image rollback is always safe.
