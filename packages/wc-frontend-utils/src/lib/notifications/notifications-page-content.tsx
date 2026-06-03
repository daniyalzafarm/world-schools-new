import React from 'react'
import {
  NotificationCategory,
  categoryFor,
  type WsNotificationPayload,
} from '@world-schools/wc-types'
import type { NotificationFilter, NotificationFilterConfig } from './use-notifications-page'

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

const GROUP_ORDER: Record<string, number> = {
  Today: 0,
  Yesterday: 1,
  'Earlier This Week': 2,
  Earlier: 3,
}

function getDateGroup(createdAt: string): string {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const date = new Date(createdAt).getTime()
  const diff = todayStart - date

  if (date >= todayStart) return 'Today'
  if (diff < 86_400_000) return 'Yesterday'
  if (diff < 7 * 86_400_000) return 'Earlier This Week'
  return 'Earlier'
}

function formatRelativeTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface DateGroup {
  label: string
  order: number
  items: WsNotificationPayload[]
}

function groupByDate(items: WsNotificationPayload[]): DateGroup[] {
  const map = new Map<string, WsNotificationPayload[]>()
  for (const item of items) {
    const label = getDateGroup(item.createdAt)
    const existing = map.get(label) ?? []
    existing.push(item)
    map.set(label, existing)
  }
  return Array.from(map.entries())
    .map(([label, groupItems]) => ({ label, order: GROUP_ORDER[label] ?? 4, items: groupItems }))
    .sort((a, b) => a.order - b.order)
}

// ---------------------------------------------------------------------------
// Notification icon
// ---------------------------------------------------------------------------

// Phase 11 — one variant per visually-distinct family. Maps every
// `NotificationCategory` to its rendering colour + icon. All 123 catalog
// entries land in one of these via `categoryFor()`.
type IconVariant = 'booking' | 'message' | 'payment' | 'review' | 'onboarding' | 'security'

function getIconVariant(type: string): IconVariant {
  const category = categoryFor(type)
  switch (category) {
    case NotificationCategory.Booking:
      return 'booking'
    case NotificationCategory.Message:
    case NotificationCategory.Support:
      return 'message'
    case NotificationCategory.Payment:
    case NotificationCategory.Refund:
    case NotificationCategory.Dispute:
    case NotificationCategory.Payout:
      return 'payment'
    case NotificationCategory.Review:
      return 'review'
    case NotificationCategory.Onboarding:
    case NotificationCategory.Profile:
      return 'onboarding'
    default:
      // System, Marketing, Wishlist — generic alert badge.
      return 'security'
  }
}

const ICON_CLASSES: Record<IconVariant, string> = {
  booking: 'bg-blue-100 text-blue-700',
  message: 'bg-indigo-100 text-indigo-700',
  payment: 'bg-emerald-100 text-emerald-700',
  review: 'bg-amber-100 text-amber-700',
  onboarding: 'bg-purple-100 text-purple-700',
  security: 'bg-gray-100 text-gray-600',
}

