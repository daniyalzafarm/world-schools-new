import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
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
import { BookingGroupStatus, PaymentMode } from '../../generated/client/enums'
import { Prisma } from '../../generated/client/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import {
  PaymentAuthorizationExpiredError,
  PaymentIntentsService,
} from '../billing/intents/payment-intents.service'
import { PayoutsService } from '../billing/payouts/payouts.service'
import { RefundsService } from '../billing/refunds/refunds.service'
import { RefundsNotificationsService } from '../billing/refunds/notifications/refunds-notifications.service'
import { RedisService } from '../redis/redis.service'
import {
  computeBookingFinancialSnapshot,
  computeGracePeriodDeadline,
  computeProviderResponseDeadline,
} from './booking-snapshot.util'
import { buildBookingPolicySnapshot } from '../billing/shared/cancellation-policy.util'
import type { BookingDeclineReason, SpecialCircumstanceType } from '@world-schools/wc-types'
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
  private readonly logger = new Logger(BookingGroupsService.name)
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly profilePhotoService: ProfilePhotoService,
    private readonly eventEmitter: EventEmitter2,
    private readonly paymentIntentsService: PaymentIntentsService,
    private readonly payoutsService: PayoutsService,
    private readonly refundsService: RefundsService,
    private readonly refundsNotifications: RefundsNotificationsService,
    private readonly redis: RedisService
  ) {}

  // C5 audit fix: how long the submit lock is held. Submit is a sub-second
  // operation in the happy path, but the PaymentIntent create round-trip
  // plus DB writes can occasionally hit 5-10 seconds under load — 30s is
  // generous without being so long that a stuck request blocks legitimate
  // retries forever.
  private static readonly SUBMIT_LOCK_TTL_SECONDS = 30

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
        // Pull the most-recent Payment row so the parent app can decide on
        // reload whether to render the Stripe form (no payment yet, or card
        // not yet authorized) vs. the success panel (already authorized).
        // We order by createdAt DESC + take 1 — for Phase 2 a BookingGroup
        // has at most one in-flight Payment at a time; Phase 3 introduces
        // balance Payments which are evaluated separately by the cron.
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            kind: true,
            status: true,
            stripePaymentIntentId: true,
            stripeSetupIntentId: true,
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
      // Latest Payment summary — used by the booking flow to decide whether
      // to render the Stripe form on reload (the card hasn't been authorized
      // yet) or the success panel (already authorized, awaiting accept). Null
      // for legacy bookings that pre-date Phase 2.
      payment: bookingGroup.payments[0]
        ? {
            id: bookingGroup.payments[0].id,
            kind: bookingGroup.payments[0].kind,
            status: bookingGroup.payments[0].status,
            intentType: bookingGroup.payments[0].stripeSetupIntentId
              ? ('setup_intent' as const)
              : ('payment_intent' as const),
          }
        : null,
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

  /**
   * C4 audit fix: enforce session capacity at submit time, defending against
   * the TOCTOU race between the session-select step in the booking UI and
   * the actual draft → request transition. The session-select check shows
   * the parent the (then-)live spots-remaining; this check guarantees we
   * don't oversell by the time their PaymentIntent fires.
   *
   * Counting strategy:
   *   - `currentParticipants` is the count of `Booking` rows on THIS draft
   *     (those are the spots the parent is about to commit).
   *   - `otherBooked` is the count of `Booking` rows on OTHER bookingGroups
   *     for the same session whose status counts toward capacity:
   *     request/accepted/deposit_paid/fully_paid/at_camp/completed.
   *     Drafts and cancelled/declined/expired bookings do NOT count.
   *   - Capacity comes from the session row (single-spot total OR sum of
   *     per-age-group spots).
   *
   * Throws `ConflictException` if filling this draft would oversell. The 409
   * is intentionally distinct from the 4xx the rest of submit emits so the
   * frontend can surface a different "session is full" error to parents
   * (vs. a generic validation failure).
   *
   * Capacity = null means "unlimited" (legacy bookings or admin sessions
   * with no cap). Skip the check in that case.
   */
  private async assertSessionCapacityAvailable(
    bookingGroupId: string,
    sessionId: string,
    session: { availabilityType: string; totalSpots: number | null; ageGroupSpots: unknown }
  ): Promise<void> {
    const capacity = this.sessionTotalCapacity(session)
    if (capacity == null) return

    const [currentParticipants, otherBooked] = await Promise.all([
      this.prisma.booking.count({ where: { bookingGroupId } }),
      this.prisma.booking.count({
        where: {
          sessionId,
          bookingGroupId: { not: bookingGroupId },
          bookingGroup: {
            status: {
              in: [
                BookingGroupStatus.request,
                BookingGroupStatus.accepted,
                BookingGroupStatus.deposit_paid,
                BookingGroupStatus.fully_paid,
                BookingGroupStatus.at_camp,
                BookingGroupStatus.completed,
              ],
            },
          },
        },
      }),
    ])

    if (otherBooked + currentParticipants > capacity) {
      const remaining = Math.max(0, capacity - otherBooked)
      throw new ConflictException(
        `Session is now full. Only ${remaining} spot(s) remaining (your booking has ${currentParticipants} participant(s)).`
      )
    }
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

  /**
   * Submits a draft BookingGroup as a `request`, computes the immutable
   * payment snapshots (app fee, deposit, balance due, transfer date) and
   * authorizes a Stripe PaymentIntent (or SetupIntent for far-future no-deposit
   * bookings). Returns the client secret + payment metadata so the frontend
   * can confirm the card with Stripe Elements.
   *
   * Lifecycle:
   *   draft → request   (status transition + snapshots persisted)
   *   then                authorize via PaymentIntentsService
   *
   * If the Stripe authorize call fails, the BookingGroup stays as `draft` so
   * the parent can retry without losing their selections.
   */
  async submitForParent(userId: string, bookingGroupId: string) {
    // C5 audit fix: serialize concurrent submit attempts against the same
    // (user, bookingGroup) pair via a Redis SET-NX lock. Stripe's
    // PaymentIntent idempotency key + the unique constraint on
    // `Payment.idempotencyKey` already prevent duplicate intents at the
    // storage layer, but a naked concurrent retry would surface as a 500
    // (unique-violation) on the second request. The lock collapses that
    // race to a clean 409 the frontend can interpret as "already in
    // flight, please wait". Redis unavailable → fall through (the storage
    // guarantees still hold).
    return this.withSubmitLock(userId, bookingGroupId, () =>
      this.submitForParentLocked(userId, bookingGroupId)
    )
  }

  private async withSubmitLock<T>(
    userId: string,
    bookingGroupId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const client = this.redis.getClient()
    if (!client) return fn()
    const lockKey = `submit:bg:${userId}:${bookingGroupId}`
    const acquired = await client.set(
      lockKey,
      '1',
      'EX',
      BookingGroupsService.SUBMIT_LOCK_TTL_SECONDS,
      'NX'
    )
    if (!acquired) {
      throw new ConflictException(
        'A submission for this booking is already in progress. Please wait a moment and try again.'
      )
    }
    try {
      return await fn()
    } finally {
      await client.del(lockKey).catch(() => {
        /* lock auto-expires; ignore delete failures */
      })
    }
  }

  private async submitForParentLocked(userId: string, bookingGroupId: string) {
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
        sessionId: true,
        totalAmount: true,
        expiresAt: true,
        // Snapshot fields needed for the resume case (status=request reload).
        paymentMode: true,
        depositAmount: true,
        // Per-camp deposit settings — snapshotted onto Camp at create time
        // (with provider-level defaults), editable per-camp on the
        // edit/sessions page. Read directly off the camp; provider-level
        // settings are NOT consulted here.
        camp: {
          select: {
            name: true,
            depositRequired: true,
            depositType: true,
            depositPercentage: true,
            depositFixedAmount: true,
          },
        },
        // C4 audit fix: select the capacity fields so submit can re-check
        // session availability before locking in a PaymentIntent. The select
        // mirrors what `sessionTotalCapacity` consumes — both single-spot
        // and per-age-group session types are covered.
        session: {
          select: {
            startDate: true,
            availabilityType: true,
            totalSpots: true,
            ageGroupSpots: true,
          },
        },
        provider: {
          select: {
            appFeeCustom: true,
            appFeePercentage: true,
            settings: {
              select: {
                payoutMode: true,
                earlyPayoutOffsetDays: true,
                timezone: true,
                cancellationPolicy: true,
                cancellationPolicyCustom: true,
                cancellationPolicySpecialCircumstances: true,
              },
            },
          },
        },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')

    // Resume case: parent already submitted in a prior session and reloaded
    // the review-and-pay screen (or closed the tab mid-3DS). Snapshots are
    // already on the row; we just need to return the existing PaymentIntent's
    // fresh client secret so Elements can pick up where it left off.
    //
    // `authorizeForPaymentMode` is idempotent — it returns the existing
    // Payment row's clientSecret when one is in a non-terminal state,
    // creating a new intent only when none exists. So calling it again here
    // collapses to the resume case automatically.
    if (bookingGroup.status === 'request') {
      if (!bookingGroup.paymentMode) {
        throw new BadRequestException(
          'Cannot resume payment: booking has no paymentMode snapshot. Contact support.'
        )
      }
      const paymentResponse = await this.authorizeForPaymentMode(
        bookingGroup.id,
        bookingGroup.paymentMode,
        bookingGroup.depositAmount,
        bookingGroup.totalAmount
      )
      return {
        bookingGroupId: bookingGroup.id,
        status: bookingGroup.status,
        payment: paymentResponse,
      }
    }

    if (bookingGroup.status !== 'draft') {
      throw new BadRequestException('Only draft or in-progress bookings can be submitted')
    }

    // C4 audit fix: re-check session capacity right before the draft → request
    // transition. The session-select UI capacity check is necessary but not
    // sufficient — multiple parents on the review-and-pay screen can race
    // each other to the last spot. We rely on the booking-group `findFirst`
    // above to have row-locked the draft already; here we count siblings
    // and compare against the snapshotted capacity to fail-fast before
    // the Stripe PaymentIntent is created.
    await this.assertSessionCapacityAvailable(bookingGroup.id, bookingGroup.sessionId, {
      availabilityType: bookingGroup.session.availabilityType,
      totalSpots: bookingGroup.session.totalSpots,
      ageGroupSpots: bookingGroup.session.ageGroupSpots,
    })

    const now = new Date()

    // Snapshot app fee + deposit + balance-due-at + payment mode. These
    // values become the audit-grade source of truth for refund and payout
    // math even if the provider edits their settings later.
    const systemSettings = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', defaultAppFee: 10 },
      update: {},
    })
    const snapshot = computeBookingFinancialSnapshot({
      totalAmount: bookingGroup.totalAmount,
      sessionStartDate: bookingGroup.session.startDate,
      providerAppFeeCustom: bookingGroup.provider.appFeeCustom,
      providerAppFeePercentage: bookingGroup.provider.appFeePercentage,
      systemDefaultAppFee: systemSettings.defaultAppFee,
      // Phase 9: deposit settings now live on the camp (snapshotted from the
      // provider on camp creation, editable per-camp). Provider-level
      // ProviderSettings.deposit* is the default for new camps only — the
      // booking submit path reads off the camp directly.
      depositSettings: bookingGroup.camp,
      now,
    })

    // Phase 8: snapshot the provider's payout mode (and offset days when in
    // offset_days mode) at submission. The schedule itself is generated at
    // acceptance, when `gracePeriodEndsAt` is known. Snapshotting here means
    // post-submit edits to ProviderSettings.payoutMode don't retroactively
    // shift in-flight bookings.
    const settings = bookingGroup.provider.settings
    const payoutMode = settings?.payoutMode ?? 'default_after_start'
    const payoutOffsetDaysSnapshot =
      payoutMode === 'offset_days' ? (settings?.earlyPayoutOffsetDays ?? null) : null
    const expiresAt = computeProviderResponseDeadline(now)

    // Cancellation-policy snapshot — same consumer-protection invariant as
    // the payout snapshot above: the parent's refund schedule must not move
    // if the provider edits their policy after acceptance. Read by
    // `RefundsService.evaluatePolicy` and `PayoutsService` tier-date math.
    const cancellationPolicySnapshot = buildBookingPolicySnapshot({
      policyName: settings?.cancellationPolicy ?? 'moderate',
      cancellationPolicyCustom: settings?.cancellationPolicyCustom ?? null,
      cancellationPolicySpecialCircumstances:
        settings?.cancellationPolicySpecialCircumstances ?? null,
      now,
    })

    // C5 audit fix: persist snapshot + transition draft → request via a
    // status-guarded updateMany. If two concurrent submits race, only the
    // first transition wins; the loser sees `count: 0` and re-routes through
    // the resume path (which is idempotent end-to-end via the existing
    // `authorizeForPaymentMode` dedup). This prevents two parallel writes of
    // identical snapshots and — more importantly — eliminates the only
    // remaining surface where two callers could both think they "won" the
    // draft→request flip.
    //
    // If the Stripe call below fails, we roll back via the catch handler.
    const transitionResult = await this.prisma.bookingGroup.updateMany({
      where: { id: bookingGroup.id, status: 'draft' },
      data: {
        status: 'request',
        requestedAt: now,
        expiresAt,
        appFeePercentageSnapshot: snapshot.appFeePercentageSnapshot,
        serviceFeeAmount: snapshot.serviceFeeAmount,
        depositAmount: snapshot.depositAmount,
        paymentMode: snapshot.paymentMode,
        balanceDueAt: snapshot.balanceDueAt,
        payoutMode,
        payoutOffsetDaysSnapshot,
        cancellationPolicySnapshot: cancellationPolicySnapshot as unknown as Prisma.InputJsonValue,
      },
    })
    if (transitionResult.count === 0) {
      // A concurrent submit raced past us between our `findFirst` and this
      // update. Re-read the booking and route through the resume-path
      // semantics so this request still returns a usable clientSecret.
      const refreshed = await this.prisma.bookingGroup.findUnique({
        where: { id: bookingGroup.id },
        select: { status: true, paymentMode: true, depositAmount: true, totalAmount: true },
      })
      if (refreshed?.status === 'request' && refreshed.paymentMode) {
        const paymentResponse = await this.authorizeForPaymentMode(
          bookingGroup.id,
          refreshed.paymentMode,
          refreshed.depositAmount,
          refreshed.totalAmount
        )
        return {
          bookingGroupId: bookingGroup.id,
          status: 'request' as BookingGroupStatus,
          payment: paymentResponse,
        }
      }
      throw new ConflictException('Booking submit lost a concurrent race; please retry')
    }

    // Authorize the Stripe intent matching the resolved paymentMode. The
    // PaymentIntentsService is idempotent — a retry of submit (e.g. due to a
    // transient Stripe outage) returns the existing intent's client secret
    // rather than creating a duplicate.
    let paymentResponse: SubmitPaymentResponse
    try {
      paymentResponse = await this.authorizeForPaymentMode(
        bookingGroup.id,
        snapshot.paymentMode,
        snapshot.depositAmount,
        bookingGroup.totalAmount
      )
    } catch (err) {
      // Roll back the status transition + null out the snapshots so the
      // parent can retry without their booking being stuck in `request`
      // with stale values from a failed submit. The snapshots are
      // recomputed on the next attempt anyway, but leaving stale values
      // visible to debug / admin tooling is a foot-gun.
      await this.prisma.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          status: 'draft',
          expiresAt: null,
          appFeePercentageSnapshot: null,
          serviceFeeAmount: null,
          depositAmount: null,
          paymentMode: null,
          balanceDueAt: null,
          transferDate: null,
          cancellationPolicySnapshot: Prisma.JsonNull,
        },
      })
      throw err
    }

    this.eventEmitter.emit(WsInternalEvent.BookingRequestSubmitted, {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      parentUserId: userId,
      providerId: bookingGroup.providerId,
      campName: bookingGroup.camp.name,
      requestExpiresAt: expiresAt.toISOString(),
    })

    return {
      bookingGroupId: bookingGroup.id,
      status: 'request' as BookingGroupStatus,
      payment: paymentResponse,
    }
  }

  /**
   * Dispatches to the right billing call based on the resolved payment mode.
   * Returned shape is consistent across modes so the frontend has a single
   * code path to confirm the intent (PaymentIntent → confirmPayment, SetupIntent
   * → confirmSetup).
   */
  private async authorizeForPaymentMode(
    bookingGroupId: string,
    paymentMode: PaymentMode,
    depositAmount: Prisma.Decimal | null,
    totalAmount: Prisma.Decimal
  ): Promise<SubmitPaymentResponse> {
    switch (paymentMode) {
      case PaymentMode.deposit_then_balance: {
        const result = await this.paymentIntentsService.authorizeDeposit(bookingGroupId)
        return {
          intentType: 'payment_intent',
          kind: 'deposit',
          paymentId: result.paymentId,
          intentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          amount: depositAmount?.toFixed(2) ?? result.amount,
          currency: result.currency,
        }
      }
      case PaymentMode.full_at_booking: {
        const result = await this.paymentIntentsService.authorizeFull(bookingGroupId)
        return {
          intentType: 'payment_intent',
          kind: 'full',
          paymentId: result.paymentId,
          intentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          amount: result.amount,
          currency: result.currency,
        }
      }
      case PaymentMode.full_at_due: {
        const result = await this.paymentIntentsService.createSetupIntent(bookingGroupId)
        return {
          intentType: 'setup_intent',
          kind: 'setup',
          paymentId: result.paymentId,
          intentId: result.setupIntentId,
          clientSecret: result.clientSecret,
          // Setup mode has no current charge — surface the future amount so
          // the frontend can render "You'll be charged €2,000 on Jul 15."
          amount: totalAmount.toFixed(2),
          // Currency on the placeholder is stored downstream; surface from
          // the Payment row that createSetupIntent persisted.
          currency: await this.currencyForPaymentId(result.paymentId),
        }
      }
      default:
        throw new Error(`Unknown payment mode: ${paymentMode}`)
    }
  }

  private async currencyForPaymentId(paymentId: string): Promise<string> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { currency: true },
    })
    return payment.currency
  }

  /**
   * Pulls every non-terminal Payment for the booking from Stripe and syncs
   * the local row to the live state. The frontend calls this immediately
   * after `stripe.confirmPayment` resolves so the UI doesn't depend on the
   * webhook arriving (helpful in dev where `stripe listen` may not be
   * forwarding events).
   *
   * Idempotent: runs the same handler logic that webhooks invoke, so
   * concurrent webhook delivery + sync calls converge to the same DB state.
   */
  async syncPaymentForParent(userId: string, bookingGroupId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can sync bookings')

    const group = await this.prisma.bookingGroup.findFirst({
      where: { parentId: parent.id, ...bookingGroupWhereByRef(bookingGroupId) },
      select: { id: true },
    })
    if (!group) throw new NotFoundException('Booking group not found')

    await this.paymentIntentsService.syncForBookingGroup(group.id)
    return { bookingGroupId: group.id, synced: true as const }
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

  /**
   * Read-only refund preview for the parent's "Cancel booking" UI. Shows the
   * exact amount that would be refunded right now (per-payment breakdown) and
   * which refund mode applies (`grace`, `policy`, `void_auth`, or
   * `not_cancelable`). The frontend uses this to populate the confirmation
   * modal so the parent never confirms a refund whose amount they didn't see.
   *
   * Idempotent + side-effect-free. Calling this many times is cheap.
   */
  async previewParentCancel(
    userId: string,
    bookingGroupId: string,
    options: { circumstance?: SpecialCircumstanceType | null } = {}
  ) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can cancel bookings')

    const owned = await this.prisma.bookingGroup.findFirst({
      where: { parentId: parent.id, ...bookingGroupWhereByRef(bookingGroupId) },
      select: { id: true },
    })
    if (!owned) throw new NotFoundException('Booking group not found')

    return this.refundsService.previewParentCancel(owned.id, {
      circumstance: options.circumstance ?? null,
    })
  }

  /**
   * Parent-initiated cancellation. Routes to the right path based on the
   * live booking state:
   *   - status=request (or any pre-capture state) → void the auth + mark cancelled
   *   - succeeded payments + within 48h grace → grace-period 100% refund
   *   - succeeded payments + post-grace → policy-tier % refund (deposit kept)
   *   - any non-cancelable status → 400.
   *
   * Ownership is enforced before delegating to RefundsService; the service
   * holds a Redis lock for the duration so concurrent cancel clicks resolve
   * to one execution. Status is re-checked under the lock to defeat any
   * preview→confirm race against a webhook-driven status change.
   */
  async cancelForParent(
    userId: string,
    bookingGroupId: string,
    options: { circumstance?: SpecialCircumstanceType | null } = {}
  ) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!parent) throw new ForbiddenException('Only parents can cancel bookings')

    const owned = await this.prisma.bookingGroup.findFirst({
      where: { parentId: parent.id, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        camp: { select: { name: true } },
      },
    })
    if (!owned) throw new NotFoundException('Booking group not found')

    // Pass voidAuthFn so the pre-capture path can void the open auth /
    // SetupIntent. PaymentIntentsService.cancelForBookingGroup is idempotent
    // and scoped to non-terminal intents — safe to call from inside a
    // booking lock.
    const result = await this.refundsService.cancelForParent({
      bookingGroupId: owned.id,
      parentUserId: userId,
      circumstance: options.circumstance ?? null,
      voidAuthFn: id =>
        this.paymentIntentsService.cancelForBookingGroup(id, 'requested_by_customer').then(() => {
          /* discard */
        }),
    })

    this.eventEmitter.emit(WsInternalEvent.BookingStatusChanged, {
      bookingGroupId: owned.id,
      bookingGroupNumber: owned.bookingGroupNumber,
      newStatus: 'cancelled',
      previousStatus: owned.status,
      parentUserId: userId,
      campName: owned.camp.name,
      respondedAt: new Date().toISOString(),
    })

    // Best-effort confirmation email. We sum refund amounts from the actual
    // Refund rows that were created (not from a pre-cancel preview) so the
    // numbers in the email exactly match what was issued. The
    // `not_cancelable` case is unreachable here — RefundsService.cancelForParent
    // throws BadRequestException for it before this code runs.
    const refundedTotal = result.refunds
      .reduce((acc, r) => acc.plus(r.amount), new Prisma.Decimal(0))
      .toFixed(2)
    const currency = await this.resolveBookingCurrency(owned.id)
    const nonRefunded =
      result.mode === 'policy' ? await this.computeNonRefundedAmount(owned.id, refundedTotal) : null
    void this.refundsNotifications
      .notifyParentCancelled({
        bookingGroupId: owned.id,
        mode: result.mode,
        refundedAmountMajor: result.mode === 'void_auth' ? null : refundedTotal,
        nonRefundedAmountMajor: nonRefunded,
        currency,
      })
      .catch(err => {
        // Already logged inside the notifications service. Swallow so
        // the cancel response is unaffected by an SMTP hiccup.
        void err
      })

    return {
      bookingGroupId: owned.id,
      mode: result.mode,
      refundCount: result.refunds.length,
    }
  }

  /**
   * Pulls the currency snapshot from any succeeded payment on the booking,
   * falling back to provider settings. Used by the cancel notification path
   * so the refund amount renders in the correct currency.
   */
  private async resolveBookingCurrency(bookingGroupId: string): Promise<string | null> {
    const anyPayment = await this.prisma.payment.findFirst({
      where: { bookingGroupId, status: { not: 'canceled' } },
      select: { currency: true },
    })
    if (anyPayment?.currency) return anyPayment.currency
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: { provider: { select: { settings: { select: { currency: true } } } } },
    })
    return group?.provider?.settings?.currency ?? null
  }

  /**
   * For policy-mode parent cancels: computes (totalAmount - refundedTotal).
   * The non-refunded amount is what the parent loses to the policy + the
   * non-refundable deposit. Used for transparency in the confirmation email.
   */
  private async computeNonRefundedAmount(
    bookingGroupId: string,
    refundedAmountMajor: string
  ): Promise<string | null> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: { totalAmount: true, paidAmount: true, refundedAmount: true },
    })
    if (!group) return null
    // Use paidAmount (what the parent actually paid) as the basis. The
    // non-refunded amount is paidAmount - (priorRefunded + thisRefund).
    const priorRefunded = group.refundedAmount ?? new Prisma.Decimal(0)
    const thisRefund = new Prisma.Decimal(refundedAmountMajor)
    const nonRefunded = (group.paidAmount ?? new Prisma.Decimal(0))
      .minus(priorRefunded)
      .minus(thisRefund)
    if (nonRefunded.isNegative() || nonRefunded.isZero()) return null
    return nonRefunded.toFixed(2)
  }

  /**
   * Provider accepts the booking. Captures any manual-capture PaymentIntent
   * (deposit or full-at-booking) and starts the 48h grace-period countdown.
   *
   * Status transitions:
   *   request → accepted   (this method)
   *   accepted → deposit_paid / fully_paid   (via payment_intent.succeeded webhook)
   *
   * Stale auth handling: if the card hold expired before acceptance (rare —
   * card auths typically last 7d, our 72h response window is well within),
   * we throw `412 Precondition Failed` with code `PAYMENT_AUTH_EXPIRED` so
   * the provider UI can surface a "ask parent to re-enter card" path. The
   * BookingGroup stays in `request` for the parent to retry.
   */
  async acceptForProvider(providerId: string, bookingGroupId: string, providerNote?: string) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        parentId: true,
        totalAmount: true,
        camp: { select: { name: true } },
        parent: { select: { userId: true } },
        session: { select: { startDate: true, endDate: true } },
        provider: { select: { settings: { select: { currency: true } } } },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be accepted')
    }

    const now = new Date()
    const gracePeriodEndsAt = computeGracePeriodDeadline(now)

    // Capture before flipping status: if the capture fails (stale auth),
    // we want the BookingGroup to remain in `request` so the parent can
    // retry payment. Capture is idempotent for already-succeeded intents
    // (no-op) and for the SetupIntent path (the captureForBookingGroup
    // query is scoped to manual-capture intents, so the SetupIntent
    // placeholder is left alone).
    try {
      await this.paymentIntentsService.captureForBookingGroup(bookingGroup.id)
    } catch (err) {
      if (err instanceof PaymentAuthorizationExpiredError) {
        throw new PreconditionFailedException({
          message:
            "The parent's card authorization has expired. Ask them to re-enter their card before accepting.",
          code: 'PAYMENT_AUTH_EXPIRED',
          paymentId: err.paymentId,
        })
      }
      throw err
    }

    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          status: 'accepted',
          respondedAt: now,
          gracePeriodEndsAt,
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

    // Phase 8: with `gracePeriodEndsAt` set + capture complete, generate the
    // payout schedule. The schedule reads the booking's snapshotted
    // `payoutMode` (frozen at submit) and writes one or more
    // BookingPayoutSchedule rows. Failure to schedule MUST NOT roll back
    // acceptance — log and let ops reconcile via the (still-cron-safe)
    // generator. The cron's idempotency guard means a manual rerun is safe.
    try {
      await this.payoutsService.generateScheduleForBooking(bookingGroup.id)
    } catch (err) {
      this.logger.error(
        `acceptForProvider: failed to generate payout schedule for ${bookingGroup.id}: ${(err as Error).message}`,
        (err as Error).stack
      )
    }

    this.eventEmitter.emit(WsInternalEvent.BookingStatusChanged, {
      bookingGroupId: bookingGroup.id,
      bookingGroupNumber: bookingGroup.bookingGroupNumber,
      newStatus: 'accepted',
      previousStatus: 'request',
      parentUserId: bookingGroup.parent.userId,
      providerId,
      campName: bookingGroup.camp.name,
      respondedAt: now.toISOString(),
      chargedAmount: Number(bookingGroup.totalAmount),
      currency: bookingGroup.provider.settings?.currency ?? undefined,
      sessionStartDate: bookingGroup.session.startDate.toISOString(),
      sessionEndDate: bookingGroup.session.endDate.toISOString(),
    })

    return { bookingGroupId: bookingGroup.id, status: 'accepted' }
  }

  /**
   * Provider declines the booking. Voids any open card authorizations (and
   * cancels any SetupIntent placeholders) so the parent never sees a charge.
   * Idempotent — already-canceled intents return without error.
   *
   * Provider Terms v1.5 §5.1(h)(iii) requires every decline to carry a
   * reason from the controlled list, persisted to enable §5.1(h)(iv)
   * pattern monitoring.
   */
  async declineForProvider(
    providerId: string,
    bookingGroupId: string,
    args: {
      declineReason: BookingDeclineReason
      declineReasonOther?: string
      providerNote?: string
    }
  ) {
    const bookingGroup = await this.prisma.bookingGroup.findFirst({
      where: { providerId, ...bookingGroupWhereByRef(bookingGroupId) },
      select: {
        id: true,
        status: true,
        bookingGroupNumber: true,
        parentId: true,
        camp: { select: { name: true } },
        parent: { select: { userId: true } },
        session: { select: { startDate: true, endDate: true } },
        provider: { select: { settings: { select: { currency: true } } } },
      },
    })
    if (!bookingGroup) throw new NotFoundException('Booking group not found')
    if (bookingGroup.status !== 'request') {
      throw new BadRequestException('Only requested bookings can be declined')
    }

    // Void the auth before flipping status. If this fails (transient Stripe
    // error), the booking stays in `request` so the cron / a manual retry
    // can re-attempt — better than declining the booking but leaving an
    // open auth on the parent's card.
    await this.paymentIntentsService.cancelForBookingGroup(bookingGroup.id, 'requested_by_customer')

    const now = new Date()
    await this.prisma.$transaction(async tx => {
      await tx.bookingGroup.update({
        where: { id: bookingGroup.id },
        data: {
          status: 'declined',
          respondedAt: now,
          declineReason: args.declineReason,
          declineReasonOther:
            args.declineReason === 'other' ? (args.declineReasonOther ?? null) : null,
        },
      })
      await tx.booking.updateMany({
        where: { bookingGroupId: bookingGroup.id },
        data: {
          respondedAt: now,
          providerNote: args.providerNote ?? null,
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
      currency: bookingGroup.provider.settings?.currency ?? undefined,
      sessionStartDate: bookingGroup.session.startDate.toISOString(),
      sessionEndDate: bookingGroup.session.endDate.toISOString(),
      declineReason: args.declineReason,
    })

    return { bookingGroupId: bookingGroup.id, status: 'declined' }
  }
}

/**
 * Public response shape for `submitForParent` / `POST /user/booking-groups/:id/submit`.
 * The frontend reads this to know which Stripe.js confirmation method to
 * call (`stripe.confirmPayment` for payment_intent, `stripe.confirmSetup`
 * for setup_intent).
 */
export interface SubmitPaymentResponse {
  intentType: 'payment_intent' | 'setup_intent'
  kind: 'deposit' | 'full' | 'setup'
  paymentId: string
  intentId: string
  clientSecret: string
  /// Major-unit string ("600.00"). For setup_intent this is the FUTURE charge
  /// amount (the full balance) — useful for "you'll be charged X" copy.
  amount: string
  /// ISO 4217 lowercase (e.g. "eur").
  currency: string
}
