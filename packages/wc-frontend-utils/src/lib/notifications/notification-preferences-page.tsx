import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Info, X } from 'lucide-react'
import { NotificationCategory } from '@world-schools/wc-types'

// Phase 12 — shared notification preferences UI used by wc-booking,
// wc-provider, and wc-superadmin. Sections grouped by category;
// transactional rows render locked with an info tooltip.
//
// The hook+component are kept here in wc-frontend-utils so all three apps
// share the same layout + interaction; per-app pages only handle the API
// wiring and surrounding chrome.

// ---------------------------------------------------------------------------
// Types — wire-compatible with the backend
// `apps/wc-nest-api/src/modules/notifications/preferences/...` payloads.
// ---------------------------------------------------------------------------

export type PreferenceChannel = 'in_app' | 'email'

export interface PreferenceRow {
  templateKey: string
  channel: PreferenceChannel
  enabled: boolean
  transactional: boolean
  category: NotificationCategory | string
  label: string
  description: string
}

export interface BulkPreferenceItem {
  templateKey: string
  channel: PreferenceChannel
  enabled: boolean
}

// ---------------------------------------------------------------------------
// Shared hook — fetch + optimistic toggle
// ---------------------------------------------------------------------------

export interface UseNotificationPreferencesOptions {
  fetchPreferences: () => Promise<PreferenceRow[]>
  bulkUpdate: (items: BulkPreferenceItem[]) => Promise<void>
}

