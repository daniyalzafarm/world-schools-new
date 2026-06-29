#!/usr/bin/env tsx
/**
 * Notification QA matrix generator.
 *
 * Reads the catalog, renders each entry's in-app + email strings against
 * its template's `PreviewProps`, and writes `docs/notifications-qa.md` —
 * a Markdown checklist QA uses to walk every trigger end-to-end.
 *
 * Run as:
 *   npx tsx apps/wc-nest-api/scripts/notification-qa-matrix.ts
 *
 * Output: `docs/notifications-qa.md` (overwritten each run). Designed as a
 * snapshot — re-run after any catalog / template change to refresh the
 * checklist.
 *
 * Template prop resolution: each React Email template under
 * `packages/wc-email-templates/emails/**` exports a named `PreviewProps`
 * constant alongside its default export. We dynamic-import every template
 * file, map `default → PreviewProps` via reference equality, then look up
 * each catalog entry's `email.component` in that map.
 *
 * In-app-only entries (no email component) fall back to a minimal stub
 * — most catalog-level `inApp.title/body/redirectUrl` builders accept the
 * email props shape anyway because the loader returns one props object
 * per entry.
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { ComponentType } from 'react'
import { listCatalogEntries } from '../src/modules/notifications/catalog/notification-catalog'
import type { CatalogEntry } from '../src/modules/notifications/catalog/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../../..')
const TEMPLATES_ROOT = path.resolve(REPO_ROOT, 'packages/wc-email-templates/emails')
const OUTPUT_PATH = path.resolve(REPO_ROOT, 'docs/notifications-qa.md')

async function findTemplates(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue // skip _shared
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await findTemplates(full)))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Map each catalog entry's email component back to the `PreviewProps`
 * exported from its source file. Reference equality holds because each
 * template module is loaded once.
 */
async function buildComponentToPreviewMap(): Promise<Map<ComponentType<unknown>, unknown>> {
  const map = new Map<ComponentType<unknown>, unknown>()
  const templatePaths = await findTemplates(TEMPLATES_ROOT)
  for (const tplPath of templatePaths) {
    const mod = (await import(pathToFileURL(tplPath).href)) as {
      default?: ComponentType<unknown>
      PreviewProps?: unknown
    }
    if (mod.default && mod.PreviewProps !== undefined) {
      map.set(mod.default, mod.PreviewProps)
    }
  }
  return map
}

function safeCall<T>(fn: (() => T) | undefined, fallback: T): T {
  if (!fn) return fallback
  try {
    return fn()
  } catch (err) {
    return `⚠️ ${err instanceof Error ? err.message : String(err)}` as T
  }
}

/** Sort entries by audience → category → templateKey for predictable diff. */
function sortEntries(entries: CatalogEntry<unknown>[]): CatalogEntry<unknown>[] {
  const audienceOrder = { parent: 0, provider: 1, superadmin: 2 } as const
  return [...entries].sort((a, b) => {
    const ao = audienceOrder[a.audience] - audienceOrder[b.audience]
    if (ao !== 0) return ao
    const co = a.category.localeCompare(b.category)
    if (co !== 0) return co
    return a.templateKey.localeCompare(b.templateKey)
  })
}

