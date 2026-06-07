# Azure Setup for World Camps Production (Beta Launch)

This is the runbook for standing up the World Camps **production** environment on Azure. It is designed for the beta launch — low hundreds of concurrent users, single region, no HA on the data tier yet — and bakes in every fix called out in [`AZURE_STAGING_REVIEW.md`](AZURE_STAGING_REVIEW.md).

Run the sections in order. Every command is copy-pasteable; placeholders are wrapped in `<…>` and explained in the section that introduces them.

> **Companion docs:** [`AZURE_SETUP_WC_STAGING.md`](AZURE_SETUP_WC_STAGING.md) (style template), [`AZURE_STAGING_REVIEW.md`](AZURE_STAGING_REVIEW.md) (the issues this doc fixes), [`DEPLOYMENT_WC_STAGING.md`](DEPLOYMENT_WC_STAGING.md), [`.github/workflows/wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml).

---

## Overview

### Goals

- **Secure-by-default**: no public Postgres, no admin keys, no shared-key storage, every request through a WAF.
- **Observable**: every resource ships logs and metrics to a single Log Analytics workspace; an action group pages the team on outage.
- **Cheap-but-not-cheap**: ~$230–270 / month all-in. Skips HA on the data tier; keeps everything else at the smallest sane SKU.
- **Reasonable for beta**: scale knobs are documented (§ 22) so the team can grow each tier independently without re-architecting.

### Topology

```
Internet ──HTTPS──► wc-prod-frontdoor (Std + WAF)
                          │
                          ├─► api.world-camps.org      ──► ca-api-wc-prod
                          ├─► booking.world-camps.org  ──► ca-booking-wc-prod
                          ├─► provider.world-camps.org ──► ca-provider-wc-prod
                          ├─► superadmin.world-camps.org ──► ca-admin-wc-prod
                          └─► files.world-camps.org    ──► sawcprod (blob)

         Container Apps Env (cae-wc-prod, VNet-integrated)
              │  AcrPull MI ──► acrwc (shared)
              │  Secrets MI ──► kv-wc-prod
              │  Blob MI    ──► sawcprod
              │
              ▼
        ┌──────────────────────────────────────────┐
        │   vnet-wc-prod  10.1.0.0/20              │
        │   ├─ snet-aca   10.1.0.0/23  (CAE)       │
        │   ├─ snet-pg    10.1.2.0/24  (Postgres)  │
        │   ├─ snet-pe    10.1.3.0/24  (Redis PE)  │
        │   └─ snet-jump  10.1.4.0/28  (ops VM)    │
        └──────────────────────────────────────────┘
              │                          │
              ▼                          ▼
       pg-wc-prod (Postgres flex,   redis-wc-prod (Azure Managed Redis
       VNet-integrated, public OFF)  Balanced_B0, private endpoint)
```

### Confirmed inputs

- **Subscription:** `65a4056e-681d-44cb-9d47-3eb3a9c77d94` (same as staging)
- **Resource group:** `rg-wc-prod-ch-north` (already exists, empty, tagged `env=prod`)
- **Region:** Switzerland North
- **Domain:** `*.world-camps.org` (override at § 17 if different)
- **IaC:** `az` runbook for now; Bicep migration in [Appendix A](#appendix-a--when-to-move-to-bicepterraform)
- **Front Door:** new prod profile `wc-prod-frontdoor` fronts **all 5 hostnames**, with WAF
- **GH Actions auth:** federated OIDC (no long-lived `AZURE_CREDENTIALS_PROD` secret)

---

## 1. Prerequisites

```bash
# Logged-in CLI with Owner on the prod RG
az account set --subscription 65a4056e-681d-44cb-9d47-3eb3a9c77d94
az account show --query "{sub:name, user:user.name}" -o table

# One-time: register resource providers we need (Insights is currently NotRegistered)
for ns in Microsoft.Insights Microsoft.OperationalInsights Microsoft.App \
          Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL \
          Microsoft.Cache Microsoft.Cdn Microsoft.KeyVault \
          Microsoft.Storage Microsoft.Network Microsoft.Security; do
  az provider register --namespace "$ns"
done
```

`az provider register` is fire-and-forget. Block until every namespace is actually registered before continuing — subsequent resource creates fail with `ResourceProviderNotRegistered` otherwise:

```bash
for ns in Microsoft.Insights Microsoft.OperationalInsights Microsoft.App \
          Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL \
          Microsoft.Cache Microsoft.Cdn Microsoft.KeyVault \
          Microsoft.Storage Microsoft.Network Microsoft.Security; do
  while [ "$(az provider show -n $ns --query registrationState -o tsv)" != "Registered" ]; do
    echo "Waiting for $ns to finish registering…"
    sleep 10
  done
done
echo "All providers registered."
```

---

## 2. Naming + tagging conventions

| Resource | Name | Notes |
|---|---|---|
| Resource group | `rg-wc-prod-ch-north` | exists |
| Shared RG | `rg-wc-infra-shared-ch-north` | exists |
| VNet | `vnet-wc-prod` | 10.1.0.0/20 |
| Log Analytics | `log-wc-prod` | |
| Application Insights | `appi-wc-prod` | workspace-based, links to `log-wc-prod` |
| Key Vault | `kv-wc-prod` | RBAC mode |
| Storage account | `sawcprod` | LRS (upgrade to ZRS at Day-2 if regulatory pressure) |
| Postgres flex server | `pg-wc-prod` | VNet-integrated, no public endpoint |
| Postgres connection endpoint | `pg-wc-prod.postgres.database.azure.com` | resolves to 10.1.2.x inside `vnet-wc-prod` only |
| Postgres private DNS zone | `pg-wc-prod.private.postgres.database.azure.com` | zone name (do not use as connection target) |
| Redis (AMR) | `redis-wc-prod` | Azure Managed Redis, Balanced_B0 |
| Redis private DNS | `privatelink.redis.azure.net` | |
| Container App env | `cae-wc-prod` | system-assigned MI |
| Container Apps | `ca-api-wc-prod`, `ca-admin-wc-prod`, `ca-booking-wc-prod`, `ca-provider-wc-prod` | |
| Front Door profile | `wc-prod-frontdoor` | new, in prod RG |
| Front Door endpoint | `wc-prod` | hostname auto-generated |
| WAF policy | `wcprodwaf` | prod RG |
| Action group | `ag-wc-prod-oncall` | |

**Mandatory tags** on every resource:

```bash
TAGS="env=prod app=wc managed-by=manual cost-center=wc"
```

When the runbook says `--tags $TAGS`, drop in any per-resource extras (e.g. `app=ca-api`).

---

## 3. Resource group lock — defer until end

> **Important — do NOT lock the RG yet.** Despite its name, `CanNotDelete` blocks subnet-delegation writes, which means Postgres flex (§ 7), Container Apps env (§ 10), and private endpoints (§ 8) all fail with `OperationFailed … blocking by customer lock` if the RG is locked at creation time. Provision everything first, then apply the lock in § 23 once the environment is fully built.

For the impatient: jump to [§ 23](#23-resource-group-lock-final-step) to see the lock command, but only run it after § 16 is complete.

---

## 4. Networking

```bash
# VNet
az network vnet create \
  -g rg-wc-prod-ch-north \
  -n vnet-wc-prod \
  --address-prefixes 10.1.0.0/20 \
  --location switzerlandnorth \
  --tags env=prod app=wc managed-by=manual

# Subnet for Container Apps Env (must be /23 minimum for Consumption-only)
az network vnet subnet create \
  -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod \
  -n snet-aca \
  --address-prefixes 10.1.0.0/23 \
  --delegations Microsoft.App/environments

# Subnet for Postgres flex (delegated)
az network vnet subnet create \
  -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod \
  -n snet-pg \
  --address-prefixes 10.1.2.0/24 \
  --delegations Microsoft.DBforPostgreSQL/flexibleServers

# Subnet for private endpoints (Redis, optionally KV/Storage later)
az network vnet subnet create \
  -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod \
  -n snet-pe \
  --address-prefixes 10.1.3.0/24 \
  --private-endpoint-network-policies Disabled

# Optional ops jump subnet (provisioned in § 21 — ops jump VM)
az network vnet subnet create \
  -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod \
  -n snet-jump \
  --address-prefixes 10.1.4.0/28
```

---

## 5. Log Analytics + Application Insights

Provision logging first; later resources will reference its ID.

```bash
az monitor log-analytics workspace create \
  -g rg-wc-prod-ch-north \
  -n log-wc-prod \
  --location switzerlandnorth \
  --retention-time 30 \
  --tags env=prod app=wc managed-by=manual

LAW_ID=$(az monitor log-analytics workspace show -g rg-wc-prod-ch-north -n log-wc-prod --query id -o tsv)
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys -g rg-wc-prod-ch-north -n log-wc-prod --query primarySharedKey -o tsv)

# Workspace-based Application Insights (for the API)
az monitor app-insights component create \
  -g rg-wc-prod-ch-north \
  --app appi-wc-prod \
  --location switzerlandnorth \
  --workspace "$LAW_ID" \
  --kind web \
  --tags env=prod app=wc-api managed-by=manual

APPI_CONN=$(az monitor app-insights component show -g rg-wc-prod-ch-north --app appi-wc-prod --query connectionString -o tsv)
echo "APPI_CONN=$APPI_CONN"   # save for § 11.1 (set as APPLICATIONINSIGHTS_CONNECTION_STRING on the API)
```

---

## 6. Key Vault

RBAC mode, soft-delete + purge protection on (purge protection is irreversible — be deliberate).

```bash
az keyvault create \
  -g rg-wc-prod-ch-north \
  -n kv-wc-prod \
  --location switzerlandnorth \
  --sku standard \
  --enable-rbac-authorization true \
  --retention-days 90 \
  --enable-purge-protection true \
  --public-network-access Enabled \
  --tags env=prod app=wc managed-by=manual

# Grant yourself Key Vault Administrator so you can write secrets in § 18
ME=$(az ad signed-in-user show --query id -o tsv)
KV_ID=$(az keyvault show -n kv-wc-prod --query id -o tsv)
az role assignment create --assignee "$ME" --role "Key Vault Administrator" --scope "$KV_ID"
```

> Public network access is `Enabled` so the GitHub Actions runner can write secrets (§ 19). Once the deploy workflow is stable, switch to a private endpoint into `snet-pe` and use a self-hosted runner. That's a Day-2 task; not blocking for beta launch.

---

## 7. Postgres Flexible Server (VNet-integrated)

> **Network mode is immutable** on flex servers. Get this right at create time — there is no "switch from public to private" later.

> **Why VNet injection (not private endpoint)?** Postgres flex doesn't offer the private-endpoint pattern that Redis uses in § 8. Instead, the server is *injected* directly into `snet-pg` — it gets a private IP there and has no public endpoint at all. This is arguably stronger than private endpoint because there's no public endpoint to attack — `az postgres flexible-server firewall-rule list` will actually refuse to run, confirming no public exposure exists. All traffic from `ca-*-wc-prod` in `snet-aca` to Postgres in `snet-pg` is pure VNet-internal routing.

> **Geo-backup is off for beta.** Burstable tier on B1ms with cross-region backup has been historically flaky. In-region point-in-time restore still works (7-day retention via `--backup-retention 7` below). Re-enable geo-redundancy when you scale up — see § 22 Day-2 row.

```bash
# Private DNS zone for the VNet-integrated server
az network private-dns zone create \
  -g rg-wc-prod-ch-north \
  -n pg-wc-prod.private.postgres.database.azure.com

az network private-dns link vnet create \
  -g rg-wc-prod-ch-north \
  -n pg-wc-prod-link \
  -z pg-wc-prod.private.postgres.database.azure.com \
  -v vnet-wc-prod \
  -e false

