import { Logger } from '@nestjs/common'
import type { PrismaService } from '../../../prisma/prisma.service'
import type { NotificationContext } from '../queue/queue.types'

const logger = new Logger('RecipientResolvers')

/**
 * String key for each resolver. Catalog entries reference resolvers by key
 * (not by direct function reference) so:
 *  - the catalog payload stays serializable / printable for QA tooling
 *  - unused resolvers are detectable via a simple grep over the catalog
 *  - tests can swap resolvers via the same registry pattern
 *
 * Add a new key alongside its implementation in `recipientResolvers` below;
 * exhaustiveness is enforced by the `satisfies` clause on the registry.
 */
export type ResolverKey =
  | 'parentForBooking'
  | 'parentByUserId'
  | 'parentForSupportTicket'
  | 'parentForReview'
  | 'parentForConversation'
  | 'allProviderUsers'
  | 'providerMessagingRecipients'
  | 'providerOwnerByProviderId'
  | 'providerOwnerForBooking'
  | 'providerOwnerForCamp'
  | 'providerOwnerForReview'
  | 'allProviderUsersForBooking'
  | 'allProviderUsersForCamp'
  | 'allProviderUsersForReview'
  | 'providerUserForSupportTicket'
  | 'allSuperadmins'

export interface ResolverContext {
  prisma: PrismaService
}

export type Resolver = (ctx: ResolverContext, payload: NotificationContext) => Promise<string[]>

/**
 * Returns the userId of the parent attached to a BookingGroup.
 *
 * Wraps the relation lookup so callers don't repeat the include chain.
 * Returns an empty array (rather than throwing) when the booking is
 * missing — the dispatcher logs a "no recipients" warning and skips,
 * which is the right behavior for a transient race (e.g. the booking
 * was deleted between domain commit and dispatcher fire).
 */
async function parentForBooking(
  { prisma }: ResolverContext,
  { bookingGroupId }: NotificationContext
): Promise<string[]> {
  if (!bookingGroupId) return []
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: { parent: { select: { userId: true } } },
  })
  return bg?.parent.userId ? [bg.parent.userId] : []
}

/**
 * All users associated with a provider:
 *  - users with a role tied to this provider (UserRole.role.providerId match)
 *  - the provider's owner (Provider.ownerId), always included
 *  - de-duplicated since the owner often also carries a role
 *
 * Pre-v28 the provider notification fan-out lived inline inside
 * `booking-websocket.handler.ts → getProviderUserIds`. Extracted here so
 * the catalog can reuse it across every provider trigger.
 */
async function allProviderUsers(
  { prisma }: ResolverContext,
  { providerId }: NotificationContext
): Promise<string[]> {
  if (!providerId) return []
  const [usersWithRole, provider] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: { providerId } } } },
      select: { id: true },
    }),
    prisma.provider.findUnique({
      where: { id: providerId },
      select: { ownerId: true },
    }),
  ])
  const ids = new Set(usersWithRole.map(u => u.id))
  if (provider?.ownerId) ids.add(provider.ownerId)
  return [...ids]
}

/**
 * All users with a system-wide role (providerId is null) that isn't
 * "Provider Admin" or "Parent". Mirrors the pre-v28 fan-out in
 * `application-submitted-websocket.handler.ts`.
 */
async function allSuperadmins({ prisma }: ResolverContext): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            providerId: null,
            name: { notIn: ['Provider Admin', 'Parent'] },
          },
        },
      },
    },
    select: { id: true },
  })
  return users.map(u => u.id)
}

/**
 * Trivial pass-through for triggers where the dispatcher already has the
 * parent's userId on the context (wishlist nudges, profile reminders,
 * post-decline alternatives, abandoned-checkout follow-ups, etc.). Saves
 * one DB hit per dispatch.
 */
function parentByUserId(
  _: ResolverContext,
  { parentUserId }: NotificationContext
): Promise<string[]> {
  return Promise.resolve(parentUserId ? [parentUserId] : [])
}

/**
 * Recipient for support ticket triggers — the ticket's requester user.
 * Returns empty for provider-requested tickets (those map to the
 * `allProviderUsers` resolver via a different catalog entry).
 */
async function parentForSupportTicket(
  { prisma }: ResolverContext,
  { supportTicketId }: NotificationContext
): Promise<string[]> {
  if (!supportTicketId) return []
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: supportTicketId },
    select: { requesterUserId: true, requesterType: true },
  })
  if (ticket?.requesterType !== 'PARENT' || !ticket.requesterUserId) return []
  return [ticket.requesterUserId]
}

