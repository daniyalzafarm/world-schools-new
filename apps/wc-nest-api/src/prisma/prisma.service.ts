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
    const isProduction = configService.isProduction

    // Check if SSL is required via ConfigService
    // Set POSTGRES_REQUIRE_SSL=true for Azure PostgreSQL or other SSL-required databases
    const requiresSsl = configService.postgresRequireSsl

    // Create Pool with production-grade connection pooling settings
    // PrismaPg adapter does not automatically parse SSL parameters from connection string
    // Azure PostgreSQL Flexible Server requires SSL connections
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: requiresSsl
        ? {
            rejectUnauthorized: false, // Azure PostgreSQL uses self-signed certificates
          }
        : undefined,
      // Production-grade connection pooling settings
      // For messaging system with 10,000+ concurrent WebSocket connections
      max: isProduction ? 20 : 10, // Maximum pool size (production: 20, dev: 10)
      min: isProduction ? 5 : 2, // Minimum pool size (keep connections warm)
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Timeout for acquiring connection (10 seconds)
      maxUses: 7500, // Recycle connections after 7500 uses (prevent memory leaks)
      allowExitOnIdle: !isProduction, // Allow process to exit when idle (dev only)
    })

    // Log pool errors
    pool.on('error', err => {
      this.logger.error('Unexpected database pool error', err)
    })

    // Log pool connection events in development
    // if (!isProduction) {
    //   pool.on('connect', () => {
    //     this.logger.debug('New database connection established')
    //   })
    //   pool.on('acquire', () => {
    //     this.logger.debug('Database connection acquired from pool')
    //   })
    //   pool.on('remove', () => {
    //     this.logger.debug('Database connection removed from pool')
    //   })
    // }

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
