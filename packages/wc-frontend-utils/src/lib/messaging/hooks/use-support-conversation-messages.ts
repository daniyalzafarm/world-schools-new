import { useCallback, useEffect, useMemo, useState } from 'react'
import { WsClientEvent, WsServerEvent } from '@world-schools/wc-types'
import type { GlobalWebSocketService } from '../../websocket/create-websocket-service'

export interface SupportMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  status?: string
  deliveredAt?: string | null
  readAt?: string | null
}

interface UseSupportConversationMessagesOptions<TMessage extends SupportMessage> {
  ticketId: string
  conversationId?: string | null
  currentUserId?: string | null
  wsService: GlobalWebSocketService
  /** Load initial messages for the ticket */
  getConversation: (ticketId: string) => Promise<TMessage[]>
  /** Persist a reply and return the created message */
  addReply: (
    ticketId: string,
    data: { content: string; attachmentIds?: string[] }
  ) => Promise<TMessage | null>
}

/**
 * Shared WebSocket subscription logic for support ticket conversations.
 *
 * Handles:
 *  - Initial message loading via REST
 *  - Join/leave conversation room on WebSocket
 *  - Auto-marking incoming messages as delivered
 *  - Subscribing to `message:new`, `receipt:delivered`, `receipt:read`
 *  - `sendReply` that appends optimistically to local state
 *
 * Used by `useSupportTicketConversation` in wc-booking and wc-provider.
 * The wc-superadmin variant extends this with ticket status and sound alerts.
 */
export function useSupportConversationMessages<TMessage extends SupportMessage>({
  ticketId,
  conversationId,
  currentUserId,
  wsService,
  getConversation,
  addReply,
}: UseSupportConversationMessagesOptions<TMessage>) {
  const [messages, setMessages] = useState<TMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const undeliveredIncomingIds = useMemo(() => {
    if (!currentUserId) return []
    return messages
      .filter(m => m.senderId !== currentUserId && !m.deliveredAt)
      .slice(-20)
      .map(m => m.id)
  }, [messages, currentUserId])

  // Load initial messages
  useEffect(() => {
    if (!ticketId) return
    setIsLoading(true)
    setError(null)
    getConversation(ticketId)
      .then(data => setMessages(data))
      .catch(() => {
        setError('Failed to load conversation.')
        setMessages([])
      })
      .finally(() => setIsLoading(false))
  }, [ticketId, getConversation])

  // Join / leave conversation room
  useEffect(() => {
    if (!conversationId || !wsService.isConnected()) return
    wsService.emit(WsClientEvent.JoinConversation, { conversationId })
    return () => {
      wsService.emit(WsClientEvent.LeaveConversation, { conversationId })
    }
  }, [conversationId, wsService])

  // Mark undelivered incoming messages as delivered
  useEffect(() => {
    if (!conversationId || !currentUserId || !wsService.isConnected()) return
    for (const messageId of undeliveredIncomingIds) {
      wsService.emit(WsClientEvent.MessageDelivered, { messageId, conversationId })
    }
  }, [conversationId, currentUserId, undeliveredIncomingIds, wsService])

  // WebSocket event subscriptions
  useEffect(() => {
    if (!ticketId) return

    const handleNewMessage = (payload: { message: TMessage }) => {
      const msg = payload.message
      if (msg?.conversationId == null) return
      setMessages(prev => (prev.find(m => m.id === msg.id) ? prev : [...prev, msg]))
      if (conversationId && currentUserId && msg.senderId && msg.senderId !== currentUserId) {
        wsService.emit(WsClientEvent.MessageDelivered, { messageId: msg.id, conversationId })
      }
    }

    const handleDelivered = (data: { messageId: string; deliveredAt?: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                status: m.status === 'READ' ? m.status : 'DELIVERED',
                deliveredAt: m.deliveredAt ?? data.deliveredAt ?? new Date().toISOString(),
              }
            : m
        )
      )
    }

    const handleRead = (data: { messageId: string; readAt?: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, status: 'READ', readAt: m.readAt ?? data.readAt ?? new Date().toISOString() }
            : m
        )
      )
    }

    const unsubNew = wsService.on(WsServerEvent.MessageNew, handleNewMessage)
    const unsubDelivered = wsService.on(WsServerEvent.ReceiptDelivered, handleDelivered)
    const unsubRead = wsService.on(WsServerEvent.ReceiptRead, handleRead)

    return () => {
      unsubNew()
      unsubDelivered()
      unsubRead()
    }
  }, [ticketId, conversationId, currentUserId, wsService])

  const sendReply = useCallback(
    async (content: string, attachmentIds?: string[]) => {
      const trimmed = content.trim()
      if (!ticketId || (!trimmed && !attachmentIds?.length)) return
      const created = await addReply(ticketId, { content: trimmed, attachmentIds })
      if (created) {
        setMessages(prev => (prev.find(m => m.id === created.id) ? prev : [...prev, created]))
      }
    },
    [ticketId, addReply]
  )

  return { messages, isLoading, error, sendReply, setMessages }
}
