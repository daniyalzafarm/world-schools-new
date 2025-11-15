import { Module } from '@nestjs/common'
import { UserChildrenService } from './children.service'
import { UserChildrenController } from './children.controller'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [UserChildrenController],
  providers: [UserChildrenService],
})
export class UserChildrenModule {}
