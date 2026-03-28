import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class BookingGroupsService {
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Same as {@link UserCampsService#getAzureStorage} — camp images use this path.
   */
  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new Error('Azure Storage is not configured. Please contact the administrator.')
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Same as {@link UserCampsService#generatePhotoUrls} — SAS URLs for camp photo JSON.
   */
  private async generatePhotoUrls(photos: any[]): Promise<any[]> {
    const azureStorage = this.getAzureStorage()
    return Promise.all(
      photos.map(async photo => {
        try {
          const sasUrl = await azureStorage.generateSasUrl(photo.url, 24)
          return {
            ...photo,
            url: sasUrl,
            thumbnail: sasUrl,
          }
        } catch {
          return photo
        }
      })
    )
  }

  async updateDraftForParent(params: {
    userId: string
    bookingGroupId: string
    sessionId: string
    childIds: string[]
  }) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId: params.userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can modify bookings')
    if (!params.childIds.length) throw new BadRequestException('At least one child is required')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { id: params.bookingGroupId, parentId: parent.id },
      select: {
        id: true,
        status: true,
        campId: true,
        providerId: true,
        sessionId: true,
        bookings: {
          select: {
            id: true,
            childId: true,
            basePrice: true,
            addOns: {
              select: {
                bookingId: true,
                campId: true,
                addOnId: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
                snapshot: true,
              },
            },
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be modified')
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: params.sessionId,
        campId: bookingGroup.campId,
        status: 'published',
      },
      include: {
        camp: {
          select: {
            providerId: true,
          },
        },
      },
    })
    if (!session) throw new BadRequestException('Session is invalid for this booking group')
    if (session.camp.providerId !== bookingGroup.providerId) {
      throw new BadRequestException('Session provider mismatch')
    }

    const children = await this.prisma.children.findMany({
      where: {
        id: { in: params.childIds },
        parentId: parent.id,
        archived: false,
      },
      select: { id: true },
    })
    if (children.length !== params.childIds.length) {
      throw new BadRequestException('One or more children are invalid')
    }

    const nextChildIdSet = new Set(params.childIds)
    const existingByChildId = new Map(bookingGroup.bookings.map(b => [b.childId, b]))
    const removedBookingIds = bookingGroup.bookings
      .filter(b => !nextChildIdSet.has(b.childId))
      .map(b => b.id)

    const qtyRowsByBookingId = bookingGroup.bookings.flatMap(booking =>
      booking.addOns
        .filter(row => (row.snapshot as any)?.mode === 'qty')
        .map(row => ({
          bookingId: booking.id,
          campId: row.campId,
          addOnId: row.addOnId,
          quantity: row.quantity,
          unitPrice: Number(row.unitPrice ?? 0),
          lineTotal: Number(row.lineTotal ?? 0),
          snapshot: row.snapshot,
        }))
    )

    const sessionPrice = Number(session.price ?? 0)

    await this.prisma.$transaction(async tx => {
      if (removedBookingIds.length > 0) {
        await tx.booking.deleteMany({
          where: { id: { in: removedBookingIds } },
        })
      }

      // Create booking rows for newly selected children.
      for (const childId of params.childIds) {
        if (existingByChildId.has(childId)) continue
        await tx.booking.create({
          data: {
            bookingGroupId: bookingGroup.id,
            sessionId: session.id,
            campId: bookingGroup.campId,
            providerId: bookingGroup.providerId,
            parentId: parent.id,
            childId,
            startDate: session.startDate,
            endDate: session.endDate,
            basePrice: sessionPrice,
            discountAmount: 0,
            totalPrice: sessionPrice,
          },
        })
      }

      // Update persisted bookings when session is changed.
      const keptBookingIds = bookingGroup.bookings
        .filter(b => nextChildIdSet.has(b.childId))
        .map(b => b.id)

      if (keptBookingIds.length > 0) {
        await tx.booking.updateMany({
          where: { id: { in: keptBookingIds } },
          data: {
            sessionId: session.id,
            startDate: session.startDate,
            endDate: session.endDate,
            basePrice: sessionPrice,
          },
        })
      }

      // Re-map qty add-ons if the previous holder booking was removed.
      const groupBookingsAfterSync = await tx.booking.findMany({
        where: { bookingGroupId: bookingGroup.id },
        select: { id: true },
        orderBy: { childId: 'asc' },
      })
      const remainingBookingIds = groupBookingsAfterSync.map(b => b.id)
      const firstRemainingBookingId = remainingBookingIds[0]

      if (firstRemainingBookingId) {
        for (const qtyRow of qtyRowsByBookingId) {
          if (!removedBookingIds.includes(qtyRow.bookingId)) continue

          const existingQtyRow = await tx.bookingCampAddOn.findFirst({
            where: {
              bookingId: { in: remainingBookingIds },
              campId: qtyRow.campId,
              addOnId: qtyRow.addOnId,
            },
            select: { bookingId: true },
          })
          if (existingQtyRow) continue

          await tx.bookingCampAddOn.create({
            data: {
              bookingId: firstRemainingBookingId,
              campId: qtyRow.campId,
              addOnId: qtyRow.addOnId,
              quantity: qtyRow.quantity,
              unitPrice: qtyRow.unitPrice,
              lineTotal: qtyRow.lineTotal,
              snapshot: JSON.parse(JSON.stringify(qtyRow.snapshot ?? {})),
            },
          })
        }
      }

      // Recompute booking totals and group totals.
      const bookingsWithAddOns = await tx.booking.findMany({
        where: { bookingGroupId: bookingGroup.id },
        select: {
          id: true,
          basePrice: true,
          addOns: {
            select: {
              lineTotal: true,
            },
          },
        },
      })

      let newGroupSubtotal = 0
      for (const booking of bookingsWithAddOns) {
        const addOnsTotal = booking.addOns.reduce((sum, row) => sum + Number(row.lineTotal ?? 0), 0)
        const lineTotal = Number(booking.basePrice ?? 0) + addOnsTotal
        newGroupSubtotal += lineTotal

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            totalPrice: lineTotal,
            discountAmount: 0,
          },
          select: { id: true },
        })
      }

      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          sessionId: session.id,
          subtotalAmount: newGroupSubtotal,
          totalAmount: newGroupSubtotal,
          discountTotal: 0,
          campId: bookingGroup.campId,
          providerId: bookingGroup.providerId,
        },
        select: { id: true },
      })
    })

    return {
      bookingGroupId: bookingGroup.id,
      status: 'draft',
    }
  }

  async saveAddOnsForParent(params: {
    userId: string
    bookingGroupId: string
    addOns: {
      addOnId: string
      mode: 'per_child' | 'per_child_qty' | 'qty'
      quantity?: number
      childIds?: string[]
      childQuantities?: { childId: string; quantity: number }[]
    }[]
    specialRequest?: string
  }) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId: params.userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can modify bookings')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: {
        id: params.bookingGroupId,
        parentId: parent.id,
      },
      select: {
        id: true,
        status: true,
        campId: true,
        specialRequest: true,
        bookings: {
          select: {
            id: true,
            childId: true,
            basePrice: true,
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be modified')
    }

    const bookingIds = bookingGroup.bookings.map(b => b.id)
    if (bookingIds.length === 0) {
      throw new BadRequestException('Booking group has no bookings')
    }

    const addOnSelections = params.addOns
    const uniqueAddOnIds = Array.from(new Set(addOnSelections.map(a => a.addOnId)))

    // Validate add-ons belong to the camp and are enabled.
    const campAddOns = await this.prisma.campAddOn.findMany({
      where: {
        campId: bookingGroup.campId,
        addOnId: { in: uniqueAddOnIds },
        isEnabled: true,
        addOn: { isActive: true },
      },
      include: {
        addOn: true,
      },
    })

    if (campAddOns.length !== uniqueAddOnIds.length) {
      throw new BadRequestException('One or more add-ons are invalid for this camp')
    }

    const campAddOnById = new Map<string, (typeof campAddOns)[number]>()
    for (const ca of campAddOns) campAddOnById.set(ca.addOnId, ca)

    const bookingByChildId = new Map(bookingGroup.bookings.map(b => [b.childId, b]))
    const orderedBookings = [...bookingGroup.bookings].sort((a, b) =>
      a.childId.localeCompare(b.childId)
    )
    const firstBooking = orderedBookings[0]

    // Clear all current add-on selections for all bookings in this group.
    await this.prisma.$transaction(async tx => {
      await tx.bookingCampAddOn.deleteMany({
        where: {
          bookingId: { in: bookingIds },
        },
      })

      // Create desired selections.
      const toCreate: {
        bookingId: string
        campId: string
        addOnId: string
        quantity: number
        unitPrice: number
        lineTotal: number
        snapshot: any
      }[] = []

      for (const selection of addOnSelections) {
        const campAddOn = campAddOnById.get(selection.addOnId)
        if (!campAddOn) continue

        const unitPrice = Number(campAddOn.addOn.price ?? 0)
        if (selection.mode === 'per_child') {
          const childIds = selection.childIds ?? []
          if (childIds.length === 0) continue

          for (const childId of childIds) {
            const booking = bookingByChildId.get(childId)
            if (!booking) {
              throw new BadRequestException('One or more selected children are invalid')
            }
            const qty = 1
            toCreate.push({
              bookingId: booking.id,
              campId: bookingGroup.campId,
              addOnId: selection.addOnId,
              quantity: qty,
              unitPrice,
              lineTotal: unitPrice * qty,
              snapshot: { mode: selection.mode, childId, quantity: qty },
            })
          }
        } else if (selection.mode === 'per_child_qty') {
          const childQuantities = selection.childQuantities ?? []
          if (childQuantities.length === 0) continue

          for (const cq of childQuantities) {
            if (!cq.quantity || cq.quantity <= 0) continue
            const booking = bookingByChildId.get(cq.childId)
            if (!booking) {
              throw new BadRequestException('One or more selected children are invalid')
            }
            const qty = cq.quantity
            toCreate.push({
              bookingId: booking.id,
              campId: bookingGroup.campId,
              addOnId: selection.addOnId,
              quantity: qty,
              unitPrice,
              lineTotal: unitPrice * qty,
              snapshot: {
                mode: selection.mode,
                childId: cq.childId,
                quantity: qty,
              },
            })
          }
        } else {
          // qty mode
          const qty = selection.quantity ?? 0
          if (!qty || qty <= 0) continue
          // Global add-on should count once for the whole group.
          toCreate.push({
            bookingId: firstBooking.id,
            campId: bookingGroup.campId,
            addOnId: selection.addOnId,
            quantity: qty,
            unitPrice,
            lineTotal: unitPrice * qty,
            snapshot: { mode: selection.mode, quantity: qty },
          })
        }
      }

      if (toCreate.length > 0) {
        await tx.bookingCampAddOn.createMany({
          data: toCreate.map(row => ({
            bookingId: row.bookingId,
            campId: row.campId,
            addOnId: row.addOnId,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            lineTotal: row.lineTotal,
            snapshot: row.snapshot,
          })),
        })
      }

      // Recompute booking totals and group totals.
      const addOnsByBookingId = new Map<string, number>()
      for (const row of toCreate) {
        addOnsByBookingId.set(
          row.bookingId,
          (addOnsByBookingId.get(row.bookingId) ?? 0) + row.lineTotal
        )
      }

      const updatedBookings = await Promise.all(
        bookingGroup.bookings.map(b => {
          const addonTotal = addOnsByBookingId.get(b.id) ?? 0
          const newTotal = Number(b.basePrice ?? 0) + addonTotal
          return tx.booking.update({
            where: { id: b.id },
            data: {
              totalPrice: newTotal,
              discountAmount: 0,
            },
            select: { id: true },
          })
        })
      )

      // Ensure Promise.all result is used (avoids unused var lint).
      void updatedBookings

      const newGroupSubtotal = bookingGroup.bookings.reduce((sum, b) => {
        const addonTotal = addOnsByBookingId.get(b.id) ?? 0
        return sum + Number(b.basePrice ?? 0) + addonTotal
      }, 0)

      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          subtotalAmount: newGroupSubtotal,
          totalAmount: newGroupSubtotal,
          discountTotal: 0,
          specialRequest: params.specialRequest ?? undefined,
        },
        select: { id: true, status: true },
      })
    })

    return {
      bookingGroupId: bookingGroup.id,
      status: 'draft',
    }
  }

  async createDraftForParent(params: {
    userId: string
    campId: string
    sessionId: string
    childIds: string[]
    specialRequest?: string
    forceNew?: boolean
  }) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId: params.userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can create bookings')
    if (!params.childIds.length) throw new BadRequestException('At least one child is required')

    const session = await this.prisma.session.findFirst({
      where: {
        id: params.sessionId,
        campId: params.campId,
        status: 'published',
      },
      include: {
        camp: {
          select: {
            providerId: true,
          },
        },
      },
    })
    if (!session) throw new NotFoundException('Session not found')

    const children = await this.prisma.children.findMany({
      where: {
        id: { in: params.childIds },
        parentId: parent.id,
        archived: false,
      },
      select: { id: true },
    })
    if (children.length !== params.childIds.length) {
      throw new BadRequestException('One or more children are invalid')
    }

    if (!params.forceNew) {
      const existingDraft = await this.prisma.bookingGroup.findFirst({
        where: {
          parentId: parent.id,
          campId: params.campId,
          status: 'draft',
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      })

      if (existingDraft) {
        throw new ConflictException({
          code: 'DRAFT_ALREADY_EXISTS',
          bookingGroupId: existingDraft.id,
          message:
            'You already have a draft booking for this camp. Continue your existing booking or create a new one.',
        })
      }
    }

    const sessionPrice = Number(session.price ?? 0)
    const subtotal = sessionPrice * children.length
    const now = new Date()

    const bookingGroup = await this.prisma.bookingGroup.create({
      data: {
        parentId: parent.id,
        sessionId: session.id,
        campId: params.campId,
        providerId: session.camp.providerId,
        subtotalAmount: subtotal,
        totalAmount: subtotal,
        discountTotal: 0,
        paidAmount: 0,
        refundedAmount: 0,
        status: 'draft',
        requestedAt: now,
        // Normalize empty/whitespace to null so reload hydration doesn't
        // incorrectly assume the user already reached the review step.
        specialRequest: params.specialRequest?.trim() ? params.specialRequest : null,
        bookings: {
          create: children.map(child => ({
            sessionId: session.id,
            campId: params.campId,
            providerId: session.camp.providerId,
            parentId: parent.id,
            childId: child.id,
            startDate: session.startDate,
            endDate: session.endDate,
            basePrice: sessionPrice,
            discountAmount: 0,
            totalPrice: sessionPrice,
          })),
        },
      },
      include: {
        bookings: {
          select: {
            id: true,
            childId: true,
          },
        },
      },
    })

    return {
      bookingGroupId: bookingGroup.id,
      status: bookingGroup.status,
      bookings: bookingGroup.bookings,
    }
  }

  async getForParent(userId: string, bookingGroupId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: {
        id: bookingGroupId,
        parentId: parent.id,
      },
      include: {
        bookings: {
          include: {
            addOns: {
              select: {
                campId: true,
                addOnId: true,
                quantity: true,
              },
            },
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')

    return bookingGroup
  }

  /**
   * Parent dashboard: all booking groups with fields needed for list cards.
   */
  async listForParent(userId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')

    const rows = await this.prisma.bookingGroup.findMany({
      where: { parentId: parent.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        requestedAt: true,
        respondedAt: true,
        expiresAt: true,
        updatedAt: true,
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            photos: true,
          },
        },
        session: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        bookings: {
          select: {
            child: {
              select: {
                id: true,
                firstName: true,
                dateOfBirth: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    })

    const pickPrimaryPhotoForSas = (
      photos: unknown
    ): { url: string; thumbnail?: string; isPrimary?: boolean; id?: string } | null => {
      if (!photos || !Array.isArray(photos) || photos.length === 0) return null
      const list = photos as Array<{
        url?: string
        thumbnail?: string
        isPrimary?: boolean
        id?: string
      }>
      const withUrl = list.filter(p => p?.url)
      if (withUrl.length === 0) return null
      const primary = withUrl.find(p => p.isPrimary)
      const chosen = primary ?? withUrl[0]
      return {
        id: chosen.id,
        url: chosen.url as string,
        thumbnail: chosen.thumbnail,
        isPrimary: chosen.isPrimary,
      }
    }

    const coverUrlByCampId = new Map<string, string | null>()

    const resolveCoverImageUrl = async (
      campId: string,
      photos: unknown
    ): Promise<string | null> => {
      if (coverUrlByCampId.has(campId)) {
        return coverUrlByCampId.get(campId) ?? null
      }
      const photo = pickPrimaryPhotoForSas(photos)
      if (!photo?.url) {
        coverUrlByCampId.set(campId, null)
        return null
      }

      const raw = String(photo.url).trim()
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        coverUrlByCampId.set(campId, raw)
        return raw
      }

      try {
        const [resolved] = await this.generatePhotoUrls([photo])
        const url = resolved?.url
        const ok =
          typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
            ? url
            : null
        coverUrlByCampId.set(campId, ok)
        return ok
      } catch {
        coverUrlByCampId.set(campId, null)
        return null
      }
    }

    return Promise.all(
      rows.map(async row => {
        const coverImageUrl = await resolveCoverImageUrl(row.camp.id, row.camp.photos)
        return {
          id: row.id,
          status: row.status,
          totalAmount: Number(row.totalAmount ?? 0),
          requestedAt: row.requestedAt.toISOString(),
          respondedAt: row.respondedAt?.toISOString() ?? null,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
          camp: {
            name: row.camp.name,
            slug: row.camp.slug,
            coverImageUrl,
          },
          session: {
            name: row.session.name,
            startDate: row.session.startDate.toISOString(),
            endDate: row.session.endDate.toISOString(),
          },
          children: row.bookings.map(b => ({
            id: b.child.id,
            firstName: b.child.firstName,
            dateOfBirth: b.child.dateOfBirth?.toISOString() ?? null,
            photoUrl: b.child.photoUrl,
          })),
        }
      })
    )
  }

  async getLatestDraftPreviewsForParent(userId: string, campId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')
    if (!campId) throw new BadRequestException('campId is required')

    const drafts = await this.prisma.bookingGroup.findMany({
      where: {
        parentId: parent.id,
        campId,
        status: 'draft',
      },
      select: {
        id: true,
        sessionId: true,
        updatedAt: true,
        totalAmount: true,
        session: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    })

    return drafts.map(draft => ({
      id: draft.id,
      sessionId: draft.sessionId,
      sessionName: draft.session?.name ?? null,
      updatedAt: draft.updatedAt,
      totalAmount: Number(draft.totalAmount ?? 0),
      childrenCount: draft._count.bookings,
    }))
  }

  async listForProvider(providerId: string) {
    return this.prisma.bookingGroup.findMany({
      where: { providerId },
      include: {
        bookings: {
          select: { id: true, childId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getForProvider(providerId: string, bookingGroupId: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: {
        id: bookingGroupId,
        providerId,
      },
      include: {
        bookings: {
          include: {
            addOns: true,
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    return bookingGroup
  }

  async submitForParent(userId: string, bookingGroupId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { id: bookingGroupId, parentId: parent.id },
      select: { id: true, status: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be submitted')
    }

    const updated = await this.prisma.bookingGroup.update({
      where: { id: bookingGroupId },
      data: {
        status: 'request',
        requestedAt: new Date(),
      },
      select: { id: true, status: true },
    })
    return { bookingGroupId: updated.id, status: updated.status }
  }

  async deleteDraftForParent(userId: string, bookingGroupId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can delete bookings')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { id: bookingGroupId, parentId: parent.id },
      select: { id: true, status: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be deleted')
    }

    await this.prisma.$transaction(async tx => {
      await tx.booking.deleteMany({ where: { bookingGroupId } })
      await tx.bookingGroup.delete({ where: { id: bookingGroupId } })
    })

    return { bookingGroupId, deleted: true as const }
  }

  async acceptForProvider(providerId: string, bookingGroupId: string, providerNote?: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { id: bookingGroupId, providerId },
      select: { id: true, status: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be accepted')
    }

    const now = new Date()
    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroupId },
        data: {
          status: 'accepted',
          respondedAt: now,
        },
      })
      await tx.booking.updateMany({
        where: { bookingGroupId },
        data: {
          respondedAt: now,
          providerNote: providerNote ?? null,
        },
      })
    })

    return { bookingGroupId, status: 'accepted' }
  }

  async declineForProvider(providerId: string, bookingGroupId: string, providerNote?: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { id: bookingGroupId, providerId },
      select: { id: true, status: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be declined')
    }

    const now = new Date()
    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroupId },
        data: {
          status: 'declined',
          respondedAt: now,
        },
      })
      await tx.booking.updateMany({
        where: { bookingGroupId },
        data: {
          respondedAt: now,
          providerNote: providerNote ?? null,
        },
      })
    })

    return { bookingGroupId, status: 'declined' }
  }
}
