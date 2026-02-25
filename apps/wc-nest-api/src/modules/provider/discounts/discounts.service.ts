import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  AddDiscountEntryDto,
  UpdateDiscountEntryDto,
  UpdateGlobalDiscountDto,
} from './dto/global-discount.dto'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify camp ownership
   */
  private async verifyCampOwnership(campId: string, providerId: string) {
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: { providerId: true },
    })

    if (!camp) {
      throw new NotFoundException('Camp not found')
    }

    if (camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have access to this camp')
    }
  }

  /**
   * Get all global discounts for a camp
   */
  async getGlobalDiscounts(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)

    return this.prisma.globalDiscount.findMany({
      where: { campId },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * Update a global discount (category level)
   * Can update entries array or isEnabled flag
   *
   * LAZY CREATION: If discount doesn't exist and isEnabled=true, creates it
   */
  async updateGlobalDiscount(
    discountId: string,
    campId: string,
    providerId: string,
    dto: UpdateGlobalDiscountDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (discount?.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: {
        ...(dto.entries !== undefined && { entries: dto.entries as any }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    })
  }

  /**
   * Create a global discount entry (lazy creation)
   * Called when a camp director enables a discount type for the first time
   * Creates the discount with an empty entries array - entries are added via separate API calls
   */
  async createGlobalDiscount(
    campId: string,
    providerId: string,
    category: string,
    sortOrder: number
  ) {
    await this.verifyCampOwnership(campId, providerId)

    // Check if discount already exists
    const existing = await this.prisma.globalDiscount.findUnique({
      where: {
        campId_category: {
          campId,
          category: category as any,
        },
      },
    })

    if (existing) {
      return existing
    }

    // Create new discount entry with empty entries array
    // Entries will be added via addDiscountEntry API
    return this.prisma.globalDiscount.create({
      data: {
        campId,
        category: category as any,
        entries: [], // Always start with empty array
        isEnabled: true,
        sortOrder,
      },
    })
  }

  /**
   * Add a new entry to a discount category
   */
  async addDiscountEntry(
    discountId: string,
    campId: string,
    providerId: string,
    dto: AddDiscountEntryDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (discount?.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // For promo codes, check uniqueness
    if (discount.category === 'promo_code' && dto.config?.code) {
      const promoCode = dto.config.code.toUpperCase()
      const codeExists = entries.some(
        (entry: any) => entry.config?.code?.toUpperCase() === promoCode
      )

      if (codeExists) {
        throw new BadRequestException(`Promo code "${promoCode}" already exists for this camp`)
      }
    }

    // Create new entry with unique ID
    const newEntry = {
      id: uuidv4(),
      ...dto,
    }

    // Add to entries array
    const updatedEntries = [...entries, newEntry]

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }

  /**
   * Update an existing entry in a discount category
   */
  async updateDiscountEntry(
    discountId: string,
    entryId: string,
    campId: string,
    providerId: string,
    dto: UpdateDiscountEntryDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (discount?.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // Find entry index
    const entryIndex = entries.findIndex((e: any) => e.id === entryId)
    if (entryIndex === -1) {
      throw new NotFoundException('Entry not found')
    }

    // For promo codes, check uniqueness (excluding current entry)
    if (discount.category === 'promo_code' && dto.config?.code) {
      const promoCode = dto.config.code.toUpperCase()
      const codeExists = entries.some(
        (entry: any, index: number) =>
          index !== entryIndex && entry.config?.code?.toUpperCase() === promoCode
      )

      if (codeExists) {
        throw new BadRequestException(`Promo code "${promoCode}" already exists for this camp`)
      }
    }

    // Update entry
    const updatedEntries = [...entries]
    updatedEntries[entryIndex] = {
      ...updatedEntries[entryIndex],
      ...dto,
    }

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }

  /**
   * Remove an entry from a discount category
   */
  async removeDiscountEntry(
    discountId: string,
    entryId: string,
    campId: string,
    providerId: string
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (discount?.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // Filter out the entry
    const updatedEntries = entries.filter((e: any) => e.id !== entryId)

    if (updatedEntries.length === entries.length) {
      throw new NotFoundException('Entry not found')
    }

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }
}
