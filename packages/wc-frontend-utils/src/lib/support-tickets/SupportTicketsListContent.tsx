import React from 'react'
import { Button, Chip, Spinner } from '@heroui/react'
import { AlertCircle, HelpCircle, MessageSquare, Plus } from 'lucide-react'
import type { SupportTicket } from '@world-schools/wc-types'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
} from '@world-schools/wc-types'
import {
  getStatusChipColorClass,
  getStatusIconColorClass,
  getPriorityBadgeClass,
  ticketPreviewText,
  formatRelativeTime,
} from './support-tickets-ui-utils'
import type { TabId } from './support-tickets-ui-utils'
import { OPEN_TAB_STATUSES } from './support-tickets-ui-utils'

export interface SupportTicketsListContentProps {
  tickets: SupportTicket[]
  loading: boolean
  error: string | null
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  currentUserId: string
  /** Tailwind class for active/accent elements. e.g. 'bg-slate-800' or 'bg-secondary' */
  accentColorClass: string
  /** Optional outer container className. Default: empty (full-width). */
  containerClassName?: string
  onNavigateToNew: () => void
  onNavigateToTicket: (id: string) => void
  onRetry: () => void
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending your reply' },
  { id: 'closed', label: 'Closed' },
]

export function SupportTicketsListContent({
  tickets,
  loading,
  error,
  activeTab,
  onTabChange,
  currentUserId,
  accentColorClass,
  containerClassName = '',
  onNavigateToNew,
  onNavigateToTicket,
  onRetry,
}: SupportTicketsListContentProps) {
  // Tab counts (derived from full ticket list, not filtered)
  const tabCounts = {
    all: tickets.length,
    open: tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status)).length,
    pending: tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
      .length,
    closed: tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
  }

  // Filtered list for current tab (filtering here instead of in the page keeps JSX simpler)
  const filteredTickets =
    activeTab === 'all'
      ? tickets
      : activeTab === 'open'
        ? tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status))
        : activeTab === 'pending'
          ? tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
          : tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED')

  return (
    <div className={containerClassName}>
      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
              My support tickets
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Track and manage your support requests
            </p>
          </div>
          <Button
            color="primary"
            className={`${accentColorClass} text-white shrink-0`}
            startContent={<Plus size={18} />}
            onPress={onNavigateToNew}
          >
            New support ticket
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" label="Loading tickets..." />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">
              Error loading tickets
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`cursor-pointer px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === id
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold ${
                    activeTab === id
                      ? `${accentColorClass} text-white`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tabCounts[id]}
                </span>
              </button>
            ))}
          </div>

          {/* Empty state */}
          {filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {activeTab === 'all' ? 'No tickets yet' : `No ${activeTab} tickets`}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-5">
                {activeTab === 'all'
                  ? 'Create a support ticket and we will get back to you as soon as we can.'
                  : 'There are no tickets in this category.'}
              </p>
              {activeTab === 'all' && (
                <Button
                  className={`${accentColorClass} text-white`}
                  startContent={<Plus size={18} />}
                  onPress={onNavigateToNew}
                >
                  New support ticket
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTickets.map(ticket => {
                const priorityClass = getPriorityBadgeClass(ticket.priority)
                return (
                  <div
                    key={ticket.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToTicket(ticket.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onNavigateToTicket(ticket.id)
                      }
                    }}
                    className="flex items-start gap-4 p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                    {/* Status icon */}
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${getStatusIconColorClass(ticket.status)}`}
                    >
                      <MessageSquare size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {ticket.subject}
                        </h3>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {ticket.ticketNumber}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                        {ticketPreviewText(ticket, currentUserId)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {ticket.category && <span>{ticket.category.name}</span>}
                        <span>Created {formatRelativeTime(ticket.createdAt)}</span>
                        {ticket.lastSupportReplyAt && (
                          <span>Last reply {formatRelativeTime(ticket.lastSupportReplyAt)}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: status chip + optional priority badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Chip size="sm" className={getStatusChipColorClass(ticket.status)}>
                        {SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Chip>
                      {priorityClass && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}
                        >
                          {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