/**
 * Recipient for review-related triggers — resolves to the parent who
 * authored the review.
 */
async function parentForReview(
  { prisma }: ResolverContext,
  { reviewId }: NotificationContext
): Promise<string[]> {
  if (!reviewId) return []
  const review = await prisma.campReview.findUnique({
    where: { id: reviewId },
    select: { parent: { select: { userId: true } } },
  })
  return review?.parent.userId ? [review.parent.userId] : []
}

/**
 * Recipient for parent-side messaging triggers. Resolves the parent
 * participant on a conversation (parent ↔ camp DM); excludes the message
 * author so a parent isn't notified about their own message.
 */
async function parentForConversation(
  { prisma }: ResolverContext,
  { conversationId, messageId }: NotificationContext
): Promise<string[]> {
  if (!conversationId) return []
  let senderUserId: string | undefined
  if (messageId) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    })
    senderUserId = msg?.senderId
  }
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participants: { select: { userId: true, providerId: true, muted: true } } },
  })
  if (!conv) return []
  // Parent participants on a parent ↔ camp DM have `providerId = null`. Skip
  // anyone who muted the conversation — mute suppresses notifications.
  return conv.participants
    .filter(p => p.userId !== senderUserId && p.providerId == null && !p.muted)
    .map(p => p.userId)
}

/** Permission id that grants a provider user access to messaging. */
const MESSAGING_PERMISSION_ID = 'messages.read'

/**
 * Provider users for `providerId` who hold the Messaging permission:
 *  - staff with a provider-scoped role (UserRole.role.providerId match), or the
 *    provider owner (User.ownedProvider) — same membership set as allProviderUsers
 *  - AND who hold a role granting `messages.read`
 *
 * Unlike allProviderUsers, the owner is NOT added unconditionally: they qualify
 * only via their Provider Admin role (which carries messages.read after seed),
 * so a provider that has explicitly revoked messaging from everyone notifies
 * no one.
 */
async function providerUsersWithMessagingPermission(
  { prisma }: ResolverContext,
  providerId: string
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { roles: { some: { role: { providerId } } } },
            { ownedProvider: { id: providerId } },
          ],
        },
        {
          roles: {
            some: { role: { permissions: { some: { permissionId: MESSAGING_PERMISSION_ID } } } },
          },
        },
      ],
    },
    select: { id: true },
  })
  return users.map(u => u.id)
}

/**
 * Recipients for the provider-side "new message from family" trigger. The set
 * depends on whether the conversation has been claimed (Conversation.assignedToId
 * is set by the first provider reply — see MessagesService):
 *
 *  - Unclaimed (assignedToId null): every provider user with the Messaging
 *    permission, so anyone can pick the thread up.
 *  - Claimed (assignedToId set): only the conversation's provider participants
 *    (the owner + any staff who have since replied). Other staff keep view
 *    access org-wide but stop receiving notifications.
 *
 * The message sender is always excluded so a reply never re-notifies its author.
 */
async function providerMessagingRecipients(
  ctx: ResolverContext,
  payload: NotificationContext
): Promise<string[]> {
  const { conversationId, messageId } = payload
  if (!conversationId) return []

  const conv = await ctx.prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      assignedToId: true,
      metadata: true,
      participants: { select: { userId: true, providerId: true, muted: true } },
    },
  })
  if (!conv) return []

  let senderUserId: string | undefined
  if (messageId) {
    const msg = await ctx.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    })
    senderUserId = msg?.senderId
  }

  if (conv.assignedToId) {
    // Claimed: notify the conversation's provider participants, minus the sender
    // and anyone who muted it.
    return conv.participants
      .filter(p => p.providerId != null && p.userId !== senderUserId && !p.muted)
      .map(p => p.userId)
  }

  const providerId =
    payload.providerId ?? (conv.metadata as { providerId?: string } | null)?.providerId
  if (!providerId) return []
  const recipients = await providerUsersWithMessagingPermission(ctx, providerId)
  return recipients.filter(id => id !== senderUserId)
}

/**
 * Provider owner by providerId. Single recipient — used for finance-flavoured
 * triggers (payouts, refunds, disputes, reimbursements) where the spec
 * stakeholder wants only one person to take ownership, not the whole staff
 * roster. The owner is the User who created / claimed the Provider.
 */
async function providerOwnerByProviderId(
  { prisma }: ResolverContext,
  { providerId }: NotificationContext
): Promise<string[]> {
  if (!providerId) return []
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { ownerId: true },
  })
  return provider?.ownerId ? [provider.ownerId] : []
}

