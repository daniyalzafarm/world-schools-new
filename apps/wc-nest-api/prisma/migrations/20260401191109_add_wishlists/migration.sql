-- CreateEnum
CREATE TYPE "wishlist_share_role" AS ENUM ('viewer', 'editor');

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(10),
    "share_token" TEXT,
    "is_link_sharing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_children" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "session_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_shares" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "role" "wishlist_share_role" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_share_token_key" ON "wishlists"("share_token");

-- CreateIndex
CREATE INDEX "wishlists_parent_id_idx" ON "wishlists"("parent_id");

-- CreateIndex
CREATE INDEX "wishlists_share_token_idx" ON "wishlists"("share_token");

-- CreateIndex
CREATE INDEX "wishlist_children_wishlist_id_idx" ON "wishlist_children"("wishlist_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_children_wishlist_id_child_id_key" ON "wishlist_children"("wishlist_id", "child_id");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlist_id_idx" ON "wishlist_items"("wishlist_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_camp_id_key" ON "wishlist_items"("wishlist_id", "camp_id");

-- CreateIndex
CREATE INDEX "wishlist_shares_email_idx" ON "wishlist_shares"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_shares_wishlist_id_email_key" ON "wishlist_shares"("wishlist_id", "email");

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_children" ADD CONSTRAINT "wishlist_children_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_children" ADD CONSTRAINT "wishlist_children_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_shares" ADD CONSTRAINT "wishlist_shares_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_shares" ADD CONSTRAINT "wishlist_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
