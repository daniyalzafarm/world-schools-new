import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CatalogueService } from './services/catalogue.service'
import { AdminCatalogueController } from './controllers/admin-catalogue.controller'
import { PublicCatalogueController } from './controllers/public-catalogue.controller'

@Module({
  imports: [PrismaModule],
  providers: [CatalogueService],
  controllers: [AdminCatalogueController, PublicCatalogueController],
  exports: [CatalogueService],
})
export class CatalogueModule {}
