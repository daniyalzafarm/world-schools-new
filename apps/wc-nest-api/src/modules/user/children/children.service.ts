import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
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

    // Convert date string to Date if provided
    const dateOfBirth = createChildDto.personalInfo.dateOfBirth
      ? new Date(createChildDto.personalInfo.dateOfBirth)
      : null

    // Create child
    const child = await this.prisma.children.create({
      data: {
        // Personal Info
        firstName: createChildDto.personalInfo.firstName,
        lastName: createChildDto.personalInfo.lastName,
        dateOfBirth: dateOfBirth,
        gender: createChildDto.personalInfo.gender,
        nationality: createChildDto.personalInfo.nationality,
        languages: createChildDto.personalInfo.languages ?? [],

        // Academic Preferences
        currentGrade: createChildDto.academicPreferences?.currentGrade,
        favoriteSubjects: createChildDto.academicPreferences?.favoriteSubjects ?? [],
        learningStyle: createChildDto.academicPreferences?.learningStyle,
        languagesOfInstruction: createChildDto.academicPreferences?.languagesOfInstruction ?? [],
        interestedInBoarding: createChildDto.academicPreferences?.interestedInBoarding,

        // Extra-Curricular
        interests: createChildDto.extraCurricular?.interests ?? [],
        preferredSchedule: createChildDto.extraCurricular?.preferredSchedule,

        // Special Needs
        specialNeedsAreas: createChildDto.specialNeeds?.areas ?? [],
        specialNeedsSupportNeeds: createChildDto.specialNeeds?.supportNeeds ?? [],
        specialNeedsNotes: createChildDto.specialNeeds?.additionalNotes,

        parentId: parent.id,
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

    // Get all children for this parent
    const children = await this.prisma.children.findMany({
      where: {
        parentId: parent.id,
      },
      orderBy: {
        createdAt: 'desc',
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
    await this.findOne(userId, id)

    // Build update data
    const updateData: any = {}

    // Personal Info
    if (updateChildDto.personalInfo) {
      if (updateChildDto.personalInfo.firstName !== undefined) {
        updateData.firstName = updateChildDto.personalInfo.firstName
      }
      if (updateChildDto.personalInfo.lastName !== undefined) {
        updateData.lastName = updateChildDto.personalInfo.lastName
      }
      if (updateChildDto.personalInfo.dateOfBirth !== undefined) {
        updateData.dateOfBirth = new Date(updateChildDto.personalInfo.dateOfBirth)
      }
      if (updateChildDto.personalInfo.gender !== undefined) {
        updateData.gender = updateChildDto.personalInfo.gender
      }
      if (updateChildDto.personalInfo.nationality !== undefined) {
        updateData.nationality = updateChildDto.personalInfo.nationality
      }
      if (updateChildDto.personalInfo.languages !== undefined) {
        updateData.languages = updateChildDto.personalInfo.languages
      }
    }

    // Academic Preferences
    if (updateChildDto.academicPreferences) {
      if (updateChildDto.academicPreferences.currentGrade !== undefined) {
        updateData.currentGrade = updateChildDto.academicPreferences.currentGrade
      }
      if (updateChildDto.academicPreferences.favoriteSubjects !== undefined) {
        updateData.favoriteSubjects = updateChildDto.academicPreferences.favoriteSubjects
      }
      if (updateChildDto.academicPreferences.learningStyle !== undefined) {
        updateData.learningStyle = updateChildDto.academicPreferences.learningStyle
      }
      if (updateChildDto.academicPreferences.languagesOfInstruction !== undefined) {
        updateData.languagesOfInstruction =
          updateChildDto.academicPreferences.languagesOfInstruction
      }
      if (updateChildDto.academicPreferences.interestedInBoarding !== undefined) {
        updateData.interestedInBoarding = updateChildDto.academicPreferences.interestedInBoarding
      }
    }

    // Extra-Curricular
    if (updateChildDto.extraCurricular) {
      if (updateChildDto.extraCurricular.interests !== undefined) {
        updateData.interests = updateChildDto.extraCurricular.interests
      }
      if (updateChildDto.extraCurricular.preferredSchedule !== undefined) {
        updateData.preferredSchedule = updateChildDto.extraCurricular.preferredSchedule
      }
    }

    // Special Needs
    if (updateChildDto.specialNeeds) {
      if (updateChildDto.specialNeeds.areas !== undefined) {
        updateData.specialNeedsAreas = updateChildDto.specialNeeds.areas
      }
      if (updateChildDto.specialNeeds.supportNeeds !== undefined) {
        updateData.specialNeedsSupportNeeds = updateChildDto.specialNeeds.supportNeeds
      }
      if (updateChildDto.specialNeeds.additionalNotes !== undefined) {
        updateData.specialNeedsNotes = updateChildDto.specialNeeds.additionalNotes
      }
    }

    // Update child
    const child = await this.prisma.children.update({
      where: { id },
      data: updateData,
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

    // Delete child
    await this.prisma.children.delete({
      where: { id },
    })

    return {
      message: `Child '${child.firstName} ${child.lastName}' deleted successfully`,
    }
  }

  /**
   * Format child database record to match frontend Child type structure
   */
  private formatChildResponse(child: any) {
    return {
      id: child.id,
      personalInfo: {
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        nationality: child.nationality,
        languages: child.languages || [],
      },
      academicPreferences: {
        currentGrade: child.currentGrade,
        favoriteSubjects: child.favoriteSubjects || [],
        learningStyle: child.learningStyle,
        languagesOfInstruction: child.languagesOfInstruction || [],
        interestedInBoarding: child.interestedInBoarding,
      },
      extraCurricular: {
        interests: child.interests || [],
        preferredSchedule: child.preferredSchedule,
      },
      specialNeeds: {
        areas: child.specialNeedsAreas || [],
        supportNeeds: child.specialNeedsSupportNeeds || [],
        additionalNotes: child.specialNeedsNotes,
      },
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    }
  }
}
