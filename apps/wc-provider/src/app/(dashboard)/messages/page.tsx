'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Avatar,
  Button,
  Checkbox,
  Chip,
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
  type Message,
  type ReportReason,
  Textarea,
} from '@world-schools/ui-web'
import { Circle, MessageSquare, MoreVertical } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { MessagesSidebar } from '@/components/layout/messages-sidebar'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'
import { MessageListSkeleton } from '@/components/messages/message-skeleton'
import {
  type EnhancedMessage,
  EnhancedMessageBubble,
} from '@/components/messages/enhanced-message-bubble'
import { TypingDots } from '@/components/messages/TypingIndicator'
import { PresenceIndicator } from '@/components/messages/PresenceIndicator'
import { NotificationBadge } from '@/components/messages/NotificationBadge'

import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import type {
  ConversationResponseDto,
  MessageResponseDto,
  MessageStatus,
  PresenceStatus,
  SenderType,
} from '@world-schools/wc-frontend-utils'

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
    pendingMessages,
    failedMessages,
    isLoadingConversations,
    isLoadingMessages,
    conversationsError,
    messagesError,
    fetchConversations,
    setActiveConversation,
    fetchMessages,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    retryFailedMessage,
    removeFailedMessage,
  } = useMessagingStore()

  // Initialize typing indicator hook
  const { handleTyping, handleStopTyping } = useTypingIndicator(activeConversationId)

  // Local UI state
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [reportComment, setReportComment] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Get active conversation messages
  const activeMessages = activeConversationId ? storeMessages[activeConversationId] || [] : []

  // Get active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null

  // Convert MessageResponseDto to EnhancedMessage type
  const convertToEnhancedMessage = (msg: MessageResponseDto): EnhancedMessage => {
    return {
      id: msg.id,
      text: msg.content,
      isUser: msg.senderId === user?.id,
      timestamp: msg.sentAt,
      status: msg.status as MessageStatus,
      isTransferRequest: msg.type === 'TRANSFER_REQUEST',
      isTransferSummary: msg.type === 'TRANSFER_SUMMARY',
      isChatbot: msg.senderType === 'CHATBOT',
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
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

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !activeConversationId || !user) {
      return
    }

    // Clear input immediately for better UX
    setInput('')

    // Stop typing indicator
    stopTyping(activeConversationId)

    // Send message via store (with optimistic update)
    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'PROVIDER' as SenderType,
      content: text,
      idempotencyKey: `${user.id}-${Date.now()}`,
    })
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

  const handleSubmitReport = async () => {
    if (selectedReasons.length === 0) {
      return
    }

    setIsSubmittingReport(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Reset form and close modal
      setSelectedReasons([])
      setReportComment('')
      setShowReportModal(false)
    } catch {
      // Failed to submit report - handle error
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const handleCancelReport = () => {
    setSelectedReasons([])
    setReportComment('')
    setShowReportModal(false)
  }

  // Handle conversation selection
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId)
    // fetchMessages is called automatically by setActiveConversation
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [enhancedMessages])

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

  // Get assignment status for active conversation
  const getAssignmentStatus = () => {
    if (!activeConversation) return null
    // TODO: Once backend implements assignment, use real data
    // For now, return placeholder
    return {
      isAssigned: false, // activeConversation.assignedToId !== null
      assignedToCurrentUser: false, // activeConversation.assignedToId === user?.id
      assignedToName: null, // activeConversation.assignedTo?.name
    }
  }

  const assignmentStatus = getAssignmentStatus()

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
                setShowReportModal(true)
              }
            }}
          >
            <DropdownItem key="report" className="text-danger" color="danger">
              Report
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      {/* Messages Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {isLoadingMessages[activeConversationId || ''] ? (
          <MessageListSkeleton count={5} />
        ) : messagesError[activeConversationId || ''] ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-red-500 mb-2">
                {messagesError[activeConversationId || '']}
              </p>
              <Button
                size="sm"
                color="primary"
                onPress={() => activeConversationId && fetchMessages(activeConversationId)}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : enhancedMessages.length === 0 ? (
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
        ) : (
          <div className="space-y-4">
            {enhancedMessages.map(msg => (
              <EnhancedMessageBubble
                key={msg.id}
                message={msg}
                avatarSrc={avatarSrc}
                senderName={name}
                isAdminView={false}
                onRetry={messageId => retryFailedMessage(messageId)}
              />
            ))}

            {/* Show typing indicator if someone else is typing (not current user) */}
            {activeConversationId &&
              user &&
              (() => {
                const otherUsersTyping =
                  typingUsers[activeConversationId]?.filter(userId => userId !== user.id) || []
                return (
                  otherUsersTyping.length > 0 && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm px-4 py-3">
                        <TypingDots show={true} />
                      </div>
                    </div>
                  )
                )
              })()}
          </div>
        )}
      </div>

      {/* Chat Input */}
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
          placeholder="Type a message..."
          disabled={!isConnected || !user}
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

              <div className="space-y-2">
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
