# Azure WC Prod — Runbook vs. Reality Status

_Re-audited 2026-06-01 against subscription `65a4056e-681d-44cb-9d47-3eb3a9c77d94`, resource group `rg-wc-prod-ch-north`. (Prior audit: 2026-05-22.)_

This document tracks where the live prod environment stands relative to [`AZURE_SETUP_WC_PROD.md`](AZURE_SETUP_WC_PROD.md). Tick boxes as you complete each step.

**TL;DR:** The foundation, **all four container apps**, the migration Job, the **full Front Door + WAF stack**, and **DNS (all 5 custom domains Approved with managed certs)** are now built and live — `https://api.world-camps.org/health` serves **200** through Front Door. But there is **one production-blocking bug**: Front Door does not route by hostname, so `booking/provider/superadmin.world-camps.org` all serve the **API** instead of their own app. Fix that first (§ 13.3/13.4/13.6 + commands below), then run migrations, deploy an app image that actually contains the `X-Azure-FDID` middleware, and lock the API. After that prod is **beta-functional**. Observability (§ 14–16) and GH OIDC (§ 19) are non-blocking fast-follows.

---

## Per-section status

| § | Section | Status | Notes |
|---|---|---|---|
| 1 | Prereqs (providers registered) | ✅ Done | All providers `Registered`. |
| 2–6 | Naming, networking, LAW+AppInsights, Key Vault | ✅ Done | `vnet-wc-prod` + 4 subnets, `log-wc-prod` + `appi-wc-prod`, `kv-wc-prod` all present. |
| 7 | Postgres flex | ✅ Done | `pg-wc-prod` (PG17), `publicNetworkAccess=Disabled`, delegated to `snet-pg`, `world-camps` DB, private DNS zone + link present. |
| 8 | Azure Managed Redis | ✅ Done | `redis-wc-prod` + `pe-redis-wc-prod` + `privatelink.redis.azure.net` zone + link present. |
| 9 | Storage (`sawcprod`) | ✅ Done | `allowSharedKeyAccess=false`, `allowBlobPublicAccess=true`. Containers `wc-prod-files` (private) + `wc-prod-public-assets` (blob public). |
| 10 | CAE + shared MI | ✅ Done | `cae-wc-prod` + `mi-ca-kv-wc-prod` present. |
| 11.1 | API container app | ✅ Done | `ca-api-wc-prod` healthy, 100% traffic on revision `--0000006` (image `wc-nest-api:0.19.0`). 9 secrets + env vars + 3 probes + user-assigned MI wired. |
| 11.2 | Booking frontend | ✅ Done | `ca-booking-wc-prod` healthy, serving `wc-booking:0.19.0` (direct origin `/` → 200 html). |
| 11.3 | Provider frontend | ✅ Done | `ca-provider-wc-prod` healthy, serving `wc-provider:0.19.0` (direct origin `/` → 308 SPA redirect). |
| 11.4 | Superadmin frontend | ✅ Done | `ca-admin-wc-prod` healthy, serving `wc-superadmin:0.19.0` (direct origin `/` → 308 SPA redirect). |
| 11.5 / 13.8 | Lock CAs to FD only | ⚠️ Partial | `AZURE_FDID` env set on all 4 and **matches** FD `frontDoorId` `4b1e1bb2-…` ✓. **But not enforced** — the deployed `0.19.0` image predates `FrontDoorMiddleware` (see Step 3). IP-locking is intentionally **not** used (CAs reject the FD service tag — runbook § 13.8). |
| 11.6 | Migration Job | ⚠️ Exists, never run | `caj-migrate-wc-prod` exists with `POSTGRES_DB=world-camps` ✓, image `0.19.0`. **Zero execution history** — migrations have not been applied via the Job. |
| 12 | Custom domains at CA level | ✅ N/A | Intentionally skipped per runbook (handled at FD). |
| 13 | Front Door + WAF | ⚠️ Built but **routing broken** | `wc-prod-frontdoor` profile + `wc-prod` endpoint (`Enabled`), `wcprodwaf` (Prevention, rate-limit 200/min/IP), security policy `sp-wc-prod` over all 5 domains, 5 origins, 5 routes — **all present**, but origin grouping is wrong (see blocker below). WAF managed rule sets empty by design (needs Premium; deferred per § 13.1). |
| 13.5 | Custom domains (FD) | ✅ Done | All 5 (`api/booking/provider/superadmin/files`-wc) created with managed certs. |
| 14 | Diagnostic settings → LAW | ❌ Not done | No `to-law` settings on API, Postgres, Key Vault, or Front Door (sampled — all empty). |
| 15 | Action group + alerts | ❌ Not done | Only default `Application Insights Smart Detection`; no `ag-wc-prod-oncall`, no metric alerts, no activity-log alerts. |
| 16 | Defender for Cloud | ❌ Not at Standard | Only `Discovery` + `FoundationalCspm` at Standard; Containers/KeyVaults/StorageAccounts/etc. all Free. |
| 17 | DNS records | ✅ Done | All 5 custom domains read `domainValidationState = Approved` with `ManagedCertificate` — CNAMEs + `_dnsauth` TXTs are live and validated at the DNS provider. |
| 18 | Secrets bootstrap | ✅ Done | All 9 secrets present in `kv-wc-prod`. |
| 19 | GH Actions auth | ⚠️ Secret-based, no OIDC | [`wc-prod-deploy.yml`](.github/workflows/wc-prod-deploy.yml) exists and uses the `AZURE_CREDENTIALS_PROD` secret. App registration `github-actions-wc-prod` **does not exist** — § 19.1 (federation) not done. |
| 20 | Smoke test | ⚠️ Blocked | API `/health` → 200 ✅. Frontends serve the **API**, not their own app — blocked on the FD routing fix. |
| 21 | Ops jump VM | ❌ Not done | Optional — defer until DB debugging needed. |
| 22 | Day-2 scale knobs | ✅ N/A | Reference only. |
| 23 | RG lock | ✅ Correctly deferred | No lock exists. Apply last, after smoke test. |