/**
 * Provider owner for a booking — resolves the BookingGroup → Provider → owner
 * chain. Same single-recipient finance pattern as `providerOwnerByProviderId`
 * but keyed off `bookingGroupId` since most catalog entries that need it
 * carry the booking on their context (not the provider id).
 */
async function providerOwnerForBooking(
  { prisma }: ResolverContext,
  { bookingGroupId }: NotificationContext
): Promise<string[]> {
  if (!bookingGroupId) return []
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: { provider: { select: { ownerId: true } } },
  })
  return bg?.provider.ownerId ? [bg.provider.ownerId] : []
}

/**
 * Provider owner for a camp — derives the providerId from the camp row,
 * then defers to the same owner-only resolution. Used for review triggers
 * keyed off campId.
 */
async function providerOwnerForCamp(
  { prisma }: ResolverContext,
  { campId }: NotificationContext
): Promise<string[]> {
  if (!campId) return []
  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: { provider: { select: { ownerId: true } } },
  })
  return camp?.provider.ownerId ? [camp.provider.ownerId] : []
}

/**
 * Provider owner for a review — chains review → camp → provider → owner.
 */
async function providerOwnerForReview(
  { prisma }: ResolverContext,
  { reviewId }: NotificationContext
): Promise<string[]> {
  if (!reviewId) return []
  const review = await prisma.campReview.findUnique({
    where: { id: reviewId },
    select: { camp: { select: { provider: { select: { ownerId: true } } } } },
  })
  return review?.camp.provider.ownerId ? [review.camp.provider.ownerId] : []
}

/**
 * Full provider staff (owner + role-bound users) for a booking — same
 * fan-out semantics as `allProviderUsers` but keyed off `bookingGroupId`.
 * Used for booking-lifecycle triggers (cancellation, modification, etc.)
 * where every staff member should see the update.
 */
async function allProviderUsersForBooking(
  ctx: ResolverContext,
  payload: NotificationContext
): Promise<string[]> {
  if (!payload.bookingGroupId) return []
  const bg = await ctx.prisma.bookingGroup.findUnique({
    where: { id: payload.bookingGroupId },
    select: { providerId: true },
  })
  if (!bg?.providerId) return []
  return allProviderUsers(ctx, { ...payload, providerId: bg.providerId })
}

async function allProviderUsersForCamp(
  ctx: ResolverContext,
  payload: NotificationContext
): Promise<string[]> {
  if (!payload.campId) return []
  const camp = await ctx.prisma.camp.findUnique({
    where: { id: payload.campId },
    select: { providerId: true },
  })
  if (!camp?.providerId) return []
  return allProviderUsers(ctx, { ...payload, providerId: camp.providerId })
}

async function allProviderUsersForReview(
  ctx: ResolverContext,
  payload: NotificationContext
): Promise<string[]> {
  if (!payload.reviewId) return []
  const review = await ctx.prisma.campReview.findUnique({
    where: { id: payload.reviewId },
    select: { camp: { select: { providerId: true } } },
  })
  if (!review?.camp.providerId) return []
  return allProviderUsers(ctx, { ...payload, providerId: review.camp.providerId })
}

/**
 * Provider user for a support ticket — the ticket's requester user when
 * requesterType is PROVIDER. Mirrors `parentForSupportTicket` for the
 * other audience.
 */
async function providerUserForSupportTicket(
  { prisma }: ResolverContext,
  { supportTicketId }: NotificationContext
): Promise<string[]> {
  if (!supportTicketId) return []
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: supportTicketId },
    select: { requesterUserId: true, requesterType: true },
  })
  if (ticket?.requesterType !== 'PROVIDER' || !ticket.requesterUserId) return []
  return [ticket.requesterUserId]
}

export const recipientResolvers = {
  parentForBooking,
  parentByUserId,
  parentForSupportTicket,
  parentForReview,
  parentForConversation,
  allProviderUsers,
  providerMessagingRecipients,
  providerOwnerByProviderId,
  providerOwnerForBooking,
  providerOwnerForCamp,
  providerOwnerForReview,
  allProviderUsersForBooking,
  allProviderUsersForCamp,
  allProviderUsersForReview,
  providerUserForSupportTicket,
  allSuperadmins,
} as const satisfies Record<ResolverKey, Resolver>

/** Safe lookup with a structured warning when a resolver is missing. */
export function getResolver(key: string): Resolver | undefined {
  const fn = (recipientResolvers as Record<string, Resolver>)[key]
  if (!fn) {
    logger.error(`Unknown recipient resolver: ${key}`)
  }
  return fn
}