export interface UseNotificationPreferencesResult {
  rows: PreferenceRow[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  /** Per-row optimistic toggle — debounced batch save to the API. */
  onToggle: (templateKey: string, channel: PreferenceChannel, enabled: boolean) => void
}

const SAVE_DEBOUNCE_MS = 400

export function useNotificationPreferences({
  fetchPreferences,
  bulkUpdate,
}: UseNotificationPreferencesOptions): UseNotificationPreferencesResult {
  const [rows, setRows] = useState<PreferenceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<BulkPreferenceItem[]>([])

  useEffect(() => {
    setIsLoading(true)
    fetchPreferences()
      .then(setRows)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false))
    // intentionally one-shot on mount — fetchPreferences identity is the
    // service factory, stable for the lifetime of the page.
  }, [])

  // Debounced batch save: every toggle pushes into `pending`; a timer
  // flushes ~400ms after the last change. Lets the user toggle multiple
  // rows quickly without flooding the API.
  useEffect(() => {
    if (pending.length === 0) return
    const timer = setTimeout(async () => {
      const batch = pending
      setPending([])
      setIsSaving(true)
      try {
        await bulkUpdate(batch)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        // Revert optimistic state on save failure — pull truth from the
        // server again rather than guess the previous values.
        try {
          const fresh = await fetchPreferences()
          setRows(fresh)
        } catch {
          // Swallow refetch error — already surfaced the original.
        }
      } finally {
        setIsSaving(false)
      }
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pending, bulkUpdate, fetchPreferences])

  const onToggle = useCallback(
    (templateKey: string, channel: PreferenceChannel, enabled: boolean) => {
      // Optimistic local update first.
      setRows(prev =>
        prev.map(r =>
          r.templateKey === templateKey && r.channel === channel ? { ...r, enabled } : r
        )
      )
      // Queue for the debounced batch save.
      setPending(prev => {
        const next = prev.filter(p => !(p.templateKey === templateKey && p.channel === channel))
        next.push({ templateKey, channel, enabled })
        return next
      })
    },
    []
  )

  return { rows, isLoading, isSaving, error, onToggle }
}

// ---------------------------------------------------------------------------
// Section grouping helpers
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: NotificationCategory[] = [
  NotificationCategory.Booking,
  NotificationCategory.Payment,
  NotificationCategory.Payout,
  NotificationCategory.Refund,
  NotificationCategory.Dispute,
  NotificationCategory.Message,
  NotificationCategory.Support,
  NotificationCategory.Review,
  NotificationCategory.Wishlist,
  NotificationCategory.Onboarding,
  NotificationCategory.Profile,
  NotificationCategory.System,
  NotificationCategory.Marketing,
]

const CATEGORY_LABELS: Record<string, string> = {
  [NotificationCategory.Booking]: 'Bookings',
  [NotificationCategory.Payment]: 'Payments',
  [NotificationCategory.Payout]: 'Payouts',
  [NotificationCategory.Refund]: 'Refunds',
  [NotificationCategory.Dispute]: 'Disputes',
  [NotificationCategory.Message]: 'Messages',
  [NotificationCategory.Support]: 'Support',
  [NotificationCategory.Review]: 'Reviews',
  [NotificationCategory.Wishlist]: 'Wishlists',
  [NotificationCategory.Onboarding]: 'Onboarding',
  [NotificationCategory.Profile]: 'Profile',
  [NotificationCategory.System]: 'System & Security',
  [NotificationCategory.Marketing]: 'Offers',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  [NotificationCategory.Booking]: 'Updates about your camp bookings',
  [NotificationCategory.Payment]: 'Payment receipts, reminders, and confirmations',
  [NotificationCategory.Payout]: 'Payouts from World Camps to your bank',
  [NotificationCategory.Refund]: 'Refund status and reimbursement updates',
  [NotificationCategory.Dispute]: 'Chargeback and dispute lifecycle updates',
  [NotificationCategory.Message]: 'New messages from camps and the platform',
  [NotificationCategory.Support]: 'Support ticket replies and status changes',
  [NotificationCategory.Review]: 'Reviews from families and your responses',
  [NotificationCategory.Wishlist]: 'Wishlist activity and follow-ups',
  [NotificationCategory.Onboarding]: 'Onboarding milestones and reminders',
  [NotificationCategory.Profile]: 'Profile completeness and seasonal reminders',
  [NotificationCategory.System]: 'Account, security, and platform updates',
  [NotificationCategory.Marketing]: 'Promotional emails and special offers',
}

type Audience = 'parent' | 'provider' | 'superadmin'

/**
 * Audience-specific category descriptions. The same category means different
 * things to a parent vs. a provider vs. a superadmin (e.g. "Bookings" for a
 * superadmin is platform alerts, not their own bookings), so the generic
 * `CATEGORY_DESCRIPTIONS` above is only a fallback. The audience is derived
 * from the row `templateKey` prefix — the page is always single-audience.
 */
const CATEGORY_DESCRIPTIONS_BY_AUDIENCE: Record<Audience, Partial<Record<string, string>>> = {
  parent: {
    [NotificationCategory.Booking]: 'Your booking requests, confirmations, and pre-camp reminders.',
    [NotificationCategory.Payment]: 'Deposits, balance reminders, receipts, and payment issues.',
    [NotificationCategory.Refund]: 'Refunds issued to your payment method.',
    [NotificationCategory.Dispute]: 'Payment disputes (chargebacks) on your bookings.',
    [NotificationCategory.Message]: 'Messages camps send you.',
    [NotificationCategory.Support]: 'Replies and status changes on your support tickets.',
    [NotificationCategory.Review]: 'Review invitations and camp responses to your reviews.',
    [NotificationCategory.Wishlist]:
      'Price drops, availability, and reminders for camps you saved.',
    [NotificationCategory.Profile]: 'Reminders to complete your profile.',
    [NotificationCategory.Marketing]: 'Suggested camps and occasional offers.',
  },
  provider: {
    [NotificationCategory.Booking]:
      'New requests, your responses, cancellations, and pre/post-camp reminders.',
    [NotificationCategory.Payment]: "When a family's balance is collected.",
    [NotificationCategory.Payout]: 'Your payouts — schedules, releases, reminders, and failures.',
    [NotificationCategory.Refund]: 'Refunds to families and reimbursements you owe.',
    [NotificationCategory.Dispute]: 'Chargebacks on your bookings and their outcomes.',
    [NotificationCategory.Message]: 'Messages from families and unanswered-message nudges.',
    [NotificationCategory.Support]: 'Replies and status changes on your support tickets.',
    [NotificationCategory.Review]: 'New reviews and reminders to respond.',
    [NotificationCategory.Onboarding]: 'Application status and Stripe setup.',
    [NotificationCategory.Profile]: 'Profile publishing and completeness reminders.',
    [NotificationCategory.System]: 'Season and program-freshness reminders.',
  },
  superadmin: {
    [NotificationCategory.Booking]:
      'Platform alerts when a booking is cancelled for non-payment or a camp is unresponsive.',
    [NotificationCategory.Payout]:
      'Payout failures, clawback recovery, and funds pending transfer.',
    [NotificationCategory.Dispute]: 'Chargebacks filed and dispute resolutions.',
    [NotificationCategory.Support]: 'New support tickets and replies.',
    [NotificationCategory.Review]: 'Reviews flagged for moderation.',
    [NotificationCategory.Onboarding]: 'New applications, verification docs, and first listings.',
    [NotificationCategory.Profile]: 'Camps needing attention or deactivated.',
    [NotificationCategory.System]: 'Camp Stripe disconnects and deletion requests.',
  },
}

/** The page is single-audience; infer it from the first row's templateKey prefix. */
export function audienceFromRows(rows: PreferenceRow[]): Audience | null {
  const prefix = rows[0]?.templateKey.split('.')[0]
  return prefix === 'parent' || prefix === 'provider' || prefix === 'superadmin' ? prefix : null
}

/** Audience-specific category description, falling back to the generic copy. */
export function categoryDescription(category: string, audience: Audience | null): string {
  const specific = audience ? CATEGORY_DESCRIPTIONS_BY_AUDIENCE[audience][category] : undefined
  return specific ?? CATEGORY_DESCRIPTIONS[category] ?? ''
}

interface Section {
  category: string
  label: string
  description: string
  templates: Map<string, PreferenceRow[]>
}

// ---------------------------------------------------------------------------
// Category-level toggle derivation
//
// The page shows ONE toggle per category per channel (not one per event).
// A category+channel is "locked" (always-on, can't be disabled) only when
// EVERY notification in it is transactional — otherwise the toggle governs
// the non-transactional members and cascades to all of them. This keeps a
// mixed category like Booking (lifecycle confirmations = transactional, but
// abandoned-checkout + pre-camp nudges = optional) user-controllable for the
// optional pieces while the required confirmations always send.
// ---------------------------------------------------------------------------

/** Derive a category+channel toggle's lock + checked state from its rows. */
export function deriveCategoryToggleState(rows: PreferenceRow[]): {
  locked: boolean
  checked: boolean
} {
  if (rows.length === 0) return { locked: false, checked: false }
  const toggleable = rows.filter(r => !r.transactional)
  if (toggleable.length === 0) return { locked: true, checked: true }
  // "On" while the user still receives at least one of the optional members.
  return { locked: false, checked: toggleable.some(r => r.enabled) }
}

/** Cascade a category+channel toggle to every non-transactional member. */
export function categoryCascadeItems(
  rows: PreferenceRow[],
  enabled: boolean
): BulkPreferenceItem[] {
  return rows
    .filter(r => !r.transactional)
    .map(r => ({ templateKey: r.templateKey, channel: r.channel, enabled }))
}

function groupBySection(rows: PreferenceRow[]): Section[] {
  const audience = audienceFromRows(rows)
  const map = new Map<string, Map<string, PreferenceRow[]>>()
  for (const row of rows) {
    const cat = String(row.category)
    let byTemplate = map.get(cat)
    if (!byTemplate) {
      byTemplate = new Map()
      map.set(cat, byTemplate)
    }
    const list = byTemplate.get(row.templateKey) ?? []
    list.push(row)
    byTemplate.set(row.templateKey, list)
  }
  // Sort categories by canonical order, then any unknown categories at the end.
  const seenCategories = Array.from(map.keys())
  seenCategories.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a as NotificationCategory)
    const bi = CATEGORY_ORDER.indexOf(b as NotificationCategory)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
  return seenCategories.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    description: categoryDescription(cat, audience),
    templates: map.get(cat)!,
  }))
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface NotificationPreferencesPageProps {
  rows: PreferenceRow[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onToggle: (templateKey: string, channel: PreferenceChannel, enabled: boolean) => void
}

export function NotificationPreferencesPage({
  rows,
  isLoading,
  isSaving,
  error,
  onToggle,
}: NotificationPreferencesPageProps) {
  const sections = useMemo(() => groupBySection(rows), [rows])
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const activeSection = openCategory
    ? (sections.find(s => s.category === openCategory) ?? null)
    : null

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isLoading
              ? ' '
              : 'Choose which notifications you receive and how. Required updates always send.'}
          </p>
        </div>
        {isSaving && <span className="text-xs text-zinc-500 mt-2">Saving…</span>}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-100 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-6" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && rows.length === 0 && !error && (
        <p className="text-sm text-zinc-500 py-10 text-center">No preferences available.</p>
      )}

      {/* ── Sections ── one cascading toggle per category per channel ── */}
      {!isLoading &&
        sections.map(section => {
          const allRows = Array.from(section.templates.values()).flat()
          const emailRows = allRows.filter(r => r.channel === 'email')
          const inAppRows = allRows.filter(r => r.channel === 'in_app')
          return (
            <section key={section.category} className="mb-6 border border-gray-100 rounded-xl p-5">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-semibold text-gray-900">{section.label}</h2>
                    <button
                      type="button"
                      onClick={() => setOpenCategory(section.category)}
                      aria-label={`What's included in ${section.label}`}
                      title={`What's included in ${section.label}`}
                      className="cursor-pointer text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <Info size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {section.description && (
                    <p className="text-xs text-zinc-500 mt-1">{section.description}</p>
                  )}
                </div>
                <div className="flex items-start gap-8 pr-1">
                  <CategoryToggleCell
                    rows={emailRows}
                    channel="email"
                    columnLabel="Email"
                    categoryLabel={section.label}
                    onToggle={onToggle}
                  />
                  <CategoryToggleCell
                    rows={inAppRows}
                    channel="in_app"
                    columnLabel="In-app"
                    categoryLabel={section.label}
                    onToggle={onToggle}
                  />
                </div>
              </div>
            </section>
          )
        })}

      {activeSection && (
        <CategoryInfoModal section={activeSection} onClose={() => setOpenCategory(null)} />
      )}
    </div>
  )
}

