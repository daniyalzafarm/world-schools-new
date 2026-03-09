-- CreateEnum
CREATE TYPE "article_type" AS ENUM ('how_to', 'faq', 'reference', 'policy');

-- CreateEnum
CREATE TYPE "audience" AS ENUM ('parents', 'providers', 'staff');

-- CreateEnum
CREATE TYPE "article_status" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "article_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(10),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "article_type" "article_type" NOT NULL,
    "audience" "audience"[],
    "category_id" TEXT NOT NULL,
    "status" "article_status" NOT NULL DEFAULT 'draft',
    "content_html" TEXT NOT NULL,
    "summary" TEXT,
    "meta_title" VARCHAR(255) NOT NULL,
    "meta_description" VARCHAR(500) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "published_at" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_relations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "related_article_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_feedback" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "is_helpful" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_name_key" ON "article_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_slug_key" ON "article_categories"("slug");

-- CreateIndex
CREATE INDEX "article_categories_is_active_idx" ON "article_categories"("is_active");

-- CreateIndex
CREATE INDEX "article_categories_sort_order_idx" ON "article_categories"("sort_order");

-- CreateIndex
CREATE INDEX "article_categories_is_active_sort_order_idx" ON "article_categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_idx" ON "articles"("status");

-- CreateIndex
CREATE INDEX "articles_slug_idx" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_published_at_idx" ON "articles"("published_at");

-- CreateIndex
CREATE INDEX "articles_category_id_idx" ON "articles"("category_id");

-- CreateIndex
CREATE INDEX "articles_category_id_status_idx" ON "articles"("category_id", "status");

-- CreateIndex
CREATE INDEX "articles_category_id_published_at_idx" ON "articles"("category_id", "published_at");

-- CreateIndex
CREATE INDEX "article_relations_article_id_idx" ON "article_relations"("article_id");

-- CreateIndex
CREATE INDEX "article_relations_related_article_id_idx" ON "article_relations"("related_article_id");

-- CreateIndex
CREATE INDEX "article_relations_article_id_sort_order_idx" ON "article_relations"("article_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "article_relations_article_id_related_article_id_key" ON "article_relations"("article_id", "related_article_id");

-- CreateIndex
CREATE INDEX "article_feedback_article_id_idx" ON "article_feedback"("article_id");

-- CreateIndex
CREATE INDEX "article_feedback_user_id_idx" ON "article_feedback"("user_id");

-- CreateIndex
CREATE INDEX "article_feedback_session_id_idx" ON "article_feedback"("session_id");

-- CreateIndex
CREATE INDEX "article_feedback_created_at_idx" ON "article_feedback"("created_at");

-- CreateIndex
CREATE INDEX "article_feedback_article_id_is_helpful_idx" ON "article_feedback"("article_id", "is_helpful");

-- CreateIndex
CREATE UNIQUE INDEX "article_feedback_article_id_user_id_key" ON "article_feedback"("article_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_feedback_article_id_session_id_key" ON "article_feedback"("article_id", "session_id");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "article_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relations" ADD CONSTRAINT "article_relations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relations" ADD CONSTRAINT "article_relations_related_article_id_fkey" FOREIGN KEY ("related_article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_feedback" ADD CONSTRAINT "article_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_feedback" ADD CONSTRAINT "article_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
