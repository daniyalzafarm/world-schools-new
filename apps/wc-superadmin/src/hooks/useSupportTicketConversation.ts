import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { globalWsService } from '@/lib/websocket-instance'
import { supportTicketsService } from '@/services/support-tickets.services'
import { useAuthStore } from '@/stores/auth-store'
import type { SupportTicket, SupportTicketMessageResponse } from '@/types/support-tickets'

const NOTIFICATION_SOUND = '/sounds/notification.mp3'

function playNotificationSound(): void {
  if (typeof window === 'undefined') return
  try {
    const audio = new Audio(NOTIFICATION_SOUND)
    audio.volume = 0.5
    void audio.play().catch(() => {})
  } catch {
    // Ignore playback errors (e.g. file missing, autoplay blocked)
  }
}

interface UseSupportTicketConversationOptions {
  ticketId: string
}

export function useSupportTicketConversation({ ticketId }: UseSupportTicketConversationOptions) {
  const { user } = useAuthStore()
  const notifiedIds = useRef<Set<string>>(new Set())
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageResponse[]>([])
  const [isLoadingTicket, setIsLoadingTicket] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(true)

  const currentUserId = user?.id ?? null

  const undeliveredIncomingIds = useMemo(() => {
    if (!currentUserId) return []
    return messages
      .filter(m => m.senderId !== currentUserId && !m.deliveredAt)
      .slice(-20)
      .map(m => m.id)
  }, [messages, currentUserId])

  const loadTicket = useCallback(async () => {
    setIsLoadingTicket(true)
    try {
      const res = await supportTicketsService.getTicketById(ticketId)
      if (res.success) {
        setTicket(res.data)
      } else {
        setTicket(null)
      }
    } finally {
      setIsLoadingTicket(false)
    }
  }, [ticketId])

  const loadConversation = useCallback(async () => {
    setIsLoadingConversation(true)
    try {
      const res = await supportTicketsService.getConversation(ticketId, { limit: 100 })
      if (res.success) {
        setMessages(res.data.data)
      } else {
        setMessages([])
      }
    } finally {
      setIsLoadingConversation(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (!ticketId) return
    void loadTicket()
    void loadConversation()
  }, [ticketId, loadTicket, loadConversation])

  // Join conversation room when viewing a ticket so we receive message:new when requester replies
  useEffect(() => {
    if (!ticket?.conversationId || !globalWsService.isConnected()) return
    globalWsService.emit('join_conversation', { conversationId: ticket.conversationId })
    return () => {
      globalWsService.emit('leave_conversation', { conversationId: ticket.conversationId })
    }
  }, [ticket?.conversationId])

  // Mark incoming messages as delivered so senders see Delivered (and reload reflects it)
  useEffect(() => {
    if (!ticket?.conversationId) return
    if (!currentUserId) return
    if (!globalWsService.isConnected()) return

    for (const messageId of undeliveredIncomingIds) {
      globalWsService.emit('message:delivered', {
        messageId,
        conversationId: ticket.conversationId,
      })
    }
  }, [ticket?.conversationId, currentUserId, undeliveredIncomingIds])

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
      if (
        ticket?.conversationId &&
        currentUserId &&
        msg.senderId &&
        msg.senderId !== currentUserId
      ) {
        ws.emit('message:delivered', { messageId: msg.id, conversationId: ticket.conversationId })
      }

      // Play sound when requester sends (not our own message)
      if (msg.senderId !== user?.id && !notifiedIds.current.has(msg.id)) {
        notifiedIds.current.add(msg.id)
        if (notifiedIds.current.size > 100) {
          const arr = Array.from(notifiedIds.current)
          notifiedIds.current = new Set(arr.slice(-50))
        }
        playNotificationSound()
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

    const handleTicketStatusUpdated = (data: {
      ticketId: string
      status: SupportTicket['status']
      resolvedAt?: string | null
      closedAt?: string | null
      updatedAt?: string
    }) => {
      if (!ticket || data.ticketId !== ticket.id) return
      setTicket(prev =>
        prev
          ? {
              ...prev,
              status: data.status,
              resolvedAt: data.resolvedAt ?? prev.resolvedAt,
              closedAt: data.closedAt ?? prev.closedAt,
              updatedAt: data.updatedAt ?? prev.updatedAt,
            }
          : prev
      )
    }

    const handleTicketAssigned = (data: {
      ticketId: string
      assignedToUserId: string | null
      assignedAt?: string | null
    }) => {
      if (!ticket || data.ticketId !== ticket.id) return
      if (!data.assignedToUserId) {
        setTicket(prev => (prev ? { ...prev, assignedToUser: null, assignedAt: null } : prev))
        return
      }
      // For now, just update assignedAt; full assignee details will refresh on next GET.
      setTicket(prev => (prev ? { ...prev, assignedAt: data.assignedAt ?? prev.assignedAt } : prev))
    }

    const unsubMessage = ws.on('message:new', handleNewMessage)
    const unsubDelivered = ws.on('receipt:delivered', handleDeliveredReceipt)
    const unsubRead = ws.on('receipt:read', handleReadReceipt)
    const unsubStatus = ws.on('ticket:statusUpdated', handleTicketStatusUpdated)
    const unsubAssigned = ws.on('ticket:assigned', handleTicketAssigned)

    return () => {
      unsubMessage()
      unsubDelivered()
      unsubRead()
      unsubStatus()
      unsubAssigned()
    }
  }, [ticketId, ticket, currentUserId])

  const sendReply = useCallback(
    async (content: string, senderId: string, attachmentIds?: string[]) => {
      const trimmed = content.trim()
      if (!ticketId || (!trimmed && (!attachmentIds || attachmentIds.length === 0))) return
      const res = await supportTicketsService.addReply(
        ticketId,
        { content: trimmed, senderId, attachmentIds },
        'SUPERADMIN'
      )
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
    ticket,
    messages,
    isLoadingTicket,
    isLoadingConversation,
    sendReply,
    setTicket,
  }
}