function renderEntry(
  entry: CatalogEntry<unknown>,
  previewByComponent: Map<ComponentType<unknown>, unknown>
): string {
  const lines: string[] = []
  const previewProps =
    entry.email?.component != null
      ? (previewByComponent.get(entry.email.component as ComponentType<unknown>) ?? {})
      : {}

  // Fall back to an empty object for in_app-only entries — most string
  // builders use null-safe property access (`props?.field`) so this works.
  const props = previewProps as never

  lines.push(`#### \`${entry.templateKey}\``)
  lines.push('')
  lines.push(`- **Audience**: ${entry.audience}`)
  lines.push(`- **Category**: ${entry.category}`)
  lines.push(`- **Channels**: ${entry.channels.join(', ')}`)
  lines.push(`- **Trigger**: ${entry.trigger}`)
  lines.push(`- **Resolver**: \`${entry.resolver}\``)
  lines.push(
    `- **Transactional**: ${entry.transactional ? 'yes (bypasses user preferences)' : 'no'}`
  )
  lines.push(`- **Salutation**: ${entry.salutation}`)

  if (entry.inApp) {
    lines.push('')
    lines.push('**In-app preview:**')
    lines.push('')
    lines.push(`- Title: ${safeCall(() => entry.inApp!.title(props), '—')}`)
    lines.push(`- Body: ${safeCall(() => entry.inApp!.body(props), '—')}`)
    lines.push(`- Redirect URL: \`${safeCall(() => entry.inApp!.redirectUrl(props), '—')}\``)
    if (entry.inApp.entityType) {
      lines.push(`- Entity type: \`${entry.inApp.entityType}\``)
    }
  }

  if (entry.email) {
    lines.push('')
    lines.push('**Email preview:**')
    lines.push('')
    lines.push(`- Subject: ${safeCall(() => entry.email!.subject(props), '—')}`)
    lines.push(`- Plain-text alt: ${entry.email.includePlainText ? 'yes' : 'no'}`)
  }

  lines.push('')
  lines.push('**Test steps:**')
  lines.push('')
  lines.push('- [ ] Trigger the source event in a test environment')
  if (entry.channels.includes('in_app')) {
    lines.push('- [ ] Confirm in-app delivery (appears in notifications page, badge increments)')
    lines.push('- [ ] Confirm in-app title + body match the preview above')
    lines.push('- [ ] Click-through navigates to the expected URL')
  }
  if (entry.channels.includes('email')) {
    lines.push('- [ ] Confirm email delivered (recipient inbox)')
    lines.push('- [ ] Confirm email subject matches the preview above')
    lines.push('- [ ] Confirm email body renders correctly across clients (Gmail, Outlook)')
  }
  lines.push('- [ ] Re-trigger the source event — confirm no duplicate notification')
  if (entry.trigger === 'scheduled') {
    lines.push(
      '- [ ] Cancel the source entity before `runAt` — confirm the scheduled job is suppressed (or the loader returns null)'
    )
  }
  lines.push('')

  return lines.join('\n')
}

interface AudienceSection {
  audience: 'parent' | 'provider' | 'superadmin'
  label: string
  entries: CatalogEntry<unknown>[]
}

function groupByAudience(entries: CatalogEntry<unknown>[]): AudienceSection[] {
  const buckets: Record<'parent' | 'provider' | 'superadmin', CatalogEntry<unknown>[]> = {
    parent: [],
    provider: [],
    superadmin: [],
  }
  for (const entry of entries) buckets[entry.audience].push(entry)
  return [
    { audience: 'parent', label: 'Parent', entries: buckets.parent },
    { audience: 'provider', label: 'Provider', entries: buckets.provider },
    { audience: 'superadmin', label: 'Superadmin', entries: buckets.superadmin },
  ]
}

/**
 * Prerequisites checklist. Emitted at the top of the QA doc so a tester
 * who just ran a real flow and saw nothing has a single place to confirm
 * the environment is wired correctly before assuming the catalog is
 * broken. Lives in the generator (not the .md) so a `nx qa-matrix
 * wc-nest-api` re-run can't accidentally drop it.
 */
