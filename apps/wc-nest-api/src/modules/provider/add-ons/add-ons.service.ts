import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateAddOnDto } from './dto/create-add-on.dto'
import { UpdateAddOnDto } from './dto/update-add-on.dto'
import { QueryAddOnsDto } from './dto/query-add-ons.dto'

@Injectable()
export class AddOnsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serialize AddOn to convert Decimal to number
   */
  private serializeAddOn(addOn: any) {
    return {
      ...addOn,
      price: typeof addOn.price === 'object' ? parseFloat(addOn.price.toString()) : addOn.price,
    }
  }

  /**
   * Create a new add-on
   */
  async create(providerId: string, dto: CreateAddOnDto) {
    // Get provider's currency from settings if not provided
    let currency = dto.currency || 'CHF'

    if (!dto.currency) {
      const providerSettings = await this.prisma.providerSettings.findUnique({
        where: { providerId },
      })
      if (providerSettings) {
        currency = providerSettings.currency
      }
    }

    // Validate age range if both are provided
    if (dto.minAge && dto.maxAge && dto.minAge > dto.maxAge) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age')
    }

    const addOn = await this.prisma.addOn.create({
      data: {
        providerId,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        type: dto.type,
        price: dto.price,
        currency,
        pricingUnit: dto.pricingUnit,
        maxQuantity: dto.maxQuantity,
        quantityUnit: dto.quantityUnit,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        sortOrder: dto.sortOrder ?? 0,
      },
    })

    return this.serializeAddOn(addOn)
  }

  /**
   * Get all add-ons for a provider
   */
  async findAll(providerId: string, query: QueryAddOnsDto) {
    const where: any = { providerId }

    if (query.type) {
      where.type = query.type
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true'
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const addOns = await this.prisma.addOn.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { campAddOns: true },
        },
      },
    })

    return addOns.map(addOn => this.serializeAddOn(addOn))
  }

  /**
   * Get a single add-on
   */
  async findOne(id: string, providerId: string) {
    const addOn = await this.prisma.addOn.findUnique({
      where: { id },
      include: {
        _count: {
          select: { campAddOns: true },
        },
      },
    })

    if (!addOn) {
      throw new NotFoundException('Add-on not found')
    }

    if (addOn.providerId !== providerId) {
      throw new ForbiddenException('You do not have access to this add-on')
    }

    return this.serializeAddOn(addOn)
  }

  /**
   * Update an add-on
   */
  async update(id: string, providerId: string, dto: UpdateAddOnDto) {
    // Verify ownership
    await this.findOne(id, providerId)

    // Validate age range if both are provided
    if (dto.minAge && dto.maxAge && dto.minAge > dto.maxAge) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age')
    }

    const addOn = await this.prisma.addOn.update({
      where: { id },
      data: dto,
    })

    return this.serializeAddOn(addOn)
  }

  /**
   * Delete an add-on
   */
  async remove(id: string, providerId: string) {
    // Verify ownership
    await this.findOne(id, providerId)

    await this.prisma.addOn.delete({
      where: { id },
    })

    return { message: 'Add-on deleted successfully' }
  }
}
