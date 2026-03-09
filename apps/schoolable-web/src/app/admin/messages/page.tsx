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
import { cn, Textarea } from '@world-schools/ui-web'
import { ArrowUp, MessageSquare, MoreVertical, Users } from 'lucide-react'
import type { Conversation } from '@/types/conversation'
import type { Message } from '@/types/chat'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { AdminMessagesLayout } from '@/components/layout/admin-messages-layout'
import { UserPreferencesSidebar } from '@/components/layout/user-preferences-sidebar'

// Extended message type for admin view
type Msg = Message & {
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
  isAdmin?: boolean
}

type ReportReason = {
  id: string
  label: string
}

// Direct port of mobile constants
const reportReasons: ReportReason[] = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam or unwanted messages' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'scam', label: 'Scam or fraud' },
  { id: 'other', label: 'Other' },
]

const avatarMap: Record<string, string> = {
  'child-1': '/assets/child-1.jpg',
  'child-2': '/assets/child-2.jpg',
  'school-1': '/assets/school-1.jpg',
  'school-2': '/assets/school-2.jpg',
  'school-3': '/assets/school-3.jpg',
}

export default function AdminMessagesPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  // Detect if we're on the archived route
  const isArchivedPage = pathname === '/admin/messages/archived'

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [hasTransferSummary, setHasTransferSummary] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idCounterRef = useRef(1)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [reportComment, setReportComment] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // User preferences sidebar state
  const [showUserPreferences, setShowUserPreferences] = useState(false)

  // Utility functions
  const nextId = () => `${Date.now()}-${idCounterRef.current++}`

  const handleBack = () => {
    if (isArchivedPage) {
      router.push('/admin/messages')
    } else {
      router.push('/admin/messages')
      setSelectedConversation(null)

      if (window.innerWidth < 1024) {
        window.dispatchEvent(new CustomEvent('showMessagesSidebar'))
      }
    }
  }

  const appendMessage = (msg: Msg) => setMessages(prev => [...prev, msg])

  // Load conversation history including chatbot messages
  const loadConversationHistory = (_conversationId: string) => {
    // In a real implementation, this would fetch from the database
    // For now, we'll simulate a conversation that was transferred from chatbot

    const mockHistory: Msg[] = [
      {
        id: 'chatbot-1',
        text: 'Hi there! Thanks for reaching out. How can we help you?',
        isUser: false,
        isChatbot: true,
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      },
      {
        id: 'user-1',
        text: 'I have a question about your summer camp program.',
        isUser: true,
        timestamp: new Date(Date.now() - 280000),
      },
      {
        id: 'chatbot-2',
        text: 'I understand your question. Let me help you with that.',
        isUser: false,
        isChatbot: true,
        timestamp: new Date(Date.now() - 260000),
      },
      {
        id: 'user-2',
        text: 'What are the dates and costs?',
        isUser: true,
        timestamp: new Date(Date.now() - 240000),
      },
      {
        id: 'chatbot-3',
        text: "That's a great question! Here's what I can tell you...",
        isUser: false,
        isChatbot: true,
        timestamp: new Date(Date.now() - 220000),
      },
      {
        id: 'user-3',
        text: "I'd like to speak with a human representative, please.",
        isUser: true,
        isTransferRequest: true,
        timestamp: new Date(Date.now() - 200000),
      },
      {
        id: 'chatbot-4',
        text: "I understand you'd like to speak with a human representative. I'm transferring you to our support team now. Please wait a moment...",
        isUser: false,
        isChatbot: true,
        timestamp: new Date(Date.now() - 180000),
      },
      {
        id: 'transfer-summary',
        text: `Conversation Summary:

User Inquiries: I have a question about your summer camp program. | What are the dates and costs?
Chatbot Responses: I understand your question. Let me help you with that. | That's a great question! Here's what I can tell you...

Total Messages: 7
User Messages: 3
Chatbot Messages: 3

Transfer Request: User requested to speak with a human representative.`,
        isUser: false,
        isTransferSummary: true,
        timestamp: new Date(Date.now() - 160000),
      },
    ]

    setMessages(mockHistory)
    setHasTransferSummary(true)
  }

  const handleSend = (text: string) => {
    if (!text.trim()) {
      return
    }
    const adminMsg: Msg = {
      id: nextId(),
      text: text.trim(),
      isUser: false,
      isAdmin: true,
      timestamp: new Date(),
    }
    appendMessage(adminMsg)
    setInput('')
  }

  // Direct port of mobile report handlers
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

      // Show success feedback (you could add a toast notification here)
      // Report submitted successfully
    } catch {
      // Failed to submit report - handle error (you could show an error message here)
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const handleCancelReport = () => {
    setSelectedReasons([])
    setReportComment('')
    setShowReportModal(false)
  }

  // Listen for conversation selection events from the sidebar
  useEffect(() => {
    const handleSelectConversation = (event: CustomEvent<Conversation>) => {
      const conversation = event.detail

      // Filter conversations based on current route
      if (isArchivedPage && !conversation.archived) {
        return
      }
      if (!isArchivedPage && conversation.archived) {
        return
      }

      setSelectedConversation(conversation)

      // Update URL to reflect the selected conversation
      if (!isArchivedPage) {
        router.push(`/admin/messages/${conversation.id}`)
      }

      // Load conversation history including chatbot messages
      loadConversationHistory(conversation.id)
    }

    window.addEventListener('selectConversation', handleSelectConversation as EventListener)

    return () => {
      window.removeEventListener('selectConversation', handleSelectConversation as EventListener)
    }
  }, [isArchivedPage, router])

  // Auto-scroll to bottom when messages change - direct port from mobile
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Trigger handleBack on Escape key when a conversation is open
  useEffect(() => {
    if (!selectedConversation) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedConversation, isArchivedPage])

  // Get conversation details for display - matching mobile logic exactly
  const name = selectedConversation?.name || 'User'
  const avatarSrc =
    selectedConversation?.avatar && avatarMap[String(selectedConversation.avatar)]
      ? avatarMap[String(selectedConversation.avatar)]
      : '/assets/school-1.jpg'
  const profileData = selectedConversation?.userProfileData ?? null

  return (
    <ProtectedRoute requireAuth={true} requireAdmin={true}>
      <AdminMessagesLayout>
        {selectedConversation ? (
          <div
            className={`flex flex-col h-full bg-white dark:bg-gray-900 ${showUserPreferences ? 'mr-96' : ''}`}
          >
            {/* Header - Matching Chat New layout structure */}
            <div className="h-20 pr-16 pl-14 w-full flex self-center items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/50">
              {/* Left Section */}
              <div
                className="flex pl-2 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 items-center gap-3 min-w-0 flex-1 cursor-pointer"
                onClick={() => setShowUserPreferences(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') setShowUserPreferences(true)
                }}
              >
                <Avatar src={avatarSrc} alt={name} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {name}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {isArchivedPage ? `${name} (Archived)` : 'User'}
                  </p>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-2 shrink-0">
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      radius="full"
                      variant="light"
                      size="sm"
                      aria-label="More options"
                    >
                      <MoreVertical size={20} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Message options"
                    onAction={key => {
                      if (key === 'report') {
                        setShowReportModal(true)
                      }
                    }}
                  >
                    <DropdownItem key="report">Report Issue</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>

            {/* Messages Container - Matching Chat New layout structure */}
            <div className="flex-1 flex flex-col min-h-0">
              <div ref={scrollRef} className="flex-1 py-4 overflow-y-auto">
                <div className="w-full px-16 mx-auto">
                  <div className="space-y-4">
                    {messages.map(m => (
                      <div key={m.id}>
                        {/* User messages and transfer summary - shown on LEFT in admin view */}
                        {m.isUser || m.isTransferSummary ? (
                          <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
                            <div className="shrink-0">
                              <Avatar
                                src={m.isTransferSummary ? '/assets/avatar.png' : avatarSrc}
                                alt={m.isTransferSummary ? 'System' : name}
                                size="sm"
                                className="w-8 h-8"
                              />
                            </div>
                            <div className="max-w-[80%] lg:max-w-[60%]">
                              <div
                                className={cn(
                                  'rounded-2xl rounded-bl-md px-4 py-3 shadow-sm',
                                  m.isTransferSummary
                                    ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                                    : m.isTransferRequest
                                      ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                                      : 'bg-primary-100 text-primary-dark'
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {m.isTransferSummary ? 'Transfer Summary' : name}
                                  </span>
                                  {m.isTransferRequest && (
                                    <div className="flex gap-1 items-center">
                                      <Users className="w-3 h-3 text-orange-600" />
                                      <span className="text-xs bg-orange-100 text-orange-700 py-1 rounded-full">
                                        Transfer Request
                                      </span>
                                    </div>
                                  )}
                                  {m.isTransferSummary && (
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                      System
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-gray-100">
                                  {m.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Chatbot and admin messages - shown on RIGHT in admin view */
                          <div className="flex justify-end mb-4 animate-in slide-in-from-right-2 duration-300">
                            <div className="max-w-[80%] lg:max-w-[60%]">
                              <div
                                className={cn(
                                  'rounded-2xl rounded-br-md px-4 py-3 shadow-sm',
                                  m.isChatbot
                                    ? 'bg-gray-100 dark:bg-gray-800'
                                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {m.isChatbot ? 'AI Assistant' : 'You'}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-gray-100">
                                  {m.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Scroll anchor */}
                  <div />

                  {/* Conversation history indicator */}
                  {hasTransferSummary && (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Full conversation history visible
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Bar - Using ChatInput component */}
              <div className="sticky bottom-0 bg-white dark:bg-gray-900/95 backdrop-blur-md pb-4">
                <div className="w-full px-16 mx-auto">
                  <div className="relative max-h-40 flex items-end gap-3 bg-white shadow dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2">
                    <Textarea
                      value={input}
                      onValueChange={setInput}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (input.trim()) {
                            handleSend(input)
                          }
                        }
                      }}
                      placeholder="Type your response..."
                      minRows={1}
                      maxRows={6}
                      classNames={{
                        base: 'flex-1',
                        input: cn(
                          'resize-none bg-transparent border-0 focus:ring-0 text-sm',
                          'placeholder:text-gray-500 dark:placeholder:text-gray-400',
                          'text-gray-900 dark:text-gray-100'
                        ),
                        inputWrapper:
                          'p-0 px-4 bg-transparent shadow-none border-0 group-data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent focus-within:bg-transparent',
                      }}
                    />

                    <Button
                      isIconOnly
                      size="sm"
                      onPress={() => handleSend(input)}
                      isDisabled={input.trim().length === 0}
                      className={cn(
                        'w-8 h-8 rounded-full shrink-0 transition-all duration-200',
                        input.trim().length > 0
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      )}
                      aria-label="Send message"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Helper text */}
                  <div className="text-xs text-secondary mt-2 text-center space-y-1">
                    <p>Press Enter to send, Shift+Enter for new line</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* No Conversation Selected */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 mx-auto">
                <MessageSquare size={32} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {isArchivedPage ? 'Select an archived conversation' : 'Select a conversation'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {isArchivedPage
                  ? 'Choose an archived conversation from the sidebar to view messages'
                  : 'Choose a user conversation from the sidebar to start responding'}
              </p>
            </div>
          </div>
        )}

        {/* Report Modal - Direct port from mobile */}
        <Modal
          isOpen={showReportModal}
          onClose={handleCancelReport}
          size="lg"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader>Report User</ModalHeader>
            <ModalBody className="py-0">
              <p className="opacity-70 text-gray-600 dark:text-gray-400">
                Help us understand what&apos;s happening. Select all that apply:
              </p>

              <div className="max-h-[300px] overflow-y-auto px-2">
                {/* Report Reasons */}
                <div className="mb-4">
                  {reportReasons.map(reason => (
                    <div
                      key={reason.id}
                      className={cn(
                        'flex flex-row items-center py-1 px-2 rounded-lg mb-2 cursor-pointer',
                        selectedReasons.includes(reason.id)
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                      onClick={() => handleReportReasonToggle(reason.id)}
                    >
                      <Checkbox
                        isSelected={selectedReasons.includes(reason.id)}
                        onValueChange={() => handleReportReasonToggle(reason.id)}
                      />
                      <span className="flex-1 ml-2 text-gray-900 dark:text-gray-100">
                        {reason.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Additional Comments */}
                <div className="mb-4">
                  <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Additional details (optional)
                  </h4>
                  <Textarea
                    value={reportComment}
                    onValueChange={setReportComment}
                    placeholder="Provide more context about your report..."
                    maxRows={4}
                    maxLength={500}
                    className="w-full"
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="primary"
                radius="full"
                onPress={handleSubmitReport}
                isDisabled={selectedReasons.length === 0 || isSubmittingReport}
                isLoading={isSubmittingReport}
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* User Preferences Sidebar */}
        <UserPreferencesSidebar
          isOpen={showUserPreferences}
          onClose={() => setShowUserPreferences(false)}
          profileData={profileData}
          avatarUrl={avatarSrc}
        />
      </AdminMessagesLayout>
    </ProtectedRoute>
  )
}
