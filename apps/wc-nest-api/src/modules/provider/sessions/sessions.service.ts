import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateFlexibleSessionDto } from './dto/create-flexible-session.dto'
import { CreateFixedSessionDto } from './dto/create-fixed-session.dto'
import { UpdateFlexibleSessionDto } from './dto/update-flexible-session.dto'
import { UpdateFixedSessionDto } from './dto/update-fixed-session.dto'
import { UpdateSessionTypeDto } from './dto/update-session-type.dto'

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Get session type for a camp
   */
  async getSessionType(campId: string, providerId: string) {
    const camp = await this.validateCampOwnership(campId, providerId)

    const sessionsCount = await this.prisma.session.count({
      where: { campId },
    })

    return {
      sessionType: camp.sessionType,
      canChange: sessionsCount === 0,
    }
  }

  /**
   * Set session type for a camp (can only be done once)
   */
  async setSessionType(campId: string, providerId: string, dto: UpdateSessionTypeDto) {
    const camp = await this.validateCampOwnership(campId, providerId)

    // Check if sessions already exist
    const sessionsCount = await this.prisma.session.count({
      where: { campId },
    })

    if (sessionsCount > 0) {
      throw new BadRequestException(
        'Cannot change session type after sessions have been created. Delete all sessions first.'
      )
    }

    const updatedCamp = await this.prisma.camp.update({
      where: { id: campId },
      data: { sessionType: dto.sessionType },
    })

    return {
      sessionType: updatedCamp.sessionType,
      message: 'Session type updated successfully',
    }
  }

  /**
   * Get all flexible sessions for a camp
   */
  async getFlexibleSessions(campId: string, providerId: string) {
    const camp = await this.validateCampOwnership(campId, providerId)

    if (camp.sessionType !== 'flexible') {
      throw new BadRequestException('This camp does not use flexible sessions')
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        campId,
        type: 'flexible',
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    return {
      sessions,
      total: sessions.length,
    }
  }

  /**
   * Get all fixed sessions for a camp
   */
  async getFixedSessions(campId: string, providerId: string) {
    const camp = await this.validateCampOwnership(campId, providerId)

    if (camp.sessionType !== 'fixed') {
      throw new BadRequestException('This camp does not use fixed sessions')
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        campId,
        type: 'fixed',
      },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: {
        sessionStartDate: 'asc',
      },
    })

    return {
      sessions: sessions.map(session => ({
        ...session,
        bookedCount: session._count.bookings,
      })),
      total: sessions.length,
    }
  }

  /**
   * Create a flexible session
   */
  async createFlexibleSession(campId: string, providerId: string, dto: CreateFlexibleSessionDto) {
    const camp = await this.validateCampOwnership(campId, providerId)

    // Validate session type
    if (!camp.sessionType) {
      // Auto-set session type if not set
      await this.prisma.camp.update({
        where: { id: campId },
        data: { sessionType: 'flexible' },
      })
    } else if (camp.sessionType !== 'flexible') {
      throw new BadRequestException('This camp is configured for fixed sessions')
    }

    // Validate dates
    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date')
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Start date must be in the future')
    }

    // Validate blackout dates if provided
    if (dto.blackoutDates && dto.blackoutDates.length > 0) {
      for (const blackout of dto.blackoutDates) {
        const blackoutStart = new Date(blackout.start)
        const blackoutEnd = new Date(blackout.end)

        if (blackoutStart < startDate || blackoutEnd > endDate) {
          throw new BadRequestException('Blackout dates must be within session date range')
        }

        if (blackoutEnd <= blackoutStart) {
          throw new BadRequestException('Blackout end date must be after start date')
        }
      }
    }

    // Check session limit (max 10 flexible sessions)
    const existingCount = await this.prisma.session.count({
      where: { campId, type: 'flexible' },
    })

    if (existingCount >= 10) {
      throw new BadRequestException('Maximum 10 flexible sessions allowed per camp')
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
        type: 'flexible',
        name: dto.name,
        description: dto.description,
        startDate,
        endDate,
        blackoutDates: (dto.blackoutDates ?? []) as any,
        capacity: dto.capacity,
        sortOrder,
      },
    })

    return {
      session,
      message: 'Flexible session created successfully',
    }
  }

  /**
   * Create a fixed session
   */
  async createFixedSession(campId: string, providerId: string, dto: CreateFixedSessionDto) {
    const camp = await this.validateCampOwnership(campId, providerId)

    // Validate session type
    if (!camp.sessionType) {
      // Auto-set session type if not set
      await this.prisma.camp.update({
        where: { id: campId },
        data: { sessionType: 'fixed' },
      })
    } else if (camp.sessionType !== 'fixed') {
      throw new BadRequestException('This camp is configured for flexible sessions')
    }

    // Validate dates
    const sessionStartDate = new Date(dto.sessionStartDate)
    const sessionEndDate = new Date(dto.sessionEndDate)

    if (sessionEndDate <= sessionStartDate) {
      throw new BadRequestException('End date must be after start date')
    }

    if (sessionStartDate < new Date()) {
      throw new BadRequestException('Start date must be in the future')
    }

    const durationDays = Math.ceil(
      (sessionEndDate.getTime() - sessionStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (durationDays < 1) {
      throw new BadRequestException('Session must be at least 1 day long')
    }

    // Check for overlapping sessions
    const overlappingSessions = await this.prisma.session.findFirst({
      where: {
        campId,
        type: 'fixed',
        OR: [
          {
            AND: [
              { sessionStartDate: { lte: sessionStartDate } },
              { sessionEndDate: { gte: sessionStartDate } },
            ],
          },
          {
            AND: [
              { sessionStartDate: { lte: sessionEndDate } },
              { sessionEndDate: { gte: sessionEndDate } },
            ],
          },
          {
            AND: [
              { sessionStartDate: { gte: sessionStartDate } },
              { sessionEndDate: { lte: sessionEndDate } },
            ],
          },
        ],
      },
    })

    if (overlappingSessions) {
      throw new BadRequestException(
        `Session dates overlap with existing session "${overlappingSessions.name}"`
      )
    }

    // Check session limit (max 50 fixed sessions)
    const existingCount = await this.prisma.session.count({
      where: { campId, type: 'fixed' },
    })

    if (existingCount >= 50) {
      throw new BadRequestException('Maximum 50 fixed sessions allowed per camp')
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
        type: 'fixed',
        name: dto.name,
        description: dto.description,
        sessionStartDate,
        sessionEndDate,
        price: dto.price,
        capacity: dto.capacity,
        sortOrder,
      },
    })

    return {
      session,
      message: 'Fixed session created successfully',
    }
  }

  /**
   * Update a flexible session
   */
  async updateFlexibleSession(
    campId: string,
    sessionId: string,
    providerId: string,
    dto: UpdateFlexibleSessionDto
  ) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    if (session.type !== 'flexible') {
      throw new BadRequestException('This is not a flexible session')
    }

    // Check if session has bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId },
    })

    // Validate date changes if bookings exist
    if (bookingsCount > 0) {
      if (dto.startDate || dto.endDate) {
        throw new BadRequestException('Cannot change dates for a session with existing bookings')
      }
      if (dto.capacity && dto.capacity < bookingsCount) {
        throw new BadRequestException(
          `Cannot reduce capacity to ${dto.capacity}. Current bookings: ${bookingsCount}`
        )
      }
    }

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ? new Date(dto.startDate) : session.startDate!
      const endDate = dto.endDate ? new Date(dto.endDate) : session.endDate!

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date')
      }
    }

    // Build update data
    const updateData: any = {}
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.startDate) updateData.startDate = new Date(dto.startDate)
    if (dto.endDate) updateData.endDate = new Date(dto.endDate)
    if (dto.blackoutDates !== undefined) updateData.blackoutDates = dto.blackoutDates as any
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    })

    return {
      session: updatedSession,
      message: 'Session updated successfully',
    }
  }

  /**
   * Update a fixed session
   */
  async updateFixedSession(
    campId: string,
    sessionId: string,
    providerId: string,
    dto: UpdateFixedSessionDto
  ) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    if (session.type !== 'fixed') {
      throw new BadRequestException('This is not a fixed session')
    }

    // Check if session has bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId },
    })

    // Validate changes if bookings exist
    if (bookingsCount > 0) {
      if (dto.sessionStartDate || dto.sessionEndDate) {
        throw new BadRequestException('Cannot change dates for a session with existing bookings')
      }
      if (dto.price !== undefined) {
        throw new BadRequestException('Cannot change price for a session with existing bookings')
      }
      if (dto.capacity && dto.capacity < bookingsCount) {
        throw new BadRequestException(
          `Cannot reduce capacity to ${dto.capacity}. Current bookings: ${bookingsCount}`
        )
      }
    }

    // Validate dates if provided
    if (dto.sessionStartDate || dto.sessionEndDate) {
      const sessionStartDate = dto.sessionStartDate
        ? new Date(dto.sessionStartDate)
        : session.sessionStartDate!
      const sessionEndDate = dto.sessionEndDate
        ? new Date(dto.sessionEndDate)
        : session.sessionEndDate!

      if (sessionEndDate <= sessionStartDate) {
        throw new BadRequestException('End date must be after start date')
      }

      // Check for overlapping sessions (excluding current session)
      const overlappingSessions = await this.prisma.session.findFirst({
        where: {
          campId,
          type: 'fixed',
          id: { not: sessionId },
          OR: [
            {
              AND: [
                { sessionStartDate: { lte: sessionStartDate } },
                { sessionEndDate: { gte: sessionStartDate } },
              ],
            },
            {
              AND: [
                { sessionStartDate: { lte: sessionEndDate } },
                { sessionEndDate: { gte: sessionEndDate } },
              ],
            },
            {
              AND: [
                { sessionStartDate: { gte: sessionStartDate } },
                { sessionEndDate: { lte: sessionEndDate } },
              ],
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

    // Build update data
    const updateData: any = {}
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.sessionStartDate) updateData.sessionStartDate = new Date(dto.sessionStartDate)
    if (dto.sessionEndDate) updateData.sessionEndDate = new Date(dto.sessionEndDate)
    if (dto.price !== undefined) updateData.price = dto.price
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    })

    return {
      session: updatedSession,
      message: 'Session updated successfully',
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(campId: string, sessionId: string, providerId: string) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

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
   * Toggle session active status
   */
  async toggleSessionStatus(campId: string, sessionId: string, providerId: string) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: !session.isActive },
    })

    return {
      session: updatedSession,
      message: `Session ${updatedSession.isActive ? 'activated' : 'deactivated'} successfully`,
    }
  }

  /**
   * Duplicate a fixed session
   */
  async duplicateFixedSession(campId: string, sessionId: string, providerId: string) {
    const session = await this.validateSessionOwnership(sessionId, campId, providerId)

    if (session.type !== 'fixed') {
      throw new BadRequestException('Can only duplicate fixed sessions')
    }

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
        type: session.type,
        name: `${session.name} (Copy)`,
        description: session.description,
        sessionStartDate: session.sessionStartDate,
        sessionEndDate: session.sessionEndDate,
        price: session.price,
        capacity: session.capacity,
        isActive: false, // Start as inactive
        sortOrder,
      },
    })

    return {
      session: duplicatedSession,
      message: 'Session duplicated successfully',
    }
  }
}