function pushPrerequisites(lines: string[]): void {
  lines.push('## Prerequisites — read before testing')
  lines.push('')
  lines.push(
    'If you just ran a real flow and **no notification arrived on either app** (in-app + email both silent), the problem is almost always an environment / config gap, not a catalog regression. Walk this checklist first.'
  )
  lines.push('')

  lines.push('### 1. Services that must be running')
  lines.push('')
  lines.push(
    '- **Postgres** reachable on `DATABASE_URL` (built from `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`; defaults `localhost:5432`, db `world-schools`). Without it, prop-loaders throw and every delivery row writes `status=failed`.'
  )
  lines.push(
    "- **Redis** reachable on `REDIS_URL` (default `redis://localhost:6379`). Without it BullMQ can't enqueue → `NotificationsEnqueueService` logs ERROR, **no `NotificationDelivery` row is written**, and the in-app notification never happens. This is the single most common silent-failure mode."
  )
  lines.push(
    '- **SMTP server** reachable on `EMAIL_HOST` / `EMAIL_PORT`. Only required for the email channel — in-app still works without it. Failures land in `notification_deliveries.error_message`.'
  )
  lines.push(
    "- **`nx serve wc-nest-api`** actually running. The BullMQ worker (`NotificationLiveWorker` / `NotificationScheduledWorker`) is in-process — if the API isn't up, jobs pile up in Redis and never deliver."
  )
  lines.push('')

  lines.push('### 2. Environment variables (and the silent-failure mode for each)')
  lines.push('')
  lines.push('| Var | Default | Silent failure if unset / wrong |')
  lines.push('|---|---|---|')
  lines.push(
    '| `REDIS_URL` | `redis://localhost:6379` | Enqueue fails; no audit row; ERROR log `Failed to enqueue notification …`. |'
  )
  lines.push(
    '| `EMAIL_HOST` | `smtp.gmail.com` | SMTP connect fails; delivery row `failed`; retries 5× then dies. |'
  )
  lines.push('| `EMAIL_PORT` | `587` | TLS / port mismatch; same failure path as `EMAIL_HOST`. |')
  lines.push('| `EMAIL_USER` | _empty_ | SMTP auth rejects; delivery row `failed`. |')
  lines.push('| `EMAIL_PASS` | _empty_ | SMTP auth rejects; delivery row `failed`. |')
  lines.push(
    '| `EMAIL_FROM` | `noreply@worldschools.com` | Provider rejects from-address; delivery row `failed`. |'
  )
  lines.push(
    '| `BOOKING_PORTAL_URL` | `http://localhost:4303` | In-app + email still send, but click-through links point at the wrong host. Production deploys must set this explicitly. |'
  )
  lines.push(
    '| `PROVIDER_PORTAL_URL` | `http://localhost:4302` | Same — provider redirect URLs wrong. |'
  )
  lines.push(
    '| `SUPERADMIN_PORTAL_URL` | `http://localhost:4301` | Same — superadmin redirect URLs wrong. |'
  )
  lines.push(
    '| `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` | _unset_ | `/admin/queues` returns **503 in every environment**. Notifications themselves still work; this only blocks the ops dashboard. |'
  )
  lines.push('')

  lines.push('### 3. Per-user data preconditions')
  lines.push('')
  lines.push(
    "- The recipient `User.email` must be non-null for the email channel to fire. If null: in-app still delivers, but the email delivery row is written with `status=skipped` and `errorMessage='recipient has no email address'`."
  )
  lines.push(
    '- The Parent / Provider relationships must exist. The `parentForBooking` resolver walks `BookingGroup.parent.userId`; if any link is null the resolver returns `[]` and the dispatcher logs WARN `No recipients resolved`, then exits without enqueueing.'
  )
  lines.push(
    '- For non-transactional triggers, check `notification_preferences` — a row with `enabled=false` for the user × templateKey × channel will silently drop the channel. Booking lifecycle, payments, refunds, disputes and other transactional entries bypass this filter entirely.'
  )
  lines.push('')

  lines.push('### 4. 30-second diagnostic walk')
  lines.push('')
  lines.push('Run these in order until one of them lights up the problem.')
  lines.push('')
  lines.push(
    "1. `curl http://localhost:3000/health/notifications` → if `status: 'degraded'` or either queue reports an error, Redis is unreachable. Start there."
  )
  lines.push('2. Check the audit log:')
  lines.push('')
  lines.push('   ```sql')
  lines.push('   SELECT template_key, channel, status, error_message, enqueued_at')
  lines.push('   FROM notification_deliveries')
  lines.push("   WHERE recipient_user_id = '<userId>'")
  lines.push('   ORDER BY enqueued_at DESC')
  lines.push('   LIMIT 10;')
  lines.push('   ```')
  lines.push('')
  lines.push(
    '   - **Zero rows** → dispatcher never enqueued. Tail server logs for `[NotificationDispatcherService]` / `[NotificationsEnqueueService]` — likely Redis down or a missing wiring point.'
  )
  lines.push(
    "   - **All `skipped` with `loadProps returned null`** → source entity (BookingGroup, etc.) wasn't found or has transitioned out of the relevant state."
  )
  lines.push(
    '   - **All `skipped` with `recipient has no email address`** → populate `User.email`.'
  )
  lines.push(
    '   - **All `failed` with an SMTP error** → fix `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS`. Job will retry 5× automatically once creds are right.'
  )
  lines.push(
    "   - **`status: sent` but the UI looks empty** → the row is in `notifications` but the frontend hasn't seen it. Refresh the notifications page (WebSocket may not have reconnected). To rule out the WS path entirely:"
  )
  lines.push('')
  lines.push('     ```sql')
  lines.push('     SELECT id, title, type, created_at')
  lines.push('     FROM notifications')
  lines.push("     WHERE user_id = '<userId>'")
  lines.push('     ORDER BY created_at DESC')
  lines.push('     LIMIT 5;')
  lines.push('     ```')
  lines.push('')
  lines.push('3. Confirm the user has an email set:')
  lines.push('')
  lines.push('   ```sql')
  lines.push("   SELECT id, email, first_name FROM users WHERE id = '<userId>';")
  lines.push('   ```')
  lines.push('')

  lines.push('### 5. Ops dashboard (Bull Board)')
  lines.push('')
  lines.push(
    'Mounted at `/admin/queues`. Requires **both** `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD` to be set; otherwise the route hard-503s in every environment. With the env vars set, basic-auth in to see live + scheduled queues, retry failed jobs, and inspect job payloads.'
  )
  lines.push('')
  lines.push('---')
  lines.push('')
}