/**
 * Plain-Tailwind modal (no UI-library dependency, so it stays shareable across
 * all three apps) listing exactly which notifications a category contains —
 * each with its curated name + description, a Required/Optional badge, and the
 * channels it can use. Closes on Escape or overlay click; focus is moved to the
 * close button on open and restored on close.
 */
function CategoryInfoModal({ section, onClose }: { section: Section; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = `notif-cat-${section.category}`

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  const items = Array.from(section.templates.entries()).map(([templateKey, channels]) => {
    const first = channels[0]
    return {
      templateKey,
      label: first?.label ?? templateKey,
      description: first?.description ?? '',
      required: !!first?.transactional,
      channels: channels.map(c => c.channel),
    }
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 id={titleId} className="text-base font-semibold text-gray-900">
              {section.label}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Notifications included in this category</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-gray-100 hover:text-zinc-700"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className="divide-y divide-gray-100 overflow-y-auto px-5">
          {items.map(item => (
            <li key={item.templateKey} className="py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    item.required ? 'bg-zinc-100 text-zinc-600' : 'bg-emerald-50 text-emerald-700',
                  ].join(' ')}
                >
                  {item.required ? 'Required' : 'Optional'}
                </span>
              </div>
              {item.description && <p className="mt-1 text-xs text-zinc-500">{item.description}</p>}
              <div className="mt-1.5 flex gap-1.5">
                {item.channels.includes('email') && <ChannelChip label="Email" />}
                {item.channels.includes('in_app') && <ChannelChip label="In-app" />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ChannelChip({ label }: { label: string }) {
  return (
    <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
      {label}
    </span>
  )
}

/**
 * One category-level switch for a single channel. Drives + cascades all of the
 * category's non-transactional members; renders locked when every member is
 * transactional (always-on). The small column label sits above the switch so a
 * single category row reads clearly without a shared header.
 */
function CategoryToggleCell({
  rows,
  channel,
  columnLabel,
  categoryLabel,
  onToggle,
}: {
  rows: PreferenceRow[]
  channel: PreferenceChannel
  columnLabel: string
  categoryLabel: string
  onToggle: (templateKey: string, channel: PreferenceChannel, enabled: boolean) => void
}) {
  const { locked, checked } = deriveCategoryToggleState(rows)

  const labelEl = (
    <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
      {columnLabel}
    </span>
  )

  // No notifications use this channel in the category → placeholder.
  if (rows.length === 0) {
    return (
      <div className="w-16 flex flex-col items-center gap-2">
        {labelEl}
        <span className="text-xs text-zinc-300" aria-hidden="true">
          —
        </span>
      </div>
    )
  }

  const channelLabel = channel === 'in_app' ? 'in-app' : 'email'
  const ariaLabel = locked
    ? `${categoryLabel} — ${channelLabel} notifications are required and cannot be disabled`
    : `${categoryLabel} — ${channelLabel} notifications ${checked ? 'enabled' : 'disabled'} (toggle)`

  const handleClick = () => {
    if (locked) return
    for (const item of categoryCascadeItems(rows, !checked)) {
      onToggle(item.templateKey, item.channel, item.enabled)
    }
  }

  return (
    <div className="w-16 flex flex-col items-center gap-2">
      {labelEl}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={locked || undefined}
        aria-label={ariaLabel}
        disabled={locked}
        title={
          locked
            ? "Required — you'll always receive these updates"
            : checked
              ? 'On — click to disable'
              : 'Off — click to enable'
        }
        onClick={handleClick}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          locked
            ? 'bg-emerald-100 cursor-not-allowed'
            : checked
              ? 'bg-emerald-600 cursor-pointer'
              : 'bg-gray-200 cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
        {locked && (
          // Non-colour signal for the locked state so colour-blind users
          // (and screen-reader hover) can distinguish locked vs. enabled.
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-zinc-700 text-[8px] leading-none text-white"
            title="Required"
          >
            🔒
          </span>
        )}
      </button>
    </div>
  )
}
