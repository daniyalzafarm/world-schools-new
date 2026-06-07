# WC Staging — Azure Resource Review

**Reviewed:** 2026-04-27
**Subscription:** `65a4056e-681d-44cb-9d47-3eb3a9c77d94` (Azure subscription 1)
**Region:** Switzerland North
**Resource groups in scope:** `rg-wc-staging-ch-north`, `rg-wc-infra-shared-ch-north`

This is an audit of the deployed Azure footprint for the World Camps **staging** environment. All findings are based on read-only `az` queries against the live resources. No changes were made. Severity is graded with staging in mind: a finding labelled **High** is an issue you'd want to fix soon even in a non-prod environment (typically a security exposure or a footgun that will hurt you when you copy this footprint to production).

> **Companion doc:** [`AZURE_SETUP_WC_PROD.md`](AZURE_SETUP_WC_PROD.md) is the production runbook that bakes in the corrected baseline for every issue called out below. Staging is being left as-is per [decision]; prod gets the hardened defaults from day 1.

---

## TL;DR — Top findings

| # | Severity | Finding |
|---|---|---|
| 1 | **High** | Postgres flexible server is on the **public internet**, with a firewall rule that allows traffic from **all Azure services in any tenant** (`0.0.0.0/0` Azure-services rule). Not VNet-integrated despite a VNet+delegated subnet existing. |
| 2 | **High** | ACR **admin user is enabled**, and three of four Container Apps (`ca-admin`, `ca-booking`, `ca-provider`) authenticate to the registry with username + password instead of the Managed Identity already wired up for `ca-api`. |
| 3 | **High** | **No diagnostic settings** are configured on any resource (Container Apps, CAE, Postgres, Redis, ACR, Storage, Front Door). The `Microsoft.Insights` resource provider is not even registered on the subscription, so monitoring cannot be wired up until it is. |
| 4 | **High** | **Front Door has no WAF policy attached** (security policies list is empty). The CDN endpoint also fronts only the storage account; the four Container Apps are exposed directly via their CAE FQDNs / custom domains with no upstream WAF. |
| 5 | **Medium** | No private endpoint exists for Redis — `redis-wc-stg.publicNetworkAccess = Enabled` and `privateEndpointConnections: []`. The `privatelink.redis.azure.net` zone and `snet-redis-wc-stg` subnet are configured but unused. |
| 6 | **Medium** | The three frontend Container Apps (`ca-admin`, `ca-booking`, `ca-provider`) have **no liveness/readiness/startup probes** configured. |
| 7 | **Medium** | Storage account `sawcstg` allows shared-key access (`allowSharedKeyAccess: true`) and `networkRuleSet.defaultAction = Allow`. (`allowBlobPublicAccess: true` is intentional — see [note](#note-storage-public-content-container-is-intentional).) |
| 8 | **Medium** | Postgres has `geoRedundantBackup: Disabled`, `highAvailability: Disabled`, `storage.autoGrow: Disabled`, Entra ID auth disabled, and Advanced Threat Protection disabled. |
| 9 | **Low** | No Key Vault exists in the subscription; all secrets live as Container Apps secrets pushed in by the GitHub Actions workflow. |
| 10 | **Low** | No metric alerts, activity log alerts, action groups, or resource locks exist anywhere in the subscription. |
| 11 | **Low** | ACR retention policy and soft-delete policy are both **disabled** — old image tags accumulate forever. |
| 12 | **Low** | Inconsistent tagging: `ca-admin`, `ca-booking`, `ca-provider`, all 4 managed certificates, and the redis-private-DNS vnet link have `tags: null`. Only `ca-api` carries `env=staging` among the Container Apps. |

---

## Inventory

### `rg-wc-staging-ch-north`

| Resource | Type | SKU / Tier | Tag (`env`) |
|---|---|---|---|
| `vnet-wc-stg` | VNet (`10.0.0.0/20`) | — | staging |
| └─ `default` (10.0.0.0/24) | Subnet, delegated to `Microsoft.DBforPostgreSQL/flexibleServers` | — | — |
| └─ `snet-aca-wc-stg` (10.0.2.0/23) | Subnet, delegated to `Microsoft.App/environments` | — | — |
| └─ `snet-redis-wc-stg` (10.0.1.0/24) | Subnet, no delegation | — | — |
| `sawcstg` | Storage account (StorageV2) | Standard_LRS, Hot | staging |
| `log-analytics-wc-stg` | Log Analytics workspace | — | staging |
| `cae-wc-stg` | Container Apps managed env (Consumption profile, system-assigned MI, vnet-integrated, **not** zone-redundant, internal=false, static IP `4.226.30.230`) | — | staging |
| `ca-api-wc-stg` | Container App — `wc-nest-api:0.15.0-rc3` | 1 vCPU / 2 Gi, min/max 1/2, MI ACR pull | staging |
| `ca-admin-wc-stg` | Container App — `wc-superadmin:0.15.0-rc3` | 0.25 vCPU / 0.5 Gi, min/max 1/3, **admin-pwd ACR pull** | — |
| `ca-booking-wc-stg` | Container App — `wc-booking:0.15.0-rc3` | 0.25 vCPU / 0.5 Gi, min/max 1/3, **admin-pwd ACR pull** | — |
| `ca-provider-wc-stg` | Container App — `wc-provider:0.15.0-rc3` | 0.25 vCPU / 0.5 Gi, min/max 1/3, **admin-pwd ACR pull** | — |
| 4× `cae-wc-stg/...managedCertificates` | CAE-managed TLS for `api / superadmin / provider / booking .staging.world-camps.org` | — | — |
| `pg-db-wc-stg` | Postgres Flexible Server | Standard_B1ms (Burstable), PG 17, 32 GiB P4, AZ 1 | staging |
| `redis-wc-stg` | Redis Enterprise (single DB `default`) | Balanced_B0, Redis 7.4, **HA disabled** | staging |
| `privatelink.redis.azure.net` (+ vnet link) | Private DNS zone | — | staging / — |

### `rg-wc-infra-shared-ch-north`

| Resource | Type | SKU / Tier | Tag (`env`) |
|---|---|---|---|
| `acrwc` | Container Registry | Standard, **admin enabled**, public access enabled, retention/soft-delete disabled | shared |
| `wc-frontdoor` | Azure Front Door (CDN profile) | Standard_AzureFrontDoor | shared |
| └─ endpoint `wc-cdn` | AFD endpoint (`wc-cdn-aud4btepdrf6bzc0.z02.azurefd.net`) | — | — |
| └─ origin group `default-origin-group` → origin `files-staging` | Single origin: `sawcstg.blob.core.windows.net` | — | — |
| └─ route `default-route` | Patterns `/*`, custom domain `files.staging.world-camps.org`, https-redirect on | — | — |

> **No IaC found in the repo for these resources** — only the deploy workflow [`.github/workflows/wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml) which mutates already-existing Container Apps. `systemData.createdBy` shows resources were created interactively from `daniyalzafarm@gmail.com` and `stephanie@world-schools.com`.

---

## Findings

### Note: storage public content container is intentional

- **Resource:** `sawcstg` → container `wc-booking-system` (`publicAccess: "container"`)
- **By design.** This container hosts public assets (e.g. provider logos served on the booking site) and is meant to be readable anonymously. The other two containers (`wc-dev-files`, `wc-staging-files`) are correctly `publicAccess: null`.
- **Implications to keep in mind:**
  1. Application code must never write anything non-public to this container. Treat `wc-booking-system` as a public-CDN bucket.
  2. Because of this container, the account-level switch `allowBlobPublicAccess: true` has to stay enabled — so it's not flagged as an issue below. The risk is that a *new* container inadvertently created with `--public-access container` would also be public; consider a CI/policy guard if that becomes a concern.
  3. For best edge performance (and to make a future WAF/rate-limit easy), serve this container through `files.staging.world-camps.org` (Front Door already fronts `sawcstg.blob.core.windows.net`) rather than direct `*.blob.core.windows.net` URLs.

### High

#### High-1. Postgres on public internet with permissive firewall

- **Resource:** `pg-db-wc-stg`
- **Observed:**
  - `network.publicNetworkAccess: Enabled`
  - `network.delegatedSubnetResourceId: null` — server is **not** integrated with `vnet-wc-stg`, despite the VNet having a `default` subnet delegated to `Microsoft.DBforPostgreSQL/flexibleServers` (i.e. the VNet was prepared for it, but never used).
  - Firewall rules:
    - `ClientIPAddress_2025-11-23_14-59-11` — single IP `110.39.254.130`
    - `AllowAllAzureServicesAndResourcesWithinAzureIps_2025-11-23_15-2-0` — start `0.0.0.0`, end `0.0.0.0` — this is the "Allow access to Azure services" toggle, which whitelists **every Azure tenant in the world**, not just yours.
- **Why it matters:** The DB is reachable from any Azure-hosted VM/Function/Container regardless of subscription. Combined with password-only auth and ATP disabled (see High-9), brute-force surface is significant.
- **Recommendation:** Migrate to a VNet-integrated Postgres flexible server (delete-and-recreate is required — flexible server's network mode is immutable post-create) using the existing delegated `default` subnet, and disable public access. As a near-term mitigation, drop the `AllowAllAzureServices…` rule and replace it with the CAE static egress IP `4.226.30.230` plus any developer IPs.
- **Audit:**
  ```bash
  az postgres flexible-server show -n pg-db-wc-stg -g rg-wc-staging-ch-north --query "network"
  az postgres flexible-server firewall-rule list -g rg-wc-staging-ch-north -n pg-db-wc-stg -o table
  ```
- **Suggested mitigation (immediate):**
  ```bash
  az postgres flexible-server firewall-rule delete -g rg-wc-staging-ch-north --name pg-db-wc-stg --rule-name AllowAllAzureServicesAndResourcesWithinAzureIps_2025-11-23_15-2-0
  az postgres flexible-server firewall-rule create -g rg-wc-staging-ch-north --name pg-db-wc-stg --rule-name allow-cae-egress --start-ip-address 4.226.30.230 --end-ip-address 4.226.30.230
  ```
  Longer term, recreate as VNet-integrated.

#### High-2. ACR admin user + username/password on three Container Apps

- **Resources:** `acrwc`, `ca-admin-wc-stg`, `ca-booking-wc-stg`, `ca-provider-wc-stg`
- **Observed:**
  - `acrwc.adminUserEnabled: true`
  - `ca-api-wc-stg.configuration.registries[0]` — `identity: "system-environment"`, `username: ""`, `passwordSecretRef: ""` ✅
  - `ca-admin-wc-stg`, `ca-booking-wc-stg`, `ca-provider-wc-stg` — `identity: ""`, `username: "acrwc"`, `passwordSecretRef: "acrwcazurecrio-acrwc"` (i.e. they're storing the long-lived ACR admin password as a Container App secret).
  - `cae-wc-stg` system-assigned MI (`c7b11b8e-2c50-4c94-8b4a-26c9f9929219`) **already has `AcrPull` on `acrwc`** — so the same MI-based pull `ca-api` uses would work for all four apps.
- **Why it matters:** A leaked admin password rotates only by re-running `az acr credential renew`, which then has to be re-pushed into every consumer. MI auth is short-lived, scoped, and managed by Azure.
- **Recommendation:** Convert all three frontend Container Apps to MI-based registry auth (same shape as `ca-api`), then disable the ACR admin user.
- **Audit:**
  ```bash
  az acr show -n acrwc --query adminUserEnabled
  for app in ca-admin-wc-stg ca-booking-wc-stg ca-provider-wc-stg; do
    az containerapp show -n $app -g rg-wc-staging-ch-north --query "properties.configuration.registries"
  done
  ```
- **Suggested fix (per app):**
  ```bash
  az containerapp registry set \
    -n ca-admin-wc-stg -g rg-wc-staging-ch-north \
    --server acrwc.azurecr.io --identity system-environment
  az containerapp secret remove -n ca-admin-wc-stg -g rg-wc-staging-ch-north --secret-names acrwcazurecrio-acrwc
  # …repeat for ca-booking-wc-stg and ca-provider-wc-stg…
  az acr update -n acrwc --admin-enabled false
  ```

#### High-3. No diagnostic settings anywhere, `Microsoft.Insights` not registered

- **Resources:** all of them — `ca-api`, `ca-admin`, `ca-booking`, `ca-provider`, `cae-wc-stg`, `pg-db-wc-stg`, `redis-wc-stg`, `acrwc`, `sawcstg`, `wc-frontdoor`.
- **Observed:**
  - `az monitor diagnostic-settings list --resource <id>` returns an empty `value[]` for every resource above.
  - `az provider show -n Microsoft.Insights` → `registrationState: NotRegistered`. (Attempting to query Front Door diagnostic settings actually returned `(InvalidAuthenticationToken) Please register the subscription with Microsoft.Insights`.)
  - The CAE `appLogsConfiguration.destination = log-analytics` is wired to `log-analytics-wc-stg`, so Container App stdout/stderr **does** flow to LAW. But platform-level logs (DB, Redis, ACR, FD access, etc.) do not.
- **Why it matters:** Without diagnostic settings, you have no Postgres slow-query / connection logs, no Redis ops logs, no ACR push/pull audit, no Front Door access/WAF logs. There's also no way to chart or alert on any of it.
- **Recommendation:**
  1. Register the resource provider:
     ```bash
     az provider register --namespace Microsoft.Insights
     ```
  2. Add a diagnostic-settings rule per resource shipping all logs + AllMetrics to `log-analytics-wc-stg`. Example for Postgres:
     ```bash
     LAW_ID=$(az monitor log-analytics workspace show -g rg-wc-staging-ch-north -n log-analytics-wc-stg --query id -o tsv)
     PG_ID=$(az postgres flexible-server show -g rg-wc-staging-ch-north -n pg-db-wc-stg --query id -o tsv)
     az monitor diagnostic-settings create \
       --name to-law --resource $PG_ID --workspace $LAW_ID \
       --logs '[{"category":"PostgreSQLLogs","enabled":true},{"category":"PostgreSQLFlexSessions","enabled":true},{"category":"PostgreSQLFlexQueryStoreRuntime","enabled":true}]' \
       --metrics '[{"category":"AllMetrics","enabled":true}]'
     ```
     Repeat for `acrwc` (ContainerRegistryRepositoryEvents, ContainerRegistryLoginEvents), `wc-frontdoor` (FrontDoorAccessLog, FrontDoorHealthProbeLog, FrontDoorWebApplicationFirewallLog), `redis-wc-stg`, `sawcstg` blob service, and the four Container Apps.

#### High-4. Front Door has no WAF policy

- **Resource:** `wc-frontdoor` (Standard SKU)
- **Observed:**
  - `az afd security-policy list ...` returns `[]`.
  - `az network front-door waf-policy list -g rg-wc-infra-shared-ch-north` returns empty.
  - The single FD route only fronts the `files.staging` blob origin. None of the four public Container Apps (api / superadmin / provider / booking) route through Front Door at all — they're hit directly on `*.staging.world-camps.org` → CAE FQDN.
- **Why it matters:** Two issues here:
  1. The blob endpoint behind FD has no WAF in front of it, even though Standard FD supports a managed-rule WAF policy.
  2. The Container Apps are exposed directly to the internet with no edge protection, no rate limiting, no IP allowlist (`ipSecurityRestrictions: null` on all of them).
- **Recommendation:**
  - Create a WAF policy with the Microsoft default rule set + bot manager and attach it to the FD endpoint.
  - Decide whether `*.staging.world-camps.org` should also flow through Front Door. If yes, add CAE FQDNs as additional origins and use the `X-Azure-FDID` header check on the Container App side to ensure traffic only enters via FD. If no, at least add IP-based `ipSecurityRestrictions` to the Container App ingress to limit access to known networks.
- **Audit:**
  ```bash
  az afd security-policy list -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor
  for app in ca-api-wc-stg ca-admin-wc-stg ca-booking-wc-stg ca-provider-wc-stg; do
    az containerapp show -n $app -g rg-wc-staging-ch-north --query "properties.configuration.ingress.ipSecurityRestrictions"
  done
  ```

### Medium

#### Med-5. Redis private endpoint never created

- **Resource:** `redis-wc-stg`
- **Observed:**
  - `publicNetworkAccess: Enabled`
  - `privateEndpointConnections: []`
  - `privatelink.redis.azure.net` zone exists with a vnet link to `vnet-wc-stg`.
  - `snet-redis-wc-stg` (10.0.1.0/24) exists with no delegation.
- **Why it matters:** The plumbing for a private endpoint is in place (DNS zone, subnet, vnet link), so the private connectivity was clearly *intended*, but the actual private endpoint resource was never created — so Redis is currently being reached over the public hostname `redis-wc-stg.switzerlandnorth.redis.azure.net`. The unused subnet and DNS zone also generate confusion if a future engineer assumes Redis is private.
- **Recommendation:** Create a private endpoint for Redis Enterprise into `snet-redis-wc-stg`, then set `publicNetworkAccess: Disabled`.
- **Audit:**
  ```bash
  az redisenterprise show -n redis-wc-stg -g rg-wc-staging-ch-north --query "{public:publicNetworkAccess, peCount:length(privateEndpointConnections)}"
  ```

#### Med-6. Frontend Container Apps have no probes

- **Resources:** `ca-admin-wc-stg`, `ca-booking-wc-stg`, `ca-provider-wc-stg`
- **Observed:** `properties.template.containers[0].probes: null` on all three. (`ca-api-wc-stg` correctly has TCP startup/liveness/readiness probes on port 3000.)
- **Why it matters:** Without probes, Container Apps falls back to a 5-second TCP listen check, which is fine for "is the process up" but useless for catching a frontend that's serving 500s. Restarts and revision rollouts are also less reliable.
- **Recommendation:** Add HTTP probes hitting a known-cheap path (Next.js exposes `/` returning a 200 once warm; or add a `/api/health` route).
- **Audit:**
  ```bash
  for app in ca-admin-wc-stg ca-booking-wc-stg ca-provider-wc-stg; do
    az containerapp show -n $app -g rg-wc-staging-ch-north --query "properties.template.containers[0].probes"
  done
  ```

#### Med-7. Storage account: shared-key access + open network defaults

- **Resource:** `sawcstg`
- **Observed:**
  - `allowSharedKeyAccess: true`
  - `networkRuleSet.defaultAction: "Allow"`, no IP rules, no VNet rules
  - `publicNetworkAccess: Enabled`
  - `allowBlobPublicAccess: true` — this is **intentional** to support the public `wc-booking-system` container (see [note](#note-storage-public-content-container-is-intentional)). Not flagged.
  - Good: `minimumTlsVersion: TLS1_2`, `supportsHttpsTrafficOnly: true`, blob soft delete and container soft delete both enabled (7 days). Versioning is **not** enabled.
- **Why it matters:** `allowSharedKeyAccess: true` means a leaked account key grants full data-plane access to **every** container, including the private `wc-staging-files` and `wc-dev-files`. The open network rule set means anyone with that key can use it from anywhere.
- **Recommendation (incremental):**
  - Move app code to Entra ID + RBAC for blob auth, then set `allowSharedKeyAccess: false`.
  - Restrict `networkRuleSet` to specific VNet subnets / IPs (CAE static IP `4.226.30.230`, dev IPs) once RBAC is in place; keep `bypass: AzureServices` so Front Door can still pull from the public container.
  - Enable blob versioning if you'd like stronger protection against accidental overwrites.

#### Med-8. Postgres durability / auth posture

- **Resource:** `pg-db-wc-stg`
- **Observed:**
  - `backup.geoRedundantBackup: Disabled`
  - `highAvailability.mode: Disabled` (single AZ — `availabilityZone: "1"`)
  - `storage.autoGrow: Disabled` (32 GiB hard ceiling — fills up silently if logs grow)
  - `authConfig.activeDirectoryAuth: Disabled` — password-only
  - `advancedThreatProtectionSettings.state: Disabled`
  - Good: `ssl: on`, `require_secure_transport: on`, `log_connections: on`, `version: 17`, `max_connections: 50` (sane default for B1ms; just be aware NestJS connection pools must respect this).
- **Why it matters:** Storage auto-grow off + Burstable + max_connections 50 is fine for staging but easy to forget about when promoting to prod. Geo-redundant backup is cheap insurance and the only knob that lets you restore to a different region.
- **Recommendation:**
  ```bash
  az postgres flexible-server update -g rg-wc-staging-ch-north -n pg-db-wc-stg --geo-redundant-backup Enabled
  az postgres flexible-server update -g rg-wc-staging-ch-north -n pg-db-wc-stg --storage-auto-grow Enabled
  az postgres flexible-server advanced-threat-protection-setting update -g rg-wc-staging-ch-north --server-name pg-db-wc-stg --state Enabled
  ```
  Add an Entra admin and start moving service accounts to Entra ID auth at your leisure.

### Low

#### Low-9. No Key Vault

- **Observed:** `az keyvault list` returns empty across the subscription.
- **Why it matters:** All secrets (DB password, Stripe keys, JWT signing keys, SMTP credentials, etc.) are stored as Container App secrets pushed in by the GitHub Actions workflow [`wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml#L113). Rotation requires re-running the deploy, and there's no central audit trail of secret access.
- **Recommendation:** Stand up a Key Vault (`kv-wc-stg`), put the same set of secrets in there, give the CAE managed identity `Key Vault Secrets User`, and use Container Apps' [Key Vault secret references](https://learn.microsoft.com/azure/container-apps/manage-secrets) instead of inline secret values.

#### Low-10. No alerts, action groups, activity log alerts, or resource locks

- **Observed:** `az monitor metrics alert list`, `az monitor activity-log alert list`, `az monitor action-group list`, and `az lock list` all returned empty.
- **Why it matters:** No paging on outage, no email on resource deletion, and any user with Contributor can `az ... delete` the entire RG in seconds. Not strictly necessary in staging but cheap to add.
- **Recommendation:**
  - At minimum, a `CanNotDelete` lock on the two RGs.
  - One action group with the team email + a few baseline alerts: API HTTP 5xx, Postgres `connections_failed` and `storage_used > 80%`, Redis `usedmemorypercentage`, Container App `Replicas == 0`.

#### Low-11. ACR retention and soft-delete disabled

- **Observed:**
  - `acrwc.policies.retentionPolicy.status: disabled` (untagged-manifest cleanup not running)
  - `acrwc.policies.softDeletePolicy.status: disabled`
  - Current usage: ~30 GB / 100 GB included in Standard. Not urgent yet but unbounded.
- **Recommendation:** Enable a 30-day retention policy on untagged manifests and a 7-day soft delete:
  ```bash
  az acr config retention update -r acrwc --status enabled --days 30 --type UntaggedManifests
  az acr config soft-delete update -r acrwc --status enabled --days 7
  ```

#### Low-12. Inconsistent tagging

- **Observed:** Of 16 resources in `rg-wc-staging-ch-north`, only 6 carry the `env=staging` tag. Three Container Apps and all 4 managed certificates have `tags: null`. The shared RG resources are tagged `env=shared`.
- **Why it matters:** Cost-by-tag reports and cleanup tooling will under-report whatever isn't tagged.
- **Recommendation:** Apply `env=staging` (and ideally `app=<wc-api|wc-superadmin|...>`, `managed-by=manual` until IaC is in place) across all resources:
  ```bash
  az tag update --operation merge --resource-id <resource-id> --tags env=staging app=wc-superadmin
  ```

#### Low-13. Staging Front Door lives in shared RG instead of staging RG

- **Observed:** `Microsoft.Cdn/profiles/wc-frontdoor` lives in `rg-wc-infra-shared-ch-north`. The shared RG is meant for cross-env infra (ACR); FD is per-env and should live with the rest of staging. Profile name is also not env-scoped.
- **Why it matters:** RG-scoped IAM, locks, cost tagging, and lifecycle (e.g. teardown of an entire env) all break when env resources are scattered. The prod runbook now puts `wc-prod-frontdoor` in the prod RG ([AZURE_SETUP_WC_PROD.md § 13](AZURE_SETUP_WC_PROD.md#L569)); staging should match.
- **Constraints:** `Microsoft.Cdn/profiles` doesn't support `az resource move`. A custom domain can only be attached to one FD profile at a time, so even with "create new first" there's a brief window where the custom domain is detached (cert re-validation ~1 hour). Plan a maintenance window for `files.staging.world-camps.org`.
- **Strategy:** Build the new FD fully in parallel with the old one (Phase A). The old FD keeps serving traffic throughout. Then perform a single coordinated swap (Phase B) where the custom domain moves from old → new. Old FD is deleted last (Phase C).

##### Phase A — provision new FD alongside old (zero traffic impact)

```bash
# A1. Capture current origin config from the old FD (sanity check)
az afd origin show -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor \
  --origin-group-name default-origin-group --origin-name files-staging \
  --query "{host:hostName, hostHeader:originHostHeader}"
# Expect: sawcstg.blob.core.windows.net

# A2. Create new profile + endpoint in the staging RG with env-scoped name
az afd profile create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --sku Standard_AzureFrontDoor \
  --tags env=staging app=wc managed-by=manual

az afd endpoint create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --endpoint-name wc-stg \
  --enabled-state Enabled

# A3. Origin group + origin (same shape as old)
az afd origin-group create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --origin-group-name og-files \
  --probe-request-type HEAD --probe-protocol Https --probe-interval-in-seconds 100 --probe-path / \
  --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50

az afd origin create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --origin-group-name og-files \
  --origin-name files-staging \
  --host-name sawcstg.blob.core.windows.net \
  --origin-host-header sawcstg.blob.core.windows.net \
  --http-port 80 --https-port 443 \
  --priority 1 --weight 1000 \
  --enabled-state Enabled \
  --enforce-certificate-name-check true

# A4. Smoke test the new FD via its default endpoint hostname (no custom domain yet)
NEW_HOST=$(az afd endpoint show -g rg-wc-staging-ch-north --profile-name wc-stg-frontdoor --endpoint-name wc-stg --query hostName -o tsv)
echo "New endpoint: $NEW_HOST"
# Bind a temporary route so the default hostname serves traffic for the smoke test
az afd route create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --endpoint-name wc-stg \
  --route-name tmp-default \
  --origin-group og-files \
  --supported-protocols Https \
  --link-to-default-domain Enabled \
  --forwarding-protocol HttpsOnly \
  --patterns-to-match "/*"
curl -I "https://$NEW_HOST/wc-booking-system/favicon-world-camps.png"
# Expect: 200. If anything else, debug here before touching the old FD.

# A5. Remove temporary route (clears the way to bind the real custom domain in B4)
az afd route delete \
  -g rg-wc-staging-ch-north --profile-name wc-stg-frontdoor \
  --endpoint-name wc-stg --route-name tmp-default --yes
```

##### Phase B — swap (downtime window starts here)

```bash
# B1. Detach custom domain from OLD FD. After this point, files.staging.world-camps.org
#     is broken until B5 completes.
OLD_ROUTE=$(az afd route list -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor --endpoint-name wc-cdn --query "[0].name" -o tsv)
az afd route delete \
  -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor \
  --endpoint-name wc-cdn --route-name "$OLD_ROUTE" --yes

OLD_CDOM=$(az afd custom-domain list -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor --query "[0].name" -o tsv)
az afd custom-domain delete \
  -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor \
  --custom-domain-name "$OLD_CDOM" --yes

# B2. Add the custom domain to NEW FD — prints a new validation TXT token
az afd custom-domain create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --custom-domain-name files-staging-wc \
  --host-name files.staging.world-camps.org \
  --certificate-type ManagedCertificate \
  --minimum-tls-version TLS12

# B3. Add new _dnsauth TXT record on DNS (multiple TXT records at the same name are fine).
#     Then poll until Approved (typically 5–60 minutes):
az afd custom-domain show \
  -g rg-wc-staging-ch-north --profile-name wc-stg-frontdoor \
  --custom-domain-name files-staging-wc \
  --query domainValidationState

# B4. Once Approved, create the real route binding the custom domain
az afd route create \
  -g rg-wc-staging-ch-north \
  --profile-name wc-stg-frontdoor \
  --endpoint-name wc-stg \
  --route-name default-route \
  --origin-group og-files \
  --custom-domains files-staging-wc \
  --supported-protocols Https \
  --link-to-default-domain Disabled \
  --https-redirect Enabled \
  --forwarding-protocol HttpsOnly \
  --patterns-to-match "/*"

# B5. Update DNS CNAME on the registrar:
#     files.staging.world-camps.org  CNAME  $NEW_HOST
#     (Drop TTL to 60s ahead of time if practical.)
dig +short files.staging.world-camps.org CNAME
# Expect: $NEW_HOST

# B6. Verify
curl -I https://files.staging.world-camps.org/wc-booking-system/favicon-world-camps.png
# Expect: 200
```

##### Phase C — clean up

```bash
az afd profile delete -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor --yes
az afd profile list -o table   # only wc-stg-frontdoor in rg-wc-staging-ch-north should remain
# Optionally remove the now-unused old _dnsauth TXT record from DNS.
```

##### Rollback

- **If Phase A fails:** old FD is still serving — just `az afd profile delete -g rg-wc-staging-ch-north --profile-name wc-stg-frontdoor --yes` and try again.
- **If Phase B fails after B1 (custom domain detached):** re-bind the custom domain to the old `wc-frontdoor` profile in the shared RG by running the B2–B4 equivalent against it. Cert re-validates (~1 hour).

> **Optional follow-up:** the FD recreate is a natural moment to attach a WAF policy in the staging RG, closing [High-4](#high-4-front-door-has-no-waf-policy). Out of scope for this finding — handle as a separate fix.

---

## Cost notes

Quick read of the staging footprint, in order of impact:

- **Redis Enterprise `Balanced_B0`** — this is the cheapest Enterprise tier, but **Azure Cache for Redis Basic C0/C1** is roughly an order of magnitude cheaper for staging-scale workloads. Unless you specifically need RediSearch/RedisJSON modules, Redis Enterprise is overkill here. The current eviction policy is `NoEviction` — for a Socket.io/session cache that's almost certainly wrong; on memory pressure, writes will fail rather than evicting cold keys.
- **Postgres Standard_B1ms** — already minimal, leave as is.
- **Container Apps Consumption profile, min 1 replica × 4 apps** — paying for 4 always-on replicas. If you're OK with cold-starts on staging, drop the three frontends to `min-replicas 0` (the API workflow's existing 30s sleep + 10× retry health check handles cold start). Keep API at min 1.
- **ACR Standard** — fine. Basic would also work for one staging env, but Standard is reasonable if shared with prod.
- **Front Door Standard** — already the cheap tier.

---

## Suggested next steps (ordered)

1. **Mitigate High-1 today** — drop the `AllowAllAzureServicesAndResourcesWithinAzureIps_…` firewall rule on Postgres and replace it with the CAE static egress IP `4.226.30.230`. Plan a recreate to VNet-integrated mode for next maintenance window.
2. **Register `Microsoft.Insights` and add diagnostic settings** (High-3) — prerequisite for any of the alerting work in step 4 and for Front Door diagnostic logs.
3. **Switch the three frontends to MI-based ACR pull and disable the ACR admin user** (High-2).
4. **Stand up Key Vault + minimal alerting** (Low-9, Low-10). One Key Vault, one action group, ~5 alerts.
5. **Attach a WAF policy to Front Door** (High-4) and decide whether the Container Apps should also route through Front Door.
6. **Create the Redis private endpoint and disable Redis public access** (Med-5).
7. **Move staging Front Door into `rg-wc-staging-ch-north`** (Low-13). Natural pairing with step 5 if you're already in the FD recreate path.
8. **Adopt Bicep or Terraform for this environment.** All of the above are individually small; collectively they're a sign that drift between intended and actual state is large enough to need IaC. The staging RG is a good size to bootstrap from — `az bicep decompile` or `aztfexport` will give you a working starting point.

---

## Verification

To verify the report against the live state:

```bash
az resource list -g rg-wc-staging-ch-north -o table
az resource list -g rg-wc-infra-shared-ch-north -o table
az acr show -n acrwc --query "{admin:adminUserEnabled, retention:policies.retentionPolicy.status}"
az postgres flexible-server show -n pg-db-wc-stg -g rg-wc-staging-ch-north --query network
az postgres flexible-server firewall-rule list -g rg-wc-staging-ch-north -n pg-db-wc-stg -o table
az redisenterprise show -n redis-wc-stg -g rg-wc-staging-ch-north --query "{public:publicNetworkAccess, peCount:length(privateEndpointConnections)}"
az afd security-policy list -g rg-wc-infra-shared-ch-north --profile-name wc-frontdoor
az provider show -n Microsoft.Insights --query registrationState
```
