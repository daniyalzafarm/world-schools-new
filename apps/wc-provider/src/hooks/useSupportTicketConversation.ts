// Thin wrapper — injects app-specific service and wsService into the shared hook.
import { useSupportConversationMessages } from '@world-schools/wc-frontend-utils'
import { globalWsService } from '@/lib/websocket-instance'
import { supportTicketsService } from '@/services/support-tickets.services'
import { useAuthStore } from '@/stores/auth-store'

interface Options {
  ticketId: string
  conversationId?: string | null
}

export function useSupportTicketConversation({ ticketId, conversationId }: Options) {
  const { user } = useAuthStore()

  return useSupportConversationMessages({
    ticketId,
    conversationId,
    currentUserId: user?.id ?? null,
    wsService: globalWsService,
    getConversation: async id => {
      const res = await supportTicketsService.getConversation(id, { limit: 100 })
      return res.success ? res.data.data : []
    },
    addReply: async (id, data) => {
      const res = await supportTicketsService.addReply(id, data)
      return res.success ? res.data : null
    },
  })
}
