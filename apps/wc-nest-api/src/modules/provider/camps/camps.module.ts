import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { CampsController } from './camps.controller'
import { CampsService } from './camps.service'
import { PhotoUploadService } from './services/photo-upload.service'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtConfig.secret,
        signOptions: {
          expiresIn: configService.jwtConfig.expiresIn as any,
        },
      }),
    }),
  ],
  controllers: [CampsController],
  providers: [CampsService, PhotoUploadService],
  exports: [CampsService],
})
export class CampsModule {}
