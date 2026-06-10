import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { SessionStatus, WishlistShareRole } from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto'
import { SyncCampWishlistsDto } from './dto/sync-camp-wishlists.dto'
import { CreateWishlistDto } from './dto/create-wishlist.dto'
import { ShareWishlistDto } from './dto/share-wishlist.dto'
import { ToggleLinkSharingDto } from './dto/toggle-link-sharing.dto'
import { UpdateShareRoleDto } from './dto/update-share-role.dto'
import { UpdateWishlistDto } from './dto/update-wishlist.dto'
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto'

@Injectable()
export class UserWishlistsService {
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new Error('Azure Storage is not configured.')
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Generate a single SAS URL for a photo blob path.
   * Returns null if generation fails (e.g. storage not configured).
   */
  private async generateSasUrl(blobUrl: string): Promise<string | null> {
    try {
      const azureStorage = this.getAzureStorage()
      return await azureStorage.generateSasUrl(blobUrl, 24)
    } catch {
      return null
    }
  }

  /**
   * Extract the primary (or first) photo from a camp's photos JSON column
   * and return it with a full Azure SAS URL.
   */
  private async resolveCoverPhoto(photos: any): Promise<string | null> {
    if (!Array.isArray(photos) || photos.length === 0) return null
    const primary = (photos as any[]).find(p => p.isPrimary) ?? photos[0]
    const blobUrl: string | null = typeof primary === 'string' ? primary : (primary?.url ?? null)
    if (!blobUrl) return null
    return (await this.generateSasUrl(blobUrl)) ?? blobUrl
  }

  /**
   * Generate SAS URLs for all photos in each item's camp (used by detail view).
   */
  private async resolveDetailPhotos(wishlist: any): Promise<any> {
    const items = await Promise.all(
      (wishlist.items ?? []).map(async (item: any) => {
        if (!item.camp?.photos || !Array.isArray(item.camp.photos)) return item
        const resolvedPhotos = await Promise.all(
          (item.camp.photos as any[]).map(async photo => {
            const blobUrl: string | null = typeof photo === 'string' ? photo : (photo?.url ?? null)
            if (!blobUrl) return photo
            const sasUrl = await this.generateSasUrl(blobUrl)
            if (typeof photo === 'string') return sasUrl ?? photo
            return { ...photo, url: sasUrl ?? blobUrl, thumbnail: sasUrl ?? blobUrl }
          })
        )
        return { ...item, camp: { ...item.camp, photos: resolvedPhotos } }
      })
    )
    return { ...wishlist, items }
  }

  /**
   * Batch-compute overallRating + totalReviews for all camps in a wishlist detail
   * and attach them to each item's camp object.
   */
  private async attachCampRatings(wishlist: any): Promise<any> {
    const items: any[] = wishlist.items ?? []
    const campIds = [...new Set(items.map((i: any) => i.camp?.id).filter(Boolean))] as string[]
    if (campIds.length === 0) return wishlist

    const groups = await this.prisma.campReview.groupBy({
      by: ['campId'],
      where: { campId: { in: campIds }, status: 'published' },
      _count: { _all: true },
      _avg: {
        happinessRating: true,
        safetyRating: true,
        communicationRating: true,
        asDescribedRating: true,
        growthRating: true,
        valueRating: true,
      },
    })

    const ratingMap = new Map<string, { overallRating: number | null; totalReviews: number }>()
    for (const g of groups) {
      const dims = [
        g._avg.happinessRating,
        g._avg.safetyRating,
        g._avg.communicationRating,
        g._avg.asDescribedRating,
        g._avg.growthRating,
        g._avg.valueRating,
      ].filter((v): v is number => v != null)
      const overallRating =
        dims.length > 0
          ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10
          : null
      ratingMap.set(g.campId, { overallRating, totalReviews: g._count._all })
    }

    const updatedItems = items.map((item: any) => {
      if (!item.camp?.id) return item
      const ratingData = ratingMap.get(item.camp.id)
      return {
        ...item,
        camp: {
          ...item.camp,
          overallRating: ratingData?.overallRating ?? null,
          totalReviews: ratingData?.totalReviews ?? 0,
        },
      }
    })

    return { ...wishlist, items: updatedItems }
  }

