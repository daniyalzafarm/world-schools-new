'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatHistoryItem, Message, StreamingOptions, SuggestionSets } from '@/types/chat'

const SUGGESTION_SETS: SuggestionSets = {
  initial: ['IB Schools in USA', 'Soccer Camps in USA', 'Best Camps in USA', 'Bilingual Schools'],
  curriculum: ['Boarding Schools', 'Online Schools', 'Day Schools', 'Private Schools'],
}

export function useChat(chatId?: string, initialChatData?: ChatHistoryItem) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTION_SETS.initial)
  const [isLoading, setIsLoading] = useState(false)
  const [chatTitle, setChatTitle] = useState<string>()

  const idCounterRef = useRef(1)
  const streamingTimeoutRef = useRef<NodeJS.Timeout>(null)

  const nextId = useCallback(() => `${Date.now()}-${idCounterRef.current++}`, [])

  // Initialize with existing chat data if provided
  useEffect(() => {
    if (initialChatData && chatId) {
      setMessages(initialChatData.messages || [])
      setChatTitle(initialChatData.title)
      // Set suggestions based on the last message or default
      setSuggestions(SUGGESTION_SETS.initial)
    }
  }, [chatId, initialChatData])

  const hasMessages = messages.length > 0

  const appendMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message])
  }, [])

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => (msg.id === id ? { ...msg, ...updates } : msg)))
  }, [])

  const streamMessage = useCallback(
    (fullText: string, messageId: string, options: StreamingOptions = {}) => {
      const { onComplete, speed = 20 } = options
      let currentIndex = 0

      const streamNextChar = () => {
        if (currentIndex < fullText.length) {
          currentIndex++
          updateMessage(messageId, {
            text: fullText.slice(0, currentIndex),
            isStreaming: true,
          })

          streamingTimeoutRef.current = setTimeout(streamNextChar, speed)
        } else {
          updateMessage(messageId, { isStreaming: false })
          if (onComplete) {
            onComplete()
          }
        }
      }

      streamNextChar()
    },
    [updateMessage]
  )

  const generateAIResponse = useCallback(
    (userText: string) => {
      setSuggestions([])
      setIsLoading(true)

      // Generate chat title from first message
      if (!chatTitle && userText.trim()) {
        const title = userText.length > 50 ? `${userText.slice(0, 47)}...` : userText
        setChatTitle(title)
      }

      // Determine next suggestions based on user input
      const lower = userText.toLowerCase()
      const nextSuggestions =
        lower.includes('curriculum') ||
        lower.includes('us') ||
        lower.includes('ib') ||
        lower.includes('school')
          ? SUGGESTION_SETS.curriculum
          : SUGGESTION_SETS.initial

      // Simulate AI response
      const responses = [
        `Thanks! I noted: "${userText}". Here are some additional options you might want to specify to narrow the results further.`,
        `Great choice! Based on your interest in "${userText}", I can help you explore more specific options. What would you like to focus on next?`,
        `Perfect! I understand you're looking for information about "${userText}". Let me suggest some related areas that might interest you.`,
      ]

      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      const messageId = nextId()

      appendMessage({
        id: messageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        isStreaming: true,
      })

      // Stream the response
      streamMessage(randomResponse, messageId, {
        onComplete: () => {
          setSuggestions(nextSuggestions)
          setIsLoading(false)
        },
      })
    },
    [chatTitle, nextId, appendMessage, streamMessage]
  )

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return
      setSuggestions([])

      const userMessage: Message = {
        id: nextId(),
        text: text.trim(),
        isUser: true,
        timestamp: new Date(),
      }

      appendMessage(userMessage)
      setInput('')

      // For existing chats, we can continue the conversation
      // Generate AI response after a short delay
      setTimeout(() => {
        generateAIResponse(text.trim())
      }, 500)
    },
    [isLoading, nextId, appendMessage, generateAIResponse]
  )

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion)
    },
    [sendMessage]
  )

  const clearChat = useCallback(() => {
    if (initialChatData && chatId) {
      // For existing chats, reset to original state
      setMessages(initialChatData.messages || [])
      setChatTitle(initialChatData.title)
      setSuggestions(SUGGESTION_SETS.initial)
    } else {
      // For new chats, clear everything
      setMessages([])
      setChatTitle(undefined)
      setSuggestions(SUGGESTION_SETS.initial)
    }

    setInput('')
    setIsLoading(false)

    // Clear any ongoing streaming
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current)
    }
  }, [initialChatData, chatId])

  return {
    // State
    messages,
    input,
    suggestions,
    isLoading,
    chatTitle,
    hasMessages,

    // Actions
    sendMessage,
    handleSuggestion,
    setInput,
    clearChat,
    streamMessage,
  }
}
