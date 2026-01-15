import { Module } from '@nestjs/common'
import { AddOnsController } from './add-ons.controller'
import { AddOnsService } from './add-ons.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [AddOnsController],
  providers: [AddOnsService],
  exports: [AddOnsService],
})
export class AddOnsModule {}