  /**
   * Attach `coverPhoto` (full Azure SAS URL) to each item's camp for list view.
   */
  private async attachCoverPhotos(wishlists: any[]): Promise<any[]> {
    return Promise.all(
      wishlists.map(async w => {
        const allItems: any[] = w.items ?? []
        // Only generate SAS URLs for the first 4 items (used as cover photo collage)
        const itemsWithCovers = await Promise.all(
          allItems.map(async (item: any, idx: number) => {
            if (idx >= 4 || !item.camp?.photos) return item
            const coverPhoto = await this.resolveCoverPhoto(item.camp.photos)
            return { ...item, camp: { ...item.camp, coverPhoto } }
          })
        )
        return { ...w, items: itemsWithCovers }
      })
    )
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async getParent(userId: string) {
    const parent = await this.prisma.parent.findUnique({ where: { userId } })
    if (!parent) throw new NotFoundException('Parent profile not found for this user')
    return parent
  }

  private async assertOwner(userId: string, wishlistId: string) {
    const parent = await this.getParent(userId)
    const wishlist = await this.prisma.wishlist.findUnique({ where: { id: wishlistId } })
    if (!wishlist || wishlist.archived) throw new NotFoundException('Wishlist not found')
    if (wishlist.parentId !== parent.id) {
      throw new ForbiddenException('You do not have permission to modify this wishlist')
    }
    return { parent, wishlist }
  }

  private async assertReadAccess(userId: string, wishlistId: string) {
    const parent = await this.getParent(userId)
    const wishlist = await this.prisma.wishlist.findUnique({ where: { id: wishlistId } })
    if (!wishlist || wishlist.archived) throw new NotFoundException('Wishlist not found')

    if (wishlist.parentId === parent.id) return { parent, wishlist, role: 'owner' as const }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    const share = await this.prisma.wishlistShare.findFirst({
      where: {
        wishlistId,
        OR: [{ userId }, { email: user?.email ?? '' }],
      },
    })
    if (!share) throw new ForbiddenException('You do not have access to this wishlist')

    return { parent, wishlist, role: share.role }
  }

  private async assertEditorAccess(userId: string, wishlistId: string) {
    const { parent, wishlist, role } = await this.assertReadAccess(userId, wishlistId)
    if (role !== 'owner' && role !== WishlistShareRole.editor) {
      throw new ForbiddenException('You do not have permission to modify this wishlist')
    }
    return { parent, wishlist }
  }

  private async validateChildIds(parentId: string, childIds: string[]) {
    if (!childIds.length) return
    const children = await this.prisma.children.findMany({
      where: { id: { in: childIds }, parentId, archived: false },
      select: { id: true },
    })
    const foundIds = new Set(children.map(c => c.id))
    const invalid = childIds.filter(id => !foundIds.has(id))
    if (invalid.length) {
      throw new ForbiddenException(`Child IDs not found or not owned by you: ${invalid.join(', ')}`)
    }
  }

  private formatWishlist(wishlist: any) {
    const rawItems: any[] = wishlist.items ?? []

    // Extract resolved cover photos — present on list-view items (set by attachCoverPhotos)
    // and on detail-view items (first resolved photo URL)
    const coverPhotos: string[] = rawItems
      .map((item: any) => {
        if (item.camp?.coverPhoto) return item.camp.coverPhoto as string
        // Detail view: grab first resolved photo url
        const photos = item.camp?.photos
        if (Array.isArray(photos) && photos.length > 0) {
          const p = photos[0]
          return typeof p === 'string' ? p : (p?.url ?? null)
        }
        return null
      })
      .filter((url): url is string => !!url)
      .slice(0, 4)

    // Detail-view items have `wishlistId`; list-view items are stripped down (only id/campId/camp)
    const isDetailItem = rawItems.length > 0 && rawItems[0].wishlistId !== undefined
    const items = isDetailItem ? rawItems.map(item => this.formatItem(item)) : undefined

    const campIds: string[] = rawItems.map((item: any) => item.campId).filter(Boolean)

    return {
      id: wishlist.id,
      parentId: wishlist.parentId,
      name: wishlist.name,
      icon: wishlist.icon ?? null,
      isLinkSharingEnabled: wishlist.isLinkSharingEnabled,
      shareToken: wishlist.shareToken ?? null,
      campCount: wishlist._count?.items ?? rawItems.length,
      shareCount: wishlist._count?.shares ?? wishlist.shares?.length ?? 0,
      coverPhotos,
      campIds,
      ...(items !== undefined && { items }),
      shares: (wishlist.shares ?? []).map(this.formatShare),
      children: (wishlist.children ?? []).map((wc: any) => ({
        id: wc.id,
        wishlistId: wc.wishlistId,
        childId: wc.childId,
        createdAt: wc.createdAt,
        child: wc.child ?? null,
      })),
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
    }
  }

  private formatShare(share: any) {
    return {
      id: share.id,
      wishlistId: share.wishlistId,
      email: share.email,
      userId: share.userId ?? null,
      role: share.role,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    }
  }

  private formatItem(item: any) {
    return {
      id: item.id,
      wishlistId: item.wishlistId,
      campId: item.campId,
      sessionId: item.sessionId ?? null,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      camp: item.camp ?? null,
      selectedSession: item.session ?? null,
    }
  }

  private readonly wishlistDetailInclude = {
    shares: true,
    children: {
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            dateOfBirth: true,
          },
        },
      },
    },
    items: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            locationName: true,
            locationAddress: true,
            locationLat: true,
            locationLng: true,
            ageGroups: true,
            languages: true,
            gender: true,
            photos: true,
            status: true,
            provider: {
              select: {
                settings: true,
                googleBusinessProfile: {
                  select: {
                    placeId: true,
                    rating: true,
                    reviewsCount: true,
                    city: true,
                    country: true,
                  },
                },
              },
            },
            sessions: {
              where: { status: SessionStatus.published },
              orderBy: { startDate: 'asc' as const },
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                price: true,
                pricingType: true,
                ageGroupPrices: true,
                totalSpots: true,
                status: true,
                sortOrder: true,
              },
            },
          },
        },
        session: true,
      },
    },
  }

  private readonly wishlistListInclude = {
    shares: true,
    children: {
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            dateOfBirth: true,
          },
        },
      },
    },
    _count: {
      select: { items: true, shares: true },
    },
    // Fetch all items — first 4 used for cover photo collage, all used for campIds
    items: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        campId: true,
        camp: {
          select: {
            id: true,
            name: true,
            photos: true,
          },
        },
      },
    },
  }

  // ============================================
  // My Wishlists
  // ============================================

  async findAll(userId: string) {
    const parent = await this.getParent(userId)

    const wishlists = await this.prisma.wishlist.findMany({
      where: { parentId: parent.id, archived: false },
      orderBy: { createdAt: 'desc' },
      include: this.wishlistListInclude,
    })

    const withCovers = await this.attachCoverPhotos(wishlists)
    return withCovers.map(w => this.formatWishlist(w))
  }

  async findOne(userId: string, id: string) {
    await this.assertReadAccess(userId, id)

    const wishlist = await this.prisma.wishlist.findUnique({
      where: { id },
      include: this.wishlistDetailInclude,
    })

    const withPhotos = await this.resolveDetailPhotos(wishlist)
    const withRatings = await this.attachCampRatings(withPhotos)
    return this.formatWishlist(withRatings)
  }

  async create(userId: string, dto: CreateWishlistDto) {
    const parent = await this.getParent(userId)

    const childIds = dto.childIds ?? []
    if (childIds.length) await this.validateChildIds(parent.id, childIds)

    const wishlist = await this.prisma.$transaction(async tx => {
      const created = await tx.wishlist.create({
        data: {
          parentId: parent.id,
          name: dto.name,
          icon: dto.icon,
        },
      })

      if (childIds.length) {
        await tx.wishlistChild.createMany({
          data: childIds.map(childId => ({ wishlistId: created.id, childId })),
        })
      }

      return tx.wishlist.findUnique({
        where: { id: created.id },
        include: this.wishlistListInclude,
      })
    })

    const [withCovers] = await this.attachCoverPhotos([wishlist])
    return this.formatWishlist(withCovers)
  }

  async update(userId: string, id: string, dto: UpdateWishlistDto) {
    const { parent } = await this.assertOwner(userId, id)

    const childIds = dto.childIds
    if (childIds?.length) {
      await this.validateChildIds(parent.id, childIds)
    }

    const wishlist = await this.prisma.$transaction(async tx => {
      await tx.wishlist.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      })

      if (childIds !== undefined) {
        await tx.wishlistChild.deleteMany({ where: { wishlistId: id } })
        if (childIds.length) {
          await tx.wishlistChild.createMany({
            data: childIds.map(childId => ({ wishlistId: id, childId })),
          })
        }
      }

      return tx.wishlist.findUnique({
        where: { id },
        include: this.wishlistListInclude,
      })
    })

    const [withCovers] = await this.attachCoverPhotos([wishlist])
    return this.formatWishlist(withCovers)
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id)

    await this.prisma.wishlist.delete({ where: { id } })

    return { message: 'Wishlist deleted successfully' }
  }

  async duplicate(userId: string, id: string) {
    const { parent, wishlist } = await this.assertOwner(userId, id)

    const original = await this.prisma.wishlist.findUnique({
      where: { id },
      include: {
        children: { select: { childId: true } },
        items: {
          orderBy: { sortOrder: 'asc' as const },
          select: { campId: true, sessionId: true, sortOrder: true },
        },
      },
    })
    if (!original) throw new NotFoundException('Wishlist not found')

    const copy = await this.prisma.$transaction(async tx => {
      const created = await tx.wishlist.create({
        data: {
          parentId: parent.id,
          name: `${original.name} (Copy)`,
          icon: original.icon,
        },
      })

      if (original.children.length) {
        await tx.wishlistChild.createMany({
          data: original.children.map(c => ({ wishlistId: created.id, childId: c.childId })),
        })
      }

      if (original.items.length) {
        await tx.wishlistItem.createMany({
          data: original.items.map(item => ({
            wishlistId: created.id,
            campId: item.campId,
            sessionId: item.sessionId ?? null,
            sortOrder: item.sortOrder,
          })),
        })
      }

      return tx.wishlist.findUnique({
        where: { id: created.id },
        include: this.wishlistListInclude,
      })
    })

    const [withCovers] = await this.attachCoverPhotos([copy])
    return this.formatWishlist(withCovers)
  }

  // ============================================
  // Shared With Me
  // ============================================

  async findSharedWithMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const shares = await this.prisma.wishlistShare.findMany({
      where: {
        OR: [{ userId }, { email: user.email }],
      },
      include: {
        wishlist: {
          include: {
            ...this.wishlistListInclude,
            parent: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const active = shares.filter(s => !s.wishlist.archived)
    const wishlists = active.map(s => s.wishlist)
    const withCovers = await this.attachCoverPhotos(wishlists)

    return active.map((s, i) => ({
      wishlist: this.formatWishlist(withCovers[i]),
      role: s.role,
      sharedBy: [s.wishlist.parent.user.firstName, s.wishlist.parent.user.lastName]
        .filter(Boolean)
        .join(' '),
    }))
  }

  // ============================================
  // Public Share Token View
  // ============================================

  async findByShareToken(token: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { shareToken: token },
      include: this.wishlistDetailInclude,
    })

    if (!wishlist || wishlist.archived || !wishlist.isLinkSharingEnabled) {
      throw new NotFoundException('Wishlist not found or link sharing is disabled')
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id: wishlist.parentId },
      select: { user: { select: { firstName: true, lastName: true } } },
    })

    const ownerName = [parent?.user?.firstName, parent?.user?.lastName].filter(Boolean).join(' ')

    const withPhotos = await this.resolveDetailPhotos(wishlist)
    const withRatings = await this.attachCampRatings(withPhotos)
    const formatted = this.formatWishlist(withRatings)
    // Strip share token and shares list from public response
    return { ...formatted, shareToken: null, shares: [], ownerName }
  }

  // ============================================
  // Wishlist Items
  // ============================================

  async addItem(userId: string, wishlistId: string, dto: AddWishlistItemDto) {
    await this.assertEditorAccess(userId, wishlistId)

    const camp = await this.prisma.camp.findUnique({
      where: { id: dto.campId },
      select: { id: true, status: true },
    })
    if (camp?.status !== 'published') {
      throw new NotFoundException('Camp not found or not published')
    }

    if (dto.sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: dto.sessionId, campId: dto.campId },
        select: { id: true },
      })
      if (!session) throw new NotFoundException('Session not found for this camp')
    }

    const item = await this.prisma.wishlistItem.upsert({
      where: { wishlistId_campId: { wishlistId, campId: dto.campId } },
      create: {
        wishlistId,
        campId: dto.campId,
        sessionId: dto.sessionId ?? null,
      },
      update: {
        ...(dto.sessionId !== undefined && { sessionId: dto.sessionId }),
      },
      include: {
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            locationName: true,
            locationLat: true,
            locationLng: true,
            photos: true,
            status: true,
          },
        },
        session: true,
      },
    })

    return this.formatItem(item)
  }

  async updateItem(userId: string, wishlistId: string, itemId: string, dto: UpdateWishlistItemDto) {
    await this.assertEditorAccess(userId, wishlistId)

    const existing = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlistId },
    })
    if (!existing) throw new NotFoundException('Wishlist item not found')

    if (dto.sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: dto.sessionId, campId: existing.campId },
        select: { id: true },
      })
      if (!session) throw new NotFoundException('Session not found for this camp')
    }

    const item = await this.prisma.wishlistItem.update({
      where: { id: itemId },
      data: { sessionId: dto.sessionId ?? null },
      include: {
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            locationName: true,
            locationLat: true,
            locationLng: true,
            photos: true,
            status: true,
          },
        },
        session: true,
      },
    })

    return this.formatItem(item)
  }

  async removeItem(userId: string, wishlistId: string, itemId: string) {
    await this.assertEditorAccess(userId, wishlistId)

    const existing = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlistId },
    })
    if (!existing) throw new NotFoundException('Wishlist item not found')

    await this.prisma.wishlistItem.delete({ where: { id: itemId } })

    return { message: 'Camp removed from wishlist' }
  }

  async syncCampWishlists(userId: string, dto: SyncCampWishlistsDto) {
    const parent = await this.getParent(userId)

    const camp = await this.prisma.camp.findUnique({
      where: { id: dto.campId },
      select: { id: true, status: true },
    })
    if (camp?.status !== 'published') {
      throw new NotFoundException('Camp not found or not published')
    }

    // Verify all provided wishlist IDs belong to this parent
    if (dto.wishlistIds.length > 0) {
      const owned = await this.prisma.wishlist.findMany({
        where: { id: { in: dto.wishlistIds }, parentId: parent.id, archived: false },
        select: { id: true },
      })
      const ownedIds = new Set(owned.map(w => w.id))
      const invalid = dto.wishlistIds.filter(id => !ownedIds.has(id))
      if (invalid.length) {
        throw new ForbiddenException(
          `Wishlists not found or not owned by you: ${invalid.join(', ')}`
        )
      }
    }

    // Find all wishlists owned by this parent that currently contain the camp
    const existing = await this.prisma.wishlistItem.findMany({
      where: { campId: dto.campId, wishlist: { parentId: parent.id, archived: false } },
      select: { id: true, wishlistId: true },
    })
    const currentWishlistIds = new Set(existing.map(i => i.wishlistId))
    const desiredWishlistIds = new Set(dto.wishlistIds)

    const toAdd = dto.wishlistIds.filter(id => !currentWishlistIds.has(id))
    const toRemove = existing.filter(i => !desiredWishlistIds.has(i.wishlistId))

    await this.prisma.$transaction([
      ...toAdd.map(wishlistId =>
        this.prisma.wishlistItem.create({ data: { wishlistId, campId: dto.campId } })
      ),
      ...toRemove.map(item => this.prisma.wishlistItem.delete({ where: { id: item.id } })),
    ])

    return { added: toAdd.length, removed: toRemove.length }
  }

  // ============================================
  // Sharing
  // ============================================

  async addShare(userId: string, wishlistId: string, dto: ShareWishlistDto) {
    await this.assertOwner(userId, wishlistId)

    // Check if sharing with self
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (owner?.email === dto.email) {
      throw new ForbiddenException('You cannot share a wishlist with yourself')
    }

    // Look up if invited email is a registered user
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    })

    const share = await this.prisma.wishlistShare.upsert({
      where: { wishlistId_email: { wishlistId, email: dto.email } },
      create: {
        wishlistId,
        email: dto.email,
        userId: invitedUser?.id ?? null,
        role: dto.role ?? WishlistShareRole.viewer,
      },
      update: {
        role: dto.role ?? WishlistShareRole.viewer,
        userId: invitedUser?.id ?? null,
      },
    })

    return this.formatShare(share)
  }

  async updateShareRole(
    userId: string,
    wishlistId: string,
    shareId: string,
    dto: UpdateShareRoleDto
  ) {
    await this.assertOwner(userId, wishlistId)

    const existing = await this.prisma.wishlistShare.findFirst({
      where: { id: shareId, wishlistId },
    })
    if (!existing) throw new NotFoundException('Share not found')

    const share = await this.prisma.wishlistShare.update({
      where: { id: shareId },
      data: { role: dto.role },
    })

    return this.formatShare(share)
  }

  async removeShare(userId: string, wishlistId: string, shareId: string) {
    await this.assertOwner(userId, wishlistId)

    const existing = await this.prisma.wishlistShare.findFirst({
      where: { id: shareId, wishlistId },
    })
    if (!existing) throw new NotFoundException('Share not found')

    await this.prisma.wishlistShare.delete({ where: { id: shareId } })

    return { message: 'Share removed successfully' }
  }

  async toggleLinkSharing(userId: string, wishlistId: string, dto: ToggleLinkSharingDto) {
    const { wishlist } = await this.assertOwner(userId, wishlistId)

    let shareToken = wishlist.shareToken
    if (dto.enabled && !shareToken) {
      shareToken = crypto.randomUUID()
    }

    const updated = await this.prisma.wishlist.update({
      where: { id: wishlistId },
      data: {
        isLinkSharingEnabled: dto.enabled,
        ...(dto.enabled && { shareToken }),
      },
      include: this.wishlistListInclude,
    })

    return this.formatWishlist(updated)
  }
}
