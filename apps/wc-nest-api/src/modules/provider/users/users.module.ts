import { Module } from '@nestjs/common'
import { ProviderUsersController } from './users.controller'
import { ProviderUsersService } from './users.service'
import { CommonUsersService } from '../../common/users/users.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ProviderUsersController],
  providers: [CommonUsersService, ProviderUsersService],
  exports: [ProviderUsersService],
})
export class ProviderUsersModule {}
