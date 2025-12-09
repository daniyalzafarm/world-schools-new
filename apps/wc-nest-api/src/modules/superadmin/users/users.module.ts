import { Module } from '@nestjs/common'
import { SuperAdminUsersController } from './users.controller'
import { SuperAdminUsersService } from './users.service'
import { CommonUsersService } from '../../common/users/users.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminUsersController],
  providers: [CommonUsersService, SuperAdminUsersService],
})
export class SuperAdminUsersModule {}
