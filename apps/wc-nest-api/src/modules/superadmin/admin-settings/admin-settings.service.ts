import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { SystemSettingsResponseDto, UpdateSystemSettingsDto } from './dto/admin-settings.dto'

const SINGLETON_ID = 'singleton'

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the singleton SystemSettings row, creating it with defaults if it doesn't exist.
   */
  async getSettings(): Promise<SystemSettingsResponseDto> {
    const settings = await this.prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, defaultCommission: 10 },
      update: {},
    })

    return {
      defaultCommission: Number(settings.defaultCommission),
      updatedAt: settings.updatedAt.toISOString(),
    }
  }

  /**
   * Updates the singleton SystemSettings row.
   */
  async updateSettings(
    dto: UpdateSystemSettingsDto,
    adminId: string
  ): Promise<SystemSettingsResponseDto> {
    const settings = await this.prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        defaultCommission: dto.defaultCommission,
        updatedByAdminId: adminId,
      },
      update: {
        defaultCommission: dto.defaultCommission,
        updatedByAdminId: adminId,
      },
    })

    this.logger.log(
      `System settings updated by admin ${adminId}: defaultCommission=${dto.defaultCommission}%`
    )

    return {
      defaultCommission: Number(settings.defaultCommission),
      updatedAt: settings.updatedAt.toISOString(),
    }
  }
}
