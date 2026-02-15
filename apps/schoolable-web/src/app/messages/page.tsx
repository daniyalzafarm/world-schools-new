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
import { ChatInput } from '@/components/chat/chat-input'
import { SchoolDetailSidebar } from '@/components/layout/school-detail-sidebar'
import { MessageSquare, MoreVertical, Users } from 'lucide-react'
import type { Conversation } from '@/types/conversation'
import type { Message } from '@/types/chat'

// Extended message type for our use case
type Msg = Message & {
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
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
  'school-1': '/assets/school-1.jpg',
  'school-2': '/assets/school-2.jpg',
  'school-3': '/assets/school-3.jpg',
}

export default function MessagesPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  // Detect if we're on the archived route
  const isArchivedPage = pathname === '/messages/archived'

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isTransferredToAdmin, setIsTransferredToAdmin] = useState(false)
  const [isWaitingForAdmin, setIsWaitingForAdmin] = useState(false)
  const [showSchoolSidebar, setShowSchoolSidebar] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idCounterRef = useRef(1)

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [reportComment, setReportComment] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Utility functions
  const nextId = () => `${Date.now()}-${idCounterRef.current++}`

  // Note: handleBack helper remains for parity with admin page though not used here
  const _handleBack = () => {
    router.push('/messages')
    setSelectedConversation(null)
    if (window.innerWidth < 1024) {
      window.dispatchEvent(new CustomEvent('showMessagesSidebar'))
    }
  }

  const appendMessage = (msg: Msg) => setMessages(prev => [...prev, msg])

  // Generate conversation summary for admin
  const generateConversationSummary = (_messages: Msg[]): string => {
    const userMessages = messages.filter(m => m.isUser && !m.isTransferRequest)
    const chatbotMessages = messages.filter(m => !m.isUser && m.isChatbot)

    const keyTopics = userMessages.map(m => m.text).join(' | ')
    const chatbotResponses = chatbotMessages.map(m => m.text).join(' | ')

    return `Conversation Summary:
    
User Inquiries: ${keyTopics}
Chatbot Responses: ${chatbotResponses}

Total Messages: ${messages.length}
User Messages: ${userMessages.length}
Chatbot Messages: ${chatbotMessages.length}

Transfer Request: User requested to speak with a human representative.`
  }

  // Handle transfer to admin
  const handleTransferToAdmin = () => {
    if (isTransferredToAdmin) return

    // Add transfer request message (visible to user)
    const transferRequest: Msg = {
      id: nextId(),
      text: "I'd like to speak with a human representative, please.",
      isUser: true,
      isTransferRequest: true,
      timestamp: new Date(),
    }
    appendMessage(transferRequest)

    // Add chatbot acknowledgment (visible to user)
    const chatbotResponse: Msg = {
      id: nextId(),
      text: "I understand you'd like to speak with a human representative. I'm transferring you to our support team now. Please wait a moment...",
      isUser: false,
      isChatbot: true,
      timestamp: new Date(),
    }
    appendMessage(chatbotResponse)

    // Generate and send summary to admin (not visible to user)
    const summary = generateConversationSummary(messages)
    const summaryMessage: Msg = {
      id: nextId(),
      text: summary,
      isUser: false,
      isTransferSummary: true,
      timestamp: new Date(),
    }

    // Send to admin (this would be an API call in real implementation)
    console.warn('Sending to admin:', summaryMessage)

    // Update conversation status
    setIsTransferredToAdmin(true)
    setIsWaitingForAdmin(true)

    // Simulate admin taking over
    setTimeout(() => {
      const adminMessage: Msg = {
        id: nextId(),
        text: `Hello! I'm from ${name}, from our support team. I can see you've been chatting with our AI assistant. How can I help you today?`,
        isUser: false,
        isChatbot: false,
        timestamp: new Date(),
      }
      appendMessage(adminMessage)
      setIsWaitingForAdmin(false)
    }, 2000)
  }

  // Check if message contains transfer request
  const checkForTransferRequest = (_text: string): boolean => {
    const transferKeywords = [
      'human',
      'representative',
      'agent',
      'person',
      'real person',
      'speak to someone',
      'talk to someone',
      'transfer',
      'connect me',
      'help me',
      'support',
    ]
    return transferKeywords.some(keyword => _text.toLowerCase().includes(keyword.toLowerCase()))
  }

  // Generate chatbot response
  const generateChatbotResponse = (_userMessage: string): string => {
    const responses = [
      'I understand your question. Let me help you with that.',
      "That's a great question! Here's what I can tell you...",
      'I can help you with that. Let me provide some information...',
      "Thanks for asking! Here's what you need to know...",
      "I'd be happy to help you with that question.",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const handleSend = (text: string) => {
    if (!text.trim()) {
      return
    }

    const userMsg: Msg = {
      id: nextId(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    }
    appendMessage(userMsg)
    setInput('')

    // Check if user wants to transfer to admin
    if (checkForTransferRequest(text.trim()) && !isTransferredToAdmin) {
      setTimeout(() => {
        handleTransferToAdmin()
      }, 500)
      return
    }

    // If already transferred to admin, simulate admin response
    if (isTransferredToAdmin && !isWaitingForAdmin) {
      setTimeout(() => {
        const adminResponse: Msg = {
          id: nextId(),
          text: "Thank you for your message. I'm looking into this for you and will get back to you shortly.",
          isUser: false,
          isChatbot: false,
          timestamp: new Date(),
        }
        appendMessage(adminResponse)
      }, 1000)
      return
    }

    // Generate chatbot response
    setTimeout(() => {
      const chatbotResponse: Msg = {
        id: nextId(),
        text: generateChatbotResponse(text.trim()),
        isUser: false,
        isChatbot: true,
        timestamp: new Date(),
      }
      appendMessage(chatbotResponse)
    }, 400)
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
        router.push(`/messages/${conversation.id}`)
      }

      // Reset messages and add initial chatbot greeting
      setMessages([
        {
          id: 'sys-1',
          text: 'Hi there! Thanks for reaching out. How can we help you?',
          isUser: false,
          isChatbot: true,
          timestamp: new Date(),
        },
      ])

      // Reset transfer state
      setIsTransferredToAdmin(false)
      setIsWaitingForAdmin(false)
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

  // Get conversation details for display - matching mobile logic exactly
  const name = selectedConversation?.name || 'School Name'
  const avatarSrc =
    selectedConversation?.avatar && avatarMap[String(selectedConversation.avatar)]
      ? avatarMap[String(selectedConversation.avatar)]
      : '/assets/school-1.jpg'

  return (
    <>
      {selectedConversation ? (
        <div
          className={`flex flex-col h-full bg-white dark:bg-gray-900 ${showSchoolSidebar ? 'mr-96' : ''}`}
        >
          {/* Header - Matching Admin Messages layout structure */}
          <div className="h-20 pr-16 pl-14 w-full flex self-center items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/50">
            {/* Left Section */}
            <div
              className="flex pl-2 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 items-center gap-3 min-w-0 flex-1 cursor-pointer"
              onClick={() => setShowSchoolSidebar(true)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowSchoolSidebar(true)
                }
              }}
            >
              <Avatar src={avatarSrc} alt={name} className="h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {selectedConversation?.name || 'School'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {isArchivedPage
                    ? `${selectedConversation?.name || 'School'} (Archived)`
                    : 'School'}
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
                    if (key === 'transfer') {
                      handleTransferToAdmin()
                    } else if (key === 'report') {
                      setShowReportModal(true)
                    }
                  }}
                >
                  <DropdownItem key="transfer">Transfer to Representative</DropdownItem>
                  <DropdownItem key="report">Report</DropdownItem>
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
                      {!m.isUser ? (
                        <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
                          <div className="shrink-0">
                            <Avatar
                              src={m.isChatbot ? avatarSrc : '/assets/avatar.png'}
                              alt={m.isChatbot ? name : 'Admin'}
                              size="sm"
                              className="w-8 h-8"
                            />
                          </div>
                          <div className="max-w-[80%] lg:max-w-[60%]">
                            <div
                              className={cn(
                                'rounded-2xl rounded-bl-md px-4 py-3 shadow-sm',
                                m.isChatbot
                                  ? 'bg-gray-100 dark:bg-gray-800'
                                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {m.isChatbot ? 'AI Assistant' : 'Representative'}
                                </span>
                                {m.isTransferSummary && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                    Transfer Summary
                                  </span>
                                )}
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                                {m.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end mb-4 animate-in slide-in-from-right-2 duration-300">
                          <div className="max-w-[80%] lg:max-w-[60%]">
                            <div
                              className={cn(
                                'rounded-2xl rounded-br-md px-4 py-3 shadow-sm',
                                m.isTransferRequest
                                  ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                                  : 'bg-primary-100 text-primary-dark'
                              )}
                            >
                              {m.isTransferRequest && (
                                <div className="flex items-center gap-2 mb-1">
                                  <Users size={12} className="text-orange-600" />
                                  <span className="text-xs font-medium text-orange-700">
                                    Transfer Request
                                  </span>
                                </div>
                              )}
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
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

                {/* Transfer waiting indicator */}
                {isWaitingForAdmin && (
                  <div className="flex items-center justify-center gap-2 py-4 text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-sm">Transferring to human representative...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Input Bar - Using ChatInput component */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend(input)}
              placeholder="Ask anything"
              disabled={false}
              helpText={true}
              className="pb-4"
              fullWidth={true}
            />
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
                : 'Choose a conversation from the sidebar to start messaging'}
            </p>
          </div>
        </div>
      )}

      {/* School Detail Sidebar for user view */}
      <SchoolDetailSidebar
        isOpen={showSchoolSidebar}
        onClose={() => setShowSchoolSidebar(false)}
        schoolName={selectedConversation?.name}
        avatarUrl={avatarSrc}
        verified={selectedConversation?.verified}
        conversationId={selectedConversation?.id}
      />

      {/* Report Modal - Direct port from mobile */}
      <Modal
        isOpen={showReportModal}
        onClose={handleCancelReport}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Report Conversation</ModalHeader>
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
    </>
  )
}
