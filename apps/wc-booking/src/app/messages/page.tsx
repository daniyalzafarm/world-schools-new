'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
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
  ChatInput,
  type Conversation,
  DEFAULT_REPORT_REASONS,
  type Message,
  type ReportReason,
  Textarea,
} from '@world-schools/ui-web'
import { Circle, MessageSquare, MoreVertical, Users } from 'lucide-react'
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

// Extended message type for our use case
type Msg = Message & {
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
}

const avatarMap: Record<string, string> = {
  'school-1': '/assets/school-1.jpg',
  'school-2': '/assets/school-2.jpg',
  'school-3': '/assets/school-3.jpg',
}

export default function MessagesPage() {
  const pathname = usePathname()
  const router = useRouter()

  // Detect if we're on the archived route (includes both /messages/archived and /messages/archived/[id])
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
    draftConversation,
    fetchConversations,
    setActiveConversation,
    fetchMessages,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    retryFailedMessage,
    removeFailedMessage,
    createConversationWithMessage,
    clearDraftConversation,
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

  // Handle transfer to admin (TODO: Implement with real API)
  const handleTransferToAdmin = () => {
    console.log('Transfer to admin requested for conversation:', activeConversationId)
    // TODO: Implement transfer functionality with backend API
  }

  const handleSend = async () => {
    const text = input.trim()
    // ✅ Only check for text and user - allow sending without activeConversationId for draft conversations
    if (!text || !user) {
      return
    }

    // Clear input immediately for better UX
    setInput('')

    // ✅ WhatsApp Web pattern: If draft conversation exists, create conversation with first message
    if (draftConversation && !activeConversationId) {
      try {
        const conversation = await createConversationWithMessage({
          userId: user.id,
          participantId: draftConversation.providerId,
          participantType: draftConversation.participantType,
          contextType: draftConversation.contextType,
          contextId: draftConversation.contextId,
          initialMessage: text,
        })

        // Conversation is now created and set as active by the store
        // Draft is automatically cleared by createConversationWithMessage
        console.log('Conversation created with first message:', conversation.id)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        // Restore input on error
        setInput(text)
      }
      return
    }

    // Normal message send for existing conversation
    if (!activeConversationId) {
      return
    }

    // Stop typing indicator
    stopTyping(activeConversationId)

    // Send message via store (with optimistic update)
    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'USER' as SenderType,
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

    // For USER_SUPERADMIN conversations, show "Support Team"
    if (activeConversation.type === 'USER_SUPERADMIN') {
      return 'World Camps Support'
    }

    // For USER_PROVIDER conversations, get provider name from participants
    // Filter out current user to get the "other" participant
    const otherParticipants =
      activeConversation.participants?.filter(p => p.userId !== user?.id) ?? []
    const providerParticipant = otherParticipants.find(p => p.providerId)
    return providerParticipant?.provider?.legalCompanyName || 'Provider'
  }

  const name = getConversationName()
  const avatarSrc = undefined // No real avatar yet - Avatar component will show initials from name

  // Check if conversation is with superadmin
  const isSuperadminConversation = activeConversation?.type === 'USER_SUPERADMIN'

  // Main content - conversation view, draft conversation, or empty state
  const mainContent =
    !activeConversation && !draftConversation ? (
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
    ) : !activeConversation && draftConversation ? (
      // ✅ WhatsApp Web pattern: Show draft conversation UI
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        {/* Chat Header for Draft */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={draftConversation.providerName} size="md" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {draftConversation.providerName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {draftConversation.contextName
                  ? `About: ${draftConversation.contextName}`
                  : 'New conversation'}
              </p>
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
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar src={avatarSrc} name={name} size="md" />
              {/* Presence indicator */}
              <PresenceIndicator status={presenceStatus} position="bottom-right" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isArchivedPage
                  ? `${name} (Archived)`
                  : presenceStatus === 'ONLINE'
                    ? 'Online'
                    : presenceStatus === 'AWAY'
                      ? 'Away'
                      : isSuperadminConversation
                        ? 'Support Team'
                        : 'Provider'}
              </p>
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
                if (key === 'transfer') {
                  handleTransferToAdmin()
                } else if (key === 'report') {
                  setShowReportModal(true)
                }
              }}
            >
              {!isSuperadminConversation ? (
                <DropdownItem key="transfer" startContent={<Users size={16} />}>
                  Transfer to Representative
                </DropdownItem>
              ) : null}
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

  // Main content is now wrapped by MessagesMainLayout which includes both sidebars
  return <div className="h-full bg-white dark:bg-gray-900">{mainContent}</div>
}
