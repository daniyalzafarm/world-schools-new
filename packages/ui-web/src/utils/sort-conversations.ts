import type { Conversation } from '../types/messages'

/**
 * Order a conversation list the way world-class messaging apps do:
 *  1. The World Camps Support (superadmin) thread is pinned to the very top.
 *  2. Pinned conversations form a group above the rest.
 *  3. Within each group, most-recent activity first (`time` = last activity).
 *  4. Ties break on `id` for a stable, deterministic order across renders.
 *
 * Pure: returns a new array and does not mutate the input.
 */
export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    if (a.id === 'superadmin') return -1
    if (b.id === 'superadmin') return 1

    const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    if (pinDelta !== 0) return pinDelta

    if (b.time !== a.time) return b.time - a.time
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
