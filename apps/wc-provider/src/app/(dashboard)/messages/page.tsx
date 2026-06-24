'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  addToast,
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import {
  type Conversation,
  DEFAULT_REPORT_REASONS,
  MessageContextMenu,
  type MessageContextMenuAction,
  type MessageMenuAnchor,
  MessageThread,
  type ReportReason,
  Textarea,
  UserAvatar,
} from '@world-schools/ui-web'
import { ChevronLeft, MessageSquare, MoreVertical, PanelRight } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { MessagesSidebar } from '@/components/layout/messages-sidebar'
import { ContactProfilePanel } from '@/components/messages/context-panel/ContactProfilePanel'
import { useMessagingStore } from '@/stores/messaging-store'
import { useMessagePanelStore } from '@/stores/message-panel-store'
import { useAuthStore } from '@/stores/auth-store'
import { MessageListSkeleton } from '@/components/messages/message-skeleton'
import { PresenceIndicator } from '@/components/messages/PresenceIndicator'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'

import {
  type EnhancedMessage,
  EnhancedMessageBubble,
  type MessageResponseDto,
  type MessageStatus,
  type PresenceStatus,
  type SenderType,
  TypingBubble,
} from '@world-schools/wc-frontend-utils'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'

export default function MessagesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // On mobile, show the conversation list by default
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(true)
    }
  }, [])

  // Get user from auth store
  const { user } = useAuthStore()

  // Right contact panel toggle (parent profile)
  const { togglePanel, setPanelOpen, isPanelOpen } = useMessagePanelStore()

  // Measure the chat-area region (chat + panel) so the panel can switch between
  // a side column and a full-cover overlay based on its own available width —
  // independent of the viewport (WhatsApp Web behaviour). Below 860px (chat min
  // 480 + panel 380) the panel covers the chat.
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const [panelOverlay, setPanelOverlay] = useState(false)

  useEffect(() => {
    const el = chatAreaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0
      setPanelOverlay(width < 860)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Get messaging store state and actions
  const {
    conversations,
    activeConversationId,
    messages: storeMessages,
    isConnected,
    typingUsers,
    userPresence,
    isLoadingMessages,
    messagesError,
    setActiveConversation,
    fetchMessages,
    sendMessage,
    markAsRead,
    retryFailedMessage,
    reportMessage,
    editMessageRemote,
    deleteMessageRemote,
    fetchMoreMessages,
    messagesHasMore,
    isLoadingMoreMessages,
    rateLimitRetryAfter,
    clearRateLimitRetryAfter,
  } = useMessagingStore()

  // Typing indicator — emits start/stop for the active conversation.
  const { handleTyping, handleStopTyping } = useTypingIndicator(activeConversationId)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportedMessageId, setReportedMessageId] = useState<string | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [reportComment, setReportComment] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Message actions (5B design): right-click context menu, reply bar, edit/delete.
  const [actionMenu, setActionMenu] = useState<{
    message: EnhancedMessage
    anchor: MessageMenuAnchor
  } | null>(null)
  const [replyTarget, setReplyTarget] = useState<{
    id: string
    sender: string
    text: string
  } | null>(null)
  const [editTarget, setEditTarget] = useState<{ id: string; text: string } | null>(null)
  const [editText, setEditText] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // Get active conversation messages
  const activeMessages = activeConversationId ? storeMessages[activeConversationId] || [] : []

  // Fetch messages for the active conversation, aborting any stale in-flight request
  // when the user switches conversations or navigates away from the page.
  useEffect(() => {
    if (!activeConversationId) return
    const controller = new AbortController()
    void fetchMessages(activeConversationId, controller.signal)
    return () => controller.abort()
  }, [activeConversationId, fetchMessages])

  // Deselect the active conversation when navigating away from this page.
  // Without this, the stale selection persists in the store and the user
  // comes back to a pre-selected (possibly stale) conversation.
  useEffect(() => {
    return () => {
      setActiveConversation(null)
    }
  }, [setActiveConversation])

  // Deselect the active conversation on Escape key press (WhatsApp-like behaviour).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveConversation(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setActiveConversation])

  // Clear rate limit cooldown after retryAfter seconds
  useEffect(() => {
    if (rateLimitRetryAfter == null || rateLimitRetryAfter <= 0) return
    const t = setTimeout(() => clearRateLimitRetryAfter(), rateLimitRetryAfter * 1000)
    return () => clearTimeout(t)
  }, [rateLimitRetryAfter, clearRateLimitRetryAfter])

  // Mark all unread incoming messages as read when viewing the conversation
  useEffect(() => {
    if (!activeConversationId || !user?.id) return
    if (!isConnected) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const unreadIncoming = activeMessages.filter(m => m.senderId !== user.id && !m.readAt)
    for (const msg of unreadIncoming) {
      void markAsRead(activeConversationId, msg.id)
    }
  }, [activeConversationId, activeMessages, user?.id, isConnected, markAsRead])

  // Re-trigger mark-as-read when the tab becomes visible again (user was in another tab)
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!activeConversationId || !user?.id || !isConnected) return

      const unreadIncoming = activeMessages.filter(m => m.senderId !== user.id && !m.readAt)
      for (const msg of unreadIncoming) {
        void markAsRead(activeConversationId, msg.id)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [activeConversationId, activeMessages, user?.id, isConnected, markAsRead])

  // On mobile: show sidebar (list) when no conversation selected, hide it when one is active
  useEffect(() => {
    if (window.innerWidth >= 1024) return
    if (activeConversationId) {
      setSidebarOpen(false)
    } else {
      setSidebarOpen(true)
    }
  }, [activeConversationId])

  // Get active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null

  // Convert MessageResponseDto to EnhancedMessage type
  const convertToEnhancedMessage = (msg: MessageResponseDto): EnhancedMessage => {
    return {
      id: msg.id,
      text: msg.content,
      // The whole provider team is one side of the conversation: every
      // provider-sent message is "ours" (right-aligned), not just the current
      // user's — a colleague's reply shows as sent, attributed by name below.
      // Only the parent's (USER) messages are incoming.
      isUser: msg.senderType === 'PROVIDER',
      timestamp: msg.sentAt,
      status: msg.status as MessageStatus,
      isTransferRequest: msg.type === 'TRANSFER_REQUEST',
      isTransferSummary: msg.type === 'TRANSFER_SUMMARY',
      isChatbot: msg.senderType === 'CHATBOT',
      // Attribute provider/staff messages to the staff member who sent them so a
      // shared inbox shows who replied. First name shows by default; the last
      // name slides in on hover. Parent messages carry no name label — the
      // conversation header already identifies the parent.
      senderFirstName:
        msg.senderType === 'PROVIDER' ? (msg.sender?.firstName ?? undefined) : undefined,
      senderLastName:
        msg.senderType === 'PROVIDER' ? (msg.sender?.lastName ?? undefined) : undefined,
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      editedAt: msg.editedAt,
      attachments: msg.attachments ?? null,
    }
  }

  // Convert messages for UI
  // Build the UI messages with WhatsApp-style grouping flags: consecutive
  // messages from the same sender within 5 min are one group (single avatar/name
  // + single timestamp), and a date divider is shown when the day changes.
  const GROUP_GAP_MS = 5 * 60 * 1000
  const dayOf = (m?: MessageResponseDto) => (m ? new Date(m.sentAt).toDateString() : '')
  const msOf = (m?: MessageResponseDto) => (m ? new Date(m.sentAt).getTime() : 0)
  const enhancedMessages: EnhancedMessage[] = activeMessages.map((msg, i) => {
    const prev = activeMessages[i - 1]
    const next = activeMessages[i + 1]
    const showDateDivider = !prev || dayOf(prev) !== dayOf(msg)
    const isGroupStart =
      showDateDivider || prev?.senderId !== msg.senderId || msOf(msg) - msOf(prev) > GROUP_GAP_MS
    const isGroupEnd =
      next?.senderId !== msg.senderId ||
      msOf(next) - msOf(msg) > GROUP_GAP_MS ||
      dayOf(next) !== dayOf(msg)
    // Quoted reply preview (WhatsApp-style): the original is carried on msg.replyTo
    // {id, content, senderId}; resolve the quoted sender's name from the loaded message.
    const repliedTo = msg.replyTo
    const original = repliedTo ? activeMessages.find(m => m.id === repliedTo.id) : undefined
    return {
      ...convertToEnhancedMessage(msg),
      senderId: msg.senderId,
      isGroupStart,
      isGroupEnd,
      showDateDivider,
      dateLabel: showDateDivider
        ? new Date(msg.sentAt).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : undefined,
      replyPreview: repliedTo
        ? {
            sender:
              repliedTo.senderId && repliedTo.senderId === user?.id
                ? 'You'
                : original?.sender
                  ? [original.sender.firstName, original.sender.lastName]
                      .filter(Boolean)
                      .join(' ') || undefined
                  : undefined,
            text: repliedTo.content ?? '',
          }
        : undefined,
    }
  })

  // Get presence status for active conversation participants
  const getPresenceStatus = (): PresenceStatus | null => {
    if (!activeConversation) return null
    const participant = activeConversation.participants?.find(p => p.userId)
    if (!participant) return null
    const userId = participant.userId
    if (!userId) return null
    return userPresence[userId] || null
  }

  const presenceStatus = getPresenceStatus()

  // Is the other participant typing in the open conversation? Drives the header
  // "typing…" subtitle and the in-thread typing bubble.
  const isOtherTyping = activeConversationId
    ? (typingUsers[activeConversationId] ?? []).some(id => id !== user?.id)
    : false

  const sendMessageContent = async ({
    content,
    attachments,
  }: {
    content: string
    attachments: File[]
  }) => {
    const trimmed = content.trim()
    if (!activeConversationId || !user) return
    if (!trimmed && attachments.length === 0) return
    handleStopTyping()

    let attachmentIds: string[] | undefined
    if (attachments.length > 0) {
      const uploadResults = await Promise.all(
        attachments.map(file => messagingAttachmentsService.uploadAttachment(file))
      )

      const failed = uploadResults.find(result => !result.success)
      if (failed) {
        const message =
          typeof failed.data === 'object' && failed.data && 'message' in failed.data
            ? (failed.data as any).message
            : 'Failed to upload attachments'
        throw new Error(message)
      }

      attachmentIds = uploadResults
        .map(result => (result.success ? result.data.id : null))
        .filter((id): id is string => id != null)
    }

    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'PROVIDER' as SenderType,
      content: trimmed,
      attachmentIds,
      replyToId: replyTarget?.id,
      idempotencyKey: `${user.id}-${Date.now()}`,
    })
    setReplyTarget(null)
  }

  const handleReportReasonToggle = (reasonId: string) => {
    setSelectedReasons(prev =>
      prev.includes(reasonId) ? prev.filter(id => id !== reasonId) : [...prev, reasonId]
    )
  }

  // Map ui-web reason id to backend ReportReason enum
  const mapReasonToBackend = (id: string): string => {
    const map: Record<string, string> = {
      inappropriate: 'INAPPROPRIATE_CONTENT',
      spam: 'SPAM',
      harassment: 'HARASSMENT',
      impersonation: 'IMPERSONATION',
      scam: 'SCAM',
      other: 'OTHER',
    }
    return map[id] ?? 'OTHER'
  }

  const handleSubmitReport = async () => {
    if (selectedReasons.length === 0 || !reportedMessageId) return

    setReportError(null)
    setIsSubmittingReport(true)

    const result = await reportMessage(reportedMessageId, {
      reason: mapReasonToBackend(selectedReasons[0]),
      description: reportComment.trim() || undefined,
    })

    setIsSubmittingReport(false)
    if (result.success) {
      setSelectedReasons([])
      setReportComment('')
      setReportedMessageId(null)
      setShowReportModal(false)
      addToast({
        title: 'Report submitted',
        description: 'The conversation has been reported',
        color: 'success',
      })
    } else {
      setReportError(result.error ?? 'Failed to submit report')
    }
  }

  const handleCancelReport = () => {
    setSelectedReasons([])
    setReportComment('')
    setReportedMessageId(null)
    setReportError(null)
    setShowReportModal(false)
  }

  // Handle conversation selection
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId)
  }

  // Listen for conversation selection events from the sidebar
  useEffect(() => {
    const handleConversationSelect = (event: CustomEvent<Conversation>) => {
      handleSelectConversation(event.detail.id)
    }

    window.addEventListener('selectConversation', handleConversationSelect as EventListener)

    return () => {
      window.removeEventListener('selectConversation', handleConversationSelect as EventListener)
    }
  }, [handleSelectConversation])

  // Get conversation details for display
  const getConversationName = () => {
    if (!activeConversation) return 'Conversation'

    // For USER_SUPERADMIN conversations, show "World Camps Support"
    if (activeConversation.type === 'USER_SUPERADMIN') {
      return 'World Camps Support'
    }

    // For provider app, filter out provider participants to find the user/parent
    const nonProviderParticipants =
      activeConversation.participants?.filter(p => !p.providerId) ?? []
    const userParticipant = nonProviderParticipants.find(p => p.userId)
    const firstName = userParticipant?.user?.firstName || ''
    const lastName = userParticipant?.user?.lastName || ''
    return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'User'
  }

  const name = getConversationName()
  // Parent's profile photo (SAS-resolved server-side) for the chat header; falls
  // back to initials when absent or for support chats.
  const avatarSrc =
    activeConversation && activeConversation.type !== 'USER_SUPERADMIN'
      ? (activeConversation.participants?.find(p => !p.providerId && p.userId)?.user
          ?.profilePhotoUrl ?? undefined)
      : undefined

  // The contact profile panel only applies to provider↔parent conversations.
  const isParentConversation = activeConversation?.type === 'USER_PROVIDER'

  // Build the right-click menu for a message: Reply/Copy for incoming; Edit/Copy/
  // Delete for the current user's own messages (gated on real authorship).
  // Reply is available on any message (including your own, like WhatsApp). Shared
  // by the context menu, double-click (desktop) and swipe (mobile) triggers.
  const startReply = (m: EnhancedMessage) => {
    const replySender =
      m.senderId && m.senderId === user?.id
        ? 'You'
        : [m.senderFirstName, m.senderLastName].filter(Boolean).join(' ') || name
    setReplyTarget({ id: m.id, sender: replySender, text: m.text })
  }

  const buildMessageActions = (m: EnhancedMessage): MessageContextMenuAction[] => {
    const actions: MessageContextMenuAction[] = []
    actions.push({
      key: 'reply',
      label: 'Reply',
      onSelect: () => startReply(m),
    })
    actions.push({
      key: 'copy',
      label: 'Copy text',
      onSelect: () => void navigator.clipboard?.writeText(m.text),
    })
    if (m.senderId && m.senderId === user?.id) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        onSelect: () => {
          setEditTarget({ id: m.id, text: m.text })
          setEditText(m.text)
        },
      })
      actions.push({
        key: 'delete',
        label: 'Delete',
        danger: true,
        onSelect: () => setDeleteTargetId(m.id),
      })
    }
    return actions
  }

  // Main content - conversation view or empty state
  const mainContent = !activeConversation ? (
    <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center px-6">
        <MessageSquare size={64} className="mx-auto mb-4 text-gray-400" />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Select a conversation
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Choose a conversation from the sidebar to start messaging
        </p>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 h-20">
        <div className="flex items-center gap-3 w-full min-w-0">
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="lg:hidden -ml-2 mr-1"
            onPress={() => setActiveConversation(null)}
          >
            <ChevronLeft size={20} />
          </Button>
          {/* Clicking the contact identity opens the profile panel (WhatsApp-style).
              Inert for support chats, which have no profile panel. */}
          <div
            role={isParentConversation ? 'button' : undefined}
            tabIndex={isParentConversation ? 0 : undefined}
            onClick={() => isParentConversation && setPanelOpen(true)}
            onKeyDown={e => {
              if (!isParentConversation) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setPanelOpen(true)
              }
            }}
            className={`flex items-center gap-3 w-full min-w-0 ${isParentConversation ? 'cursor-pointer' : ''}`}
            aria-label={isParentConversation ? 'Open contact profile' : undefined}
          >
            <div className="relative shrink-0">
              <UserAvatar
                photoUrl={avatarSrc}
                fullName={name}
                className="w-12 h-12 text-base"
                variant="flat"
              />
              {/* Presence indicator */}
              <PresenceIndicator status={presenceStatus} position="bottom-right" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {name}
              </h2>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 truncate text-sm text-gray-500 dark:text-gray-400">
                  {isOtherTyping ? (
                    <span className="font-medium text-primary-600 dark:text-primary-300">
                      typing…
                    </span>
                  ) : presenceStatus === 'ONLINE' ? (
                    <>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      Online
                    </>
                  ) : presenceStatus === 'AWAY' ? (
                    <>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      Away
                    </>
                  ) : activeConversation?.type === 'USER_SUPERADMIN' ? (
                    'Usually responds within 2 hours'
                  ) : (
                    'User'
                  )}
                </div>
                {/* Provider-specific: Assignment status indicator */}
                {/* {assignmentStatus && !isArchivedPage && (
                <>
                  <span className="text-gray-300">•</span>
                  {assignmentStatus.isAssigned ? (
                    <Chip size="sm" color="success" variant="flat">
                      {assignmentStatus.assignedToCurrentUser
                        ? 'Assigned to you'
                        : `Assigned to ${assignmentStatus.assignedToName}`}
                    </Chip>
                  ) : (
                    <Chip size="sm" color="warning" variant="flat">
                      Unassigned
                    </Chip>
                  )}
                </>
              )} */}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 pl-8 shrink-0">
          {/* Toggle the contact profile panel — not shown for support chats */}
          {isParentConversation && (
            <Button
              variant="light"
              size="sm"
              aria-label={isPanelOpen ? 'Hide details' : 'View details'}
              onPress={togglePanel}
              startContent={<PanelRight size={16} />}
              className="min-w-0 rounded-lg border border-gray-200 bg-gray-100 px-2 text-sm text-gray-900 data-[hover=true]:border-primary-500 data-[hover=true]:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:data-[hover=true]:bg-gray-700 sm:px-3"
            >
              <span className="hidden sm:inline">
                {isPanelOpen ? 'Hide Details' : 'View Details'}
              </span>
            </Button>
          )}

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button isIconOnly variant="light" size="sm">
                <MoreVertical size={20} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Conversation actions"
              onAction={key => {
                if (key === 'report') {
                  const lastMessage =
                    activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null
                  if (lastMessage?.id) {
                    setReportedMessageId(lastMessage.id)
                    setReportError(null)
                    setShowReportModal(true)
                  }
                }
              }}
            >
              <DropdownItem key="report" className="text-danger" color="danger">
                Report
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* Messages + Input (shared MessageThread) */}
      <div className="flex-1 flex flex-col min-h-0">
        {!isConnected && (
          <div className="mb-2 text-center">
            <span className="text-xs text-orange-500">Reconnecting...</span>
          </div>
        )}
        {rateLimitRetryAfter != null && rateLimitRetryAfter > 0 && (
          <div className="mb-2 text-center">
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Too many messages. Try again in {rateLimitRetryAfter} seconds.
            </span>
          </div>
        )}
        <MessageThread
          messages={enhancedMessages}
          renderMessage={msg => (
            <EnhancedMessageBubble
              message={msg}
              avatarSrc={avatarSrc}
              senderName={name}
              isAdminView={false}
              onRetry={messageId => retryFailedMessage(messageId)}
              onReply={startReply}
              onOpenActions={(m, anchor) => setActionMenu({ message: m, anchor })}
            />
          )}
          renderBeforeMessages={() =>
            activeConversationId && messagesHasMore[activeConversationId] ? (
              <div className="flex justify-center py-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => fetchMoreMessages(activeConversationId)}
                  isLoading={isLoadingMoreMessages[activeConversationId]}
                  isDisabled={isLoadingMoreMessages[activeConversationId]}
                >
                  Load older messages
                </Button>
              </div>
            ) : null
          }
          onSend={sendMessageContent}
          onType={value => (value ? handleTyping() : handleStopTyping())}
          isLoading={isLoadingMessages[activeConversationId || '']}
          error={messagesError[activeConversationId || '']}
          onRetry={() => activeConversationId && fetchMessages(activeConversationId)}
          placeholder="Type a message..."
          disabled={
            !isConnected || !user || (rateLimitRetryAfter != null && rateLimitRetryAfter > 0)
          }
          emptyMessage={
            <div className="flex h-full items-center justify-center">
              <div className="px-6 text-center">
                <div className="mb-4 text-5xl">💬</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  No messages yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send a message to start the conversation.
                </p>
              </div>
            </div>
          }
          renderError={(_error, retry) => (
            <div className="flex h-full items-center justify-center">
              <div className="px-6 text-center">
                <div className="mb-4 text-5xl">⚠️</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Unable to load messages
                </h3>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Check your internet connection and try again.
                </p>
                {retry && (
                  <Button size="sm" color="primary" onPress={retry}>
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}
          renderLoading={() => <MessageListSkeleton count={5} />}
          renderAfterMessages={() =>
            isOtherTyping ? <TypingBubble avatarSrc={avatarSrc} senderName={name} /> : null
          }
          scrollAreaClassName="flex-1 min-h-0"
          messagesContainerClassName="space-y-0"
          sendVariant="pill"
          replyTo={replyTarget ? { sender: replyTarget.sender, text: replyTarget.text } : null}
          onCancelReply={() => setReplyTarget(null)}
        />
      </div>

      {/* Report Modal */}
      <Modal isOpen={showReportModal} onClose={handleCancelReport} size="lg">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-semibold">Report Conversation</h3>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please select the reason(s) for reporting this conversation:
              </p>

              <div className="flex flex-col gap-2">
                {DEFAULT_REPORT_REASONS.map((reason: ReportReason) => (
                  <Checkbox
                    key={reason.id}
                    isSelected={selectedReasons.includes(reason.id)}
                    onValueChange={() => handleReportReasonToggle(reason.id)}
                  >
                    <span className="font-medium">{reason.label}</span>
                  </Checkbox>
                ))}
              </div>

              <Textarea
                label="Additional Comments (Optional)"
                placeholder="Provide any additional details..."
                value={reportComment}
                onValueChange={setReportComment}
                minRows={3}
              />
              {reportError && <p className="text-sm text-danger">{reportError}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCancelReport} disabled={isSubmittingReport}>
              Cancel
            </Button>
            <Button
              className="bg-slate-800 text-white"
              onPress={handleSubmitReport}
              isLoading={isSubmittingReport}
              disabled={selectedReasons.length === 0}
            >
              Submit Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Message actions menu (hover chevron / long-press) */}
      {actionMenu && (
        <MessageContextMenu
          anchor={actionMenu.anchor}
          onClose={() => setActionMenu(null)}
          actions={buildMessageActions(actionMenu.message)}
        />
      )}

      {/* Edit message */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} size="lg">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-semibold">Edit message</h3>
          </ModalHeader>
          <ModalBody>
            <Textarea value={editText} onValueChange={setEditText} minRows={3} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!editText.trim()}
              onPress={async () => {
                if (editTarget && activeConversationId && editText.trim()) {
                  await editMessageRemote(activeConversationId, editTarget.id, editText.trim())
                }
                setEditTarget(null)
              }}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete message confirmation */}
      <Modal isOpen={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} size="sm">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-semibold">Delete Message?</h3>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This message will be permanently deleted and cannot be recovered.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-500 text-white"
              onPress={async () => {
                if (deleteTargetId && activeConversationId) {
                  await deleteMessageRemote(activeConversationId, deleteTargetId)
                }
                setDeleteTargetId(null)
              }}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )

  // Full-screen layout with TopNav and MessagesSidebar
  return (
    <ProtectedRoute
      requireAuth
      requireProviderRole
      requiredPermissions={['messages.read', 'messages.write']}
    >
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Messages Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Messages Sidebar */}
          <MessagesSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          {/* Chat area region (conversation + contact panel). Relative so the
              panel can cover exactly this region as an overlay when narrow. */}
          <div ref={chatAreaRef} className="relative flex flex-1 min-w-0 overflow-hidden">
            {/* Main Messages Content */}
            <main className="flex-1 overflow-auto bg-white dark:bg-gray-900 min-w-0">
              <div className="h-full">{mainContent}</div>
            </main>

            {/* Right contact profile panel for the active conversation */}
            <ContactProfilePanel overlay={panelOverlay} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
