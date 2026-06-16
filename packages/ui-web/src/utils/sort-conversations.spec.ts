import { sortConversations } from './sort-conversations'
import type { Conversation } from '../types/messages'

const make = (over: Partial<Conversation> & { id: string }): Conversation => ({
  name: over.id,
  lastMessage: '',
  time: 0,
  lastSeen: 0,
  avatar: '',
  ...over,
})

const ids = (list: Conversation[]) => list.map(c => c.id)

describe('sortConversations', () => {
  it('keeps the superadmin thread at the very top regardless of activity', () => {
    const result = sortConversations([
      make({ id: 'a', time: 100 }),
      make({ id: 'superadmin', time: 1 }),
      make({ id: 'b', time: 50 }),
    ])
    expect(ids(result)).toEqual(['superadmin', 'a', 'b'])
  })

  it('places pinned conversations above unpinned ones', () => {
    const result = sortConversations([
      make({ id: 'unpinned-new', time: 999 }),
      make({ id: 'pinned-old', time: 1, pinned: true }),
    ])
    expect(ids(result)).toEqual(['pinned-old', 'unpinned-new'])
  })

  it('orders within a group by most recent activity', () => {
    const result = sortConversations([
      make({ id: 'older', time: 10 }),
      make({ id: 'newer', time: 20 }),
      make({ id: 'newest', time: 30 }),
    ])
    expect(ids(result)).toEqual(['newest', 'newer', 'older'])
  })

  it('orders the pinned group by activity too', () => {
    const result = sortConversations([
      make({ id: 'pin-old', time: 5, pinned: true }),
      make({ id: 'pin-new', time: 50, pinned: true }),
      make({ id: 'plain', time: 999 }),
    ])
    expect(ids(result)).toEqual(['pin-new', 'pin-old', 'plain'])
  })

  it('breaks equal-time ties deterministically by id', () => {
    const result = sortConversations([
      make({ id: 'c', time: 100 }),
      make({ id: 'a', time: 100 }),
      make({ id: 'b', time: 100 }),
    ])
    expect(ids(result)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input array', () => {
    const input = [make({ id: 'a', time: 1 }), make({ id: 'b', time: 2 })]
    const before = ids(input)
    sortConversations(input)
    expect(ids(input)).toEqual(before)
  })
})
