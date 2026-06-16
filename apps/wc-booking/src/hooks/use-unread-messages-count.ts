import { useMemo } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Unread-conversation count for the nav "Messages" badge.
 *
 * Derived from the messaging store — the single source of truth, initialized
 * app-wide via MessagingProvider — so it updates in real time: new messages,
 * opening a thread, and manual mark-as-(un)read all reflect instantly with no
 * extra request. Uses the same rule as the in-list "Unread" tab so the two
 * always agree: a conversation counts when the current user's participant is
 * not archived and has either real unread messages or a manual "mark as unread".
 */
export function useUnreadMessagesCount(): number {
  const userId = useAuthStore(s => s.user?.id)
  const conversations = useMessagingStore(s => s.conversations)

  return useMemo(() => {
    if (!userId) return 0
    return conversations.reduce((total, conversation) => {
      const me = conversation.participants?.find(p => p.userId === userId)
      if (!me || me.archived) return total
      const isUnread = (me.unreadCount ?? 0) > 0 || Boolean(me.manuallyUnread)
      return isUnread ? total + 1 : total
    }, 0)
  }, [conversations, userId])
}
