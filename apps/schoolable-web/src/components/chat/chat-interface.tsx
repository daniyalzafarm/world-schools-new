'use client'

import React, { useEffect, useRef } from 'react'
import { ScrollShadow } from '@heroui/react'
import { useChat } from '@/hooks/use-chat'
import { MessageList } from './message-bubble'
import { ChatInput } from './chat-input'
import { InitialSuggestions, SuggestionChips } from './suggestion-chips'
import { cn } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import type { ChatHistoryItem } from '@/types/chat'

interface ChatInterfaceProps {
  className?: string
  chatId?: string
  initialChatData?: ChatHistoryItem
}

export function ChatInterface({ className, chatId, initialChatData }: ChatInterfaceProps) {
  const {
    messages,
    input,
    suggestions,
    isLoading,
    hasMessages,
    sendMessage,
    handleSuggestion,
    setInput,
  } = useChat(chatId, initialChatData)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSuggestion(suggestion)
  }

  return (
    <div className={cn('flex flex-col h-full bg-white dark:bg-gray-900', className)}>
      {/* Main Content Area */}
      <div className="flex-1 pt-10 flex flex-col min-h-0">
        {!hasMessages ? (
          /* Initial State - No Messages */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full md:w-[80%] lg:w-[50%] space-y-4">
              {/* Logo */}
              <div className="text-center">
                <Logo size="lg" showText={true} className="justify-center" />
              </div>

              {/* Welcome Message */}
              {/* <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  How can I help you today?
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Ask me anything about schools, camps, or educational programs
                </p>
              </div> */}
              {/* Input Area */}
              {!hasMessages && (
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  disabled={isLoading}
                  helpText={false}
                  isLarge
                  className="mb-0"
                  placeholder={
                    hasMessages ? 'Ask a follow-up question...' : 'How can I help you today?'
                  }
                />
              )}
              {/* Initial Suggestions */}
              <InitialSuggestions
                suggestions={suggestions}
                onSuggestionClick={handleSuggestionClick}
                disabled={isLoading}
              />
            </div>
          </div>
        ) : (
          /* Active Chat State - With Messages */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages Area */}
            <ScrollShadow ref={scrollAreaRef} className="flex-1 px-6 py-4" hideScrollBar>
              <div className="w-full md:w-[80%] lg:w-[60%] mx-auto">
                <MessageList messages={messages} />

                {/* Loading indicator */}
                {/* {isLoading && (
                  <div className="flex items-start gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </div>
                    <div className="flex-1 max-w-[80%] lg:max-w-[70%]">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )} */}

                {/* Suggestions after messages */}
                {suggestions.length > 0 && (
                  <div className="mt-4">
                    <SuggestionChips
                      suggestions={suggestions}
                      onSuggestionClick={handleSuggestionClick}
                      disabled={isLoading}
                    />
                  </div>
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollShadow>
          </div>
        )}

        {/* Input Area */}
        {hasMessages && (
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isLoading}
            placeholder={hasMessages ? 'Ask a follow-up question...' : 'How can I help you today?'}
          />
        )}
      </div>
    </div>
  )
}
