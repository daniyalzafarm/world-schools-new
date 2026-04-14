'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  addToast,
  Avatar,
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
  MessageThread,
  type ReportReason,
  Textarea,
} from '@world-schools/ui-web'
import { MessageSquare, MoreVertical } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { MessagesSidebar } from '@/components/layout/messages-sidebar'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'
import { MessageListSkeleton } from '@/components/messages/message-skeleton'
import { TypingDots } from '@/components/messages/TypingIndicator'
import { PresenceIndicator } from '@/components/messages/PresenceIndicator'

import {
  type EnhancedMessage,
  EnhancedMessageBubble,
  type MessageResponseDto,
  type MessageStatus,
  type PresenceStatus,
  type SenderType,
} from '@world-schools/wc-frontend-utils'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'

export default function MessagesPage() {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Detect if we're on the archived route
  const isArchivedPage = pathname.startsWith('/messages/archived')

  // Get user from auth store
  const { user } = useAuthStore()

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
    stopTyping,
    retryFailedMessage,
    reportMessage,
    fetchMoreMessages,
    messagesHasMore,
    isLoadingMoreMessages,
    rateLimitRetryAfter,
    clearRateLimitRetryAfter,
  } = useMessagingStore()

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportedMessageId, setReportedMessageId] = useState<string | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [reportComment, setReportComment] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

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

  // Convert MessageResponseDto to EnhancedMessage type
  const convertToEnhancedMessage = (msg: MessageResponseDto): EnhancedMessage => {
    return {
      id: msg.id,
      text: msg.content,
      isUser: msg.senderId === user?.id && msg.senderType !== 'USER',
      timestamp: msg.sentAt,
      status: msg.status as MessageStatus,
      isTransferRequest: msg.type === 'TRANSFER_REQUEST',
      isTransferSummary: msg.type === 'TRANSFER_SUMMARY',
      isChatbot: msg.senderType === 'CHATBOT',
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      attachments: msg.attachments ?? null,
    }
  }

  // Convert messages for UI
  const enhancedMessages: EnhancedMessage[] = activeMessages.map(convertToEnhancedMessage)

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
    stopTyping(activeConversationId)

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
      idempotencyKey: `${user.id}-${Date.now()}`,
    })
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
      const conversation = event.detail

      // Filter conversations based on current route
      if (isArchivedPage && !conversation.archived) {
        return
      }
      if (!isArchivedPage && conversation.archived) {
        return
      }

      // Set active conversation in store
      handleSelectConversation(conversation.id)
    }

    window.addEventListener('selectConversation', handleConversationSelect as EventListener)

    return () => {
      window.removeEventListener('selectConversation', handleConversationSelect as EventListener)
    }
  }, [isArchivedPage, handleSelectConversation])

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
  const avatarSrc = undefined // No real avatar yet - Avatar component will show initials from name

  // Main content - conversation view or empty state
  const mainContent = !activeConversation ? (
    <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center px-6">
        <MessageSquare size={64} className="mx-auto mb-4 text-gray-400" />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {isArchivedPage ? 'Select an archived conversation' : 'Select a conversation'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {isArchivedPage
            ? 'Choose an archived conversation from the sidebar to view messages'
            : 'Choose a conversation from the sidebar to start messaging'}
        </p>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar src={avatarSrc} name={name} size="md" />
            {/* Presence indicator */}
            <PresenceIndicator status={presenceStatus} position="bottom-right" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name}</h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isArchivedPage
                  ? `${name} (Archived)`
                  : presenceStatus === 'ONLINE'
                    ? 'Online'
                    : presenceStatus === 'AWAY'
                      ? 'Away'
                      : 'User'}
              </p>
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
          isLoading={isLoadingMessages[activeConversationId || '']}
          error={messagesError[activeConversationId || '']}
          onRetry={() => activeConversationId && fetchMessages(activeConversationId)}
          placeholder="Type a message..."
          disabled={
            !isConnected || !user || (rateLimitRetryAfter != null && rateLimitRetryAfter > 0)
          }
          emptyMessage={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No messages yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Start the conversation by sending a message
                </p>
              </div>
            </div>
          }
          renderLoading={() => <MessageListSkeleton count={5} />}
          renderAfterMessages={() => {
            const otherUsersTyping =
              activeConversationId && user
                ? typingUsers[activeConversationId]?.filter(id => id !== user.id) || []
                : []
            return otherUsersTyping.length > 0 ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm px-4 py-3">
                  <TypingDots show={true} />
                </div>
              </div>
            ) : null
          }}
          scrollAreaClassName="flex-1 min-h-0"
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
              color="danger"
              onPress={handleSubmitReport}
              isLoading={isSubmittingReport}
              disabled={selectedReasons.length === 0}
            >
              Submit Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )

  // Full-screen layout with TopNav and MessagesSidebar
  return (
    <ProtectedRoute requireAuth requireProviderRole>
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        {/* Messages Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Messages Sidebar */}
          <MessagesSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          {/* Main Messages Content */}
          <main className="flex-1 overflow-auto bg-white dark:bg-gray-900">
            <div className="h-full">{mainContent}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
