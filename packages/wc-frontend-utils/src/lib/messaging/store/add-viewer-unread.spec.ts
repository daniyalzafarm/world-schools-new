import { describe, expect, it } from 'vitest'
import { addViewerUnread } from './create-messaging-store'
import type { ConversationResponseDto } from '../types'

const VIEWER = 'viewer-user-id'
const PARENT = 'parent-user-id'
const PROVIDER_ORG = 'provider-org-id'

// Minimal conversation factory — only the fields addViewerUnread touches.
const makeConversation = (
  overrides: Partial<ConversationResponseDto> = {}
): ConversationResponseDto =>
  ({
    id: 'conv-1',
    type: 'USER_PROVIDER',
    metadata: { providerId: PROVIDER_ORG },
    participants: [{ userId: PARENT, providerId: null, unreadCount: 0 }],
    ...overrides,
  }) as unknown as ConversationResponseDto

describe('addViewerUnread', () => {
  it('increments an existing viewer participant', () => {
    const conv = makeConversation({
      participants: [
        { userId: PARENT, providerId: null, unreadCount: 0 },
        { userId: VIEWER, providerId: PROVIDER_ORG, unreadCount: 2 },
      ] as never,
    })

    addViewerUnread(conv, VIEWER, 1)

    const viewer = conv.participants?.find(p => p.userId === VIEWER)
    expect(viewer?.unreadCount).toBe(3)
    expect(conv.participants).toHaveLength(2)
  })

  it('synthesizes a viewer participant (with providerId from metadata) when missing', () => {
    // Provider-org viewer with no participant row — the parent-initiated case.
    const conv = makeConversation()

    addViewerUnread(conv, VIEWER, 1)

    const viewer = conv.participants?.find(p => p.userId === VIEWER)
    expect(viewer).toBeDefined()
    expect(viewer?.unreadCount).toBe(1)
    expect((viewer as { providerId?: string | null }).providerId).toBe(PROVIDER_ORG)
    // Parent participant is left untouched so the other-party name still resolves.
    expect(conv.participants?.find(p => p.userId === PARENT)?.unreadCount).toBe(0)
  })

  it('handles a missing participants array', () => {
    const conv = makeConversation({ participants: undefined, metadata: null })

    addViewerUnread(conv, VIEWER, 1)

    expect(conv.participants).toHaveLength(1)
    const viewer = conv.participants?.[0]
    expect(viewer?.userId).toBe(VIEWER)
    expect(viewer?.unreadCount).toBe(1)
    expect((viewer as { providerId?: string | null }).providerId).toBeNull()
  })
})