# Generate a strong admin password and stash it in Key Vault.
# Postgres flex requires 3-of-4 character categories (upper/lower/digit/non-alphanumeric).
# Pure alphanumeric + `Aa1` suffix gives 3 categories (upper, lower, digit) and meets the rule.
# IMPORTANT: do NOT include URL-special chars (`#`, `@`, `:`, `/`, `?`, `&`, `=`, `%`) — the API's
# startup script composes `DATABASE_URL=postgresql://wcadmin:${PG_ADMIN_PASS}@...` for Prisma
# migrations, and those chars break the URL parser (P1013 "invalid port number" / similar).
PG_ADMIN_PASS="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 28)Aa1"
az keyvault secret set --vault-name kv-wc-prod -n postgres-password --value "$PG_ADMIN_PASS"

# Create the server
az postgres flexible-server create \
  -g rg-wc-prod-ch-north \
  -n pg-wc-prod \
  --location switzerlandnorth \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --version 17 \
  --storage-size 32 \
  --storage-auto-grow Disabled \
  --backup-retention 7 \
  --geo-redundant-backup Disabled \
  --high-availability Disabled \
  --admin-user wcadmin \
  --admin-password "$PG_ADMIN_PASS" \
  --vnet vnet-wc-prod \
  --subnet snet-pg \
  --private-dns-zone pg-wc-prod.private.postgres.database.azure.com \
  --yes \
  --tags env=prod app=wc managed-by=manual

# Strict TLS + connection logging
az postgres flexible-server parameter set -g rg-wc-prod-ch-north --server-name pg-wc-prod --name require_secure_transport --value on
az postgres flexible-server parameter set -g rg-wc-prod-ch-north --server-name pg-wc-prod --name log_connections --value on
az postgres flexible-server parameter set -g rg-wc-prod-ch-north --server-name pg-wc-prod --name log_disconnections --value on
az postgres flexible-server parameter set -g rg-wc-prod-ch-north --server-name pg-wc-prod --name log_checkpoints --value on

# Advanced Threat Protection — deliberately OFF for beta (~$15/mo savings).
# The server is private (VNet-only, no public access) so the immediate attack
# surface is small. Re-enable at Day-2 once real traffic ramps:
#   az postgres flexible-server advanced-threat-protection-setting update \
#     -g rg-wc-prod-ch-north --server-name pg-wc-prod --state Enabled

# Set yourself as the Entra admin on the server.
# Optional — only needed if you plan to authenticate to Postgres with an Azure AD token
# instead of the wcadmin password. § 21's pgAdmin flow uses password auth, so this is
# strictly optional. Delete the entire block if you don't need SSO.
#
# Step 1: Entra auth must be explicitly enabled on the server (default is password-only).
# Keep --password-auth Enabled so the wcadmin password (POSTGRES_PASSWORD secretref) keeps working.
az postgres flexible-server update \
  -g rg-wc-prod-ch-north -n pg-wc-prod \
  --microsoft-entra-auth Enabled --password-auth Enabled

# Step 2: Now register yourself as an Entra admin.
ME=$(az ad signed-in-user show --query id -o tsv)
MY_UPN=$(az ad signed-in-user show --query userPrincipalName -o tsv)
az postgres flexible-server microsoft-entra-admin create \
  -g rg-wc-prod-ch-north --server-name pg-wc-prod \
  --display-name "$MY_UPN" --object-id "$ME" --type User

# Create the application database
az postgres flexible-server db create \
  -g rg-wc-prod-ch-north -s pg-wc-prod \
  --database-name world-camps

# The app reads individual POSTGRES_* env vars (see § 11.1), not a combined DATABASE_URL,
# so no connection-string secret is built here.
#
# Note on the FQDN to use: connect using the *canonical* FQDN
#   pg-wc-prod.postgres.database.azure.com
# NOT the `.private.`-prefixed form. Reason: the zone above is named with the server name
# baked into it (Azure's choice when you pass --private-dns-zone <server>.private.postgres...),
# so the zone only has a hash-named A record at runtime, not an apex record. Azure's
# split-horizon DNS routes the canonical FQDN to the private IP from inside the VNet —
# `pg-wc-prod.postgres.database.azure.com` resolves to 10.1.2.x for any pod in vnet-wc-prod.
# Same private routing either way; just use the form that actually resolves.
```

---

## 8. Azure Managed Redis (Balanced_B0)

Matches the staging Redis product (`Microsoft.Cache/redisEnterprise`, kind `v2`). Note: this is **not** the same product as the legacy "Azure Cache for Redis" — different CLI (`az redisenterprise`), different port (10000, not 6380), different host pattern (`*.<region>.redis.azure.net`), different private-link group-id (`redisEnterprise`), different private DNS zone (`privatelink.redis.azure.net`).

```bash
# Cluster + default database in one call. All the database-level settings below are set HERE
# (not via a later `database update`) because **clustering policy can only be set at creation** —
# `az redisenterprise database update` rejects changing it afterwards.
#
# `--clustering-policy NoCluster`: REQUIRED. The default is `OSSCluster`, on which BullMQ's multi-key
#   Lua scripts fail with `CROSSSLOT Keys in request don't hash to the same slot` (the app uses
#   standalone ioredis with no hash-tag prefixes). NoCluster matches staging; on Balanced_B0 it's a
#   single shard anyway, so there's no perf loss (OSSCluster only helps multi-shard scale-out, which
#   this app can't use). If you ever need sharding, that's an app rework (cluster client + hash tags).
# `--access-keys-authentication Enabled`: the default flips to Disabled in az CLI 2.86 (May 2026
#   breaking change); we use the access key in the connection string, so keep keys on. (If you ever
#   recreate the DB without this, `list-keys` and the app's key auth break — re-enable via update.)
# `--eviction-policy AllKeysLRU`: staging defaults to NoEviction, wrong for a session cache.
# `--public-network-access Disabled` (cluster-level): avoids a separate lock-down call later.
az redisenterprise create \
  -g rg-wc-prod-ch-north \
  --cluster-name redis-wc-prod \
  --location switzerlandnorth \
  --sku Balanced_B0 \
  --minimum-tls-version 1.2 \
  --public-network-access Disabled \
  --clustering-policy NoCluster \
  --eviction-policy AllKeysLRU \
  --access-keys-authentication Enabled \
  --client-protocol Encrypted \
  --tags env=prod app=wc managed-by=manual

# Private endpoint into snet-pe — note group-id is "redisEnterprise" (not "redisCache")
REDIS_ID=$(az redisenterprise show -g rg-wc-prod-ch-north --cluster-name redis-wc-prod --query id -o tsv)
az network private-endpoint create \
  -g rg-wc-prod-ch-north \
  -n pe-redis-wc-prod \
  --vnet-name vnet-wc-prod --subnet snet-pe \
  --private-connection-resource-id "$REDIS_ID" \
  --connection-name pe-redis-wc-prod-conn \
  --group-id redisEnterprise \
  --location switzerlandnorth

# Private DNS for Azure Managed Redis (DIFFERENT zone from classic Cache for Redis)
az network private-dns zone create -g rg-wc-prod-ch-north -n privatelink.redis.azure.net
az network private-dns link vnet create \
  -g rg-wc-prod-ch-north \
  -n redis-amr-link \
  -z privatelink.redis.azure.net \
  -v vnet-wc-prod -e false
az network private-endpoint dns-zone-group create \
  -g rg-wc-prod-ch-north \
  --endpoint-name pe-redis-wc-prod \
  -n redis-dns-zone-group \
  --private-dns-zone privatelink.redis.azure.net \
  --zone-name redis-azure

# (Public access is already disabled at create time — no separate "lock down" call needed.)

# Stash the Redis connection string in Key Vault — port is 10000 on AMR
REDIS_HOST=$(az redisenterprise show -g rg-wc-prod-ch-north --cluster-name redis-wc-prod --query hostName -o tsv)
REDIS_KEY=$(az redisenterprise database list-keys \
  -g rg-wc-prod-ch-north --cluster-name redis-wc-prod \
  --query primaryKey -o tsv)
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:10000"
az keyvault secret set --vault-name kv-wc-prod -n redis-url --value "$REDIS_URL"
```

---

## 9. Storage account (LRS, Entra ID auth)

```bash
az storage account create \
  -g rg-wc-prod-ch-north \
  -n sawcprod \
  --location switzerlandnorth \
  --kind StorageV2 \
  --sku Standard_LRS \
  --access-tier Hot \
  --min-tls-version TLS1_2 \
  --https-only true \
  --allow-blob-public-access true \
  --allow-shared-key-access false \
  --default-action Allow \
  --tags env=prod app=wc managed-by=manual
```

> **Why `allow-blob-public-access true`** even though shared-key is off? To support a public-asset container for logos served via Front Door (see [memory note](AZURE_STAGING_REVIEW.md#note-storage-public-content-container-is-intentional)). Public-access is still gated per-container; only the asset container will be opened up.

```bash
# Soft delete + versioning
az storage account blob-service-properties update \
  -g rg-wc-prod-ch-north \
  --account-name sawcprod \
  --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30 \
  --enable-versioning true

# Grant yourself Storage Blob Data Contributor so you can create containers
ME=$(az ad signed-in-user show --query id -o tsv)
SA_ID=$(az storage account show -g rg-wc-prod-ch-north -n sawcprod --query id -o tsv)
az role assignment create --assignee "$ME" --role "Storage Blob Data Contributor" --scope "$SA_ID"

# Containers
# Private: user-uploaded files referenced by wc-nest-api (PII, attachments). App writes via MI.
az storage container create --account-name sawcprod --auth-mode login -n wc-prod-files

# Public: assets served through Front Door (logos, favicons, marketing images).
# Public-access on the container is gated; the account-level `allow-blob-public-access true`
# in the create above just permits this exception.
az storage container create \
  --account-name sawcprod --auth-mode login \
  -n wc-prod-public-assets --public-access blob

# Smoke-test marker for § 20 — a tiny file that proves the FD → blob path works end-to-end.
echo "ok" > /tmp/healthcheck.txt
az storage blob upload \
  --account-name sawcprod --auth-mode login \
  --container-name wc-prod-public-assets \
  --name healthcheck.txt \
  --file /tmp/healthcheck.txt --overwrite
rm /tmp/healthcheck.txt
```

---

## 10. Container Apps environment

```bash
az containerapp env create \
  -g rg-wc-prod-ch-north \
  -n cae-wc-prod \
  --location switzerlandnorth \
  --logs-destination log-analytics \
  --logs-workspace-id "$(az monitor log-analytics workspace show -g rg-wc-prod-ch-north -n log-wc-prod --query customerId -o tsv)" \
  --logs-workspace-key "$LAW_KEY" \
  --infrastructure-subnet-resource-id "$(az network vnet subnet show -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod -n snet-aca --query id -o tsv)" \
  --internal-only false \
  --enable-mtls \
  --tags env=prod app=wc managed-by=manual

# Capture the system-assigned MI principal ID (the env gets one automatically once a CA references it,
# but force-create now and grant ACR/KV/Storage roles up front).
az containerapp env identity assign \
  -g rg-wc-prod-ch-north -n cae-wc-prod --system-assigned
CAE_MI=$(az containerapp env show -g rg-wc-prod-ch-north -n cae-wc-prod --query identity.principalId -o tsv)

# Role assignments
ACR_ID=$(az acr show -n acrwc -g rg-wc-infra-shared-ch-north --query id -o tsv)
KV_ID=$(az keyvault show -n kv-wc-prod --query id -o tsv)
SA_ID=$(az storage account show -g rg-wc-prod-ch-north -n sawcprod --query id -o tsv)
az role assignment create --assignee "$CAE_MI" --role "AcrPull"                    --scope "$ACR_ID"
az role assignment create --assignee "$CAE_MI" --role "Storage Blob Data Contributor" --scope "$SA_ID"

