# WC Deploy Checklist — staging (tag) + prod (dispatch)

Step-by-step manual actions to ship World Camps to staging and prod. Staging deploys automatically on
a `wc-v*.*.*` tag push; prod is a separate manual dispatch of the **same** tag (gated by the
`production` environment). Run the GitHub setup (Steps 1–2) **once**; then Steps 3–4 per release.

> Already done (no action): staging + prod Prisma migration Jobs (`caj-migrate-wc-stg` /
> `caj-migrate-wc-prod`) are created and fixed; the `*.example` files in `.github/workflows/` are
> up to date; the `STORAGE_URL` cleanup is merged.

Prereq: authenticated `gh` (`gh auth login`) and `az` (`az login`), repo `daniyalzafarm/world-schools`.

---

## Step 1 — Staging GitHub config (one-time)

### 1a. Rewrite the three frontend variables (drop `NEXT_PUBLIC_`; runtime config reads unprefixed names)

```bash
gh variable set STAGING_BOOKING_ENV --body 'APP_URL=https://booking.staging.world-camps.org
API_BASE_URL=https://api.staging.world-camps.org
WS_URL=https://api.staging.world-camps.org
AUTH_USING_REQUEST=false
ENABLE_WEBSOCKET_MESSAGES=true
WEBSOCKET_FALLBACK_HTTP=true
GOOGLE_MAPS_API_KEY=AIzaSyB5eGnfvTKhYmfOjrOrOk-uqllhm8UpJ5g
STRIPE_PUBLISHABLE_KEY=pk_test_51TH5B8LqI3rnRhAizDFsmm0LLDXFYNx69XpqLbnGhAseHhk0Q5l5ZH05fnFtN3jm7xDNmCRe4JSWqlMFHnkUMSRo00Qtq0t4Xg'

gh variable set STAGING_PROVIDER_ENV --body 'APP_URL=https://provider.staging.world-camps.org
API_BASE_URL=https://api.staging.world-camps.org
WS_URL=https://api.staging.world-camps.org
AUTH_USING_REQUEST=false
ENABLE_WEBSOCKET_MESSAGES=true
WEBSOCKET_FALLBACK_HTTP=true
GOOGLE_MAPS_API_KEY=AIzaSyB5eGnfvTKhYmfOjrOrOk-uqllhm8UpJ5g
STRIPE_PUBLISHABLE_KEY=pk_test_51TH5B8LqI3rnRhAizDFsmm0LLDXFYNx69XpqLbnGhAseHhk0Q5l5ZH05fnFtN3jm7xDNmCRe4JSWqlMFHnkUMSRo00Qtq0t4Xg
BOOKING_APP_URL=https://booking.staging.world-camps.org
SUPERADMIN_APP_URL=https://superadmin.staging.world-camps.org'

gh variable set STAGING_SUPERADMIN_ENV --body 'APP_URL=https://superadmin.staging.world-camps.org
API_BASE_URL=https://api.staging.world-camps.org
WS_URL=https://api.staging.world-camps.org
AUTH_USING_REQUEST=false
BOOKING_APP_URL=https://booking.staging.world-camps.org
PROVIDER_APP_URL=https://provider.staging.world-camps.org'
```

- [ ] Three staging frontend variables rewritten

### 1b. Move `BULL_BOARD_PASSWORD` into the secret (it's currently in a plain variable)

1. Re-set `WC_STAGING_API_SECRETS` with `BULL_BOARD_PASSWORD=<password>` **added** to the existing
   block (the secret can't be read back, so paste the full set of keys — see
   [`WC_STAGING_API_SECRETS.example`](.github/workflows/WC_STAGING_API_SECRETS.example)).
2. Edit `WC_STAGING_API_ENV` and **delete** the `BULL_BOARD_PASSWORD=…` line (keep `BULL_BOARD_USER`).

- [ ] `BULL_BOARD_PASSWORD` now a secret, removed from the plain variable
- [ ] Rotated the password (it was previously exposed in the plain variable)

### 1c. Delete obsolete entries

```bash
gh variable delete STAGING_BOOKING_RUNTIME_ENV
gh variable delete STAGING_PROVIDER_RUNTIME_ENV
gh variable delete STAGING_SUPERADMIN_RUNTIME_ENV
gh secret delete AZURE_SWA_ADMIN_TOKEN
gh secret delete AZURE_SWA_BOOKING_TOKEN
gh secret delete AZURE_SWA_PROVIDER_TOKEN
```

- [ ] Obsolete `*_RUNTIME_ENV` variables and `AZURE_SWA_*_TOKEN` secrets deleted

---

## Step 2 — Prod GitHub config (one-time)

### 2a. Secrets

- [ ] `AZURE_CREDENTIALS_PROD` — mint per [`AZURE_CREDENTIALS_PROD.example`](.github/workflows/AZURE_CREDENTIALS_PROD.example) (`az ad sp create-for-rbac --json-auth` → Contributor on `rg-wc-prod-ch-north` + `AcrPull` on `acrwc`), paste the JSON.
- [ ] `WC_PROD_API_SECRETS` — fill from [`WC_PROD_API_SECRETS.example`](.github/workflows/WC_PROD_API_SECRETS.example) (live `sk_live_…`, prod DB password, `BULL_BOARD_PASSWORD`, etc.).

### 2b. Variables

- [ ] `WC_PROD_API_ENV` — fill from [`WC_PROD_API_ENV.example`](.github/workflows/WC_PROD_API_ENV.example) (already corrected: `POSTGRES_DB=world-camps`, `AZURE_STORAGE_CONTAINER_NAME=wc-prod-files`, includes `BULL_BOARD_USER`).
- [ ] Frontend variables (per-app — superadmin needs **no** Stripe/Maps/websocket-flag vars):

