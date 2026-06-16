import { recipientResolvers, getResolver } from '../resolvers/recipient-resolvers'

interface MockPrisma {
  bookingGroup: { findUnique: jest.Mock }
  user: { findMany: jest.Mock }
  provider: { findUnique: jest.Mock }
  supportTicket: { findUnique: jest.Mock }
  campReview: { findUnique: jest.Mock }
  camp: { findUnique: jest.Mock }
  conversation: { findUnique: jest.Mock }
  message: { findUnique: jest.Mock }
}

function makePrisma(): MockPrisma {
  return {
    bookingGroup: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
    provider: { findUnique: jest.fn() },
    supportTicket: { findUnique: jest.fn() },
    campReview: { findUnique: jest.fn() },
    camp: { findUnique: jest.fn() },
    conversation: { findUnique: jest.fn() },
    message: { findUnique: jest.fn() },
  }
}

describe('recipient resolvers', () => {
  let prisma: MockPrisma
  let ctx: { prisma: MockPrisma }

  beforeEach(() => {
    prisma = makePrisma()
    ctx = { prisma }
  })

  describe('registry shape', () => {
    it('exposes all 16 resolver keys as functions', () => {
      const expectedKeys = [
        'parentForBooking',
        'parentByUserId',
        'parentForSupportTicket',
        'parentForReview',
        'parentForConversation',
        'allProviderUsers',
        'providerMessagingRecipients',
        'providerOwnerByProviderId',
        'providerOwnerForBooking',
        'providerOwnerForCamp',
        'providerOwnerForReview',
        'allProviderUsersForBooking',
        'allProviderUsersForCamp',
        'allProviderUsersForReview',
        'providerUserForSupportTicket',
        'allSuperadmins',
      ]
      for (const key of expectedKeys) {
        expect(typeof (recipientResolvers as Record<string, unknown>)[key]).toBe('function')
      }
      expect(Object.keys(recipientResolvers)).toHaveLength(expectedKeys.length)
    })

    it('getResolver returns undefined for an unknown key', () => {
      expect(getResolver('does-not-exist')).toBeUndefined()
    })

    it('getResolver returns the function for a known key', () => {
      expect(typeof getResolver('parentForBooking')).toBe('function')
    })
  })

  describe('parentForBooking', () => {
    it('returns [parent.userId] when the booking exists', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue({ parent: { userId: 'u-parent' } })

      const result = await recipientResolvers.parentForBooking(ctx as never, {
        bookingGroupId: 'BG-1',
      })

      expect(result).toEqual(['u-parent'])
    })

    it('returns [] when bookingGroupId is missing from context', async () => {
      const result = await recipientResolvers.parentForBooking(ctx as never, {})
      expect(result).toEqual([])
      expect(prisma.bookingGroup.findUnique).not.toHaveBeenCalled()
    })

    it('returns [] when the booking lookup returns null (race / deleted)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue(null)
      const result = await recipientResolvers.parentForBooking(ctx as never, {
        bookingGroupId: 'BG-missing',
      })
      expect(result).toEqual([])
    })
  })

  describe('parentByUserId', () => {
    it('passes through the parentUserId from context without hitting the DB', async () => {
      const result = await recipientResolvers.parentByUserId(ctx as never, {
        parentUserId: 'u-passthrough',
      })
      expect(result).toEqual(['u-passthrough'])
    })

    it('returns [] when parentUserId is absent', async () => {
      const result = await recipientResolvers.parentByUserId(ctx as never, {})
      expect(result).toEqual([])
    })
  })

  describe('parentForSupportTicket', () => {
    it('returns [requesterUserId] only when requesterType is PARENT', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        requesterUserId: 'u-parent',
        requesterType: 'PARENT',
      })

      const result = await recipientResolvers.parentForSupportTicket(ctx as never, {
        supportTicketId: 'T-1',
      })

      expect(result).toEqual(['u-parent'])
    })

    it('returns [] when the ticket is provider-requested', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        requesterUserId: 'u-provider',
        requesterType: 'PROVIDER',
      })

      const result = await recipientResolvers.parentForSupportTicket(ctx as never, {
        supportTicketId: 'T-2',
      })

      expect(result).toEqual([])
    })
  })

  describe('parentForConversation', () => {
    it('returns parent participants and excludes the message sender', async () => {
      prisma.message.findUnique.mockResolvedValue({ senderId: 'u-sender' })
      prisma.conversation.findUnique.mockResolvedValue({
        participants: [
          { userId: 'u-sender', providerId: null }, // excluded (sender)
          { userId: 'u-other-parent', providerId: null }, // included
          { userId: 'u-camp-staff', providerId: 'prov-1' }, // excluded (provider participant)
        ],
      })

      const result = await recipientResolvers.parentForConversation(ctx as never, {
        conversationId: 'C-1',
        messageId: 'M-1',
      })

      expect(result).toEqual(['u-other-parent'])
    })

    it('excludes participants who muted the conversation', async () => {
      prisma.message.findUnique.mockResolvedValue({ senderId: 'u-sender' })
      prisma.conversation.findUnique.mockResolvedValue({
        participants: [
          { userId: 'u-muted-parent', providerId: null, muted: true }, // excluded (muted)
          { userId: 'u-other-parent', providerId: null, muted: false }, // included
        ],
      })

      const result = await recipientResolvers.parentForConversation(ctx as never, {
        conversationId: 'C-1',
        messageId: 'M-1',
      })

      expect(result).toEqual(['u-other-parent'])
    })

    it('returns [] when conversationId is missing', async () => {
      const result = await recipientResolvers.parentForConversation(ctx as never, {})
      expect(result).toEqual([])
    })
  })

  describe('allProviderUsers', () => {
    it('returns the de-duplicated union of role-bound users + the provider owner', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u-1' }, { id: 'u-2' }])
      prisma.provider.findUnique.mockResolvedValue({ ownerId: 'u-2' }) // owner is already in role list

      const result = await recipientResolvers.allProviderUsers(ctx as never, {
        providerId: 'prov-1',
      })

      expect(result.sort()).toEqual(['u-1', 'u-2'])
    })

    it('always includes the owner even when no role-bound users exist', async () => {
      prisma.user.findMany.mockResolvedValue([])
      prisma.provider.findUnique.mockResolvedValue({ ownerId: 'u-owner' })

      const result = await recipientResolvers.allProviderUsers(ctx as never, {
        providerId: 'prov-1',
      })

      expect(result).toEqual(['u-owner'])
    })

    it('returns [] when providerId is missing', async () => {
      const result = await recipientResolvers.allProviderUsers(ctx as never, {})
      expect(result).toEqual([])
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })
  })

  describe('providerMessagingRecipients', () => {
    it('unclaimed thread → all provider users with the Messaging permission, minus the sender', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        assignedToId: null,
        metadata: { providerId: 'prov-1' },
        participants: [{ userId: 'u-parent', providerId: null }],
      })
      prisma.message.findUnique.mockResolvedValue({ senderId: 'u-parent' })
      // Permission-filtered membership query (owner + staff holding messages.read)
      prisma.user.findMany.mockResolvedValue([{ id: 'u-owner' }, { id: 'u-staff' }])

      const result = await recipientResolvers.providerMessagingRecipients(ctx as never, {
        conversationId: 'c-1',
        messageId: 'm-1',
        providerId: 'prov-1',
      })

      expect(result.sort()).toEqual(['u-owner', 'u-staff'])
      // Resolved via the permission-aware membership query, not the open fan-out.
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1)
    })

    it('claimed thread → only provider participants (owner + replied staff), minus the sender', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        assignedToId: 'u-owner',
        metadata: { providerId: 'prov-1' },
        participants: [
          { userId: 'u-parent', providerId: null }, // parent — excluded (not a provider participant)
          { userId: 'u-owner', providerId: 'prov-1' }, // owner
          { userId: 'u-staff', providerId: 'prov-1' }, // staff who replied
        ],
      })
      prisma.message.findUnique.mockResolvedValue({ senderId: 'u-parent' })

      const result = await recipientResolvers.providerMessagingRecipients(ctx as never, {
        conversationId: 'c-1',
        messageId: 'm-1',
      })

      expect(result.sort()).toEqual(['u-owner', 'u-staff'])
      // Claimed branch reads participants off the conversation — no membership query.
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })

    it('claimed thread → excludes provider participants who muted the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        assignedToId: 'u-owner',
        metadata: { providerId: 'prov-1' },
        participants: [
          { userId: 'u-owner', providerId: 'prov-1', muted: false }, // included
          { userId: 'u-staff', providerId: 'prov-1', muted: true }, // excluded (muted)
        ],
      })
      prisma.message.findUnique.mockResolvedValue({ senderId: 'u-parent' })

      const result = await recipientResolvers.providerMessagingRecipients(ctx as never, {
        conversationId: 'c-1',
        messageId: 'm-1',
      })

      expect(result).toEqual(['u-owner'])
    })

    it('returns [] when the conversation is missing', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)
      const result = await recipientResolvers.providerMessagingRecipients(ctx as never, {
        conversationId: 'c-gone',
      })
      expect(result).toEqual([])
    })
  })

  describe('providerOwnerByProviderId', () => {
    it('returns just [ownerId] — the single-recipient finance pattern', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ownerId: 'u-owner' })

      const result = await recipientResolvers.providerOwnerByProviderId(ctx as never, {
        providerId: 'prov-1',
      })

      expect(result).toEqual(['u-owner'])
    })

    it('returns [] when the provider exists but has no owner', async () => {
      prisma.provider.findUnique.mockResolvedValue({ ownerId: null })

      const result = await recipientResolvers.providerOwnerByProviderId(ctx as never, {
        providerId: 'prov-1',
      })

      expect(result).toEqual([])
    })
  })

  describe('providerOwnerForBooking', () => {
    it('walks bookingGroup → provider → owner', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue({
        provider: { ownerId: 'u-owner' },
      })

      const result = await recipientResolvers.providerOwnerForBooking(ctx as never, {
        bookingGroupId: 'BG-1',
      })

      expect(result).toEqual(['u-owner'])
    })
  })

  describe('allProviderUsersForBooking', () => {
    it('derives providerId from the booking then fans out via allProviderUsers', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue({ providerId: 'prov-1' })
      prisma.user.findMany.mockResolvedValue([{ id: 'u-1' }])
      prisma.provider.findUnique.mockResolvedValue({ ownerId: 'u-owner' })

      const result = await recipientResolvers.allProviderUsersForBooking(ctx as never, {
        bookingGroupId: 'BG-1',
      })

      expect(result.sort()).toEqual(['u-1', 'u-owner'])
    })

    it('returns [] when the booking has no providerId', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValue({ providerId: null })

      const result = await recipientResolvers.allProviderUsersForBooking(ctx as never, {
        bookingGroupId: 'BG-x',
      })

      expect(result).toEqual([])
    })
  })

  describe('providerUserForSupportTicket', () => {
    it('returns the requester only when requesterType is PROVIDER', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        requesterUserId: 'u-provider',
        requesterType: 'PROVIDER',
      })

      const result = await recipientResolvers.providerUserForSupportTicket(ctx as never, {
        supportTicketId: 'T-1',
      })

      expect(result).toEqual(['u-provider'])
    })

    it('returns [] for parent-requested tickets', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        requesterUserId: 'u-parent',
        requesterType: 'PARENT',
      })

      const result = await recipientResolvers.providerUserForSupportTicket(ctx as never, {
        supportTicketId: 'T-2',
      })

      expect(result).toEqual([])
    })
  })

  describe('allSuperadmins', () => {
    it('returns ids of users with a system-wide role other than Parent / Provider Admin', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u-admin-1' }, { id: 'u-admin-2' }])

      const result = await recipientResolvers.allSuperadmins(ctx as never)

      expect(result).toEqual(['u-admin-1', 'u-admin-2'])
      // The query MUST scope to providerId=null + notIn Parent/Provider Admin.
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: expect.objectContaining({
              some: expect.objectContaining({
                role: expect.objectContaining({
                  providerId: null,
                  name: { notIn: ['Provider Admin', 'Parent'] },
                }),
              }),
            }),
          }),
        })
      )
    })
  })
})
