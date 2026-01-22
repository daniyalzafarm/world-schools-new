import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { UserCampsService } from './camps.service'
import { UserCampsController } from './camps.controller'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'

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
  controllers: [UserCampsController],
  providers: [UserCampsService],
})
export class UserCampsModule {}
