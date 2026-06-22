'use client'

import React, { useEffect, useState } from 'react'
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
  ChatInput,
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
import { useMessagingStore } from '@/stores/messaging-store'
import { useMessagePanelStore } from '@/stores/message-panel-store'
import { useAuthStore } from '@/stores/auth-store'
import { MessageListSkeleton } from '@/components/messages/message-skeleton'
import { PresenceIndicator } from '@/components/messages/PresenceIndicator'

import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import {
  ContextType,
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
  // Get user from auth store
  const { user } = useAuthStore()

  // Right context panel toggle (camp/booking info)
  const { togglePanel, setPanelOpen, isPanelOpen } = useMessagePanelStore()

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
    draftConversation,
    setActiveConversation,
    clearDraftConversation,
    fetchMessages,
    sendMessage,
    markAsRead,
    retryFailedMessage,
    createConversationWithMessage,
    reportMessage,
    editMessageRemote,
    deleteMessageRemote,
    fetchMoreMessages,
    messagesHasMore,
    isLoadingMoreMessages,
    rateLimitRetryAfter,
    clearRateLimitRetryAfter,
  } = useMessagingStore()

  // Initialize typing indicator hook
  const { handleTyping, handleStopTyping } = useTypingIndicator(activeConversationId)

  // Local UI state (input only for draft conversation; active conversation uses MessageThread)
  const [input, setInput] = useState('')

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

  // Get active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null

  // Deep-link support: if a draft was opened for a provider the user already has
  // a conversation with (e.g. "Message camp" from a booking or camp profile),
  // open that existing thread instead of the empty "Select a conversation" /
  // compose state. Resolves as soon as conversations are loaded.
  useEffect(() => {
    if (!draftConversation?.providerId) return
    const { providerId, contextType, contextId } = draftConversation
    // Match the same key the backend dedups by — provider AND camp context —
    // so a draft for a different camp from the same provider doesn't reopen the
    // old camp's thread. Mirror the backend normalization: missing contextType
    // → GENERAL, missing contextId → null.
    const draftContextType = contextType ?? ContextType.GENERAL
    const draftContextId = contextId ?? null
    const existing = conversations.find(
      c =>
        c.type === 'USER_PROVIDER' &&
        (c.metadata as { providerId?: string } | null)?.providerId === providerId &&
        (c.contextType ?? ContextType.GENERAL) === draftContextType &&
        (c.contextId ?? null) === draftContextId
    )
    if (existing) {
      setActiveConversation(existing.id)
      clearDraftConversation()
    }
  }, [
    draftConversation?.providerId,
    draftConversation?.contextType,
    draftConversation?.contextId,
    conversations,
    setActiveConversation,
    clearDraftConversation,
  ])

  // Convert MessageResponseDto to EnhancedMessage type
  const convertToEnhancedMessage = (msg: MessageResponseDto): EnhancedMessage => {
    return {
      id: msg.id,
      text: msg.content,
      isUser: msg.senderId === user?.id && msg.senderType !== 'PROVIDER',
      timestamp: msg.sentAt,
      status: msg.status as MessageStatus,
      isTransferRequest: msg.type === 'TRANSFER_REQUEST',
      isTransferSummary: msg.type === 'TRANSFER_SUMMARY',
      isChatbot: msg.senderType === 'CHATBOT',
      // Show the camp staff member's name on provider messages (the header shows
      // the camp). First name shows by default; the last name slides in on hover.
      // The parent's own messages carry no name label.
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
    // Filter out current user to get the "other" participant
    const otherParticipants =
      activeConversation.participants?.filter(p => p.userId !== user?.id) ?? []
    const participant = otherParticipants.find(p => p.providerId || p.userId)
    if (!participant) return null
    const userId = participant.userId || participant.providerId
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
    if (!user) return
    if (!trimmed && attachments.length === 0) return
    if (draftConversation?.providerId && !activeConversationId) {
      await createConversationWithMessage({
        userId: user.id,
        participantId: draftConversation.providerId,
        participantType: draftConversation.participantType,
        contextType: draftConversation.contextType,
        contextId: draftConversation.contextId,
        initialMessage: trimmed,
      })
      return
    }
    if (!activeConversationId) return
    handleStopTyping()

    let attachmentIds: string[] | undefined
    if (attachments.length > 0) {
      const uploadResults = await Promise.all(
        attachments.map(file => messagingAttachmentsService.uploadAttachment(file))
      )

      const failed = uploadResults.find(result => !result.success)
      if (failed?.data && 'message' in failed.data) {
        throw new Error((failed.data as { message: string }).message)
      }

      attachmentIds = uploadResults
        .filter(result => result.success && result.data && 'id' in result.data)
        .map(result => (result.data as { id: string }).id)

      if (!attachmentIds.length) {
        throw new Error('Failed to upload attachments')
      }
    }

    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'USER' as SenderType,
      content: trimmed,
      attachmentIds,
      replyToId: replyTarget?.id,
      idempotencyKey: `${user.id}-${Date.now()}`,
    })
    setReplyTarget(null)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !user) return
    setInput('')
    try {
      await sendMessageContent({ content: text, attachments: [] })
    } catch (error) {
      console.error('Failed to send:', error)
      setInput(text)
    }
  }

  // Handle input change with typing indicator
  const handleInputChange = (value: string) => {
    setInput(value)

    if (value) {
      handleTyping()
    } else {
      handleStopTyping()
    }
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

    // For USER_SUPERADMIN conversations, show "Support Team"
    if (activeConversation.type === 'USER_SUPERADMIN') {
      return 'World Camps Support'
    }

    // Prefer the camp identity (enriched server-side) over the operator org so
    // the parent sees the camp they are messaging — not "World Schools".
    if (activeConversation.campName) {
      return activeConversation.campName
    }

    // Fallback: provider name from participants
    const otherParticipants =
      activeConversation.participants?.filter(p => p.userId !== user?.id) ?? []
    const providerParticipant = otherParticipants.find(p => p.providerId)
    return providerParticipant?.provider?.legalCompanyName || 'Provider'
  }

  const name = getConversationName()
  // Camp photo (enriched server-side) as the conversation avatar; falls back to
  // initials from `name` when absent.
  const avatarSrc = activeConversation?.campPhotoUrl ?? undefined
  const campLocation = activeConversation?.campLocation ?? null

  // Check if conversation is with superadmin
  const isSuperadminConversation = activeConversation?.type === 'USER_SUPERADMIN'

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

  // Main content - conversation view, draft conversation, or empty state
  const mainContent =
    !activeConversation && !draftConversation ? (
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
    ) : !activeConversation && draftConversation ? (
      // ✅ WhatsApp Web pattern: Show draft conversation UI
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        {/* Chat Header for Draft */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 h-20">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="lg:hidden -ml-2 mr-1"
              onPress={() => setActiveConversation(null)}
            >
              <ChevronLeft size={20} />
            </Button>
            <div className="relative">
              <UserAvatar
                photoUrl={draftConversation.contextImageUrl}
                fullName={draftConversation.contextName || draftConversation.providerName}
                variant="flat"
                className="w-10 h-10 text-base"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {draftConversation.contextName || draftConversation.providerName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">New conversation</p>
            </div>
          </div>
        </div>

        {/* Empty Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Send your first message to {draftConversation.providerName}
              </p>
            </div>
          </div>
        </div>

        {/* Chat Input for Draft */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          {!isConnected && (
            <div className="mb-2 text-center">
              <span className="text-xs text-orange-500">Reconnecting...</span>
            </div>
          )}
          <ChatInput
            value={input}
            onChange={handleInputChange}
            onSend={handleSend}
            placeholder="Type your first message..."
            disabled={!isConnected || !user}
          />
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
            {/* Clicking the contact identity opens the context panel.
                Inert for support chats, which have no context panel. */}
            <div
              role={isSuperadminConversation ? undefined : 'button'}
              tabIndex={isSuperadminConversation ? undefined : 0}
              onClick={() => !isSuperadminConversation && setPanelOpen(true)}
              onKeyDown={e => {
                if (isSuperadminConversation) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setPanelOpen(true)
                }
              }}
              className={`flex items-center gap-3 w-full min-w-0 ${
                isSuperadminConversation ? '' : 'cursor-pointer'
              }`}
              aria-label={isSuperadminConversation ? undefined : 'Open camp info'}
            >
              <div className="relative shrink-0">
                <UserAvatar
                  photoUrl={avatarSrc}
                  fullName={name}
                  variant="flat"
                  className="w-12 h-12 text-base"
                />
                {/* Presence indicator */}
                <PresenceIndicator status={presenceStatus} position="bottom-right" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {name}
                </h2>
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
                  ) : isSuperadminConversation ? (
                    'Usually responds within 2 hours'
                  ) : (
                    campLocation || 'Provider'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 pl-8 shrink-0">
            {/* Toggle the camp/booking context panel — not shown for support chats */}
            {!isSuperadminConversation && (
              <Button
                variant="light"
                size="sm"
                aria-label={isPanelOpen ? 'Hide camp info' : 'View camp info'}
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

  // Main content is now wrapped by MessagesMainLayout which includes both sidebars
  return <div className="h-full bg-white dark:bg-gray-900">{mainContent}</div>
}