function NotifIcon({ type }: { type: string }) {
  const variant = getIconVariant(type)
  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${ICON_CLASSES[variant]}`}
    >
      {variant === 'booking' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )}
      {variant === 'message' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
      {variant === 'payment' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="15" x2="10" y2="15" />
        </svg>
      )}
      {variant === 'review' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
      {variant === 'onboarding' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
      {variant === 'security' && (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action buttons per notification type
// ---------------------------------------------------------------------------

interface NotifAction {
  label: string
  primary: boolean
}

function getActions(notification: WsNotificationPayload): NotifAction[] {
  const redirectUrl = notification.metadata?.['redirectUrl'] as string | undefined
  if (!redirectUrl) return []

  // Action label derives from the v28 category — keeps copy consistent
  // across the ~120 catalog entries without an exhaustive switch.
  const category = categoryFor(notification.type)
  const label =
    category === NotificationCategory.Booking
      ? 'View booking'
      : category === NotificationCategory.Message
        ? 'Read message'
        : category === NotificationCategory.Support
          ? 'View ticket'
          : category === NotificationCategory.Payment ||
              category === NotificationCategory.Refund ||
              category === NotificationCategory.Dispute ||
              category === NotificationCategory.Payout
            ? 'View details'
            : 'View'
  return [{ label, primary: true }]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface NotificationsPageContentProps {
  filteredNotifications: WsNotificationPayload[]
  filter: NotificationFilter
  /**
   * Phase 11 — per-audience filter chips. Sourced from the hook so each
   * app drives its own tab set (parent / provider / superadmin all carry
   * different meaningful categories).
   */
  filters: ReadonlyArray<NotificationFilterConfig>
  isLoading: boolean
  isLoadingMore: boolean
  isMarkingAllRead: boolean
  hasMore: boolean
  unreadCount: number
  onFilterChange: (filter: NotificationFilter) => void
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onLoadMore: () => void
  onNavigate?: (url: string) => void
}

export function NotificationsPageContent({
  filteredNotifications,
  filter,
  filters,
  isLoading,
  isLoadingMore,
  isMarkingAllRead,
  hasMore,
  unreadCount,
  onFilterChange,
  onMarkAsRead,
  onMarkAllAsRead,
  onLoadMore,
  onNavigate,
}: NotificationsPageContentProps) {
  const groups = groupByDate(filteredNotifications)

  const handleCardClick = (notification: WsNotificationPayload) => {
    if (!notification.isRead) onMarkAsRead(notification.id)
    const safe = validateRedirectUrl(notification.metadata?.['redirectUrl'])
    if (safe && onNavigate) onNavigate(safe)
  }

  const handleActionClick = (e: React.MouseEvent, notification: WsNotificationPayload) => {
    e.stopPropagation()
    if (!notification.isRead) onMarkAsRead(notification.id)
    const safe = validateRedirectUrl(notification.metadata?.['redirectUrl'])
    if (safe && onNavigate) onNavigate(safe)
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isLoading ? '\u00A0' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            disabled={isMarkingAllRead}
            className="text-sm font-medium text-emerald-700 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 mt-1"
          >
            {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-8">
        {filters.map(opt => {
          const isActive = filter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={[
                'cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all',
                isActive
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-white border-gray-200 text-gray-900 hover:border-gray-900',
              ].join(' ')}
            >
              {opt.label}
              {opt.showUnreadCount && unreadCount > 0 && (
                <span
                  className={[
                    'inline-flex items-center justify-center min-w-5 h-5 rounded-full text-xs px-1.5',
                    isActive ? 'bg-white/20' : 'bg-gray-100 text-zinc-500',
                  ].join(' ')}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-100 rounded-xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filteredNotifications.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm">
            {filters.find(f => f.value === filter)?.special === 'all'
              ? 'No notifications yet'
              : `No ${(filters.find(f => f.value === filter)?.label ?? filter).toLowerCase()} notifications`}
          </p>
        </div>
      )}

      {/* ── Notification date groups ── */}
      {!isLoading &&
        groups.map(group => (
          <div key={group.label} className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {group.label}
            </p>

            <div className="space-y-2">
              {group.items.map(notification => {
                const actions = getActions(notification)
                return (
                  <div
                    key={notification.id}
                    className={[
                      'rounded-xl overflow-hidden transition-shadow hover:shadow-sm border border-l-4',
                      notification.isRead
                        ? 'bg-white border-gray-100 border-l-transparent'
                        : 'bg-emerald-50 border-emerald-50 border-l-emerald-700',
                    ].join(' ')}
                  >
                    {/* Card body */}
                    <div
                      className="flex gap-4 p-5 cursor-pointer"
                      onClick={() => handleCardClick(notification)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleCardClick(notification)}
                    >
                      <NotifIcon type={notification.type} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                            {notification.title}
                          </h3>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                        {notification.body && (
                          <p className="text-sm text-zinc-500 leading-relaxed">
                            {notification.body}
                          </p>
                        )}
                      </div>

                      {/* Unread indicator dot */}
                      {!notification.isRead && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-700 shrink-0 mt-1" />
                      )}
                    </div>

                    {/* Action buttons */}
                    {actions.length > 0 && (
                      <div className="flex gap-2 px-5 pb-4">
                        {actions.map(action => (
                          <button
                            key={action.label}
                            onClick={e => handleActionClick(e, notification)}
                            className={[
                              'px-4 py-2 rounded-lg text-xs font-semibold border transition-all',
                              action.primary
                                ? 'bg-[#45F0B5] border-[#45F0B5] text-gray-900 hover:opacity-90'
                                : 'bg-white border-gray-200 text-gray-900 hover:border-gray-900',
                            ].join(' ')}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      {/* ── Load more ── */}
      {hasMore && (
        <div className="text-center pt-6">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-8 py-3 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 hover:border-gray-900 transition-all disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Redirect URL safety check
// ---------------------------------------------------------------------------

/**
 * Guard against open-redirect via `notification.metadata.redirectUrl`.
 *
 * Catalog entries today emit relative app-internal paths
 * (e.g. `/bookings/BG-1`). Without this check, a buggy or supply-chained
 * catalog entry could ship `https://evil.com/phish` and the in-app
 * notification UI would happily push the user there.
 *
 * Rules:
 *  - Must be a non-empty string.
 *  - Must start with `/` (relative root path) but NOT `//` (which is a
 *    protocol-relative URL the browser treats as a full origin change).
 *  - Must not contain `..` segments (defence in depth — Next.js router
 *    normalises but the rule keeps the contract obvious).
 *
 * Returns the URL when safe, or `null` when not. Callers should no-op on
 * null. Exported for unit tests + so per-app pages can wrap their own
 * navigation handlers if they want belt-and-braces enforcement.
 */
export function validateRedirectUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.includes('..')) return null
  return raw
}