async function main(): Promise<void> {
  console.log('[qa-matrix] Loading catalog…')
  const entries = sortEntries(listCatalogEntries())
  console.log(`[qa-matrix] ${entries.length} catalog entries`)

  console.log('[qa-matrix] Indexing template PreviewProps…')
  const previewByComponent = await buildComponentToPreviewMap()
  console.log(`[qa-matrix] indexed ${previewByComponent.size} templates`)

  const sections = groupByAudience(entries)
  const now = new Date().toISOString().slice(0, 10)

  const lines: string[] = []
  lines.push('# Notifications QA Matrix')
  lines.push('')
  lines.push(`> Generated ${now} from \`apps/wc-nest-api/scripts/notification-qa-matrix.ts\`.`)
  lines.push(
    '> Re-run after any catalog or template change. Source spec: `WorldCamps_Notifications.xlsx`.'
  )
  lines.push('')
  lines.push(`Total entries: **${entries.length}**.`)
  lines.push('')
  pushPrerequisites(lines)
  for (const section of sections) {
    lines.push(
      `- [${section.label}](#${section.audience}-${section.entries.length}-entries): ${section.entries.length}`
    )
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const section of sections) {
    lines.push(
      `## ${section.label} (${section.entries.length} entries) <a id="${section.audience}-${section.entries.length}-entries"></a>`
    )
    lines.push('')
    let lastCategory = ''
    for (const entry of section.entries) {
      if (entry.category !== lastCategory) {
        lastCategory = entry.category
        lines.push(`### ${section.label} — ${lastCategory}`)
        lines.push('')
      }
      lines.push(renderEntry(entry, previewByComponent))
      lines.push('---')
      lines.push('')
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, lines.join('\n'), 'utf-8')
  console.log(`[qa-matrix] wrote ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('[qa-matrix] failed:', err)
  process.exit(1)
})
