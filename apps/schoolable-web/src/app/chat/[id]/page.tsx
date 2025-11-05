'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { getChatHistoryById } from '@/data/chat-history'
import type { ChatHistoryItem } from '@/types/chat'
import { Button } from '@heroui/react'

export default function ChatPage() {
  const params = useParams()
  const chatId = params.id as string
  const [chatData, setChatData] = useState<ChatHistoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (chatId) {
      // Fetch chat data based on ID
      const historyItem = getChatHistoryById(chatId)
      setChatData(historyItem ?? null)
      setIsLoading(false)
    }
  }, [chatId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (!chatData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Chat not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The chat you're looking for doesn't exist or has been deleted.
          </p>
          <Button
            size="lg"
            radius="full"
            color="primary"
            className="bg-primary-dark"
            onPress={() => window.history.back()}
          >
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return <ChatInterface chatId={chatId} initialChatData={chatData} />
}