```bash
gh variable set PROD_BOOKING_ENV --body 'APP_URL=https://booking.world-camps.org
API_BASE_URL=https://api.world-camps.org
WS_URL=https://api.world-camps.org
AUTH_USING_REQUEST=false
ENABLE_WEBSOCKET_MESSAGES=true
WEBSOCKET_FALLBACK_HTTP=true
GOOGLE_MAPS_API_KEY=<prod-google-maps-browser-key>
STRIPE_PUBLISHABLE_KEY=pk_live_xxx'

gh variable set PROD_PROVIDER_ENV --body 'APP_URL=https://provider.world-camps.org
API_BASE_URL=https://api.world-camps.org
WS_URL=https://api.world-camps.org
AUTH_USING_REQUEST=false
ENABLE_WEBSOCKET_MESSAGES=true
WEBSOCKET_FALLBACK_HTTP=true
GOOGLE_MAPS_API_KEY=<prod-google-maps-browser-key>
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
BOOKING_APP_URL=https://booking.world-camps.org
SUPERADMIN_APP_URL=https://superadmin.world-camps.org'

gh variable set PROD_SUPERADMIN_ENV --body 'APP_URL=https://superadmin.world-camps.org
API_BASE_URL=https://api.world-camps.org
WS_URL=https://api.world-camps.org
AUTH_USING_REQUEST=false
BOOKING_APP_URL=https://booking.world-camps.org
PROVIDER_APP_URL=https://provider.world-camps.org'
```

### 2c. Approval gate

The prod workflow expects a `production` environment gate. A **Required reviewer** (Settings →
Environments → production → "Deployment protection rules") needs **GitHub Pro/Team/Enterprise** for a
**private** repo — on Free it's hidden, so only the **Deployment branches and tags** policy (`wc-v*`,
already set) is available.

- [ ] Either upgrade the plan to add a Required reviewer, **or** accept the de-facto gate: prod is
  `workflow_dispatch` (only write-access users can trigger) + the `wc-v*` tag policy. No second-person
  approval click without the upgrade.

### 2d. Recommended (prod Front Door routing) — see [AZURE_PROD_STATUS.md](AZURE_PROD_STATUS.md)

- [ ] Apply the Front Door per-app origin-group fix, or prod frontend domains keep serving the API. (Independent of the deploy pipeline; can be done before/after first prod deploy.)

---

## Step 3 — Deploy to staging (per release)

```bash
git tag wc-v0.21.0          # use your version
git push origin wc-v0.21.0
```

Watch the run (GitHub → Actions → "WC Staging Deployment"). Expected jobs all green:
build (×4) → run-staging-migrations → deploy-api → verify-api-health → deploy-frontends → smoke-tests.

- [ ] Staging workflow succeeded
- [ ] Verify frontends now have the runtime env (no `NEXT_PUBLIC_*`, no `TEST`):
  ```bash
  az containerapp show -g rg-wc-staging-ch-north -n ca-booking-wc-stg \
    --query "properties.template.containers[0].env[].name" -o tsv
  ```
- [ ] `https://booking.staging.world-camps.org/config.json` shows the real `apiBaseUrl` + `appVersion`; camp photos load.

---

## Step 4 — Deploy to prod (per release, after staging is green)

Prod is a **manual dispatch of a FINAL `wc-vX.Y.Z` tag** (no `-rc`), run **against the tag ref** — the
`production` environment's `wc-v*` policy blocks dispatching from a branch, and the workflow reads the
version from the ref:

```bash
gh workflow run wc-prod-deploy.yml --ref wc-v0.22.0          # the final tag staging already built
```

(Or GitHub UI → Actions → WC Production Deployment → Run workflow → in "Use workflow from" pick the tag.)

- [ ] Dispatched against the **tag ref** (`--ref`), not a branch — otherwise it's rejected with
  "Branch main is not allowed to deploy to production".
- [ ] Prod workflow succeeded (validate → migrations → deploy-api → health → frontends → smoke)
- [ ] `https://api.world-camps.org/health` returns the deployed `version`

> **Model:** staging auto-runs on **every** `wc-v*` tag (including `-rc`); prod is **manual + final-only**.
> Pre-release `-rc` tags are refused by prod's validation by design — cut a final `wc-vX.Y.Z` to promote.
> Note the prod workflow runs as it exists **at the tag's commit**, so merge any workflow changes to
> `main` *before* cutting the tag you'll promote.

---

## Reference — per-app frontend variable matrix

| Variable | booking | provider | superadmin |
|---|---|---|---|
| API_BASE_URL, APP_URL, WS_URL, AUTH_USING_REQUEST | ✓ | ✓ | ✓ |
| GOOGLE_MAPS_API_KEY, STRIPE_PUBLISHABLE_KEY | ✓ | ✓ | — |
| ENABLE_WEBSOCKET_MESSAGES, WEBSOCKET_FALLBACK_HTTP | ✓ | ✓ | — |
| BOOKING_APP_URL | — | ✓ | ✓ |
| SUPERADMIN_APP_URL | — | ✓ | — |
| PROVIDER_APP_URL | — | — | ✓ |

`APP_VERSION` is injected by the workflow from the tag (don't set it manually). `STORAGE_URL` is no
longer used (backend returns absolute SAS URLs). Value references live in
[`.github/workflows/*.example`](.github/workflows/).

## Sanity check before deploying

```bash
gh secret list       # expect AZURE_CREDENTIALS_{STAGING,PROD}, WC_{STAGING,PROD}_API_SECRETS
gh variable list     # expect WC_{STAGING,PROD}_API_ENV + {STAGING,PROD}_{BOOKING,PROVIDER,SUPERADMIN}_ENV
                     # and NO BULL_BOARD_PASSWORD, NO *_RUNTIME_ENV
```
