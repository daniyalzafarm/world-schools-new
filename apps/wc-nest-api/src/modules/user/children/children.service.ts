import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateChildDto } from './dto/create-child.dto'
import { UpdateChildDto } from './dto/update-child.dto'

@Injectable()
export class UserChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createChildDto: CreateChildDto) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    })

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user')
    }

    // Convert date string to Date
    const dateOfBirth = new Date(createChildDto.dateOfBirth)

    // Create child with minimal fields
    const child = await this.prisma.children.create({
      data: {
        firstName: createChildDto.firstName,
        lastName: createChildDto.lastName,
        dateOfBirth: dateOfBirth,
        gender: createChildDto.gender,
        parentId: parent.id,
        // Initialize JSONB fields
        emergencyContacts: [],
        // Profile completion will be calculated (30% for basic info)
        profileCompletion: 30,
      },
    })

    return this.formatChildResponse(child)
  }

  async findAll(userId: string) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    })

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user')
    }

    // Get all non-archived children for this parent
    const children = await this.prisma.children.findMany({
      where: {
        parentId: parent.id,
        archived: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return children.map(child => this.formatChildResponse(child))
  }

  async findOne(userId: string, id: string) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    })

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user')
    }

    // Get child
    const child = await this.prisma.children.findUnique({
      where: { id },
    })

    if (!child) {
      throw new NotFoundException(`Child with ID '${id}' not found`)
    }

    // Verify child belongs to this parent
    if (child.parentId !== parent.id) {
      throw new ForbiddenException('You do not have permission to access this child')
    }

    return this.formatChildResponse(child)
  }

  async update(userId: string, id: string, updateChildDto: UpdateChildDto) {
    // Verify child exists and belongs to parent
    const existingChild = await this.findOne(userId, id)

    // Validate emergency contacts (max 3)
    if (updateChildDto.emergencyContacts && updateChildDto.emergencyContacts.length > 3) {
      throw new BadRequestException('Maximum 3 emergency contacts allowed')
    }

    // Build update data
    const updateData: any = {}

    // Basic info
    if (updateChildDto.firstName !== undefined) {
      updateData.firstName = updateChildDto.firstName
    }
    if (updateChildDto.lastName !== undefined) {
      updateData.lastName = updateChildDto.lastName
    }
    if (updateChildDto.nickname !== undefined) {
      updateData.nickname = updateChildDto.nickname
    }
    if (updateChildDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = new Date(updateChildDto.dateOfBirth)
    }
    if (updateChildDto.gender !== undefined) {
      updateData.gender = updateChildDto.gender
    }
    if (updateChildDto.photoUrl !== undefined) {
      updateData.photoUrl = updateChildDto.photoUrl
    }
    if (updateChildDto.schoolYear !== undefined) {
      updateData.schoolYear = updateChildDto.schoolYear
    }
    if (updateChildDto.schoolCountry !== undefined) {
      updateData.schoolCountry = updateChildDto.schoolCountry
    }
    if (updateChildDto.languages !== undefined) {
      updateData.languages = updateChildDto.languages
    }

    // JSONB fields
    if (updateChildDto.medicalInfo !== undefined) {
      updateData.medicalInfo = updateChildDto.medicalInfo
    }
    if (updateChildDto.emergencyContacts !== undefined) {
      updateData.emergencyContacts = updateChildDto.emergencyContacts
    }
    if (updateChildDto.campPreferences !== undefined) {
      updateData.campPreferences = updateChildDto.campPreferences
    }

    // Update child
    const updatedChild = await this.prisma.children.update({
      where: { id },
      data: updateData,
    })

    // Recalculate profile completion
    const profileCompletion = this.calculateProfileCompletion(updatedChild)

    // Update profile completion if changed
    if (profileCompletion !== updatedChild.profileCompletion) {
      const finalChild = await this.prisma.children.update({
        where: { id },
        data: { profileCompletion },
      })
      return this.formatChildResponse(finalChild)
    }

    return this.formatChildResponse(updatedChild)
  }

  async archive(userId: string, id: string) {
    // Verify child exists and belongs to parent
    await this.findOne(userId, id)

    // Soft delete by setting archived flag
    const child = await this.prisma.children.update({
      where: { id },
      data: { archived: true },
    })

    return this.formatChildResponse(child)
  }

  async remove(userId: string, id: string) {
    // Get the child first to get the name for the message
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    })

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user')
    }

    const child = await this.prisma.children.findUnique({
      where: { id },
    })

    if (!child) {
      throw new NotFoundException(`Child with ID '${id}' not found`)
    }

    if (child.parentId !== parent.id) {
      throw new ForbiddenException('You do not have permission to access this child')
    }

    // Hard delete child (use archive() for soft delete)
    await this.prisma.children.delete({
      where: { id },
    })

    return {
      message: `Child '${child.firstName} ${child.lastName || ''}' deleted successfully`,
    }
  }

  /**
   * Calculate profile completion percentage based on filled fields
   * Formula: Basic (30%) + Medical (20%) + Emergency (25%) + Preferences (15%) + Photo (10%)
   */
  private calculateProfileCompletion(child: any): number {
    let score = 0

    // Basic info (30%): firstName, dateOfBirth, gender
    if (child.firstName && child.dateOfBirth && child.gender) {
      score += 30
    }

    // Medical info (20%): has medical_info with any meaningful data
    const medicalInfo = child.medicalInfo
    const hasMedicalInfo =
      medicalInfo &&
      (medicalInfo.allergies?.length > 0 ||
        medicalInfo.dietaryRequirements?.length > 0 ||
        medicalInfo.medications ||
        medicalInfo.medicalConditions ||
        medicalInfo.specialNeeds ||
        medicalInfo.swimmingAbility)
    if (hasMedicalInfo) {
      score += 20
    }

    // Emergency contacts (25%): has at least 1 contact
    const emergencyContacts = Array.isArray(child.emergencyContacts) ? child.emergencyContacts : []
    if (emergencyContacts.length >= 1) {
      score += 25
    }

    // Preferences (15%): has camp_preferences with interests
    const campPreferences = child.campPreferences
    if (campPreferences?.interests?.length > 0) {
      score += 15
    }

    // Photo (10%): has photo_url
    if (child.photoUrl) {
      score += 10
    }

    return score
  }

  /**
   * Format child database record to match frontend Child interface
   */
  private formatChildResponse(child: any) {
    // Parse JSONB fields
    const medicalInfo = child.medicalInfo || null
    const emergencyContacts = Array.isArray(child.emergencyContacts) ? child.emergencyContacts : []
    const campPreferences = child.campPreferences || null

    return {
      id: child.id,
      parentId: child.parentId,
      // Basic info
      firstName: child.firstName,
      lastName: child.lastName || null,
      nickname: child.nickname || null,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
      photoUrl: child.photoUrl || null,
      schoolYear: child.schoolYear || null,
      schoolCountry: child.schoolCountry || null,
      languages: child.languages || [],
      // Medical info
      medicalInfo,
      // Emergency contacts
      emergencyContacts,
      // Camp preferences
      campPreferences,
      // Profile completion
      profileCompletion: child.profileCompletion || 0,
      // Metadata
      archived: child.archived || false,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    }
  }
}
