import { Module } from '@nestjs/common'
import { ArticleCategoriesModule } from './article-categories/article-categories.module'
import { ArticlesModule } from './articles/articles.module'

@Module({
  imports: [ArticleCategoriesModule, ArticlesModule],
  exports: [ArticleCategoriesModule, ArticlesModule],
})
export class KbModule {}
