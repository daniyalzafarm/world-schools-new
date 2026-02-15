import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  AvailabilityType,
  CreateFixedSessionDto,
  PricingType,
  SessionDayType,
} from './dto/create-fixed-session.dto'
import { UpdateFixedSessionDto } from './dto/update-fixed-session.dto'

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transform Prisma Decimal fields to numbers for JSON serialization
   * Prisma Decimal is serialized as string by default, but we need numbers for frontend validation
   */
  private transformSessionForResponse(session: any) {
    return {
      ...session,
      price:
        session.price !== null && session.price !== undefined
          ? Number(session.price)
          : session.price,
    }
  }

  /**
   * Verify camp ownership and return camp
   */
  private async validateCampOwnership(campId: string, providerId: string) {
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
    })

    if (!camp) {
      throw new NotFoundException('Camp not found')
    }

    if (camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have permission to access this camp')
    }

    return camp
  }

  /**
   * Verify session ownership and return session
   */
  private async validateSessionOwnership(sessionId: string, campId: string, providerId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        camp: true,
      },
    })

    if (!session) {
      throw new NotFoundException('Session not found')
    }

    if (session.campId !== campId) {
      throw new BadRequestException('Session does not belong to this camp')
    }

    if (session.camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have permission to access this session')
    }

    return session
  }

  /**
   * Get all sessions for a camp
   */
  async getFixedSessions(campId: string, providerId: string, sortBy?: string) {
    await this.validateCampOwnership(campId, providerId)

    // Determine orderBy clause based on sortBy parameter
    let orderBy: any = { sortOrder: 'asc' } // Default sorting

    if (sortBy) {
      switch (sortBy) {
        case 'date-asc':
          orderBy = { startDate: 'asc' }
          break
        case 'date-desc':
          orderBy = { startDate: 'desc' }
          break
        case 'duration':
          // Duration will be calculated and sorted in-memory after fetching
          orderBy = { startDate: 'asc' }
          break
        case 'price':
          orderBy = { price: 'asc' }
          break
        case 'capacity':
          orderBy = { totalSpots: 'asc' }
          break
        default:
          orderBy = { sortOrder: 'asc' }
      }
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        campId,
      },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
      orderBy,
    })

    // Transform Decimal fields to numbers and add booked count
    let transformedSessions = sessions.map(session => ({
      ...this.transformSessionForResponse(session),
      bookedCount: session._count.bookings,
    }))

    // Handle duration sorting (requires in-memory sorting)
    if (sortBy === 'duration') {
      transformedSessions = transformedSessions.sort((a, b) => {
        const durationA = new Date(a.endDate).getTime() - new Date(a.startDate).getTime()
        const durationB = new Date(b.endDate).getTime() - new Date(b.startDate).getTime()
        return durationA - durationB
      })
    }

    return {
      sessions: transformedSessions,
      total: transformedSessions.length,
    }
  }

  /**
   * Create a session
   */
  async createFixedSession(campId: string, providerId: string, dto: CreateFixedSessionDto) {
    const camp = await this.validateCampOwnership(campId, providerId)

    // Validate dates
    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date')
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Start date must be in the future')
    }

    // Validate half-day sessions (only for day camps)
    if (dto.sessionDayType === SessionDayType.HALF_DAY) {
      if (camp.type !== 'day') {
        throw new BadRequestException('Half-day sessions are only allowed for day camps')
      }

      if (!dto.arrivalTime || !dto.departureTime) {
        throw new BadRequestException(
          'Arrival and departure times are required for half-day sessions'
        )
      }

      // Validate time format and order
      const [arrivalHour, arrivalMin] = dto.arrivalTime.split(':').map(Number)
      const [departureHour, departureMin] = dto.departureTime.split(':').map(Number)
      const arrivalMinutes = arrivalHour * 60 + arrivalMin
      const departureMinutes = departureHour * 60 + departureMin

      if (departureMinutes <= arrivalMinutes) {
        throw new BadRequestException('Departure time must be after arrival time')
      }
    }

    // Validate age group pricing
    if (dto.pricingType === PricingType.AGE_GROUP) {
      if (!dto.ageGroupPrices || dto.ageGroupPrices.length < 2) {
        throw new BadRequestException('Age group pricing requires at least 2 age groups')
      }

      // Validate that camp has age groups configured
      const campAgeGroups = camp.ageGroups as any[]
      if (!campAgeGroups || campAgeGroups.length < 2) {
        throw new BadRequestException(
          'Camp must have at least 2 age groups configured for age group pricing'
        )
      }
    } else if (dto.pricingType === PricingType.SINGLE) {
      if (dto.price === undefined || dto.price === null) {
        throw new BadRequestException('Price is required for single pricing type')
      }
    }

    // Validate age group availability
    if (dto.availabilityType === AvailabilityType.AGE_GROUP) {
      if (!dto.ageGroupSpots || dto.ageGroupSpots.length < 2) {
        throw new BadRequestException('Age group availability requires at least 2 age groups')
      }

      // Validate that camp has age groups configured
      const campAgeGroups = camp.ageGroups as any[]
      if (!campAgeGroups || campAgeGroups.length < 2) {
        throw new BadRequestException(
          'Camp must have at least 2 age groups configured for age group availability'
        )
      }
    } else if (dto.availabilityType === AvailabilityType.SINGLE) {
      if (!dto.totalSpots) {
        throw new BadRequestException('Total spots is required for single availability type')
      }
    }

    // Check for overlapping sessions
    const overlappingSessions = await this.prisma.session.findFirst({
      where: {
        campId,
        OR: [
          {
            AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }],
          },
          {
            AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }],
          },
          {
            AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }],
          },
        ],
      },
    })

    if (overlappingSessions) {
      throw new BadRequestException(
        `Session dates overlap with existing session "${overlappingSessions.name}"`
      )
    }

    // Check session limit (max 50 sessions)
    const existingCount = await this.prisma.session.count({
      where: { campId },
    })

    if (existingCount >= 50) {
      throw new BadRequestException('Maximum 50 sessions allowed per camp')
    }

    // Get next sort order
    const lastSession = await this.prisma.session.findFirst({
      where: { campId },
      orderBy: { sortOrder: 'desc' },
    })

    const sortOrder = lastSession ? lastSession.sortOrder + 1 : 0

    // Create session
    const session = await this.prisma.session.create({
      data: {
        campId,
        name: dto.name,
        startDate,
        endDate,
        sessionDayType: dto.sessionDayType || null,
        arrivalTime: dto.arrivalTime || null,
        departureTime: dto.departureTime || null,
        pricingType: dto.pricingType,
        price: dto.price ?? null,
        ageGroupPrices: dto.ageGroupPrices ? (dto.ageGroupPrices as any) : null,
        availabilityType: dto.availabilityType,
        totalSpots: dto.totalSpots ?? null,
        ageGroupSpots: dto.ageGroupSpots ? (dto.ageGroupSpots as any) : null,
        status: dto.status,
        sortOrder,
      },
    })

    return {
      session: this.transformSessionForResponse(session),
      message: 'Session created successfully',
    }
  }

  /**
   * Update a session
   */
  async updateFixedSession(
    campId: string,
    sessionId: string,
    providerId: string,
    dto: UpdateFixedSessionDto
  ) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)
    const camp = await this.prisma.camp.findUnique({ where: { id: campId } })

    // Check if session has bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId },
    })

    // Validate changes if bookings exist
    if (bookingsCount > 0) {
      if (dto.startDate || dto.endDate) {
        throw new BadRequestException('Cannot change dates for a session with existing bookings')
      }
      if (
        dto.price !== undefined ||
        dto.pricingType !== undefined ||
        dto.ageGroupPrices !== undefined
      ) {
        throw new BadRequestException('Cannot change pricing for a session with existing bookings')
      }
      if (dto.totalSpots && dto.totalSpots < bookingsCount) {
        throw new BadRequestException(
          `Cannot reduce total spots to ${dto.totalSpots}. Current bookings: ${bookingsCount}`
        )
      }
    }

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ? new Date(dto.startDate) : session.startDate
      const endDate = dto.endDate ? new Date(dto.endDate) : session.endDate

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date')
      }

      // Check for overlapping sessions (excluding current session)
      const overlappingSessions = await this.prisma.session.findFirst({
        where: {
          campId,
          id: { not: sessionId },
          OR: [
            {
              AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }],
            },
            {
              AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }],
            },
            {
              AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }],
            },
          ],
        },
      })

      if (overlappingSessions) {
        throw new BadRequestException(
          `Session dates overlap with existing session "${overlappingSessions.name}"`
        )
      }
    }

    // Validate half-day sessions (only for day camps)
    if (dto.sessionDayType === SessionDayType.HALF_DAY) {
      if (camp?.type !== 'day') {
        throw new BadRequestException('Half-day sessions are only allowed for day camps')
      }

      const arrivalTime = dto.arrivalTime || session.arrivalTime
      const departureTime = dto.departureTime || session.departureTime

      if (!arrivalTime || !departureTime) {
        throw new BadRequestException(
          'Arrival and departure times are required for half-day sessions'
        )
      }

      // Validate time order
      const [arrivalHour, arrivalMin] = arrivalTime.split(':').map(Number)
      const [departureHour, departureMin] = departureTime.split(':').map(Number)
      const arrivalMinutes = arrivalHour * 60 + arrivalMin
      const departureMinutes = departureHour * 60 + departureMin

      if (departureMinutes <= arrivalMinutes) {
        throw new BadRequestException('Departure time must be after arrival time')
      }
    }

    // Validate age group pricing
    if (
      dto.pricingType === PricingType.AGE_GROUP ||
      (dto.ageGroupPrices && session.pricingType === 'age_group')
    ) {
      const ageGroupPrices = dto.ageGroupPrices ?? (session.ageGroupPrices as any)
      if (!ageGroupPrices || ageGroupPrices.length < 2) {
        throw new BadRequestException('Age group pricing requires at least 2 age groups')
      }
    }

    // Validate age group availability
    if (
      dto.availabilityType === AvailabilityType.AGE_GROUP ||
      (dto.ageGroupSpots && session.availabilityType === 'age_group')
    ) {
      const ageGroupSpots = dto.ageGroupSpots ?? (session.ageGroupSpots as any)
      if (!ageGroupSpots || ageGroupSpots.length < 2) {
        throw new BadRequestException('Age group availability requires at least 2 age groups')
      }
    }

    // Build update data
    const updateData: any = {}
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.startDate) updateData.startDate = new Date(dto.startDate)
    if (dto.endDate) updateData.endDate = new Date(dto.endDate)
    if (dto.sessionDayType !== undefined) updateData.sessionDayType = dto.sessionDayType
    if (dto.arrivalTime !== undefined) updateData.arrivalTime = dto.arrivalTime
    if (dto.departureTime !== undefined) updateData.departureTime = dto.departureTime
    if (dto.pricingType !== undefined) updateData.pricingType = dto.pricingType
    if (dto.price !== undefined) updateData.price = dto.price
    if (dto.ageGroupPrices !== undefined) updateData.ageGroupPrices = dto.ageGroupPrices as any
    if (dto.availabilityType !== undefined) updateData.availabilityType = dto.availabilityType
    if (dto.totalSpots !== undefined) updateData.totalSpots = dto.totalSpots
    if (dto.ageGroupSpots !== undefined) updateData.ageGroupSpots = dto.ageGroupSpots as any
    if (dto.status !== undefined) updateData.status = dto.status

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    })

    return {
      session: this.transformSessionForResponse(updatedSession),
      message: 'Session updated successfully',
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(campId: string, sessionId: string, providerId: string) {
    await this.validateSessionOwnership(sessionId, campId, providerId)

    // Check if session has bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId },
    })

    if (bookingsCount > 0) {
      throw new BadRequestException(
        `Cannot delete session with ${bookingsCount} active booking(s). Cancel all bookings first.`
      )
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    })

    return {
      message: 'Session deleted successfully',
      affectedBookings: 0,
    }
  }

  /**
   * Toggle session status between draft and published
   */
  async toggleSessionStatus(campId: string, sessionId: string, providerId: string) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    const newStatus = session.status === 'draft' ? 'published' : 'draft'

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: newStatus },
    })

    return {
      session: this.transformSessionForResponse(updatedSession),
      message: `Session ${newStatus === 'published' ? 'published' : 'set to draft'} successfully`,
    }
  }

  /**
   * Duplicate a session
   */
  async duplicateFixedSession(campId: string, sessionId: string, providerId: string) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    // Get next sort order
    const lastSession = await this.prisma.session.findFirst({
      where: { campId },
      orderBy: { sortOrder: 'desc' },
    })

    const sortOrder = lastSession ? lastSession.sortOrder + 1 : 0

    // Create duplicate
    const duplicatedSession = await this.prisma.session.create({
      data: {
        campId: session.campId,
        name: `${session.name} (Copy)`,
        startDate: session.startDate,
        endDate: session.endDate,
        sessionDayType: session.sessionDayType,
        arrivalTime: session.arrivalTime,
        departureTime: session.departureTime,
        pricingType: session.pricingType,
        price: session.price,
        ageGroupPrices: session.ageGroupPrices as any,
        availabilityType: session.availabilityType,
        totalSpots: session.totalSpots,
        ageGroupSpots: session.ageGroupSpots as any,
        status: 'draft', // Start as draft
        sortOrder,
      },
    })

    return {
      session: this.transformSessionForResponse(duplicatedSession),
      message: 'Session duplicated successfully',
    }
  }
}
