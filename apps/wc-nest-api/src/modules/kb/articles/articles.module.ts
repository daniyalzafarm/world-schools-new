import { Module } from '@nestjs/common'
import { ArticlesService } from './services/articles.service'
import { ArticleActionsService } from './services/article-actions.service'
import { ArticleFeedbackService } from './services/article-feedback.service'
import { ArticleRelationsService } from './services/article-relations.service'
import { ArticlesController, PublicArticlesController } from './articles.controller'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ArticlesController, PublicArticlesController],
  providers: [
    ArticlesService,
    ArticleActionsService,
    ArticleFeedbackService,
    ArticleRelationsService,
  ],
  exports: [
    ArticlesService,
    ArticleActionsService,
    ArticleFeedbackService,
    ArticleRelationsService,
  ],
})
export class ArticlesModule {}