---

## 🔴 Production blocker — Front Door does not route by hostname

**Symptom:** `booking.world-camps.org`, `provider.world-camps.org`, and `superadmin.world-camps.org` all return the **API's** 401 JSON (response carries `x-csrf-token` + `access-control-expose-headers: x-access-token,…` — NestJS/Helmet signatures, not frontend output). Verified: 6/6 probes to `booking.world-camps.org` hit the API.

**Root cause (the bug is in the runbook, old § 13.6):** all four routes (`rt-api`, `rt-booking`, `rt-provider`, `rt-admin`) target a **single shared origin group `og-apps`** holding all four app origins at equal priority/weight. A Front Door route forwards to an _origin group_, not a specific origin — there's no way to pin `booking.world-camps.org` to `booking-origin`. And because the `og-apps` health probe is `/health` (only the API answers it; the frontends 404), FD marks the three frontend origins unhealthy and routes **100% of app traffic to the API**.

The apps themselves are fine — direct-to-origin: booking `/` → 200 html, provider/admin `/` → 308. Only the FD routing layer is misconfigured.

**Fix:** one single-origin group **per app**, each route → its own group. The runbook (§ 13.3/13.4/13.6) has been corrected to this pattern; apply it to the live profile with the commands in Step 1.

---

## Resume here — critical path to beta-functional prod

### Step 1 — Fix Front Door routing (THE blocker)

Restructure the live profile from one shared `og-apps` into four per-app groups, then delete the shared group.

```bash
RG=rg-wc-prod-ch-north; FD=wc-prod-frontdoor

# 1. Per-app origin groups (api probes /health; frontends probe /)
az afd origin-group create -g $RG --profile-name $FD --origin-group-name og-api \
  --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 60 --probe-path /health \
  --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50
for og in og-booking og-provider og-admin; do
  az afd origin-group create -g $RG --profile-name $FD --origin-group-name $og \
    --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 60 --probe-path / \
    --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50
done

# 2. One origin per group → that app's CA FQDN
for pair in "og-api:ca-api-wc-prod" "og-booking:ca-booking-wc-prod" \
            "og-provider:ca-provider-wc-prod" "og-admin:ca-admin-wc-prod"; do
  og="${pair%%:*}"; APP="${pair#*:}"
  FQDN=$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)
  az afd origin create -g $RG --profile-name $FD --origin-group-name $og \
    --origin-name "${APP}-origin" --host-name "$FQDN" --origin-host-header "$FQDN" \
    --http-port 80 --https-port 443 --priority 1 --weight 1000 \
    --enabled-state Enabled --enforce-certificate-name-check true
done

# 3. Re-point the four routes to their per-app group
az afd route update -g $RG --profile-name $FD --endpoint-name wc-prod --route-name rt-api      --origin-group og-api
az afd route update -g $RG --profile-name $FD --endpoint-name wc-prod --route-name rt-booking  --origin-group og-booking
az afd route update -g $RG --profile-name $FD --endpoint-name wc-prod --route-name rt-provider --origin-group og-provider
az afd route update -g $RG --profile-name $FD --endpoint-name wc-prod --route-name rt-admin    --origin-group og-admin

# 4. Delete the now-unreferenced shared group (removes its 4 origins)
az afd origin-group delete -g $RG --profile-name $FD --origin-group-name og-apps --yes
```

- [ ] Per-app origin groups created, routes re-pointed, `og-apps` deleted
- [ ] After ~3–5 min propagation, `booking.world-camps.org` returns its **own** HTML (see verification)

### Step 2 — Run DB migrations (the Job has never executed)

