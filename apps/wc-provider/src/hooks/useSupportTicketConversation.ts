import { useCallback, useEffect, useMemo, useState } from 'react'
import { globalWsService } from '@/lib/websocket-instance'
import { supportTicketsService } from '@/services/support-tickets.services'
import { useAuthStore } from '@/stores/auth-store'
import type { SupportTicketMessageResponse } from '@/types/support-tickets'

interface UseSupportTicketConversationOptions {
  ticketId: string
  conversationId?: string | null
}

export function useSupportTicketConversation({
  ticketId,
  conversationId,
}: UseSupportTicketConversationOptions) {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<SupportTicketMessageResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentUserId = user?.id ?? null

  const undeliveredIncomingIds = useMemo(() => {
    if (!currentUserId) return []
    return messages
      .filter(m => m.senderId !== currentUserId && !m.deliveredAt)
      .slice(-20)
      .map(m => m.id)
  }, [messages, currentUserId])

  const loadInitial = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await supportTicketsService.getConversation(ticketId, { limit: 100 })
      if (res.success) {
        setMessages(res.data.data)
      } else {
        setMessages([])
      }
    } catch {
      setError('Failed to load conversation.')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (!ticketId) return
    void loadInitial()
  }, [ticketId, loadInitial])

  useEffect(() => {
    if (!conversationId) return
    if (!globalWsService.isConnected()) return

    globalWsService.emit('join_conversation', { conversationId })
    return () => {
      globalWsService.emit('leave_conversation', { conversationId })
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    if (!currentUserId) return
    if (!globalWsService.isConnected()) return

    // Mark last few incoming messages as delivered (so reload shows Delivered)
    for (const messageId of undeliveredIncomingIds) {
      globalWsService.emit('message:delivered', { messageId, conversationId })
    }
  }, [conversationId, currentUserId, undeliveredIncomingIds])

  useEffect(() => {
    if (!ticketId) return

    const ws = globalWsService

    const handleNewMessage = (payload: { message: any }) => {
      const msg = payload.message
      if (msg?.conversationId == null) return
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      // Immediately mark incoming messages delivered
      if (conversationId && currentUserId && msg.senderId && msg.senderId !== currentUserId) {
        ws.emit('message:delivered', { messageId: msg.id, conversationId })
      }
    }

    const handleDeliveredReceipt = (data: {
      messageId: string
      conversationId?: string
      deliveredAt?: string
    }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                status: (m.status === 'READ' ? m.status : 'DELIVERED') as any,
                deliveredAt: m.deliveredAt ?? data.deliveredAt ?? new Date().toISOString(),
              }
            : m
        )
      )
    }

    const handleReadReceipt = (data: {
      messageId: string
      conversationId?: string
      readAt?: string
    }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                status: 'READ' as any,
                readAt: m.readAt ?? data.readAt ?? new Date().toISOString(),
              }
            : m
        )
      )
    }

    const unsubNew = ws.on('message:new', handleNewMessage)
    const unsubDelivered = ws.on('receipt:delivered', handleDeliveredReceipt)
    const unsubRead = ws.on('receipt:read', handleReadReceipt)

    return () => {
      unsubNew()
      unsubDelivered()
      unsubRead()
    }
  }, [ticketId, conversationId, currentUserId])

  const sendReply = useCallback(
    async (content: string) => {
      if (!ticketId || !content.trim()) return
      const res = await supportTicketsService.addReply(ticketId, { content })
      if (!res.success) return
      const created = res.data
      setMessages(prev => {
        if (prev.find(m => m.id === created.id)) return prev
        return [...prev, created]
      })
    },
    [ticketId]
  )

  return {
    messages,
    isLoading,
    error,
    sendReply,
  }
}
