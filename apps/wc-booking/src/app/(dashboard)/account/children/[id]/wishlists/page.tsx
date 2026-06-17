'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@heroui/react'
import { BackButton } from '@world-schools/ui-web'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useChildrenStore } from '@/stores/children-store'
import { WishlistsDashboard } from '@/components/wishlists/wishlists-dashboard'
import { CreateWishlistModal } from '@/components/wishlists/modals/create-wishlist-modal'
import { ShareWishlistModal } from '@/components/wishlists/modals/share-wishlist-modal'
import type { Wishlist, WishlistDetail } from '@/types/wishlists'

export default function ChildWishlistsPage() {
  const params = useParams()
  const childId = params.id as string

  const [editTarget, setEditTarget] = useState<Wishlist | null>(null)
  const [shareTarget, setShareTarget] = useState<WishlistDetail | null>(null)

  const {
    myWishlists,
    isLoadingList,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    fetchMyWishlists,
    fetchWishlistDetail,
  } = useWishlistsStore()

  const children = useChildrenStore(state => state.children)
  const isChildrenLoading = useChildrenStore(state => state.isLoading)
  const fetchChildren = useChildrenStore(state => state.fetchChildren)

  useEffect(() => {
    void fetchMyWishlists()
  }, [fetchMyWishlists])

  // The create-modal flag lives in the shared store; make sure leaving this page
  // never leaves it open for the main wishlists page.
  useEffect(() => {
    return () => closeCreateModal()
  }, [closeCreateModal])

  // Resolve the child's name on deep-links/reloads where the store is empty.
  useEffect(() => {
    if (children.length === 0 && !isChildrenLoading) {
      fetchChildren().catch(() => undefined)
    }
  }, [children.length, isChildrenLoading, fetchChildren])

  const child = children.find(c => c.id === childId)
  const childName = child?.nickname || child?.firstName

  const childWishlists = myWishlists.filter(w => w.children.some(c => c.childId === childId))

  async function handleShare(wishlist: Wishlist) {
    const detail = await fetchWishlistDetail(wishlist.id).then(
      () => useWishlistsStore.getState().activeWishlist
    )
    if (detail) setShareTarget(detail)
  }

  function handleEdit(wishlist: Wishlist) {
    setEditTarget(wishlist)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-48">
          <div className="flex items-center gap-4 mb-2">
            <BackButton />
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {childName ? `${childName}'s Wishlists` : 'Wishlists'}
            </h1>
          </div>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Camps saved for {childName ?? 'this child'}
          </p>
        </div>
        <Button
          className="bg-slate-800 text-white font-semibold px-5 py-3 rounded-xl h-auto whitespace-nowrap"
          onPress={openCreateModal}
          startContent={
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Create new list
        </Button>
      </div>

      <WishlistsDashboard
        wishlists={childWishlists}
        isLoading={isLoadingList}
        onEdit={handleEdit}
        onShare={handleShare}
      />

      {/* Create — pre-selects and locks to the current child */}
      <CreateWishlistModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        lockedChildId={childId}
      />

      {/* Edit reuses the create modal with a wishlist prop */}
      <CreateWishlistModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        wishlist={editTarget ?? undefined}
        lockedChildId={childId}
      />

      {shareTarget && (
        <ShareWishlistModal
          isOpen={!!shareTarget}
          onClose={() => setShareTarget(null)}
          wishlist={shareTarget}
        />
      )}
    </div>
  )
}
