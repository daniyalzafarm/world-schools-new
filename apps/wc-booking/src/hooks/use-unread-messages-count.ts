import { useCallback, useEffect, useRef, useState } from 'react'
import { conversationsService, messagingWebSocket } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'

export function useUnreadMessagesCount(): number {
  const [count, setCount] = useState(0)
  const user = useAuthStore(s => s.user)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCount = useCallback(async () => {
    if (!user?.id) return
    const result = await conversationsService.getUnreadCount()
    if (result.success) {
      setCount(result.data.count)
    }
  }, [user?.id])

  const debouncedFetch = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(fetchCount, 1500)
  }, [fetchCount])

  useEffect(() => {
    void fetchCount()

    const unsubMessage = messagingWebSocket.onMessageNew(() => debouncedFetch())
    const unsubRead = messagingWebSocket.onReadReceipt(() => debouncedFetch())
    const unsubConversation = messagingWebSocket.onConversationNew(() => debouncedFetch())

    return () => {
      unsubMessage()
      unsubRead()
      unsubConversation()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchCount, debouncedFetch])

  return count
}
