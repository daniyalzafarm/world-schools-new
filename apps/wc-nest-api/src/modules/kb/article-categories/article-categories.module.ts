import { Module } from '@nestjs/common'
import { ArticleCategoriesService } from './article-categories.service'
import {
  ArticleCategoriesController,
  PublicContextualArticleCategoriesController,
} from './article-categories.controller'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ArticleCategoriesController, PublicContextualArticleCategoriesController],
  providers: [ArticleCategoriesService],
  exports: [ArticleCategoriesService],
})
export class ArticleCategoriesModule {}
