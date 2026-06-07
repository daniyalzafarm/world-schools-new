# Azure WC Prod — Runbook vs. Reality Status

_Re-audited 2026-06-01 against subscription `65a4056e-681d-44cb-9d47-3eb3a9c77d94`, resource group `rg-wc-prod-ch-north`. (Prior audit: 2026-05-22.)_

This document tracks where the live prod environment stands relative to [`AZURE_SETUP_WC_PROD.md`](AZURE_SETUP_WC_PROD.md). Tick boxes as you complete each step.

**TL;DR (updated 2026-06-07):** Foundation, all four apps, the migration Job, the full Front Door + WAF stack, and DNS are live. Since the 2026-06-01 audit: **Front Door now routes per-app** (the `og-apps` bug is fixed — verified: `og-api/og-booking/og-provider/og-admin/og-files`, each → its own origin), **prod migrations have run**, and **`0.22.0` (which contains the `X-Azure-FDID` middleware) is deployed**. **Current blocker:** the three frontend Container Apps have Liveness/Readiness/Startup probes on **`/health`**, which the Next.js frontends 404 → their revisions go **Degraded / restart-loop** → the prod smoke tests fail and the frontends don't serve a stable response. **Fix the CA probe path to `/`** (Step 1 below); then prod is **beta-functional**. Observability (§ 14–16) and GH OIDC (§ 19) are non-blocking fast-follows.

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
| 11.2–11.4 | Frontends (booking/provider/admin) | ⚠️ **Probes wrong** | All three exist on `0.22.0`, but their CA Liveness/Readiness/Startup probes point at **`/health`** (Next.js 404s it) → latest revisions **Degraded / restart-loop**. **Fix:** repoint CA probes to `/` (Step 1). Runbook `add_probes` corrected to take a path arg (§ 11.1). |
| 11.5 / 13.8 | Lock CAs to FD only | ⚠️ Partial | `AZURE_FDID` env set on all 4 and **matches** FD `frontDoorId` `4b1e1bb2-…` ✓. **But not enforced** — the deployed `0.19.0` image predates `FrontDoorMiddleware` (see Step 3). IP-locking is intentionally **not** used (CAs reject the FD service tag — runbook § 13.8). |
| 11.6 | Migration Job | ✅ Done | `caj-migrate-wc-prod` recreated with the `DATABASE_URL` fix (KV `database-url` keyvaultref) and has **run successfully** in the `0.22.0` prod deploy. |
| 12 | Custom domains at CA level | ✅ N/A | Intentionally skipped per runbook (handled at FD). |
| 13 | Front Door + WAF | ✅ Done | `wc-prod-frontdoor` + `wc-prod` endpoint, `wcprodwaf` (Prevention, rate-limit 200/min/IP), security policy over all 5 domains. **Routing fixed: per-app origin groups** (`og-api` probe `/health`; `og-booking`/`og-provider`/`og-admin`/`og-files` probe `/`), each route → its own group (verified 2026-06-07). WAF managed rule sets empty by design (needs Premium; § 13.1). |
| 13.5 | Custom domains (FD) | ✅ Done | All 5 (`api/booking/provider/superadmin/files`-wc) created with managed certs. |
| 14 | Diagnostic settings → LAW | ❌ Not done | No `to-law` settings on API, Postgres, Key Vault, or Front Door (sampled — all empty). |
| 15 | Action group + alerts | ❌ Not done | Only default `Application Insights Smart Detection`; no `ag-wc-prod-oncall`, no metric alerts, no activity-log alerts. |
| 16 | Defender for Cloud | ❌ Not at Standard | Only `Discovery` + `FoundationalCspm` at Standard; Containers/KeyVaults/StorageAccounts/etc. all Free. |
| 17 | DNS records | ✅ Done | All 5 custom domains read `domainValidationState = Approved` with `ManagedCertificate` — CNAMEs + `_dnsauth` TXTs are live and validated at the DNS provider. |
| 18 | Secrets bootstrap | ✅ Done | All 9 secrets present in `kv-wc-prod`. |
| 19 | GH Actions auth | ⚠️ Secret-based, no OIDC | [`wc-prod-deploy.yml`](.github/workflows/wc-prod-deploy.yml) exists and uses the `AZURE_CREDENTIALS_PROD` secret. App registration `github-actions-wc-prod` **does not exist** — § 19.1 (federation) not done. |
| 20 | Smoke test | ⚠️ Blocked on probes | API health ✅ in the `0.22.0` deploy. Frontend smoke tests fail because the CA probes (`/health`) keep frontend revisions Degraded (Step 1). Unblocks once probes → `/`. |
| 21 | Ops jump VM | ❌ Not done | Optional — defer until DB debugging needed. |
| 22 | Day-2 scale knobs | ✅ N/A | Reference only. |
| 23 | RG lock | ✅ Correctly deferred | No lock exists. Apply last, after smoke test. |

