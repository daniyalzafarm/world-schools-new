/**
 * Enhanced Message Bubble Component
 *
 * Neutral-gray chat bubbles matching the 5B messaging design:
 * - Incoming #F7F7F7 / own #EBEBEB, 18px radius with a 4px tail corner
 * - Text read-status (Sending… / Sent / Seen / Failed) instead of icons
 * - Message grouping: avatar + sender name once per same-sender run, single
 *   meta line at the group end (flags computed by the page)
 * - Date dividers and an optional quoted reply preview
 */

'use client'

import React from 'react'
import { ChevronDown, Reply } from 'lucide-react'
import {
  cn,
  MessageAttachmentsList,
  type MessageMenuAnchor,
  UserAvatar,
} from '@world-schools/ui-web'
import { MessageStatus } from '../types'

export interface EnhancedMessage {
  id: string
  text: string
  isUser: boolean
  /** Real author id — used to group consecutive messages and gate edit/delete. */
  senderId?: string
  /**
   * Sender's first name — the static, always-visible part of the name shown on
   * the timestamp line. Set only where attribution is wanted (provider/staff
   * messages); leave undefined to render no name.
   */
  senderFirstName?: string
  /**
   * Sender's last name — collapsed by default and revealed with an inline slide
   * on hover over the name, so the full name appears in place (no popup tooltip).
   */
  senderLastName?: string
  timestamp?: Date
  status?: MessageStatus
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
  deliveredAt?: Date | null
  readAt?: Date | null
  attachments?:
    | {
        id: string
        fileName: string
        fileSize: number
        mimeType: string
        fileType: string
        url: string
        thumbnailUrl?: string | null
      }[]
    | null
  /** Grouping flags (computed in the page from adjacent messages). Default true. */
  isGroupStart?: boolean
  isGroupEnd?: boolean
  /** Date divider shown above this message when the calendar day changes. */
  showDateDivider?: boolean
  dateLabel?: string
  /** Quoted preview of the message this one replies to. */
  replyPreview?: { sender?: string; text: string }
  /** Set when the message was edited — shows a subtle "edited" marker on the meta row. */
  editedAt?: Date | string | null
}

interface EnhancedMessageBubbleProps {
  message: EnhancedMessage
  avatarSrc?: string
  senderName?: string
  isAdminView?: boolean
  onRetry?: (messageId: string) => void
  /** Start a reply to this message — wired to double-click (desktop) + swipe (mobile). */
  onReply?: (message: EnhancedMessage) => void
  /** Open the actions menu — wired to a hover chevron (desktop) + long-press (mobile). */
  onOpenActions?: (message: EnhancedMessage, anchor: MessageMenuAnchor) => void
}

// timestamp arrives as a Date or an ISO string (JSON) — coerce before formatting.
const formatClock = (d: Date | string) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Swipe-to-reply (mobile): tracks a horizontal drag in the reply `direction`
// (+1 right for incoming, -1 left for own) and fires once it passes the
// threshold. `touch-action: pan-y` on the wrapper keeps vertical scrolling
// working, so no preventDefault (and no passive-listener workaround) is needed.
function useSwipeToReply(direction: number, onSwipe?: () => void) {
  const [x, setX] = React.useState(0)
  const [progress, setProgress] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const startX = React.useRef(0)
  const startY = React.useRef(0)
  const offset = React.useRef(0)
  const active = React.useRef(false)
  const decided = React.useRef(false)

  const MAX = 72
  const THRESHOLD = 52
  const SLOP = 8

  const end = (fire: boolean) => {
    const passed = active.current && offset.current >= THRESHOLD
    active.current = false
    decided.current = false
    offset.current = 0
    setDragging(false)
    setX(0)
    setProgress(0)
    if (fire && passed) onSwipe?.()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onSwipe || e.touches.length !== 1) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    offset.current = 0
    active.current = false
    decided.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!onSwipe || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    // Decide once per gesture: lock in only a horizontal drag toward the reply side.
    if (!decided.current) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      decided.current = true
      active.current = Math.abs(dx) > Math.abs(dy) && dx * direction > 0
      if (active.current) setDragging(true)
    }
    if (!active.current) return
    const moved = Math.max(0, Math.min(dx * direction, MAX))
    offset.current = moved
    setX(moved * direction)
    setProgress(Math.min(moved / THRESHOLD, 1))
  }

  return {
    x,
    progress,
    dragging,
    onTouchStart,
    onTouchMove,
    onTouchEnd: () => end(true),
    onTouchCancel: () => end(false),
  }
}