> ⚠️ **Fix the Job first.** `caj-migrate-wc-prod` was created with a bare `npx prisma migrate deploy`, which fails with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` — Prisma 7's [`prisma.config.ts`](apps/wc-nest-api/prisma.config.ts) needs `DATABASE_URL`, and the Job (unlike [`start.sh`](apps/wc-nest-api/start.sh)) never sets it. This was caught on the staging Job. **Delete and recreate** the Job using the corrected § 11.6 block — it now stores the connection string in Key Vault as `database-url` and passes `DATABASE_URL=secretref:database-url` (the `/bin/sh -c` compose-at-runtime approach can't be used because `az containerapp job create --command` rejects sh's `-c` flag):
>
> ```bash
> az containerapp job delete -g rg-wc-prod-ch-north -n caj-migrate-wc-prod --yes
> # add the database-url KV secret + re-run the corrected `az containerapp job create …` from runbook § 11.6
> ```

```bash
az containerapp job start -g rg-wc-prod-ch-north -n caj-migrate-wc-prod
az containerapp job execution list -g rg-wc-prod-ch-north -n caj-migrate-wc-prod \
  --query "[0].{status:properties.status,start:properties.startTime}" -o table
```

Idempotent (`prisma migrate deploy`). Step 4's deploy re-runs the Job with the new image; running it now still verifies DB connectivity.

- [ ] Migration Job latest execution → `Succeeded`

### Step 3 — Confirm deploy authentication

The deploy workflow authenticates via the `AZURE_CREDENTIALS_PROD` secret (OIDC not set up). For beta this is acceptable.

- [ ] `AZURE_CREDENTIALS_PROD` secret present in the GitHub `production` environment (and the required-reviewer gate is OK), **or** set up OIDC now (§ 19.1)

### Step 4 — Cut + deploy a release that contains the FD middleware

The live image `0.19.0` (tag `wc-v0.19.0`, 2026-05-18) **predates** `FrontDoorMiddleware` (commit `b9d85ba7`, 2026-05-31), so the `AZURE_FDID` env currently does nothing. Even `wc-v0.20.0-rc1` (2026-05-22) predates it.

- [ ] Tag a new release from the current branch (includes `b9d85ba7`), e.g. `wc-v0.20.0-rc2` / `wc-v0.21.0`
- [ ] CI builds + pushes the 4 images to `acrwc`
- [ ] Run [`wc-prod-deploy.yml`](.github/workflows/wc-prod-deploy.yml) (manual dispatch, tag input `wc-v*`) — deploys all apps by digest, re-runs the migration Job, and activates the `AZURE_FDID` check

### Step 5 — Verify the API lock + smoke test

```bash
# API direct origin → should now be 403 (FD-id middleware active); /health stays 200 via FD
curl -s -o /dev/null -w "%{http_code}\n" \
  https://ca-api-wc-prod.blueocean-2a116788.switzerlandnorth.azurecontainerapps.io/

for u in https://api.world-camps.org/health https://booking.world-camps.org/ \
         https://provider.world-camps.org/ https://superadmin.world-camps.org/ ; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$u")  $u"
done
```

Expected: `api/health` → 200; `booking/` → 200 **html without** the API's `x-csrf-token` header; `provider`/`superadmin` → 200/308 serving their own SPA; direct API origin `/` → **403**.

- [ ] Smoke matrix passes; frontends serve their own apps (no API `x-csrf-token` signature)
- [ ] Direct API origin `/` → 403

> ℹ️ The frontends stay reachable at their raw `*.azurecontainerapps.io` FQDNs — accepted beta risk. CA-level FD-lock isn't possible on Standard FD without Premium + Private Link (runbook § 13.8); only the API has the header-check middleware. All _public_ traffic still flows through FD + WAF via the custom domains.

**→ Prod is beta-functional once Steps 1–5 are green.**

---

## Fast-follow hardening (NOT blocking beta launch)

- [ ] § 14 — diagnostic settings (`to-law`) on API, Postgres, Key Vault, Redis, Front Door, Storage (none exist today)
- [ ] § 15.1 — action group `ag-wc-prod-oncall`
- [ ] § 15.2 — 8 metric alerts (API 5xx, API replicas==0, PG CPU, PG storage, PG conn-failed, Redis mem, FD 5xx, FD latency)
- [ ] § 15.3 — 2 activity-log alerts (RG delete, RBAC grant)
- [ ] § 16 — Defender Standard plans (skip `OpenSourceRelationalDatabases` per beta note)
- [ ] § 19.1 — GH Actions OIDC: `github-actions-wc-prod` app reg + SP, role assignments (`Contributor` on RG, `AcrPull` on `acrwc`), federated credential; then drop the `AZURE_CREDENTIALS_PROD` secret
- [ ] § 21 — ops jump VM (optional; defer until DB debugging is needed)
- [ ] § 13.1 day-2 — WAF managed rule sets require upgrading FD + WAF to **Premium** (~+$300/mo); intentionally omitted at beta
- [ ] § 23 — `az lock create … no-delete-rg-wc-prod` (final step, after smoke test passes)

---

## Open decisions

- **Frontend FD-lock** — there is no clean CA-level lock to Front Door on Standard FD. Beta accepts direct reachability of the frontend origin FQDNs (static assets only; all public traffic is via FD). Revisit with FD Premium + Private Link if needed.
- **GH Actions auth** — staying on `AZURE_CREDENTIALS_PROD` for beta; move to OIDC (§ 19.1) before/soon after launch.
- **API max-replicas** — current value 3, runbook says 2. Harmless; leave it.