---

## 🔴 Production blocker — frontend Container Apps probe `/health` (which they 404)

**Symptom:** the prod deploy's frontend **smoke tests fail** (8/8 retries) against the direct origin FQDNs; the latest frontend revisions are **Degraded** and the container logs show Next.js **restart-looping** (`▲ Next.js… ✓ Ready` every ~1–2 min).

**Root cause:** all three frontend Container Apps have **Liveness + Readiness + Startup probes on `/health`** (port 3000), but the Next.js frontends only serve `/` (and `/config.json`) — they 404 `/health`. So every probe fails → CA marks the revision unhealthy and restart-loops the replica, and that revision still holds 100% of traffic → smoke (and real origin traffic) can't get a stable response. (The runbook's `add_probes` reused the API's `/health` path for the frontends; staging frontends have **no** probes, which is why staging smoke passes.)

**Fix:** repoint the three frontends' CA probes to `/` (Step 1). The runbook `add_probes` is now parameterized (§ 11.1) so future setups pass `/` for frontends.

> Note: this is distinct from the Front Door group probe (which is already correct — `og-booking/og-provider/og-admin` probe `/`). This is the **Container App-level** liveness/readiness/startup probe.

---

## Resume here — critical path to beta-functional prod

### Step 1 — Fix the frontend Container App probes (THE blocker)

Repoint Liveness/Readiness/Startup from `/health` to `/` on all three frontends (each creates a new, healthy revision):

```bash
RG=rg-wc-prod-ch-north
for app in ca-booking-wc-prod ca-provider-wc-prod ca-admin-wc-prod; do
  az containerapp show -g $RG -n $app -o yaml > "/tmp/$app.yaml"
  sed -i '' 's#path: /health#path: /#g' "/tmp/$app.yaml"   # GNU sed: sed -i 's#...#...#g'
  az containerapp update -g $RG -n $app --yaml "/tmp/$app.yaml"
done
```

(Or per app in the portal → Containers → Health probes → set path `/` on all three probes.)

- [ ] All three frontend latest revisions report **Healthy / Running**
- [ ] **Re-run** the failed prod deploy's smoke jobs (Actions → run → Re-run jobs) → green

### Step 2 — ✅ Done — Front Door per-app routing

Verified 2026-06-07: per-app origin groups (`og-api` probe `/health`; `og-booking/og-provider/og-admin/og-files` probe `/`), each route → its own group. The old `og-apps` shared group is gone. Runbook § 13.3/13.4/13.6 corrected to match.

### Step 3 — ✅ Done — migrations + `0.22.0` deploy

`caj-migrate-wc-prod` recreated with the `DATABASE_URL` fix and ran successfully; `0.22.0` (contains `FrontDoorMiddleware`) is deployed to all apps via `wc-prod-deploy.yml` (auth: `AZURE_CREDENTIALS_PROD` secret). The migration `20260604133046` scrub (legacy `strict` cancellation policy → `moderate`) is included.

### Step 4 — Verify the API lock + smoke test (after Step 1)

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

**→ Steps 2–3 are already done; prod is beta-functional once Step 1 (frontend probes) is applied and Step 4 verification is green.**

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
