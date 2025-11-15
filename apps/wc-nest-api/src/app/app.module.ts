import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'

// Core modules
import { ConfigModule } from '../config/config.module'
import { PrismaModule } from '../prisma/prisma.module'
import { CommonModule } from '../common/common.module'

// Feature modules
import { AuthModule } from '../modules/core/auth/auth.module'
import { HealthModule } from '../modules/health/health.module'

// Domain modules
import { SuperAdminModule } from '../modules/superadmin/superadmin.module'
import { ProviderModule } from '../modules/provider/provider.module'
import { UserModule } from '../modules/user/user.module'

@Module({
  imports: [
    // Core infrastructure
    ConfigModule,
    PrismaModule,
    CommonModule,

    // Feature modules
    AuthModule,
    HealthModule,

    // Domain modules
    SuperAdminModule,
    ProviderModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
