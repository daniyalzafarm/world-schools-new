import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '../generated/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { ConfigService } from '../config/config.service'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.databaseUrl

    // Check if SSL is required via ConfigService
    // Set POSTGRES_REQUIRE_SSL=true for Azure PostgreSQL or other SSL-required databases
    const requiresSsl = configService.postgresRequireSsl

    // Create Pool with explicit SSL configuration
    // PrismaPg adapter does not automatically parse SSL parameters from connection string
    // Azure PostgreSQL Flexible Server requires SSL connections
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: requiresSsl
        ? {
            rejectUnauthorized: false, // Azure PostgreSQL uses self-signed certificates
          }
        : undefined,
    })

    const adapter = new PrismaPg(pool)
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
