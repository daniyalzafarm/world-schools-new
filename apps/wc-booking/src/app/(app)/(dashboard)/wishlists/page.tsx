'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useChildrenStore } from '@/stores/children-store'
import { WishlistsDashboard } from '@/components/wishlists/wishlists-dashboard'
import { SharedWishlists } from '@/components/wishlists/shared-wishlists'
import { CreateWishlistModal } from '@/components/wishlists/modals/create-wishlist-modal'
import { ShareWishlistModal } from '@/components/wishlists/modals/share-wishlist-modal'
import type { Wishlist, WishlistDetail } from '@/types/wishlists'

type Tab = 'my' | 'shared'

export default function WishlistsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('my')
  const [editTarget, setEditTarget] = useState<Wishlist | null>(null)
  const [shareTarget, setShareTarget] = useState<WishlistDetail | null>(null)

  const {
    myWishlists,
    sharedWishlists,
    isLoadingList,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    fetchMyWishlists,
    fetchSharedWithMe,
    fetchWishlistDetail,
  } = useWishlistsStore()

  const { fetchChildren } = useChildrenStore()

  useEffect(() => {
    void fetchMyWishlists()
    void fetchSharedWithMe()
    void fetchChildren()
  }, [fetchMyWishlists, fetchSharedWithMe, fetchChildren])

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
    <div>
      {/* Page header */}
      <header className="flex justify-between items-start mb-8 gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <h1 className="text-3xl font-semibold tracking-tight text-secondary">My Wishlists</h1>
          <p className="mt-1 text-default-600">Plan holidays and find the perfect camps</p>
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
      </header>

      {/* Tabs */}
      <div className="mb-7">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            className={`cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'my'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('my')}
          >
            My wishlists
            <span
              className={`px-2 py-0.5 rounded-xl text-xs ${
                activeTab === 'my' ? 'bg-emerald-50 text-teal-600' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {myWishlists.length}
            </span>
          </button>
          <button
            className={`cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'shared'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('shared')}
          >
            Shared with me
            <span
              className={`px-2 py-0.5 rounded-xl text-xs ${
                activeTab === 'shared' ? 'bg-emerald-50 text-teal-600' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {sharedWishlists.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'my' ? (
        <WishlistsDashboard
          wishlists={myWishlists}
          isLoading={isLoadingList}
          onEdit={handleEdit}
          onShare={handleShare}
        />
      ) : (
        <SharedWishlists entries={sharedWishlists} isLoading={isLoadingList} />
      )}

      {/* Modals */}
      <CreateWishlistModal isOpen={isCreateModalOpen} onClose={closeCreateModal} />
      <CreateWishlistModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        wishlist={editTarget ?? undefined}
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
