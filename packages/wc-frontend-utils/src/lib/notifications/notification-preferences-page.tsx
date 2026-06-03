import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

interface Section {
  category: string
  label: string
  description: string
  templates: Map<string, PreferenceRow[]>
}

function groupBySection(rows: PreferenceRow[]): Section[] {
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
    description: CATEGORY_DESCRIPTIONS[cat] ?? '',
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

      {/* ── Sections ── */}
      {!isLoading &&
        sections.map(section => (
          <section key={section.category} className="mb-6 border border-gray-100 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">{section.label}</h2>
              {section.description && (
                <p className="text-xs text-zinc-500 mt-1">{section.description}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-12 pb-2 mb-2 border-b border-gray-100 pr-2">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-16 text-center">
                Email
              </span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-16 text-center">
                In-app
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {Array.from(section.templates.entries()).map(([templateKey, channels]) => {
                const first = channels[0]
                if (!first) return null
                const emailRow = channels.find(c => c.channel === 'email')
                const inAppRow = channels.find(c => c.channel === 'in_app')
                return (
                  <div key={templateKey} className="flex items-start gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{first.label}</p>
                      <p className="text-xs text-zinc-500 mt-1">{first.description}</p>
                    </div>
                    <div className="flex items-center gap-12 pr-2">
                      <ToggleCell row={emailRow} channel="email" onToggle={onToggle} />
                      <ToggleCell row={inAppRow} channel="in_app" onToggle={onToggle} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
    </div>
  )
}

function ToggleCell({
  row,
  channel,
  onToggle,
}: {
  row: PreferenceRow | undefined
  channel: PreferenceChannel
  onToggle: (templateKey: string, channel: PreferenceChannel, enabled: boolean) => void
}) {
  if (!row) {
    return (
      <span className="w-16 text-center text-xs text-zinc-300" aria-hidden="true">
        —
      </span>
    )
  }
  const locked = row.transactional
  const checked = row.enabled
  // Phase 14d a11y — every switch gets a unique aria-label keyed by the
  // human label + channel + state, plus an explicit aria-disabled when
  // locked. The lock icon is paired with the green colour so colour-blind
  // users see the lock signal even without distinguishing the colour.
  const channelLabel = channel === 'in_app' ? 'in-app' : 'email'
  const ariaLabel = locked
    ? `${row.label} — ${channelLabel} notifications are required and cannot be disabled`
    : `${row.label} — ${channelLabel} notifications ${checked ? 'enabled' : 'disabled'} (toggle)`
  return (
    <div className="w-16 flex justify-center">
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
        onClick={() => !locked && onToggle(row.templateKey, channel, !checked)}
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