// Long-press (mobile) to open the actions menu: starts a timer on touch and
// fires with the touch point unless the finger moves (scroll/swipe) or lifts.
function useLongPress(onLongPress?: (anchor: { x: number; y: number }) => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = React.useRef({ x: 0, y: 0 })

  const DELAY = 500
  const MOVE_SLOP = 10

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onLongPress || e.touches.length !== 1) return
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    clear()
    timer.current = setTimeout(() => onLongPress({ ...start.current }), DELAY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!timer.current || e.touches.length !== 1) return
    const t = e.touches[0]
    if (
      Math.abs(t.clientX - start.current.x) > MOVE_SLOP ||
      Math.abs(t.clientY - start.current.y) > MOVE_SLOP
    ) {
      clear()
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd: clear, onTouchCancel: clear }
}

export function EnhancedMessageBubble({
  message,
  avatarSrc,
  senderName = 'User',
  isAdminView = false,
  onRetry,
  onReply,
  onOpenActions,
}: EnhancedMessageBubbleProps) {
  const isLeftAligned = isAdminView ? message.isUser || message.isTransferSummary : !message.isUser
  // Grouping flags default to true so consumers that don't compute them keep the
  // "avatar + meta on every message" behaviour.
  const groupStart = message.isGroupStart ?? true
  const groupEnd = message.isGroupEnd ?? true

  // Per-message staff attribution (e.g. which colleague replied in a shared inbox).
  const showStaffName =
    !message.isTransferSummary &&
    !message.isTransferRequest &&
    !message.isChatbot &&
    !!(message.senderFirstName || message.senderLastName)

  const clock = message.timestamp ? formatClock(message.timestamp) : null

  // Own-message read status as text (design uses words, not check icons).
  const renderStatus = () => {
    if (!message.isUser || !message.status) return null
    if (message.status === MessageStatus.FAILED) {
      return (
        <span
          className="cursor-pointer text-rose-500"
          role="button"
          onClick={() => onRetry?.(message.id)}
        >
          Failed - Tap to retry
        </span>
      )
    }
    if (message.status === MessageStatus.SENDING) return <span>Sending…</span>
    if (message.status === MessageStatus.READ || message.readAt)
      return <span className="text-primary-700 dark:text-primary-300">Seen</span>
    return <span>Sent</span>
  }

  // Staff name on the meta line; first name visible, last name slides in on hover.
  const renderStaffName = () => {
    if (!showStaffName) return null
    const staticName = message.senderFirstName ?? message.senderLastName
    const revealName = message.senderFirstName ? message.senderLastName : undefined
    return (
      <span
        className="group inline-flex items-center whitespace-nowrap font-medium text-gray-500 dark:text-gray-300 cursor-default"
        aria-label={[message.senderFirstName, message.senderLastName].filter(Boolean).join(' ')}
      >
        <span>{staticName}</span>
        {revealName && (
          <span className="inline-block max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-1 group-hover:max-w-48 group-hover:translate-x-0 group-hover:opacity-100">
            {revealName}
          </span>
        )}
      </span>
    )
  }

  // Bubble background per message kind. Plain incoming/own are the design grays;
  // transfer/chatbot states keep their existing app-specific styling.
  const bubbleBg = message.isTransferSummary
    ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
    : message.isTransferRequest
      ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
      : message.isChatbot
        ? 'bg-gray-100 dark:bg-gray-800'
        : isLeftAligned
          ? 'bg-gray-100 dark:bg-gray-800'
          : 'bg-gray-200 dark:bg-gray-700'

  const bubbleInner = (
    <div
      className={cn(
        'w-fit max-w-full flex flex-col gap-2 px-3.5 py-2.5 text-sm leading-normal text-gray-900 dark:text-gray-100 rounded-2xl hover:brightness-95 transition',
        isLeftAligned ? 'rounded-bl' : 'rounded-br ml-auto',
        // Reply bubbles get a minimum width so a short reply doesn't squish the
        // quoted preview (WhatsApp-style).
        message.replyPreview && 'min-w-36',
        bubbleBg
      )}
    >
      {message.replyPreview && (
        <div className="border-l-4 border-primary-500 pl-2">
          {message.replyPreview.sender && (
            <div className="text-xs font-semibold text-primary-700">
              {message.replyPreview.sender}
            </div>
          )}
          <div className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {message.replyPreview.text}
          </div>
        </div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <MessageAttachmentsList
          attachments={message.attachments.map(a => ({
            id: a.id,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            fileType: a.fileType as any,
            url: a.url,
            thumbnailUrl: a.thumbnailUrl,
          }))}
        />
      )}
      <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
    </div>
  )

  // Reply: double-click (desktop) + swipe (mobile). Actions menu: hover chevron
  // (desktop) + long-press (mobile). Both gesture sets share one touch wrapper.
  const swipe = useSwipeToReply(
    isLeftAligned ? 1 : -1,
    onReply ? () => onReply(message) : undefined
  )
  const longPress = useLongPress(
    onOpenActions
      ? p => onOpenActions(message, { top: p.y, bottom: p.y, left: p.x, right: p.x })
      : undefined
  )
  const interactive = !!(onReply || onOpenActions)

  const meta =
    groupEnd && (clock || showStaffName || message.isUser || message.editedAt) ? (
      <div
        className={cn(
          'mt-1 flex items-center gap-1.5 px-1 text-xs text-gray-400 dark:text-gray-500',
          isLeftAligned ? '' : 'justify-end'
        )}
      >
        {clock && <span>{clock}</span>}
        {showStaffName && <span>·</span>}
        {renderStaffName()}
        {message.isUser && message.status && (
          <>
            <span>·</span>
            {renderStatus()}
          </>
        )}
        {message.editedAt && (
          <>
            <span>·</span>
            <span>edited</span>
          </>
        )}
      </div>
    ) : null

  return (
    <>
      {message.showDateDivider && message.dateLabel && (
        <div className="py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
          {message.dateLabel}
        </div>
      )}
      <div
        className={cn(
          'flex flex-col animate-in duration-300',
          isLeftAligned ? 'items-start slide-in-from-left-2' : 'items-end slide-in-from-right-2',
          groupEnd ? 'mb-4' : 'mb-0.5'
        )}
      >
        {isLeftAligned && groupStart && (
          <div className="mb-1 flex items-center gap-2">
            <UserAvatar
              photoUrl={message.isTransferSummary ? undefined : avatarSrc}
              fullName={message.isTransferSummary ? 'System' : senderName}
              className="w-7 h-7 text-xs"
              variant="flat"
            />
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {message.isTransferSummary ? 'System' : senderName}
            </span>
          </div>
        )}
        <div className={cn('flex w-full', isLeftAligned ? '' : 'flex-row-reverse')}>
          <div className={cn('max-w-[85%] lg:max-w-[70%]', isLeftAligned && 'ml-9')}>
            {interactive ? (
              <div
                className="relative touch-pan-y [-webkit-touch-callout:none]"
                onContextMenu={e => e.preventDefault()}
                onTouchStart={e => {
                  swipe.onTouchStart(e)
                  longPress.onTouchStart(e)
                }}
                onTouchMove={e => {
                  swipe.onTouchMove(e)
                  longPress.onTouchMove(e)
                }}
                onTouchEnd={() => {
                  swipe.onTouchEnd()
                  longPress.onTouchEnd()
                }}
                onTouchCancel={() => {
                  swipe.onTouchCancel()
                  longPress.onTouchCancel()
                }}
              >
                {onReply && (
                  <div
                    className={cn(
                      'pointer-events-none absolute top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-300',
                      isLeftAligned ? 'left-1' : 'right-1'
                    )}
                    style={{ opacity: swipe.progress }}
                    aria-hidden
                  >
                    <Reply size={18} />
                  </div>
                )}
                <div
                  className="group/bubble relative z-10"
                  style={{
                    transform: `translateX(${swipe.x}px)`,
                    transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
                  }}
                >
                  {onOpenActions && (
                    <button
                      type="button"
                      aria-label="Message actions"
                      onClick={e => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        onOpenActions(message, {
                          top: r.top,
                          bottom: r.bottom,
                          left: r.left,
                          right: r.right,
                        })
                      }}
                      className="pointer-events-none absolute right-1 top-1 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white text-gray-600 opacity-0 shadow-sm transition hover:bg-gray-50 hover:text-gray-700 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 dark:bg-gray-700 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-gray-600"
                    >
                      <ChevronDown size={16} />
                    </button>
                  )}
                  {bubbleInner}
                </div>
              </div>
            ) : (
              bubbleInner
            )}
            {meta}
          </div>
          {/* Double-click the empty space beside the bubble (right for received,
              left for sent) to reply — keeps the bubble's own text selectable. */}
          {onReply && <div className="flex-1" onDoubleClick={() => onReply(message)} />}
        </div>
      </div>
    </>
  )
}

interface TypingBubbleProps {
  avatarSrc?: string
  senderName?: string
}

/**
 * Typing indicator styled as an incoming message bubble — same avatar, colours
 * and shape as a received message, with animated dots in place of text.
 */
export function TypingBubble({ avatarSrc, senderName = 'User' }: TypingBubbleProps) {
  return (
    <div className="mb-4 flex items-end gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="shrink-0">
        <UserAvatar
          photoUrl={avatarSrc}
          fullName={senderName}
          className="w-7 h-7 text-xs"
          variant="flat"
        />
      </div>
      <div
        className="w-fit rounded-2xl rounded-bl bg-gray-100 px-4 py-3 dark:bg-gray-800"
        aria-label={`${senderName} is typing`}
      >
        <div className="flex items-center gap-1">
          {[0, 200, 400].map(delay => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500"
              style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
