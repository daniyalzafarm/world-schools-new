import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '../generated/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ConfigService } from '../config/config.service'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(private configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: configService.databaseUrl,
    })
    super({ adapter })
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Connected to Database Successfully')
      const dbConfig = this.configService.postgresConfig
      console.log('==============================================')
      console.log('Database Connected Successfully:', dbConfig.host)
      console.log('==============================================')
    } catch (error) {
      this.logger.error('Failed to connect to Database', error)
      throw error
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Disconnected from database')
  }
}