# Shared user-assigned MI for Container App secret resolution.
# Why a separate MI instead of the CAE's system MI: the CAE system MI works for
# `--registry-identity system-environment` (ACR pull), but the current `containerapp`
# CLI extension (1.3.x) doesn't reliably honor `system-environment` as an
# `identityref:` for KV secret resolution — Container Apps boot with a
# `KeyVaultReferenceNotFound` failure. A dedicated user-assigned MI works
# consistently and is referenced from every CA in § 11.
az identity create -g rg-wc-prod-ch-north -n mi-ca-kv-wc-prod \
  --location switzerlandnorth \
  --tags env=prod app=wc managed-by=manual

CA_KV_MI_ID=$(az identity show -g rg-wc-prod-ch-north -n mi-ca-kv-wc-prod --query id -o tsv)
CA_KV_MI_PRINCIPAL=$(az identity show -g rg-wc-prod-ch-north -n mi-ca-kv-wc-prod --query principalId -o tsv)

# Grant the MI Key Vault Secrets User on kv-wc-prod
az role assignment create --assignee "$CA_KV_MI_PRINCIPAL" --role "Key Vault Secrets User" --scope "$KV_ID"
```

> Export `CA_KV_MI_ID` in the same shell session as § 11 — the value is interpolated directly into each `keyvaultref` in § 11.1. If you closed the shell between runs, re-export:
> ```bash
> CA_KV_MI_ID=$(az identity show -g rg-wc-prod-ch-north -n mi-ca-kv-wc-prod --query id -o tsv)
> ```

---

## 11. Container Apps × 4

> **Run § 18 first.** The API ([§ 11.1](#111-api-ca-api-wc-prod)) references 9 Key Vault secrets via `keyvaultref:`. If any are missing when the Container App is created, the CA enters a crash loop on startup with `KeyVaultReferenceNotFound`. By § 11 time, only `postgres-password` (§ 7) and `redis-url` (§ 8) exist — the other 7 (`jwt-secret`, `jwt-refresh-secret`, `email-pass`, `stripe-secret-key`, `stripe-webhook-secret`, `stripe-connect-webhook-secret`, `google-places-api-key`) come from § 18. Jump to § 18, run it, then come back here.

The four apps share the same auth/secrets pattern but differ in CPU/memory/scale. The blocks below pin to image tag `0.19.0` (current at staging). When cutting a new release, search-and-replace `:0.19.0` → `:<new-version>` across § 11 before running. All four apps share the same tag — there's no app-by-app version skew at the moment.

### 11.1 API (`ca-api-wc-prod`)

The env-var and secret list below mirrors staging (`ca-api-wc-stg`) one-for-one, with prod-appropriate values where they differ (hostnames, Postgres host, `TRUST_PROXY=true` for Front Door, etc.). `STRIPE_PUBLISHABLE_KEY` needs your live `pk_live_…` pasted in. Secret resolution uses the shared user-assigned MI `mi-ca-kv-wc-prod` created at the end of § 10 — `$CA_KV_MI_ID` must be exported in the same shell session.

```bash
az containerapp create \
  -g rg-wc-prod-ch-north \
  -n ca-api-wc-prod \
  --environment cae-wc-prod \
  --image acrwc.azurecr.io/wc-nest-api:0.19.0 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --user-assigned "$CA_KV_MI_ID" \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --revisions-mode multiple \
  --min-replicas 1 --max-replicas 2 \
  --cpu 1 --memory 2Gi \
  --scale-rule-name http-scaler \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50 \
  --secrets \
      "jwt-secret=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/jwt-secret,identityref:$CA_KV_MI_ID" \
      "jwt-refresh-secret=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/jwt-refresh-secret,identityref:$CA_KV_MI_ID" \
      "postgres-password=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/postgres-password,identityref:$CA_KV_MI_ID" \
      "email-pass=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/email-pass,identityref:$CA_KV_MI_ID" \
      "redis-url=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/redis-url,identityref:$CA_KV_MI_ID" \
      "stripe-secret-key=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/stripe-secret-key,identityref:$CA_KV_MI_ID" \
      "stripe-webhook-secret=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/stripe-webhook-secret,identityref:$CA_KV_MI_ID" \
      "stripe-connect-webhook-secret=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/stripe-connect-webhook-secret,identityref:$CA_KV_MI_ID" \
      "google-places-api-key=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/google-places-api-key,identityref:$CA_KV_MI_ID" \
  --env-vars \
      APP_VERSION=0.19.0 \
      NODE_ENV=production \
      APP_URL=https://api.world-camps.org \
      SUPERADMIN_PORTAL_URL=https://superadmin.world-camps.org \
      PROVIDER_PORTAL_URL=https://provider.world-camps.org \
      BOOKING_PORTAL_URL=https://booking.world-camps.org \
      CORS_ORIGINS=https://booking.world-camps.org,https://provider.world-camps.org,https://superadmin.world-camps.org \
      POSTGRES_HOST=pg-wc-prod.postgres.database.azure.com \
      POSTGRES_PORT=5432 \
      POSTGRES_USER=wcadmin \
      POSTGRES_DB=world-camps \
      POSTGRES_REQUIRE_SSL=true \
      AUTH_USING_REQUEST=false \
      JWT_EXPIRES_IN=15m \
      JWT_REFRESH_EXPIRES_IN=7d \
      BCRYPT_SALT_ROUNDS=12 \
      HELMET_ENABLED=true \
      TRUST_PROXY=true \
      RATE_LIMIT_FAIL_MODE=open \
      EMAIL_HOST=smtp.mailgun.org \
      EMAIL_PORT=587 \
      EMAIL_USER=booking@mail.world-camps.org \
      EMAIL_FROM=noreply@world-camps.org \
      AZURE_STORAGE_ACCOUNT_URL=https://sawcprod.blob.core.windows.net \
      AZURE_STORAGE_ACCOUNT_NAME=sawcprod \
      AZURE_STORAGE_CONTAINER_NAME=wc-prod-files \
      AZURE_STORAGE_SAS_EXPIRY_HOURS=24 \
      ENABLE_WEBSOCKET_MESSAGES=true \
      STRIPE_PUBLISHABLE_KEY="<pk_live_…>" \
      STRIPE_WEBHOOK_TOLERANCE_SECONDS=300 \
      STRIPE_WEBHOOK_EVENT_RETENTION_DAYS=90 \
      BILLING_OFF_SESSION_MAX_ATTEMPTS=2 \
      BILLING_OFF_SESSION_RETRY_HOURS=24 \
      BILLING_OFF_SESSION_STEP_UP_WINDOW_HOURS=48 \
      BILLING_BALANCE_CHARGE_CRON_MINUTES=30 \
      BILLING_AUTH_EXPIRY_WARN_DAYS=5 \
      BILLING_AUTH_EXPIRY_CANCEL_DAYS=6 \
      APPLICATIONINSIGHTS_CONNECTION_STRING="$APPI_CONN" \
      JWT_SECRET=secretref:jwt-secret \
      JWT_REFRESH_SECRET=secretref:jwt-refresh-secret \
      POSTGRES_PASSWORD=secretref:postgres-password \
      EMAIL_PASS=secretref:email-pass \
      REDIS_URL=secretref:redis-url \
      STRIPE_SECRET_KEY=secretref:stripe-secret-key \
      STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret \
      STRIPE_CONNECT_WEBHOOK_SECRET=secretref:stripe-connect-webhook-secret \
      GOOGLE_PLACES_API_KEY=secretref:google-places-api-key \
  --tags env=prod app=wc managed-by=manual

# Add HTTP probes. `az containerapp create` doesn't accept a probe spec, so we patch
# the existing definition via YAML. Requires `yq` (https://github.com/mikefarah/yq;
# `brew install yq` on macOS). Reuse this pattern for the three frontends in § 11.2-11.4
# — but pass the probe PATH as the 3rd arg: only the NestJS API serves `/health`; the
# Next.js frontends 404 it, which would fail every probe and restart-loop the replica
# (Degraded revision). The frontends serve `/` (and `/config.json`) — probe `/` for those.
add_probes () {
  local APP="$1"
  local PORT="$2"
  local PROBE_PATH="${3:-/health}"   # default /health (API); pass "/" for the frontends
  az containerapp show -g rg-wc-prod-ch-north -n "$APP" -o yaml > "/tmp/${APP}.yaml"
  yq -i '.properties.template.containers[0].probes = [
    {"type":"Liveness",  "httpGet":{"path":"'"$PROBE_PATH"'","port":'"$PORT"'}, "periodSeconds":30},
    {"type":"Readiness", "httpGet":{"path":"'"$PROBE_PATH"'","port":'"$PORT"'}, "periodSeconds":10, "failureThreshold":6},
    {"type":"Startup",   "httpGet":{"path":"'"$PROBE_PATH"'","port":'"$PORT"'}, "periodSeconds":5,  "failureThreshold":30}
  ]' "/tmp/${APP}.yaml"
  az containerapp update -g rg-wc-prod-ch-north -n "$APP" --yaml "/tmp/${APP}.yaml"
  rm "/tmp/${APP}.yaml"
}
add_probes ca-api-wc-prod 3000          # API serves /health
```

> **`AZURE_STORAGE_ACCOUNT_KEY` is intentionally absent.** Staging uses a shared-key secret for blob writes, but § 9 provisions prod with `--allow-shared-key-access false` (no shared keys) and the CAE env MI has `Storage Blob Data Contributor`. The API should use MI-based blob access in prod. If the app code can't do that yet, fix the app — don't re-enable shared keys.

### 11.2 Booking frontend (`ca-booking-wc-prod`)

Bootstrap with placeholder env. The real runtime env (the `PROD_BOOKING_ENV` GitHub Variable — see § 19) is injected on the first deploy from the `wc-prod-deploy.yml` workflow. No `NEXT_PUBLIC_*` is baked into the image; the app reads its config at runtime via the inline `<script>window.__APP_CONFIG__=…</script>` rendered by the root layout and the `/config.json` route handler.

```bash
az containerapp create \
  -g rg-wc-prod-ch-north \
  -n ca-booking-wc-prod \
  --environment cae-wc-prod \
  --image acrwc.azurecr.io/wc-booking:0.19.0 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --revisions-mode multiple \
  --min-replicas 1 --max-replicas 2 \
  --cpu 0.5 --memory 1Gi \
  --scale-rule-name http-scaler \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50 \
  --env-vars \
      NODE_ENV=production \
      PORT=3000 \
      APP_VERSION=0.0.0 \
  --tags env=prod app=wc managed-by=manual

add_probes ca-booking-wc-prod 3000 /   # Next.js frontend has no /health — probe /
```

### 11.3 Provider frontend (`ca-provider-wc-prod`)

```bash
az containerapp create \
  -g rg-wc-prod-ch-north \
  -n ca-provider-wc-prod \
  --environment cae-wc-prod \
  --image acrwc.azurecr.io/wc-provider:0.19.0 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --revisions-mode multiple \
  --min-replicas 1 --max-replicas 2 \
  --cpu 0.5 --memory 1Gi \
  --scale-rule-name http-scaler \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50 \
  --env-vars \
      NODE_ENV=production \
      PORT=3000 \
      APP_VERSION=0.0.0 \
  --tags env=prod app=wc managed-by=manual

add_probes ca-provider-wc-prod 3000 /   # Next.js frontend has no /health — probe /
```

### 11.4 Superadmin frontend (`ca-admin-wc-prod`)

The Container App name uses `admin`, but the image is `wc-superadmin` — matches the staging naming convention (`ca-admin-wc-stg` → `wc-superadmin` image).

```bash
az containerapp create \
  -g rg-wc-prod-ch-north \
  -n ca-admin-wc-prod \
  --environment cae-wc-prod \
  --image acrwc.azurecr.io/wc-superadmin:0.19.0 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --revisions-mode multiple \
  --min-replicas 1 --max-replicas 2 \
  --cpu 0.5 --memory 1Gi \
  --scale-rule-name http-scaler \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50 \
  --env-vars \
      NODE_ENV=production \
      PORT=3000 \
      APP_VERSION=0.0.0 \
  --tags env=prod app=wc managed-by=manual

