import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

@Injectable()
export class UserChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createChildDto: CreateChildDto) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user');
    }

    // Convert date string to Date if provided
    const dateOfBirth = createChildDto.dateOfBirth
      ? new Date(createChildDto.dateOfBirth)
      : null;

    // Create child
    const child = await this.prisma.children.create({
      data: {
        firstName: createChildDto.firstName,
        lastName: createChildDto.lastName,
        dateOfBirth: dateOfBirth,
        grade: createChildDto.grade,
        parentId: parent.id,
      },
    });

    return child;
  }

  async findAll(userId: string) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user');
    }

    // Get all children for this parent
    return this.prisma.children.findMany({
      where: {
        parentId: parent.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    // Get parent profile
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found for this user');
    }

    // Get child
    const child = await this.prisma.children.findUnique({
      where: { id },
    });

    if (!child) {
      throw new NotFoundException(`Child with ID '${id}' not found`);
    }

    // Verify child belongs to this parent
    if (child.parentId !== parent.id) {
      throw new ForbiddenException(
        'You do not have permission to access this child',
      );
    }

    return child;
  }

  async update(userId: string, id: string, updateChildDto: UpdateChildDto) {
    // Verify child exists and belongs to parent
    await this.findOne(userId, id);

    // Convert date string to Date if provided
    const updateData: any = { ...updateChildDto };
    if (updateChildDto.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateChildDto.dateOfBirth);
    }

    // Update child
    const child = await this.prisma.children.update({
      where: { id },
      data: updateData,
    });

    return child;
  }

  async remove(userId: string, id: string) {
    // Verify child exists and belongs to parent
    const child = await this.findOne(userId, id);

    // Delete child
    await this.prisma.children.delete({
      where: { id },
    });

    return {
      message: `Child '${child.firstName} ${child.lastName}' deleted successfully`,
    };
  }
}

