import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { WsInternalEvent } from '../websocket/ws-internal-events'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { ConfigService } from '../../config/config.service'
import {
  bookingGroupWhereByRef,
  generateBookingGroupNumber,
  generateNextBookingLineNumber,
} from '../../common/utils/wc-reference.util'
import { BookingGroupStatus } from '../../generated/client/enums'
import { Prisma } from '../../generated/client/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import type {
  ProviderBookingSortField,
  ProviderBookingTab,
  QueryProviderBookingGroupsDto,
} from '../provider/booking-groups/dto/query-provider-booking-groups.dto'
import {
  PARENT_TAB_STATUS_LIST,
  type ParentBookingSortField,
  type ParentBookingTab,
  type QueryParentBookingGroupsDto,
} from '../user/booking-groups/dto/query-parent-booking-groups.dto'

@Injectable()
export class BookingGroupsService {
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly profilePhotoService: ProfilePhotoService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /** Same SAS URL generation as user/provider GET profile (`ProfilePhotoService.generatePhotoUrl`). */
  private async resolveProfilePhotoSasUrl(
    blobPath: string | null | undefined
  ): Promise<string | null> {
    if (!blobPath) return null
    return this.profilePhotoService.generatePhotoUrl(blobPath)
  }

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

  private pickPrimaryPhotoForSas(
    photos: unknown
  ): { url: string; thumbnail?: string; isPrimary?: boolean; id?: string } | null {
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

  /** Resolve public or SAS URL for camp cover (same rules as listForParent). */
  private async resolveCampCoverImageUrl(photos: unknown): Promise<string | null> {
    const photo = this.pickPrimaryPhotoForSas(photos)
    if (!photo?.url) return null

    const raw = String(photo.url).trim()
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw
    }

    try {
      const [resolved] = await this.generatePhotoUrls([photo])
      const url = resolved?.url
      return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
        ? url
        : null
    } catch {
      return null
    }
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
      where: { parentId: parent.id, ...bookingGroupWhereByRef(params.bookingGroupId) },
      select: {
        id: true,
        status: true,
        campId: true,
        providerId: true,
        sessionId: true,
        bookingGroupNumber: true,
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
        let bookingNumber: string
        try {
          bookingNumber = await generateNextBookingLineNumber(tx, bookingGroup.bookingGroupNumber)
        } catch (e) {
          if (e instanceof Error && e.message === 'BOOKING_LINE_LIMIT') {
            throw new BadRequestException(
              'This booking group cannot add more children (limit reached)'
            )
          }
          throw e
        }
        await tx.booking.create({
          data: {
            bookingNumber,
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
        parentId: parent.id,
        ...bookingGroupWhereByRef(params.bookingGroupId),
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

    const childById = new Map(children.map(c => [c.id, c]))
    const orderedChildren = params.childIds
      .map(id => childById.get(id))
      .filter((c): c is { id: string } => c != null)

    const bookingGroup = await this.prisma.$transaction(async tx => {
      const bookingGroupNumber = await generateBookingGroupNumber(tx, now)
      return tx.bookingGroup.create({
        data: {
          bookingGroupNumber,
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
            create: orderedChildren.map((child, index) => ({
              bookingNumber: `${bookingGroupNumber}-${String(index + 1).padStart(2, '0')}`,
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
              bookingNumber: true,
            },
          },
        },
      })
    })

    return {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
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
        parentId: parent.id,
        ...bookingGroupWhereByRef(bookingGroupId),
      },
      include: {
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            photos: true,
            locationLat: true,
            locationLng: true,
            locationName: true,
            locationAddress: true,
            locationPlaceId: true,
          },
        },
        session: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            sessionDayType: true,
            arrivalTime: true,
            departureTime: true,
          },
        },
        provider: {
          select: {
            legalCompanyName: true,
          },
        },
        bookings: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                dateOfBirth: true,
                photoUrl: true,
              },
            },
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

    const coverImageUrl = await this.resolveCampCoverImageUrl(bookingGroup.camp.photos)

    const lat = bookingGroup.camp.locationLat
    const lng = bookingGroup.camp.locationLng

    const childPhotoSasUrls = await Promise.all(
      bookingGroup.bookings.map(b => this.resolveProfilePhotoSasUrl(b.child.photoUrl))
    )

    return {
      id: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      status: bookingGroup.status,
      campId: bookingGroup.campId,
      sessionId: bookingGroup.sessionId,
      providerId: bookingGroup.providerId,
      specialRequest: bookingGroup.specialRequest,
      subtotalAmount: Number(bookingGroup.subtotalAmount ?? 0),
      discountTotal: Number(bookingGroup.discountTotal ?? 0),
      totalAmount: Number(bookingGroup.totalAmount ?? 0),
      depositAmount: bookingGroup.depositAmount != null ? Number(bookingGroup.depositAmount) : null,
      paidAmount: Number(bookingGroup.paidAmount ?? 0),
      refundedAmount: Number(bookingGroup.refundedAmount ?? 0),
      requestedAt: bookingGroup.requestedAt.toISOString(),
      respondedAt: bookingGroup.respondedAt?.toISOString() ?? null,
      expiresAt: bookingGroup.expiresAt?.toISOString() ?? null,
      updatedAt: bookingGroup.updatedAt.toISOString(),
      camp: {
        id: bookingGroup.camp.id,
        name: bookingGroup.camp.name,
        slug: bookingGroup.camp.slug,
        coverImageUrl,
        locationLat: lat != null ? Number(lat) : null,
        locationLng: lng != null ? Number(lng) : null,
        locationName: bookingGroup.camp.locationName,
        locationAddress: bookingGroup.camp.locationAddress,
        locationPlaceId: bookingGroup.camp.locationPlaceId,
      },
      session: {
        name: bookingGroup.session.name,
        startDate: bookingGroup.session.startDate.toISOString(),
        endDate: bookingGroup.session.endDate.toISOString(),
        sessionDayType: bookingGroup.session.sessionDayType,
        arrivalTime: bookingGroup.session.arrivalTime,
        departureTime: bookingGroup.session.departureTime,
      },
      provider: {
        legalCompanyName: bookingGroup.provider.legalCompanyName,
      },
      bookings: bookingGroup.bookings.map((b, idx) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        childId: b.childId,
        basePrice: Number(b.basePrice ?? 0),
        discountAmount: Number(b.discountAmount ?? 0),
        totalPrice: Number(b.totalPrice ?? 0),
        addOns: b.addOns.map(a => ({
          campId: a.campId,
          addOnId: a.addOnId,
          quantity: a.quantity,
        })),
        child: {
          id: b.child.id,
          firstName: b.child.firstName,
          dateOfBirth: b.child.dateOfBirth?.toISOString() ?? null,
          photoUrl: childPhotoSasUrls[idx] ?? null,
        },
      })),
    }
  }

  /**
   * Parent dashboard: all booking groups with fields needed for list cards.
   */
  async listForParent(userId: string, query: QueryParentBookingGroupsDto = {}) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')

    const tab: ParentBookingTab = query.tab ?? 'upcoming'
    const page = query.page ?? 1
    const limit = query.limit ?? 10
    const sortBy = (query.sortBy ?? 'updatedAt') as ParentBookingSortField
    const sortOrder = query.sortOrder ?? 'desc'

    const allowedStatuses = PARENT_TAB_STATUS_LIST[tab]
    if (query.status && !allowedStatuses.includes(query.status)) {
      throw new BadRequestException('Status does not match the selected tab')
    }

    const where: Prisma.BookingGroupWhereInput = {
      parentId: parent.id,
      status: query.status ?? { in: allowedStatuses },
    }

    let orderBy: Prisma.BookingGroupOrderByWithRelationInput
    switch (sortBy) {
      case 'requestedAt':
        orderBy = { requestedAt: sortOrder }
        break
      case 'totalAmount':
        orderBy = { totalAmount: sortOrder }
        break
      case 'sessionStart':
        orderBy = { session: { startDate: sortOrder } }
        break
      default:
        orderBy = { updatedAt: sortOrder }
    }

    const [total, groupedStatuses, rows] = await Promise.all([
      this.prisma.bookingGroup.count({ where }),
      this.prisma.bookingGroup.groupBy({
        by: ['status'],
        where: { parentId: parent.id },
        _count: { id: true },
      }),
      this.prisma.bookingGroup.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookingGroupNumber: true,
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
      }),
    ])

    const countByStatus = Object.fromEntries(
      groupedStatuses.map(g => [g.status, g._count.id])
    ) as Record<string, number>

    const sum = (statuses: readonly BookingGroupStatus[]) =>
      statuses.reduce((acc, s) => acc + (countByStatus[s] ?? 0), 0)

    const tabCounts: Record<ParentBookingTab, number> = {
      drafts: sum(PARENT_TAB_STATUS_LIST.drafts),
      upcoming: sum(PARENT_TAB_STATUS_LIST.upcoming),
      past: sum(PARENT_TAB_STATUS_LIST.past),
      cancelled: sum(PARENT_TAB_STATUS_LIST.cancelled),
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

    const coverUrlByCampId = new Map<string, string | null>()

    const resolveCoverImageUrl = async (
      campId: string,
      photos: unknown
    ): Promise<string | null> => {
      if (coverUrlByCampId.has(campId)) {
        return coverUrlByCampId.get(campId) ?? null
      }
      const url = await this.resolveCampCoverImageUrl(photos)
      coverUrlByCampId.set(campId, url)
      return url
    }

    const data = await Promise.all(
      rows.map(async row => {
        const coverImageUrl = await resolveCoverImageUrl(row.camp.id, row.camp.photos)
        return {
          id: row.id,
          bookingGroupNumber: row.bookingGroupNumber,
          status: row.status,
          totalAmount: Number(row.totalAmount ?? 0),
          requestedAt: row.requestedAt.toISOString(),
          respondedAt: row.respondedAt?.toISOString() ?? null,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
          camp: {
            id: row.camp.id,
            name: row.camp.name,
            slug: row.camp.slug,
            coverImageUrl,
          },
          session: {
            name: row.session.name,
            startDate: row.session.startDate.toISOString(),
            endDate: row.session.endDate.toISOString(),
          },
          children: await Promise.all(
            row.bookings.map(async b => ({
              id: b.child.id,
              firstName: b.child.firstName,
              dateOfBirth: b.child.dateOfBirth?.toISOString() ?? null,
              photoUrl: await this.resolveProfilePhotoSasUrl(b.child.photoUrl),
            }))
          ),
        }
      })
    )

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        tabCounts,
      },
    }
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
        bookingGroupNumber: true,
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
      bookingGroupNumber: draft.bookingGroupNumber,
      sessionId: draft.sessionId,
      sessionName: draft.session?.name ?? null,
      updatedAt: draft.updatedAt,
      totalAmount: Number(draft.totalAmount ?? 0),
      childrenCount: draft._count.bookings,
    }))
  }

  private static providerTabStatusList(tab: ProviderBookingTab): BookingGroupStatus[] {
    switch (tab) {
      case 'requests':
        return [BookingGroupStatus.request]
      case 'upcoming':
        return [
          BookingGroupStatus.accepted,
          BookingGroupStatus.deposit_paid,
          BookingGroupStatus.fully_paid,
        ]
      case 'at-camp':
        return [BookingGroupStatus.at_camp]
      case 'past':
        return [
          BookingGroupStatus.completed,
          BookingGroupStatus.declined,
          BookingGroupStatus.expired,
        ]
      case 'cancelled':
        return [BookingGroupStatus.cancelled]
      default:
        return [BookingGroupStatus.request]
    }
  }

  /**
   * Provider dashboard: booking groups for this provider (excludes parent drafts).
   * Paginated with optional search and sort; meta includes tab counts (global, not search-scoped).
   */
  async listForProvider(providerId: string, query: QueryProviderBookingGroupsDto = {}) {
    const tab = query.tab ?? 'requests'
    const page = query.page ?? 1
    const limit = query.limit ?? 10
    const sortBy = (query.sortBy ?? 'updatedAt') as ProviderBookingSortField
    const sortOrder = query.sortOrder ?? 'desc'
    const search = query.search?.trim()

    const allowedStatuses = BookingGroupsService.providerTabStatusList(tab)
    if (query.status && !allowedStatuses.includes(query.status)) {
      throw new BadRequestException('Status does not match the selected tab')
    }

    const baseWhere: Prisma.BookingGroupWhereInput = {
      providerId,
      status: query.status ?? { in: allowedStatuses },
    }

    const searchWhere: Prisma.BookingGroupWhereInput = search
      ? {
          OR: [
            { bookingGroupNumber: { contains: search, mode: 'insensitive' } },
            {
              parent: {
                user: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
            { camp: { name: { contains: search, mode: 'insensitive' } } },
            { session: { name: { contains: search, mode: 'insensitive' } } },
            {
              bookings: {
                some: {
                  child: { firstName: { contains: search, mode: 'insensitive' } },
                },
              },
            },
          ],
        }
      : {}

    const where: Prisma.BookingGroupWhereInput =
      search && Object.keys(searchWhere).length > 0 ? { AND: [baseWhere, searchWhere] } : baseWhere

    let orderBy: Prisma.BookingGroupOrderByWithRelationInput
    switch (sortBy) {
      case 'requestedAt':
        orderBy = { requestedAt: sortOrder }
        break
      case 'totalAmount':
        orderBy = { totalAmount: sortOrder }
        break
      case 'sessionStart':
        orderBy = { session: { startDate: sortOrder } }
        break
      case 'status':
        orderBy = { status: sortOrder }
        break
      case 'bookingGroupNumber':
        orderBy = { bookingGroupNumber: sortOrder }
        break
      case 'parentFirstName':
        orderBy = { parent: { user: { firstName: sortOrder } } }
        break
      case 'sessionName':
        orderBy = { session: { name: sortOrder } }
        break
      default:
        orderBy = { updatedAt: sortOrder }
    }

    const [total, groupedStatuses, rows] = await Promise.all([
      this.prisma.bookingGroup.count({ where }),
      this.prisma.bookingGroup.groupBy({
        by: ['status'],
        where: { providerId, status: { not: 'draft' } },
        _count: { id: true },
      }),
      this.prisma.bookingGroup.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookingGroupNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          depositAmount: true,
          refundedAmount: true,
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
          parent: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          provider: {
            select: {
              settings: {
                select: { currency: true },
              },
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
      }),
    ])

    const countByStatus = Object.fromEntries(
      groupedStatuses.map(g => [g.status, g._count.id])
    ) as Record<string, number>

    const sum = (statuses: string[]) =>
      statuses.reduce((acc, s) => acc + (countByStatus[s] ?? 0), 0)

    const tabCounts = {
      requests: countByStatus['request'] ?? 0,
      upcoming: sum(['accepted', 'deposit_paid', 'fully_paid']),
      atCamp: countByStatus['at_camp'] ?? 0,
      past: sum(['completed', 'declined', 'expired']),
      cancelled: countByStatus['cancelled'] ?? 0,
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

    const coverUrlByCampId = new Map<string, string | null>()

    const resolveCoverImageUrl = async (
      campId: string,
      photos: unknown
    ): Promise<string | null> => {
      if (coverUrlByCampId.has(campId)) {
        return coverUrlByCampId.get(campId) ?? null
      }
      const url = await this.resolveCampCoverImageUrl(photos)
      coverUrlByCampId.set(campId, url)
      return url
    }

    const data = await Promise.all(
      rows.map(async row => {
        const coverImageUrl = await resolveCoverImageUrl(row.camp.id, row.camp.photos)
        const currency = row.provider.settings?.currency ?? 'CHF'
        const u = row.parent.user
        const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email
        return {
          id: row.id,
          bookingGroupNumber: row.bookingGroupNumber,
          status: row.status,
          totalAmount: Number(row.totalAmount ?? 0),
          paidAmount: Number(row.paidAmount ?? 0),
          depositAmount: Number(row.depositAmount ?? 0),
          refundedAmount: Number(row.refundedAmount ?? 0),
          currency,
          requestedAt: row.requestedAt.toISOString(),
          respondedAt: row.respondedAt?.toISOString() ?? null,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
          parent: {
            displayName,
            email: u.email,
            phone: u.phone,
          },
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
          children: await Promise.all(
            row.bookings.map(async b => ({
              id: b.child.id,
              firstName: b.child.firstName,
              dateOfBirth: b.child.dateOfBirth?.toISOString() ?? null,
              photoUrl: await this.resolveProfilePhotoSasUrl(b.child.photoUrl),
            }))
          ),
        }
      })
    )

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        tabCounts,
      },
    }
  }

  private formatCampAgeRangeLabel(ageGroups: unknown): string | null {
    if (!Array.isArray(ageGroups) || ageGroups.length === 0) return null
    let min = Infinity
    let max = -Infinity
    for (const g of ageGroups) {
      const o = g as { min?: number; max?: number }
      if (typeof o.min === 'number') min = Math.min(min, o.min)
      if (typeof o.max === 'number') max = Math.max(max, o.max)
    }
    if (min === Infinity || max === -Infinity) return null
    return `${min}–${max} years`
  }

  private sessionTotalCapacity(session: {
    availabilityType: string
    totalSpots: number | null
    ageGroupSpots: unknown
  }): number | null {
    if (session.availabilityType === 'single') {
      return session.totalSpots ?? null
    }
    const ag = session.ageGroupSpots as { spots?: number }[] | null
    if (!ag?.length) return null
    return ag.reduce((s, x) => s + (typeof x.spots === 'number' ? x.spots : 0), 0)
  }

  private durationWeeksFromDates(start: Date, end: Date): number | null {
    const ms = end.getTime() - start.getTime()
    const days = Math.max(0, Math.round(ms / 86400000))
    const weeks = Math.round(days / 7)
    return weeks > 0 ? weeks : null
  }

  async getForProvider(providerId: string, bookingGroupId: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: {
        providerId,
        status: { not: 'draft' },
        ...bookingGroupWhereByRef(bookingGroupId),
      },
      include: {
        camp: {
          select: {
            id: true,
            name: true,
            slug: true,
            photos: true,
            ageGroups: true,
            locationLat: true,
            locationLng: true,
            locationName: true,
            locationAddress: true,
            locationPlaceId: true,
          },
        },
        session: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            sessionDayType: true,
            arrivalTime: true,
            departureTime: true,
            totalSpots: true,
            ageGroupPrices: true,
            ageGroupSpots: true,
            availabilityType: true,
            pricingType: true,
          },
        },
        provider: {
          select: {
            legalCompanyName: true,
            settings: {
              select: { currency: true },
            },
          },
        },
        parent: {
          select: {
            id: true,
            primaryNationality: true,
            secondaryNationality: true,
            languages: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                phoneVerified: true,
                profilePhotoUrl: true,
                bio: true,
                address: true,
                city: true,
                state: true,
                postalCode: true,
                country: true,
                emailVerified: true,
              },
            },
          },
        },
        bookings: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                dateOfBirth: true,
                photoUrl: true,
                gender: true,
                languages: true,
                schoolYear: true,
                schoolCountry: true,
                medicalInfo: true,
                emergencyContacts: true,
                campPreferences: true,
                childInterests: {
                  include: {
                    category: { select: { name: true } },
                  },
                },
              },
            },
            addOns: {
              include: {
                campAddOn: {
                  include: {
                    addOn: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')

    const coverImageUrl = await this.resolveCampCoverImageUrl(bookingGroup.camp.photos)
    const lat = bookingGroup.camp.locationLat
    const lng = bookingGroup.camp.locationLng
    const currency = bookingGroup.provider.settings?.currency ?? 'CHF'
    const u = bookingGroup.parent.user
    const parentDisplayName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email

    const sessionStart = bookingGroup.session.startDate
    const sessionEnd = bookingGroup.session.endDate

    const spotStatuses = [
      'request',
      'accepted',
      'deposit_paid',
      'fully_paid',
      'at_camp',
      'completed',
    ] as const

    const [bookedSpotCount, completedBookingGroupsCount, bookingConversation] = await Promise.all([
      this.prisma.booking.count({
        where: {
          sessionId: bookingGroup.sessionId,
          bookingGroup: { status: { in: [...spotStatuses] } },
        },
      }),
      this.prisma.bookingGroup.count({
        where: {
          parentId: bookingGroup.parent.id,
          id: { not: bookingGroup.id },
          status: 'completed',
        },
      }),
      this.prisma.conversation.findFirst({
        where: {
          contextType: 'BOOKING',
          contextId: bookingGroup.id,
        },
        select: { id: true },
      }),
    ])

    const capacity = this.sessionTotalCapacity(bookingGroup.session)
    const spotsRemaining = capacity != null ? Math.max(0, capacity - bookedSpotCount) : null

    const ageRangeLabel = this.formatCampAgeRangeLabel(bookingGroup.camp.ageGroups)

    const resolvedPhotoUrls = await Promise.all([
      this.resolveProfilePhotoSasUrl(u.profilePhotoUrl),
      ...bookingGroup.bookings.map(b => this.resolveProfilePhotoSasUrl(b.child.photoUrl)),
    ])
    const parentProfilePhotoUrl = resolvedPhotoUrls[0]
    const childProfilePhotoUrls = resolvedPhotoUrls.slice(1)

    return {
      id: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      status: bookingGroup.status,
      currency,
      campId: bookingGroup.campId,
      sessionId: bookingGroup.sessionId,
      providerId: bookingGroup.providerId,
      specialRequest: bookingGroup.specialRequest,
      internalNotes: bookingGroup.internalNotes ?? null,
      subtotalAmount: Number(bookingGroup.subtotalAmount ?? 0),
      discountTotal: Number(bookingGroup.discountTotal ?? 0),
      totalAmount: Number(bookingGroup.totalAmount ?? 0),
      depositAmount: bookingGroup.depositAmount != null ? Number(bookingGroup.depositAmount) : null,
      paidAmount: Number(bookingGroup.paidAmount ?? 0),
      refundedAmount: Number(bookingGroup.refundedAmount ?? 0),
      requestedAt: bookingGroup.requestedAt.toISOString(),
      respondedAt: bookingGroup.respondedAt?.toISOString() ?? null,
      expiresAt: bookingGroup.expiresAt?.toISOString() ?? null,
      updatedAt: bookingGroup.updatedAt.toISOString(),
      discountDetails: bookingGroup.discountDetails ?? null,
      parent: {
        id: bookingGroup.parent.id,
        userId: u.id,
        displayName: parentDisplayName,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        phoneVerified: u.phoneVerified,
        profilePhotoUrl: parentProfilePhotoUrl,
        bio: u.bio ?? null,
        address: u.address,
        city: u.city,
        state: u.state,
        postalCode: u.postalCode,
        country: u.country,
        emailVerified: u.emailVerified,
        languages: bookingGroup.parent.languages ?? [],
        primaryNationality: bookingGroup.parent.primaryNationality,
        secondaryNationality: bookingGroup.parent.secondaryNationality,
      },
      parentStats: {
        completedBookingGroupsCount,
      },
      camp: {
        id: bookingGroup.camp.id,
        name: bookingGroup.camp.name,
        slug: bookingGroup.camp.slug,
        coverImageUrl,
        locationLat: lat != null ? Number(lat) : null,
        locationLng: lng != null ? Number(lng) : null,
        locationName: bookingGroup.camp.locationName,
        locationAddress: bookingGroup.camp.locationAddress,
        locationPlaceId: bookingGroup.camp.locationPlaceId,
      },
      session: {
        name: bookingGroup.session.name,
        startDate: sessionStart.toISOString(),
        endDate: sessionEnd.toISOString(),
        sessionDayType: bookingGroup.session.sessionDayType,
        arrivalTime: bookingGroup.session.arrivalTime,
        departureTime: bookingGroup.session.departureTime,
        durationWeeks: this.durationWeeksFromDates(sessionStart, sessionEnd),
        spotsRemaining,
        ageRangeLabel,
      },
      provider: {
        legalCompanyName: bookingGroup.provider.legalCompanyName,
      },
      messaging: {
        parentUserId: u.id,
        conversationId: bookingConversation?.id ?? null,
      },
      bookings: bookingGroup.bookings.map((b, idx) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        childId: b.childId,
        basePrice: Number(b.basePrice ?? 0),
        discountAmount: Number(b.discountAmount ?? 0),
        totalPrice: Number(b.totalPrice ?? 0),
        providerNote: b.providerNote,
        respondedAt: b.respondedAt?.toISOString() ?? null,
        addOns: b.addOns.map(a => ({
          campId: a.campId,
          addOnId: a.addOnId,
          quantity: a.quantity,
          name: a.campAddOn.addOn.name,
          unitPrice: Number(a.unitPrice ?? 0),
          lineTotal: Number(a.lineTotal ?? 0),
        })),
        child: {
          id: b.child.id,
          firstName: b.child.firstName,
          lastName: b.child.lastName,
          nickname: b.child.nickname,
          dateOfBirth: b.child.dateOfBirth?.toISOString() ?? null,
          photoUrl: childProfilePhotoUrls[idx] ?? null,
          gender: b.child.gender,
          languages: b.child.languages ?? [],
          schoolYear: b.child.schoolYear,
          schoolCountry: b.child.schoolCountry,
          medicalInfo: b.child.medicalInfo,
          emergencyContacts: b.child.emergencyContacts,
          campPreferences: b.child.campPreferences,
          interestLabels: b.child.childInterests.map(ci => ci.category.name),
        },
      })),
    }
  }

  async updateInternalNotesForProvider(
    providerId: string,
    bookingGroupId: string,
    internalNotes: string | null | undefined
  ) {
    if (internalNotes === undefined) {
      throw new BadRequestException('internalNotes is required (use null to clear)')
    }
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: { id: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')

    await this.prisma.bookingGroup.update({
      where: { id: bookingGroup.id },
      data: { internalNotes },
    })

    return { bookingGroupId: bookingGroup.id, internalNotes }
  }

  async requestExtensionForProvider(providerId: string, bookingGroupId: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: { id: true, status: true, expiresAt: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only pending requests can be extended')
    }

    const now = new Date()
    const base =
      bookingGroup.expiresAt && bookingGroup.expiresAt.getTime() > now.getTime()
        ? bookingGroup.expiresAt
        : now
    const extended = new Date(base.getTime() + 24 * 60 * 60 * 1000)

    await this.prisma.bookingGroup.update({
      where: { id: bookingGroup.id },
      data: { expiresAt: extended },
    })

    return { bookingGroupId: bookingGroup.id, expiresAt: extended.toISOString() }
  }

  async submitForParent(userId: string, bookingGroupId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can access bookings')

    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { parentId: parent.id, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        providerId: true,
        expiresAt: true,
        camp: { select: { name: true } },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be submitted')
    }

    const updated = await this.prisma.bookingGroup.update({
      where: { id: bookingGroup.id },
      data: {
        status: 'request',
        requestedAt: new Date(),
      },
      select: { id: true, status: true },
    })

    // Notify provider users of a new booking request
    this.eventEmitter.emit(WsInternalEvent.BookingRequestSubmitted, {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      parentUserId: userId,
      providerId: bookingGroup.providerId,
      campName: bookingGroup.camp.name,
      requestExpiresAt: bookingGroup.expiresAt?.toISOString(),
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
      where: { parentId: parent.id, ...bookingGroupWhereByRef(bookingGroupId) },
      select: { id: true, status: true },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft bookings can be deleted')
    }

    await this.prisma.$transaction(async tx => {
      await tx.booking.deleteMany({ where: { bookingGroupId: bookingGroup.id } })
      await tx.bookingGroup.delete({ where: { id: bookingGroup.id } })
    })

    return { bookingGroupId: bookingGroup.id, deleted: true as const }
  }

  async acceptForProvider(providerId: string, bookingGroupId: string, providerNote?: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        parentId: true,
        camp: { select: { name: true } },
        parent: { select: { userId: true } },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be accepted')
    }

    const now = new Date()
    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          status: 'accepted',
          respondedAt: now,
        },
      })
      await tx.booking.updateMany({
        where: { bookingGroupId: bookingGroup.id },
        data: {
          respondedAt: now,
          providerNote: providerNote ?? null,
        },
      })
    })

    this.eventEmitter.emit(WsInternalEvent.BookingStatusChanged, {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      newStatus: 'accepted',
      previousStatus: 'request',
      parentUserId: bookingGroup.parent.userId,
      providerId,
      campName: bookingGroup.camp.name,
      respondedAt: now.toISOString(),
    })

    return { bookingGroupId: bookingGroup.id, status: 'accepted' }
  }

  async declineForProvider(providerId: string, bookingGroupId: string, providerNote?: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        parentId: true,
        camp: { select: { name: true } },
        parent: { select: { userId: true } },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be declined')
    }

    const now = new Date()
    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          status: 'declined',
          respondedAt: now,
        },
      })
      await tx.booking.updateMany({
        where: { bookingGroupId: bookingGroup.id },
        data: {
          respondedAt: now,
          providerNote: providerNote ?? null,
        },
      })
    })

    this.eventEmitter.emit(WsInternalEvent.BookingStatusChanged, {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      newStatus: 'declined',
      previousStatus: 'request',
      parentUserId: bookingGroup.parent.userId,
      providerId,
      campName: bookingGroup.camp.name,
      respondedAt: now.toISOString(),
    })

    return { bookingGroupId: bookingGroup.id, status: 'declined' }
  }
}