add_probes ca-admin-wc-prod 3000 /   # Next.js frontend has no /health — probe /
```

### 11.6 Prisma migration Container Apps Job (`caj-migrate-wc-prod`)

A one-shot Container Apps Job that the prod workflow updates and triggers before each API deploy. Lives inside the VNet so it can reach the private Postgres endpoint, runs `npx prisma migrate deploy` as its entrypoint override, then exits. Workflow waits for the execution to finish; on failure, the deploy halts before the new API image is rolled out.

Prisma 7's [`prisma.config.ts`](apps/wc-nest-api/prisma.config.ts) reads `env('DATABASE_URL')`, so the Job must be given `DATABASE_URL` directly (a bare `npx prisma migrate deploy` fails with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`). [`start.sh`](apps/wc-nest-api/start.sh) composes the URL from the `POSTGRES_*` parts via a `/bin/sh -c` wrapper, but `az containerapp job create --command` rejects any value starting with `-` (sh's `-c`), so instead the full connection string is stored in Key Vault as `database-url` and referenced via `keyvaultref`, keeping the dash-free `--command "npx" "prisma" "migrate" "deploy"`.

```bash
# Store the full connection string as a KV secret first (one-time):
az keyvault secret set --vault-name kv-wc-prod -n database-url \
  --value 'postgresql://wcadmin:<POSTGRES_PASSWORD>@pg-wc-prod.postgres.database.azure.com:5432/world-camps?sslmode=require'
# (percent-encode any of @ / : ? # % in the password)

# Reuse the user-assigned MI created in § 10 (mi-ca-kv-wc-prod) for KV secret resolution.
CA_KV_MI_ID=$(az identity show -g rg-wc-prod-ch-north -n mi-ca-kv-wc-prod --query id -o tsv)

az containerapp job create \
  -g rg-wc-prod-ch-north \
  -n caj-migrate-wc-prod \
  --environment cae-wc-prod \
  --trigger-type Manual \
  --replica-timeout 600 \
  --replica-retry-limit 0 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image acrwc.azurecr.io/wc-nest-api:0.19.0 \
  --registry-server acrwc.azurecr.io \
  --registry-identity system-environment \
  --mi-user-assigned $CA_KV_MI_ID \
  --command "npx" "prisma" "migrate" "deploy" \
  --cpu 0.5 --memory 1Gi \
  --secrets \
      database-url=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/database-url,identityref:$CA_KV_MI_ID \
  --env-vars \
      NODE_ENV=production \
      DATABASE_URL=secretref:database-url \
  --tags env=prod app=wc managed-by=manual
```

The deploy workflow `wc-prod-deploy.yml` then runs:

```bash
# Update job's image to the new digest, start it, wait for completion.
az containerapp job update --name caj-migrate-wc-prod -g rg-wc-prod-ch-north \
  --image acrwc.azurecr.io/wc-nest-api@$API_DIGEST
az containerapp job start --name caj-migrate-wc-prod -g rg-wc-prod-ch-north
```

Same Job pattern should be set up for staging (`caj-migrate-wc-stg` in `rg-wc-staging-ch-north`) so the staging workflow can use it too.

### 11.5 Lock the four apps to Front Door only

We'll do this *after* Front Door is up (§ 13), once we know FD's frontdoor-id and IP range. Skip ahead, then come back.

---

## 12. Custom domains (handled at Front Door, not at the Container App)

Intentionally short. Public clients only ever connect to `*.world-camps.org` through Front Door (§ 13.5 + § 17), so the **FD-level managed cert** is the cert that actually serves browsers. The Container Apps never need their own `<hostname>-mc` cert — FD reaches each origin using its built-in `*.azurecontainerapps.io` FQDN with `--origin-host-header` set to the same FQDN ([§ 13.4](#134-origins-one-per-container-app--storage)), and the CA's default cert covers that.

Skipping the CAE-level hostname bind + managed cert also avoids a DNS conflict: § 17 needs `<hostname>` to `CNAME` at the FD endpoint, and the CAE custom-domain flow would need that same `<hostname>` to `CNAME` at the CA FQDN. A DNS name can only have one CNAME target, so only one of those can be true. Pick FD.

If you ever want a Container App reachable on its own custom hostname *without* FD (not the case here), come back to this section and put the CAE-level cert flow back.

---

## 13. Front Door + WAF

### 13.1 WAF policy

```bash
az network front-door waf-policy create \
  --resource-group rg-wc-prod-ch-north \
  --name wcprodwaf \
  --sku Standard_AzureFrontDoor \
  --mode Prevention

# Managed rule sets (Microsoft_DefaultRuleSet / Microsoft_BotManagerRuleSet) require
# Premium_AzureFrontDoor — Azure rejects `managed-rules add` against a Standard SKU
# with "Web Application Firewall Policy of sku type 'Standard_AzureFrontDoor' does not
# support ManagedRules". Deliberately omitted at beta to stay on the $230–270/mo budget.
# Day-2 upgrade path: change WAF SKU + FD profile SKU (§ 13.2) to Premium_AzureFrontDoor,
# then re-run the two `managed-rules add` calls (~+$300/mo).

# Rate-limit custom rule: 200 requests / minute / IP across all routes.
# `--defer` (generic-update-arg) was removed from az CLI 2.80.0, so the old pattern
# of `rule create --defer` + `rule match-condition add` no longer works. Modern CLI
# accepts the match-condition fields inline on `rule create`, so we collapse the two
# commands into one.
az network front-door waf-policy rule create \
  --resource-group rg-wc-prod-ch-north \
  --policy-name wcprodwaf \
  --name rateLimitPerIp \
  --priority 10 \
  --rule-type RateLimitRule \
  --rate-limit-duration 1 \
  --rate-limit-threshold 200 \
  --action Block \
  --match-variable RemoteAddr --operator IPMatch --values 0.0.0.0/0
```

### 13.2 Front Door profile + endpoint

```bash
az afd profile create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --sku Standard_AzureFrontDoor \
  --tags env=prod app=wc managed-by=manual

az afd endpoint create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --endpoint-name wc-prod \
  --enabled-state Enabled
```

### 13.3 One origin group per app (not one shared group)

> **Why one group per app, not a single `og-apps`.** A Front Door route forwards to an *origin
> group*, not to a specific origin. If all four app origins live in one group, FD load-balances every
> hostname across all four — there is no way to pin `booking.world-camps.org` to `booking-origin`.
> (Worse: with a `/health` probe that only the API answers, FD marks the three frontends unhealthy
> and sends *100%* of app traffic to the API.) The correct pattern for hosting distinct apps behind
> one endpoint is **one single-origin group per app**, each route → its own group (§ 13.6).
>
> Probe path differs by app: the API answers `GET /health` (200); the frontends 404 on `/health`, so
> they probe `GET /`. Provider/superadmin return a 308 redirect on `/` — FD counts non-2xx as a
> failed probe, but because each group has exactly **one** origin, FD's "all origins unhealthy → route
> to all anyway" rule keeps traffic flowing. (If you want clean health reporting, point those two
> probes at a path that returns 200.)

```bash
# API origin group — probes /health
az afd origin-group create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --origin-group-name og-api \
  --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 60 --probe-path /health \
  --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50

# Frontend origin groups — probe / (no /health on Next.js/Vite apps)
for og in og-booking og-provider og-admin; do
  az afd origin-group create \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --origin-group-name $og \
    --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 60 --probe-path / \
    --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50
done

# Files origin group (storage)
az afd origin-group create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --origin-group-name og-files \
  --probe-request-type HEAD --probe-protocol Https --probe-interval-in-seconds 100 --probe-path / \
  --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50
```

### 13.4 Origins (one per Container App + storage)

Each app gets a single origin inside *its own* origin group from § 13.3.

```bash
# pairs are "origin-group:container-app"
for pair in "og-api:ca-api-wc-prod" "og-admin:ca-admin-wc-prod" "og-booking:ca-booking-wc-prod" "og-provider:ca-provider-wc-prod"; do
  OG="${pair%:*}"
  APP="${pair#*:}"
  FQDN=$(az containerapp show -g rg-wc-prod-ch-north -n $APP --query properties.configuration.ingress.fqdn -o tsv)
  az afd origin create \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --origin-group-name "$OG" \
    --origin-name "${APP}-origin" \
    --host-name "$FQDN" \
    --origin-host-header "$FQDN" \
    --http-port 80 --https-port 443 \
    --priority 1 --weight 1000 \
    --enabled-state Enabled \
    --enforce-certificate-name-check true
done

# Storage origin
az afd origin create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --origin-group-name og-files \
  --origin-name files-origin \
  --host-name sawcprod.blob.core.windows.net \
  --origin-host-header sawcprod.blob.core.windows.net \
  --http-port 80 --https-port 443 \
  --priority 1 --weight 1000 \
  --enabled-state Enabled \
  --enforce-certificate-name-check true
```

### 13.5 Custom domains (one per hostname)

#### 13.5.1 Create the five custom-domain resources

```bash
for SUB in api booking provider superadmin files; do
  az afd custom-domain create \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --custom-domain-name "${SUB}-wc" \
    --host-name "${SUB}.world-camps.org" \
    --certificate-type ManagedCertificate \
    --minimum-tls-version TLS12
done
```

Each create returns a `validationProperties.validationToken`. You'll add one TXT record per host at your DNS provider so Front Door can issue the managed cert.

#### 13.5.2 Fetch the five validation tokens

```bash
for SUB in api booking provider superadmin files; do
  TOKEN=$(az afd custom-domain show \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --custom-domain-name "${SUB}-wc" \
    --query validationProperties.validationToken -o tsv)
  printf '%-12s  %s\n' "_dnsauth.${SUB}" "$TOKEN"
done
```

Output looks like:

```text
_dnsauth.api          a1b2c3d4-…-…
_dnsauth.booking      e5f6g7h8-…-…
_dnsauth.provider     i9j0k1l2-…-…
_dnsauth.superadmin   m3n4o5p6-…-…
_dnsauth.files        q7r8s9t0-…-…
```

#### 13.5.3 Add the TXT records at your DNS provider

In the `world-camps.org` zone, add exactly these five records. The **Name** column is the record name relative to the zone apex; copy each **Value** from the table you printed in § 13.5.2.

| Name | Type | TTL | Value |
|---|---|---|---|
| `_dnsauth.api` | TXT | 3600 | *validation token for `api-wc`* |
| `_dnsauth.booking` | TXT | 3600 | *validation token for `booking-wc`* |
| `_dnsauth.provider` | TXT | 3600 | *validation token for `provider-wc`* |
| `_dnsauth.superadmin` | TXT | 3600 | *validation token for `superadmin-wc`* |
| `_dnsauth.files` | TXT | 3600 | *validation token for `files-wc`* |

> Provider-specific notes:
>
> - **Cloudflare**: leave the record "DNS only" (gray cloud) — proxying would break the TXT lookup. The full record name you type is `_dnsauth.api` (Cloudflare auto-appends `.world-camps.org`).
> - **AWS Route 53**: enter the name as `_dnsauth.api.world-camps.org`. Quote the value in double quotes (Route 53 stores TXT values quoted).
> - **GoDaddy / Namecheap**: enter just `_dnsauth.api` in the Host/Name field; the zone apex is implicit.
> - **Azure DNS**: `az network dns record-set txt add-record -g <dns-rg> -z world-camps.org -n _dnsauth.api -v "<token>"` (repeat for the other four).

#### 13.5.4 Wait for validation, then confirm

DNS propagation typically completes within a few minutes; Front Door polls every few minutes and flips `domainValidationState` from `Pending` to `Approved` once it sees the TXT. Verify:

```bash
for SUB in api booking provider superadmin files; do
  az afd custom-domain show \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --custom-domain-name "${SUB}-wc" \
    --query "{host:hostName, state:domainValidationState}" -o tsv
done
```

You're done with § 13.5 once all five rows read `Approved`. If a row stays `Pending` beyond ~30 minutes, double-check the TXT value matches exactly (no extra whitespace, no quotes added by the DNS UI) and run `dig +short TXT _dnsauth.<host>.world-camps.org` from your laptop to confirm it's actually resolving.

> The traffic-routing CNAMEs (`api`, `booking`, …) for these same hosts are added in § 17 once the FD endpoint hostname is known. TXT records here only validate cert ownership.

### 13.6 Routes

```bash
# Per app: route SUB.world-camps.org → that app's own single-origin group.
# triples are "custom-domain:route-name:origin-group"
for triple in "api-wc:rt-api:og-api" "booking-wc:rt-booking:og-booking" "provider-wc:rt-provider:og-provider" "superadmin-wc:rt-admin:og-admin"; do
  CDOM="${triple%%:*}"
  REST="${triple#*:}"
  RNAME="${REST%%:*}"
  OG="${REST#*:}"
  az afd route create \
    --resource-group rg-wc-prod-ch-north \
    --profile-name wc-prod-frontdoor \
    --endpoint-name wc-prod \
    --route-name "$RNAME" \
    --origin-group "$OG" \
    --custom-domains "$CDOM" \
    --supported-protocols Https \
    --link-to-default-domain Disabled \
    --https-redirect Enabled \
    --forwarding-protocol HttpsOnly \
    --patterns-to-match "/*"
done

# Files route
az afd route create \
  --resource-group rg-wc-prod-ch-north \
  --profile-name wc-prod-frontdoor \
  --endpoint-name wc-prod \
  --route-name rt-files \
  --origin-group og-files \
  --custom-domains files-wc \
  --supported-protocols Https \
  --link-to-default-domain Disabled \
  --https-redirect Enabled \
  --forwarding-protocol HttpsOnly \
  --patterns-to-match "/*"
```

### 13.7 Attach WAF policy to all five domains

`az afd security-policy create --domains <id1> <id2> …` has a CLI bug that stuffs the customDomain IDs into the request URI rather than the body — past 3 of them, ARM rejects the call with `TooManyExtensionProviders ("ARM supports up to 3 extension providers")`. With 5 domains here, the CLI form is unusable; submit the PUT directly via `az rest` instead.

```bash
SUB_ID=65a4056e-681d-44cb-9d47-3eb3a9c77d94
WAF_ID=$(az network front-door waf-policy show -g rg-wc-prod-ch-north -n wcprodwaf --query id -o tsv)

# Fetch the 5 customDomain IDs as a JSON array shaped like [{"id":"…"}, …]
DOMAINS_JSON=$(az afd custom-domain list \
  -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor \
  --query "[].{id:id}" -o json)

# Build the security-policy body
cat > /tmp/sp-wc-prod.json <<EOF
{
  "properties": {
    "parameters": {
      "type": "WebApplicationFirewall",
      "wafPolicy": { "id": "$WAF_ID" },
      "associations": [
        {
          "domains": $DOMAINS_JSON,
          "patternsToMatch": ["/*"]
        }
      ]
    }
  }
}
EOF

az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUB_ID/resourceGroups/rg-wc-prod-ch-north/providers/Microsoft.Cdn/profiles/wc-prod-frontdoor/securityPolicies/sp-wc-prod?api-version=2024-02-01" \
  --body @/tmp/sp-wc-prod.json

rm /tmp/sp-wc-prod.json

# Verify: state=Succeeded, domainCount=5
az afd security-policy show \
  -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor \
  --security-policy-name sp-wc-prod \
  --query "{state:provisioningState, domainCount:length(parameters.associations[0].domains)}" -o table
```

### 13.8 Lock Container Apps to Front Door only

Now that FD is up, restrict Container Apps ingress to the AzureFrontDoor service tag and require the FD-id header.

> **Why no IP-based lock here.** Container Apps' `ipSecurityRestrictions.ipAddressRange` only accepts literal IPv4 CIDRs — *not* service-tag strings. The runbook originally tried `ipAddressRange: AzureFrontDoor.Backend`; the control plane rejects it with `IpRestrictionsAddressEnteredInvalid`. The only way to truly IP-lock CAs to FD is to either (a) pin the actual `AzureFrontDoor.Backend` CIDRs and refresh them on the ~1-2 week Microsoft cadence, or (b) move to FD Premium + Private Link into a workload-profile CAE (significant rework, ~+$300/mo). For beta, enforce FD-only with the **`X-Azure-FDID` header check** in the API — that's the documented pattern for Standard FD + Container Apps.
>
> **Enforcement (in code).** The NestJS API validates `X-Azure-FDID` in [`FrontDoorMiddleware`](apps/wc-nest-api/src/common/middleware/front-door.middleware.ts), registered globally in `main.ts`. It's a no-op when `AZURE_FDID` is unset (dev/staging) and exempts `/health` for Container Apps probes. Once the env var is set on the four CAs (block below), direct hits on the `*.azurecontainerapps.io` FQDNs will 403.

```bash
FDID=$(az afd profile show -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor --query frontDoorId -o tsv)

# Inject the FD-id as an env var on every CA so the (forthcoming) NestJS guard can
# compare `req.headers['x-azure-fdid']` against `process.env.AZURE_FDID` and 403 mismatches.
for APP in ca-api-wc-prod ca-admin-wc-prod ca-booking-wc-prod ca-provider-wc-prod; do
  az containerapp update -g rg-wc-prod-ch-north -n $APP --set-env-vars "AZURE_FDID=$FDID"
done
```

**NestJS guard sketch** (to be added to `wc-nest-api` before launch):

```ts
// apps/wc-nest-api/src/common/middleware/front-door.middleware.ts
@Injectable()
export class FrontDoorMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const expected = process.env.AZURE_FDID;
    if (!expected) return next(); // dev / staging may not set it
    if (req.headers['x-azure-fdid'] !== expected) {
      throw new ForbiddenException('Invalid Front Door identifier');
    }
    next();
  }
}
```

Wire it via `AppModule.configure(consumer)` against `forRoutes('*')`, excluding `/health` so liveness probes (which hit the CA directly inside the VNet, not via FD) still pass.

---

## 14. Diagnostic settings — all resources to LAW

Not every resource provider supports the `categoryGroup: allLogs` shorthand — Container Apps and the Container Apps Environment in particular reject it (`CategoryGroup: 'allLogs' is not supported`). The block below uses three helper variants:

- `create_diag` — the common case, ships `allLogs` + `AllMetrics`. Works for Postgres, Redis, KV, Storage, ACR, Front Door.
- `create_diag_metrics_only` — for Container Apps. They emit no logs at the per-app level (logs flow from the CAE); only `AllMetrics` is available.
- `create_diag_cae` — for the Container Apps Environment. Explicit log categories: Console, System, and HTTP (HTTP logs aren't enabled by § 10's `--logs-workspace-id`, so adding them here is worth doing).

```bash
LAW_ID=$(az monitor log-analytics workspace show -g rg-wc-prod-ch-north -n log-wc-prod --query id -o tsv)

# Default: allLogs categoryGroup + AllMetrics. Works for most resource types.
create_diag () {
  local RID="$1"; local NAME="to-law"
  az monitor diagnostic-settings create \
    --name "$NAME" --resource "$RID" --workspace "$LAW_ID" \
    --logs '[{"categoryGroup":"allLogs","enabled":true}]' \
    --metrics '[{"category":"AllMetrics","enabled":true}]' || true
}

# Container Apps expose no log categories; ship only AllMetrics.
create_diag_metrics_only () {
  local RID="$1"; local NAME="to-law"
  az monitor diagnostic-settings create \
    --name "$NAME" --resource "$RID" --workspace "$LAW_ID" \
    --metrics '[{"category":"AllMetrics","enabled":true}]' || true
}

# CAE: enumerate log categories explicitly (categoryGroup unsupported here too).
create_diag_cae () {
  local RID="$1"; local NAME="to-law"
  az monitor diagnostic-settings create \
    --name "$NAME" --resource "$RID" --workspace "$LAW_ID" \
    --logs '[
      {"category":"ContainerAppConsoleLogs","enabled":true},
      {"category":"ContainerAppSystemLogs","enabled":true},
      {"category":"ContainerAppHTTPLogs","enabled":true}
    ]' \
    --metrics '[{"category":"AllMetrics","enabled":true}]' || true
}

# Container Apps × 4 — metrics only
for APP in ca-api-wc-prod ca-admin-wc-prod ca-booking-wc-prod ca-provider-wc-prod; do
  create_diag_metrics_only "$(az containerapp show -g rg-wc-prod-ch-north -n $APP --query id -o tsv)"
done

# CAE — explicit log categories
create_diag_cae "$(az containerapp env show -g rg-wc-prod-ch-north -n cae-wc-prod --query id -o tsv)"

# Postgres
create_diag "$(az postgres flexible-server show -g rg-wc-prod-ch-north -n pg-wc-prod --query id -o tsv)"

# Redis Enterprise splits its telemetry across two scopes:
#   - Cluster: only AllMetrics (no log categories, no categoryGroup support)
#   - databases/default sub-resource: only ConnectionEvents (no AllMetrics)
REDIS_ID=$(az redisenterprise show -g rg-wc-prod-ch-north --cluster-name redis-wc-prod --query id -o tsv)
create_diag_metrics_only "$REDIS_ID"
az monitor diagnostic-settings create \
  --name "to-law" --resource "$REDIS_ID/databases/default" --workspace "$LAW_ID" \
  --logs '[{"category":"ConnectionEvents","enabled":true}]' || true

# Storage splits similarly to Redis:
#   - Account parent: only metrics (Capacity, Transaction); no logs, no categoryGroup
#   - blobServices/default sub-resource: StorageRead / Write / Delete logs + metrics
SA_ID=$(az storage account show -g rg-wc-prod-ch-north -n sawcprod --query id -o tsv)
create_diag_metrics_only "$SA_ID"
az monitor diagnostic-settings create \
  --name "to-law" --resource "$SA_ID/blobServices/default" --workspace "$LAW_ID" \
  --logs '[
    {"category":"StorageRead","enabled":true},
    {"category":"StorageWrite","enabled":true},
    {"category":"StorageDelete","enabled":true}
  ]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]' || true

# Key Vault
create_diag "$(az keyvault show -n kv-wc-prod --query id -o tsv)"

# ACR (shared)
create_diag "$(az acr show -n acrwc -g rg-wc-infra-shared-ch-north --query id -o tsv)"

# Front Door profile
create_diag "$(az afd profile show -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor --query id -o tsv)"
```

> If any of the calls using the default `create_diag` helper come back with `CategoryGroup: 'allLogs' is not supported`, that resource provider doesn't expose the shorthand. Drop to enumerating its categories explicitly:
>
> ```bash
> az monitor diagnostic-settings categories list --resource "$RID" \
>   --query "value[?categoryType=='Logs'].name" -o tsv
> ```
>
> …then build a `--logs` array from the returned names, the same way `create_diag_cae` does above.

---

## 15. Action group + alerts

### 15.1 Action group (email + Slack webhook)

```bash
az monitor action-group create \
  -g rg-wc-prod-ch-north \
  -n ag-wc-prod-oncall \
  --short-name wconcall \
  --action email primary "<oncall@example.com>" \
  --action webhook slack-prod "<https://hooks.slack.com/services/…>" useCommonAlertSchema true
AG_ID=$(az monitor action-group show -g rg-wc-prod-ch-north -n ag-wc-prod-oncall --query id -o tsv)
```

### 15.2 Baseline metric alerts

```bash
# 1. API HTTP 5xx — fires when 5xx response count exceeds 5 in a 5-minute window.
#    Dimension name is `statusCodeCategory` (lowercase first letter — verified via
#    `az monitor metrics list-definitions`). Values are `1xx`/`2xx`/.../`5xx`.
API_ID=$(az containerapp show -g rg-wc-prod-ch-north -n ca-api-wc-prod --query id -o tsv)
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-api-5xx \
  --scopes "$API_ID" \
  --condition "total Requests > 5 where statusCodeCategory includes 5xx" \
  --window-size 5m --evaluation-frequency 1m \
  --action "$AG_ID" \
  --description "API returned more than 5 5xx responses in a 5-minute window"

# 2. API replicas == 0
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-api-replicas-zero \
  --scopes "$API_ID" \
  --condition "avg Replicas < 1" \
  --window-size 5m --evaluation-frequency 1m \
  --action "$AG_ID"

# 3. Postgres CPU > 80%
PG_ID=$(az postgres flexible-server show -g rg-wc-prod-ch-north -n pg-wc-prod --query id -o tsv)
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-pg-cpu \
  --scopes "$PG_ID" \
  --condition "avg cpu_percent > 80" \
  --window-size 10m --evaluation-frequency 5m \
  --action "$AG_ID"

# 4. Postgres storage > 80%
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-pg-storage \
  --scopes "$PG_ID" \
  --condition "avg storage_percent > 80" \
  --window-size 15m --evaluation-frequency 5m \
  --action "$AG_ID"

# 5. Postgres failed connections > 5 / 5m
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-pg-conn-failed \
  --scopes "$PG_ID" \
  --condition "total connections_failed > 5" \
  --window-size 5m --evaluation-frequency 1m \
  --action "$AG_ID"

# 6. Redis used memory > 75%
REDIS_ID=$(az redisenterprise show -g rg-wc-prod-ch-north --cluster-name redis-wc-prod --query id -o tsv)
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-redis-mem \
  --scopes "$REDIS_ID" \
  --condition "avg usedmemorypercentage > 75" \
  --window-size 10m --evaluation-frequency 5m \
  --action "$AG_ID"

# 7. Front Door 5xx — filtered on HttpStatusCodeClass dimension of RequestCount.
#    Standard FD exposes 4 profile-scope metrics: RequestCount, ResponseSize, TotalLatency,
#    ByteHitRatio. Status-code filtering is via the `HttpStatusCodeClass` dimension.
FD_ID=$(az afd profile show -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor --query id -o tsv)
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-fd-5xx \
  --scopes "$FD_ID" \
  --condition "total RequestCount > 50 where HttpStatusCodeClass includes 5xx" \
  --window-size 5m --evaluation-frequency 1m \
  --action "$AG_ID" \
  --description "Front Door served more than 50 5xx responses in a 5-minute window"

# 8. Origin-health-percentage metric only exists on FD Premium. For Standard, watch elevated
#    latency as a proxy: if backend slowness spikes, something upstream is sick.
az monitor metrics alert create -g rg-wc-prod-ch-north -n alert-fd-latency \
  --scopes "$FD_ID" \
  --condition "avg TotalLatency > 2000" \
  --window-size 5m --evaluation-frequency 1m \
  --action "$AG_ID" \
  --description "Front Door average end-to-end latency > 2s over 5min"
# (For true origin-health alerting, enable diagnostic logs to LAW in § 14 and write
#  a log-search alert against AzureDiagnostics | where Category == 'FrontDoorHealthProbeLog'.)
```

### 15.3 Activity log alerts (governance)

```bash
# Resource deletions in prod RG
az monitor activity-log alert create \
  -g rg-wc-prod-ch-north \
  -n alert-prod-delete \
  --scope "/subscriptions/65a4056e-681d-44cb-9d47-3eb3a9c77d94/resourceGroups/rg-wc-prod-ch-north" \
  --condition category=Administrative operationName=Microsoft.Resources/subscriptions/resourceGroups/delete \
  --action-group "$AG_ID"

# New role assignments in prod scope
az monitor activity-log alert create \
  -g rg-wc-prod-ch-north \
  -n alert-prod-rbac-grant \
  --scope "/subscriptions/65a4056e-681d-44cb-9d47-3eb3a9c77d94/resourceGroups/rg-wc-prod-ch-north" \
  --condition category=Administrative operationName=Microsoft.Authorization/roleAssignments/write \
  --action-group "$AG_ID"
```

---

## 16. Defender for Cloud

Enable Defender plans that cover this footprint. Bills per-resource — keep the list tight.

```bash
az security pricing create -n ContainerRegistry      --tier Standard
az security pricing create -n KeyVaults              --tier Standard
az security pricing create -n StorageAccounts        --tier Standard --subplan DefenderForStorageV2
# OpenSourceRelationalDatabases — deliberately OFF for beta (~$15/mo savings).
# Postgres is private (VNet-only, no public access) so the immediate threat surface
# is small. Re-enable at Day-2 once real traffic ramps:
#   az security pricing create -n OpenSourceRelationalDatabases --tier Standard
az security pricing create -n Containers             --tier Standard   # covers Container Apps too
```

Optional but recommended: turn on Defender CSPM (foundational tier is free):

```bash
az security pricing create -n CloudPosture --tier Standard
```

---

## 17. DNS records

On your DNS provider for `world-camps.org`, add:

| Record | Type | Value |
|---|---|---|
| `api` | CNAME | `<wc-prod endpoint hostname from az afd endpoint show -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor --endpoint-name wc-prod --query hostName -o tsv>` (typically ends in `.z01.azurefd.net` or `.z02.azurefd.net`) |
| `booking` | CNAME | same FD endpoint hostname |
| `provider` | CNAME | same FD endpoint hostname |
| `superadmin` | CNAME | same FD endpoint hostname |
| `files` | CNAME | same FD endpoint hostname |
| `_dnsauth.api` | TXT | (validation token from `az afd custom-domain show … --query validationProperties.validationToken`) |
| `_dnsauth.booking` | TXT | (per-domain token) |
| `_dnsauth.provider` | TXT | (per-domain token) |
| `_dnsauth.superadmin` | TXT | (per-domain token) |
| `_dnsauth.files` | TXT | (per-domain token) |

After DNS propagates, finalise validation:

```bash
for SUB in api booking provider superadmin files; do
  az afd custom-domain show -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor --custom-domain-name "${SUB}-wc" --query "{state:domainValidationState, host:hostName}" -o table
done
```

**Why CNAME, not the CAE FQDN?** All public traffic goes through Front Door; the CAE FQDNs are only used as origins behind FD. Direct hits on `*.azurecontainerapps.io` are blocked by § 13.8.

> **Cloudflare (or any "proxying" DNS provider): leave the proxy OFF.** Every record above — both CNAMEs *and* TXTs — must be **DNS-only** (gray cloud in Cloudflare's UI). Proxying these would:
>
> 1. **Break FD's managed cert auto-renewal.** FD revalidates ownership every ~45 days against `_dnsauth.<host>` + an HTTP probe of the apex. Behind a CF proxy the renewer sees Cloudflare's edge IPs / cert and silently fails — TLS would expire ~45 days after launch.
> 2. **Break the FD-id check** ([§ 13.8](#138-lock-container-apps-to-front-door-only) + [`FrontDoorMiddleware`](apps/wc-nest-api/src/common/middleware/front-door.middleware.ts)). CF can drop or rewrite headers between its edge and origin, and FD's WAF / rate-limit would see only Cloudflare's small egress IP set, making any rogue caller through CF rate-limit *all* CF traffic.
> 3. **Add a second CDN with no benefit.** FD already terminates TLS, runs the WAF + rate limit, and caches. Proxying through CF first just duplicates these layers, adds a hop of latency, and gives you two places to debug instead of one.
>
> Cloudflare officially recommends DNS-only for any CNAME that targets another CDN (`*.azurefd.net`) for the same reasons.

---

## 18. Secrets bootstrap

By the time you reach this section, Key Vault should contain `postgres-password` (§ 7) and `redis-url` (§ 8). Add the rest of the runtime secrets referenced by § 11.1 below.

```bash
KV=kv-wc-prod

# JWT signing keys (random)
az keyvault secret set --vault-name $KV -n jwt-secret              --value "$(openssl rand -base64 64)"
az keyvault secret set --vault-name $KV -n jwt-refresh-secret      --value "$(openssl rand -base64 64)"

# SMTP (replace with real values)
az keyvault secret set --vault-name $KV -n email-pass              --value "<smtp-password>"

# Stripe (replace with real values — these are live keys, paste from your Stripe dashboard)
az keyvault secret set --vault-name $KV -n stripe-secret-key            --value "<sk_live_…>"
az keyvault secret set --vault-name $KV -n stripe-webhook-secret        --value "<whsec_…>"
az keyvault secret set --vault-name $KV -n stripe-connect-webhook-secret --value "<whsec_…>"

# Google Places API key — see § 18.1 below for which APIs to enable + how to restrict
az keyvault secret set --vault-name $KV -n google-places-api-key   --value "<AIza…>"
```

### 18.1 Google Maps / Places API keys

The codebase needs **two separate Google API keys** because the backend and frontend hit different products and need different GCP restrictions:

| Key | Where it lives | Used by | Restriction |
|---|---|---|---|
| **Backend key** | Key Vault secret `google-places-api-key` → env `GOOGLE_PLACES_API_KEY` on `ca-api-wc-prod` | [`google-business.service.ts`](apps/wc-nest-api/src/modules/provider/onboarding/services/google-business.service.ts) — server-side Place Text Search / Details / Photo for provider onboarding | **API key restriction → IP addresses.** Allow only the Container App's outbound IPs (see § 18.1.1 below). |
| **Frontend key** | GitHub Variable `GOOGLE_MAPS_API_KEY` → baked into `wc-booking` + `wc-provider` runtime config, served to browsers | `wc-booking` map widget; `wc-provider` onboarding autocomplete | **API key restriction → HTTP referrers.** Allow only `https://booking.world-camps.org/*`, `https://provider.world-camps.org/*`, and your dev origins. |

Two keys, not one — the frontend key gets shipped to browsers and must be referrer-restricted; the backend key must NOT be referrer-restricted (server has no Referer header) and instead should be IP-restricted to the CA's egress IPs.

#### Backend key — APIs to enable

In Google Cloud Console → **APIs & Services → Library**, enable the following on the project that owns this key. The backend only hits the legacy Places REST endpoints (`/maps/api/place/textsearch`, `/maps/api/place/details`, `/maps/api/place/photo`):

- **Places API** (legacy — *not* "Places API (New)"; the codebase uses the older REST endpoints)

That's it for the backend. **Do not** enable Maps JavaScript API on this key — server code doesn't load JS libraries, and leaving extra APIs enabled increases the blast radius if the key ever leaks.

Then under **APIs & Services → Credentials → Edit `google-places-api-key`**:

1. **API restrictions** → "Restrict key" → check **Places API** only.
2. **Application restrictions** → "IP addresses" → see § 18.1.1 for the CA egress IPs.

#### Frontend key — APIs to enable

Create a **second key** in the same GCP project (Credentials → Create credentials → API key). Enable:

- **Maps JavaScript API** — `wc-booking` map canvas + advanced markers; `wc-provider` onboarding map load.
- **Places API** (legacy) — required for the `&libraries=places` JS library that powers the autocomplete widget in `wc-provider` onboarding.

Then under **Credentials → Edit (the new key)**:

1. **API restrictions** → "Restrict key" → check **Maps JavaScript API** and **Places API**.
2. **Application restrictions** → "HTTP referrers (web sites)" → add:
   - `https://booking.world-camps.org/*`
   - `https://provider.world-camps.org/*`
   - `http://localhost:*/*` (dev convenience — drop if you only want prod usage)

Paste the key's value into GitHub → Settings → Secrets and variables → Actions → **Variables** → `GOOGLE_MAPS_API_KEY` (it's a Variable, not a Secret — it's not actually secret once it's referrer-restricted and shipped to browsers).

#### 18.1.1 Fetching the Container App's outbound IPs for the backend key restriction

```bash
# These are the Container Apps Environment-wide outbound IPs. All four CAs share them.
az containerapp env show -g rg-wc-prod-ch-north -n cae-wc-prod \
  --query properties.staticIp -o tsv
# (Single IP today; can change if the env is redeployed. If you migrate to workload-profile env later
#  with multiple outbound IPs, list them with `--query properties.outboundIpAddresses`.)
```

Paste the IP(s) returned into the backend key's "IP addresses" restriction in GCP. If the egress IP ever rotates (rare on Consumption-only envs but possible), API calls will start 403'ing — re-run the command and update the restriction.

> **Day-2:** If/when you migrate the code from legacy Places (`/maps/api/place/*`) to **Places API (New)** (`https://places.googleapis.com/v1/...`), swap the GCP API restriction from "Places API" to "Places API (New)". The two are billed and metered separately. Migration ETA per Google: legacy will be deprecated but not removed for a while — no action needed for beta launch.

---

The full env-var list each Container App receives is set in § 11. To wire a *new* secret in later, run:

```bash
az containerapp secret set -g rg-wc-prod-ch-north -n ca-api-wc-prod \
  --secrets "new-secret=keyvaultref:https://kv-wc-prod.vault.azure.net/secrets/new-secret,identityref:$CA_KV_MI_ID"
az containerapp update -g rg-wc-prod-ch-north -n ca-api-wc-prod \
  --set-env-vars "NEW_SECRET=secretref:new-secret"
```

---

## 19. GitHub Actions: deployment promotion model

### Promotion model — build once, deploy many

Tag → staging is automatic. Same tag → prod is manual (`workflow_dispatch`) with a required reviewer. **Production never rebuilds from source — it deploys the same images (by digest) that staging built.**

```
git tag wc-v1.2.3 && git push origin wc-v1.2.3
  ↓
.github/workflows/wc-staging-deploy.yml
  • builds wc-nest-api / wc-booking / wc-provider / wc-superadmin once (no env vars baked in)
  • pushes to acrwc.azurecr.io/<repo>:1.2.3
  • runs prod-bound migrations via caj-migrate-wc-stg
  • deploys to staging Container Apps with STAGING_*_ENV vars
  • smoke-tests + writes deployment summary

After staging QA passes:
  gh workflow run wc-prod-deploy.yml -f tag=wc-v1.2.3
  ↓
.github/workflows/wc-prod-deploy.yml  (gated by GitHub Environment `production`)
  • verifies all four :1.2.3 images exist in ACR, resolves digests
  • runs prod migrations via caj-migrate-wc-prod
  • deploys to prod by digest with PROD_*_ENV + WC_PROD_API_SECRETS
  • smoke-tests + writes deployment summary (incl. rollback command)
```

Frontends are runtime-configured: no `NEXT_PUBLIC_*` is baked into the image. Each app reads its env via the root layout's inline `<script>window.__APP_CONFIG__=…</script>` and the `/config.json` route handler. Changing prod env on the Container App and restarting takes effect without any rebuild.

### 19.1 Create the federated identity (OIDC)

Replaces the long-lived service principal pattern from staging with **OIDC federation**.

```bash
# App registration for prod deploys
APP_ID=$(az ad app create --display-name "github-actions-wc-prod" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# Scope: only the prod RG + the shared RG (for ACR pull)
SUB_ID=65a4056e-681d-44cb-9d47-3eb3a9c77d94
az role assignment create --assignee "$APP_ID" --role "Contributor" --scope "/subscriptions/$SUB_ID/resourceGroups/rg-wc-prod-ch-north"
az role assignment create --assignee "$APP_ID" --role "AcrPull"     --scope "/subscriptions/$SUB_ID/resourceGroups/rg-wc-infra-shared-ch-north/providers/Microsoft.ContainerRegistry/registries/acrwc"

# Federated credential bound to the `production` GitHub environment
cat > /tmp/fic.json <<'EOF'
{
  "name": "gh-prod-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<ORG>/<REPO>:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters /tmp/fic.json
```

### 19.2 GitHub repo settings

In the GitHub repo → **Settings → Environments → New environment** named `production`:

- **Required reviewers:** 1+ maintainer.
- **Deployment branches:** restrict to tags matching `wc-v*`.

Then **Settings → Secrets and variables → Actions** add:

**Repository secrets** (Settings → Secrets):

| Secret | Purpose |
|---|---|
| `AZURE_CREDENTIALS_PROD` | Service-principal JSON for prod (or omit if using OIDC; see § 19.1) |
| `WC_PROD_API_SECRETS` | Multiline KEY=VALUE for prod API. See [`.github/workflows/WC_PROD_API_SECRETS.example`](.github/workflows/WC_PROD_API_SECRETS.example) |

**Repository variables** (Settings → Variables) — frontend values are **public**, so they go in Variables, not Secrets:

| Variable | Purpose |
|---|---|
| `WC_PROD_API_ENV` | Multiline KEY=VALUE for prod API. See [`.github/workflows/WC_PROD_API_ENV.example`](.github/workflows/WC_PROD_API_ENV.example) |
| `PROD_BOOKING_ENV` | Runtime env for booking. See [`.github/workflows/PROD_BOOKING_ENV.example`](.github/workflows/PROD_BOOKING_ENV.example) |
| `PROD_PROVIDER_ENV` | Runtime env for provider. See [`.github/workflows/PROD_PROVIDER_ENV.example`](.github/workflows/PROD_PROVIDER_ENV.example) |
| `PROD_SUPERADMIN_ENV` | Runtime env for superadmin. See [`.github/workflows/PROD_SUPERADMIN_ENV.example`](.github/workflows/PROD_SUPERADMIN_ENV.example) |
| `SLACK_DEPLOY_WEBHOOK_URL` | Optional Slack webhook for deployment notifications |

**Note**: The Stripe publishable key (`pk_live_…`) and Google Maps browser key go in Variables — they ship to the browser and aren't secret. Protect the Google Maps key via HTTP-referrer restrictions in GCP, not via secrecy.

### 19.3 Workflow files

Two files:

- [`.github/workflows/wc-staging-deploy.yml`](.github/workflows/wc-staging-deploy.yml) — fires on `wc-v*.*.*` tag push. Builds + pushes images, runs migrations, deploys to staging, smoke-tests, writes summary.
- [`.github/workflows/wc-prod-deploy.yml`](.github/workflows/wc-prod-deploy.yml) — `workflow_dispatch` with a `tag` input. Verifies images exist (by digest), runs prod migrations, deploys to prod by digest, smoke-tests, writes summary, optional Slack notify. Every mutating job is on `environment: production`, so the required-reviewer gate fires before anything touches prod.

## 19.4 Database migration strategy

- Migrations live in `apps/wc-nest-api/prisma/migrations/`, committed with the code that depends on them, reviewed in PR.
- Production runs `npx prisma migrate deploy` only. **Never** `prisma migrate dev` or `db push` in prod.
- The workflow runs migrations as a separate job (Container Apps Job `caj-migrate-wc-prod`, created in § 11.6) **before** the API rolls. If migration fails, no new API image is deployed.
- All normal migrations must be backward-compatible: the previous API image must still work against the new schema. This is what makes image rollback safe.

**Migration classification** (every PR with a migration should label which):

1. **Safe additive** — `ADD COLUMN` nullable, `CREATE INDEX CONCURRENTLY`, `CREATE TABLE`. Normal flow.
2. **Backward-compatible data migration** — backfill default values, copy data to new column. Normal flow.
3. **Risky/destructive** — `DROP COLUMN`, `RENAME`, `SET NOT NULL` on existing data, `DROP TABLE`. Must be split across releases using **expand → migrate → contract**.

### 19.5 Rollback

```bash
# Re-dispatch the prod workflow with a previous known-good tag.
# Required-reviewer gate still fires — rollback is not bypass.
gh workflow run wc-prod-deploy.yml -f tag=wc-vX.Y.Z
```

- Rollback redeploys the previous application images by digest. The DB schema is **not** automatically rolled back — backward-compatible migrations are what make this safe.
- The previous prod tag is recorded in every deployment summary (`$GITHUB_STEP_SUMMARY` on the workflow run) so on-call can find it fast.
- Approvers for rollback = same group as approvers for deploy. An emergency-override path (skipping the reviewer gate) is intentionally not provided in the first pass; add only with explicit org sign-off.

---

## 20. Smoke test + rollback

```bash
# Health check matrix (run from outside Azure)
for HOST in api booking provider superadmin; do
  echo "${HOST}: $(curl -s -o /dev/null -w '%{http_code}' https://${HOST}.world-camps.org/health || echo 'fail')"
done
echo "files: $(curl -s -o /dev/null -w '%{http_code}' https://files.world-camps.org/wc-prod-public-assets/healthcheck.txt)"

# WAF should block a known-bad pattern
curl -s -o /dev/null -w '%{http_code}\n' "https://api.world-camps.org/?q=<script>alert(1)</script>"  # expect 403
```

### Rollback (revisions are versioned in `--revisions-mode multiple`)

```bash
# List revisions
az containerapp revision list -g rg-wc-prod-ch-north -n ca-api-wc-prod -o table

# Set 100% traffic to a previous revision
az containerapp ingress traffic set \
  -g rg-wc-prod-ch-north -n ca-api-wc-prod \
  --revision-weight <previous-revision-name>=100
```

---

## 21. Ops jump VM (pgAdmin / psql / redis-cli access)

The data tier (Postgres, Redis) is private — its FQDNs only resolve from inside `vnet-wc-prod`. This section provisions a small Linux VM in `snet-jump` that acts as an SSH tunnel target so local tools (pgAdmin4, psql, redis-cli) can reach the private endpoints.

Steady-state cost: **~$1.50–3 / month** when deallocated (OS disk only). Running cost: ~$8 / month for a `Standard_B1s`. Auto-shutdown ensures you don't accidentally leave it on.

### 21.1 NSG for `snet-jump`

```bash
# Public IP(s) allowed to SSH in
MY_IP="$(curl -s https://api.ipify.org)/32"

az network nsg create \
  -g rg-wc-prod-ch-north \
  -n nsg-snet-jump \
  --location switzerlandnorth \
  --tags env=prod app=wc managed-by=manual

az network nsg rule create \
  -g rg-wc-prod-ch-north --nsg-name nsg-snet-jump \
  -n allow-ssh-from-ops \
  --priority 100 \
  --source-address-prefixes "$MY_IP" \
  --destination-port-ranges 22 \
  --protocol Tcp --access Allow

az network vnet subnet update \
  -g rg-wc-prod-ch-north --vnet-name vnet-wc-prod \
  -n snet-jump \
  --network-security-group nsg-snet-jump
```

### 21.2 Jump VM

```bash
# Generate a dedicated SSH keypair (skip if you already have one you want to use)
ssh-keygen -t ed25519 -f ~/.ssh/wc-prod-jump -C "wc-prod-jump" -N ""

az vm create \
  -g rg-wc-prod-ch-north \
  -n vm-wc-prod-jump \
  --location switzerlandnorth \
  --image Ubuntu2204 \
  --size Standard_B1s \
  --vnet-name vnet-wc-prod --subnet snet-jump \
  --public-ip-sku Standard --public-ip-address pip-wc-prod-jump \
  --admin-username azureuser \
  --ssh-key-values ~/.ssh/wc-prod-jump.pub \
  --os-disk-size-gb 30 \
  --storage-sku StandardSSD_LRS \
  --nsg "" \
  --tags env=prod app=wc-jump managed-by=manual

# Install psql + redis-cli for on-VM debugging
az vm run-command invoke \
  -g rg-wc-prod-ch-north -n vm-wc-prod-jump \
  --command-id RunShellScript \
  --scripts "apt-get update && apt-get install -y postgresql-client redis-tools"
```

> `--nsg ""` skips creating a per-NIC NSG; the subnet NSG from § 21.1 governs all traffic. Subnet-level NSGs are easier to audit than per-VM ones.

### 21.3 Auto-shutdown (don't pay overnight)

```bash
az vm auto-shutdown \
  -g rg-wc-prod-ch-north -n vm-wc-prod-jump \
  --time 2000   # 20:00 UTC; adjust to your timezone
```

### 21.4 Daily usage

```bash
JUMP_IP=$(az vm show -d -g rg-wc-prod-ch-north -n vm-wc-prod-jump --query publicIps -o tsv)

# 1. Start the VM (it auto-shuts-down at 20:00 UTC)
az vm start -g rg-wc-prod-ch-north -n vm-wc-prod-jump

# 2. SSH tunnel — use a non-default local port so a local Postgres Docker container on 5432 doesn't clash
ssh -i ~/.ssh/wc-prod-jump \
    -L 15432:pg-wc-prod.postgres.database.azure.com:5432 \
    -L 16379:redis-wc-prod.privatelink.redis.azure.net:10000 \
    azureuser@$JUMP_IP

# 3. pgAdmin4 connection:
#    Host:     localhost
#    Port:     15432
#    SSL mode: require
#    User:     wcadmin
#    Password: az keyvault secret show --vault-name kv-wc-prod -n postgres-password --query value -o tsv

# 4. When done, deallocate to stop paying for compute
az vm deallocate -g rg-wc-prod-ch-north -n vm-wc-prod-jump
```

### 21.5 Refreshing the allowed IP

When your home/office public IP changes:

```bash
MY_IP="$(curl -s https://api.ipify.org)/32"
az network nsg rule update \
  -g rg-wc-prod-ch-north --nsg-name nsg-snet-jump \
  -n allow-ssh-from-ops \
  --source-address-prefixes "$MY_IP"
```

### 21.6 Adding a second operator

Append another public key to the VM's `~/.ssh/authorized_keys`:

```bash
NEW_KEY="ssh-ed25519 AAAA… teammate@laptop"
az vm run-command invoke \
  -g rg-wc-prod-ch-north -n vm-wc-prod-jump \
  --command-id RunShellScript \
  --scripts "echo '$NEW_KEY' >> /home/azureuser/.ssh/authorized_keys && chown azureuser:azureuser /home/azureuser/.ssh/authorized_keys"
```

Add their public IP to the NSG rule (`--source-address-prefixes "ip1,ip2"`).

---

## 22. Day-2 — when (and how) to scale up

| Trigger | Indicator | Action |
|---|---|---|
| Postgres CPU > 70% sustained | metric `cpu_percent` > 70 over 1h | `az postgres flexible-server update -g rg-wc-prod-ch-north -n pg-wc-prod --sku-name Standard_B2s` (then `Standard_B4ms`, or jump to General Purpose `Standard_D2ds_v5` if you also need the connection-pool headroom) |
| Need geo-redundant backups | regulatory / contractual, or moving off Burstable | `az postgres flexible-server update -g rg-wc-prod-ch-north -n pg-wc-prod --geo-redundant-backup Enabled` (cleanest to pair with a Burstable → GP SKU bump; geo-backup on Burstable is historically flaky) |
| Postgres connections saturated | `connections_failed > 0` *and* `connection_count` near 50 | bump `max_connections` parameter, then consider `Standard_D2ds_v5` (raises baseline) |
| Postgres storage > 80% | `storage_percent > 80` (`alert-pg-storage` fires) | Auto-grow is OFF at beta, so resize manually before the disk fills: `az postgres flexible-server update -g rg-wc-prod-ch-north -n pg-wc-prod --storage-size 64` (or larger). Storage can only grow, not shrink. Re-enable auto-grow at the same time if you want hands-off: append `--storage-auto-grow Enabled`. |
| API p95 latency > 500ms | App Insights `requests/duration` percentile | bump `--max-replicas` on `ca-api-wc-prod` |
| Redis memory > 75% | metric `usedmemorypercentage` (AMR exposes this on the cluster scope) | Scale the AMR SKU up: `az redisenterprise update -g rg-wc-prod-ch-north --cluster-name redis-wc-prod --sku Balanced_B1` (then `Balanced_B3`/`Balanced_B5`). Tier change is online; takes ~10–20 min. |
| Need DB HA | regulatory / contractual | `az postgres flexible-server update -g rg-wc-prod-ch-north -n pg-wc-prod --high-availability ZoneRedundant --standby-zone 2` (≈ doubles cost) |
| Storage zone-redundancy | regulatory / contractual; or storage scaling past beta | `az storage account update -g rg-wc-prod-ch-north -n sawcprod --sku Standard_ZRS` (account stays in place; replication catches up over hours) |
| Multi-region / DR | RPO < geo-backup window | enable ACR Premium + geo-replication; deploy a second CAE in another region behind the same Front Door |

---

## 23. Resource group lock (final step)

Apply this **only after** the full § 1–§ 20 provisioning is complete and the smoke tests in § 20 have passed. Locking earlier breaks subnet delegation for any newly-created VNet-integrated resources (Postgres flex, Container Apps env, private endpoints) — see the note at § 3.

```bash
# Lock the prod RG against accidental deletion
az lock create \
  --name no-delete-rg-wc-prod \
  --lock-type CanNotDelete \
  --resource-group rg-wc-prod-ch-north \
  --notes "Prevent accidental deletion of prod RG. Remove only with team approval."

# Lock the shared RG if not already locked (no VNet-integration concern here — ACR + FD only)
az lock create \
  --name no-delete-rg-wc-infra-shared \
  --lock-type CanNotDelete \
  --resource-group rg-wc-infra-shared-ch-north
```

If you ever need to add a VNet-integrated resource later (a new Container App, a new private endpoint, a Postgres replica), temporarily remove the lock:

```bash
az lock delete --name no-delete-rg-wc-prod --resource-group rg-wc-prod-ch-north
# ...run your provisioning command...
az lock create --name no-delete-rg-wc-prod --lock-type CanNotDelete \
  --resource-group rg-wc-prod-ch-north \
  --notes "Prevent accidental deletion of prod RG. Remove only with team approval."
```

---

## Appendix A — when to move to Bicep/Terraform

This runbook is fine for one environment; the pain point appears the second time you go through it (e.g. setting up a separate sandbox env or reviving prod after an incident). Migrate to IaC when **any** of these become true:

- More than two engineers run `az` commands against prod.
- You need a sandbox / preview env that should match prod minus a few dials.
- Drift between the doc and reality has bitten you once.

A starting layout:

```
infra/
├── modules/
│   ├── network.bicep          # VNet + subnets
│   ├── postgres.bicep         # flex server + private DNS
│   ├── redis.bicep            # cache + private endpoint
│   ├── storage.bicep          # account + containers
│   ├── containerapp-env.bicep # CAE
│   ├── containerapp.bicep     # one CA (parametrised)
│   ├── frontdoor.bicep        # profile + WAF + routes
│   └── observability.bicep    # LAW + AppInsights + diag settings
└── wc-prod/
    ├── main.bicep             # composes the above for prod
    └── parameters.json
```

Bootstrap by running `aztfexport resource-group rg-wc-prod-ch-north` (Terraform) or `az bicep decompile` against an exported ARM template — gets you ~80% of the way; the modules are mostly cleanup.

---

## Appendix B — Disaster recovery runbook

### B.1 Postgres restore

**Geo-backup is OFF at beta** (§ 7), so cross-region `geo-restore` is not available. Recovery options:

**1. In-region point-in-time restore (the only path right now)** — works as long as the Switzerland North region itself is healthy. Backups retain 7 days per `--backup-retention`:

```bash
RESTORE_TS="2026-04-26T12:00:00Z"
az postgres flexible-server restore \
  --resource-group rg-wc-prod-ch-north \
  --name pg-wc-prod-restored \
  --source-server pg-wc-prod \
  --restore-time "$RESTORE_TS"
```

Then update `POSTGRES_HOST` env var on every Container App in § 11 to the restored server's FQDN, and restart them to pick up the new endpoint.

**2. Cross-region `geo-restore`** — requires `--geo-redundant-backup Enabled` to have been set *before* the data loss event. Enable it via the Day-2 row in § 22 once you've scaled past Burstable. Until then, a full Switzerland-North outage means data loss for the duration of the outage.

### B.2 ACR pull recovery

If `acrwc` is unavailable, the four Container Apps cannot pull new images but **already-running revisions keep running** (Container Apps caches images on the env). To deploy in a degraded state, push to a backup ACR (`acrwc-dr` if you stand one up) and update each CA's registry config.

### B.3 Managed cert renewal

Front Door managed certs auto-renew. If a renewal fails, the custom-domain resource shows `domainValidationState=Failed`. Rebind:

```bash
az afd custom-domain delete \
  -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor \
  --custom-domain-name <SUB>-wc --yes
# Then re-run the custom-domain + route block from § 13.5 / § 13.6 for the affected hostname.
# DNS validation token will be regenerated — add the new _dnsauth TXT to DNS before binding.
```

### B.4 Restoring deleted Key Vault secrets

```bash
az keyvault secret recover --vault-name kv-wc-prod -n <secret-name>          # within 90-day soft delete
```

---

## Verification checklist

Run through this after § 1–§ 16 are complete and DNS has propagated:

- [ ] `az resource list -g rg-wc-prod-ch-north -o table` shows: VNet, LAW, AppInsights, KV, Postgres flex, Redis + PE, Storage, CAE, 4 Container Apps, FD profile + 5 custom domains.
- [ ] `az postgres flexible-server show -n pg-wc-prod -g rg-wc-prod-ch-north --query network` shows `publicNetworkAccess=Disabled` and a `delegatedSubnetResourceId`.
- [ ] From the jump VM (§ 21): `nslookup pg-wc-prod.postgres.database.azure.com` returns an IP in `10.1.2.x` (private, inside `snet-pg`). If it returns a public IP, the private DNS zone link isn't working.
- [ ] `az redisenterprise show --cluster-name redis-wc-prod -g rg-wc-prod-ch-north --query "{public:publicNetworkAccess, peCount:length(privateEndpointConnections)}"` shows `public=Disabled, peCount>=1`.
- [ ] `az acr show -n acrwc --query adminUserEnabled` returns `false`. (Toggle off on the shared registry once all four prod apps are running on MI.)
- [ ] `az afd security-policy list -g rg-wc-prod-ch-north --profile-name wc-prod-frontdoor` returns a non-empty list.
- [ ] `for r in <…ids>; do az monitor diagnostic-settings list --resource $r --query "value[].name" -o tsv; done` returns `to-law` for every resource.
- [ ] Browse `https://api.world-camps.org/health` → 200, **without** `X-Azure-FDID` reaching origin returns 403.
- [ ] Browse the storage default endpoint directly (`https://sawcprod.blob.core.windows.net/wc-prod-files/<obj>`) → 401/403; via `https://files.world-camps.org/...` → 200.
- [ ] `az monitor metrics alert list -g rg-wc-prod-ch-north -o table` shows the 8 alerts, all in `Healthy` state.

If every box is ticked, the prod environment is launch-ready for beta.
