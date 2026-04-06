'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/react'
import { Copy, Heart, MoreVertical, Search, Share2, SquarePen, Trash2, User } from 'lucide-react'
import { useConfirmDialog } from '@world-schools/ui-web'
import type { Wishlist } from '@/types/wishlists'
import { useWishlistsStore } from '@/stores/wishlists-store'

interface WishlistCardProps {
  wishlist: Wishlist
  onEdit?: (wishlist: Wishlist) => void
  onShare?: (wishlist: Wishlist) => void
  readOnly?: boolean
  sharedBy?: string
}

function CollageArea({ wishlist }: { wishlist: Wishlist }) {
  const photos = wishlist.coverPhotos ?? []
  const isEmpty = wishlist.campCount === 0 || photos.length === 0

  if (isEmpty) {
    return (
      <div className="relative h-[180px] flex flex-col items-center justify-center bg-linear-to-br from-gray-100 to-gray-200 overflow-hidden">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
          <Search className="w-6 h-6 text-gray-400" />
        </div>
        <span className="text-[13px] text-gray-500 mt-2">Start exploring camps</span>
      </div>
    )
  }

  // 1 photo: full-width single image
  if (photos.length === 1) {
    return (
      <div className="relative h-[180px] overflow-hidden">
        <img
          src={photos[0]}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40" />
        <span className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/75 text-white rounded-lg text-[13px] font-medium backdrop-blur-sm">
          {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'}
        </span>
      </div>
    )
  }

  // 2 photos: two equal columns
  if (photos.length === 2) {
    return (
      <div className="relative h-[180px] overflow-hidden grid grid-cols-2 gap-0.5">
        {photos.map((url, i) => (
          <div key={i} className="overflow-hidden">
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40" />
        <span className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/75 text-white rounded-lg text-[13px] font-medium backdrop-blur-sm">
          {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'}
        </span>
      </div>
    )
  }

  // 3 photos: 2×2 grid, first image spans 2 rows
  if (photos.length === 3) {
    return (
      <div className="relative h-[180px] overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5">
        <div className="row-span-2 overflow-hidden">
          <img
            src={photos[0]}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        {photos.slice(1, 3).map((url, i) => (
          <div key={i} className="overflow-hidden">
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40" />
        <span className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/75 text-white rounded-lg text-[13px] font-medium backdrop-blur-sm">
          {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'}
        </span>
      </div>
    )
  }

  // 4+ photos: 2×2 grid
  return (
    <div className="relative h-[180px] overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5">
      {photos.slice(0, 4).map((url, i) => (
        <div key={i} className="overflow-hidden">
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40" />
      <span className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/75 text-white rounded-lg text-[13px] font-medium backdrop-blur-sm">
        {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'}
      </span>
    </div>
  )
}

export function WishlistCard({
  wishlist,
  onEdit,
  onShare,
  readOnly = false,
  sharedBy,
}: WishlistCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const { deleteWishlist, duplicateWishlist } = useWishlistsStore()
  const { confirm } = useConfirmDialog()

  function handleCardClick() {
    router.push(`/wishlists/${wishlist.id}`)
  }

  async function handleDuplicate() {
    const ok = await confirm({
      title: 'Duplicate wishlist',
      message: `Duplicate "${wishlist.name}"? A copy will be created with all the same camps and children.`,
      confirmText: 'Duplicate',
      variant: 'info',
    })
    if (!ok) return
    const duplicated = await duplicateWishlist(wishlist.id)
    if (!duplicated) {
      addToast({ title: 'Error', description: 'Failed to duplicate wishlist', color: 'danger' })
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete wishlist',
      message: `Are you sure you want to delete "${wishlist.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setIsDeleting(true)
    const deleted = await deleteWishlist(wishlist.id)
    if (!deleted) {
      addToast({ title: 'Error', description: 'Failed to delete wishlist', color: 'danger' })
    }
    setIsDeleting(false)
  }

  // Build children meta string
  const childrenNames = wishlist.children
    .map(c => {
      if (!c.child) return null
      return c.child.firstName
    })
    .filter(Boolean)
    .join(' & ')

  return (
    <div
      className="group bg-white rounded-[20px] border border-gray-100 overflow-hidden transition-all duration-200 cursor-pointer hover:border-gray-900 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      onClick={handleCardClick}
    >
      <CollageArea wishlist={wishlist} />

      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          {/* Title area */}
          <div className="flex items-center gap-2.5 min-w-0">
            {wishlist.icon && <span className="text-2xl flex-shrink-0">{wishlist.icon}</span>}
            <div className="min-w-0">
              <h3 className="text-[17px] font-semibold truncate hover:text-[#0D8B6D] transition-colors">
                {wishlist.name}
              </h3>
              {childrenNames && (
                <div className="text-[13px] text-gray-500 truncate">{childrenNames}</div>
              )}
            </div>
          </div>

          {/* Kebab menu */}
          {!readOnly && (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="w-9 h-9"
                  disabled={isDeleting}
                >
                  <MoreVertical className="w-[18px] h-[18px] text-gray-500" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Wishlist actions"
                onAction={key => {
                  if (key === 'edit') onEdit?.(wishlist)
                  if (key === 'share') onShare?.(wishlist)
                  if (key === 'duplicate') void handleDuplicate()
                  if (key === 'delete') void handleDelete()
                }}
              >
                <DropdownSection showDivider>
                  <DropdownItem key="edit" startContent={<SquarePen className="w-4 h-4" />}>
                    Edit list
                  </DropdownItem>
                  <DropdownItem key="share" startContent={<Share2 className="w-4 h-4" />}>
                    Share list
                  </DropdownItem>
                  <DropdownItem key="duplicate" startContent={<Copy className="w-4 h-4" />}>
                    Duplicate
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection>
                  <DropdownItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    startContent={<Trash2 className="w-4 h-4" />}
                  >
                    Delete list
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>

        {/* Meta pills */}
        {(wishlist.campCount > 0 ||
          wishlist.children.length > 0 ||
          (readOnly && sharedBy) ||
          (!readOnly && wishlist.shareCount > 0)) && (
          <div className="flex flex-wrap items-center gap-2 mt-[14px] pt-[14px] border-t border-gray-100">
            {wishlist.campCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[13px] font-medium text-gray-900 whitespace-nowrap">
                <Heart className="w-3.5 h-3.5 text-gray-500" />
                {wishlist.campCount} {wishlist.campCount === 1 ? 'camp' : 'camps'}
              </span>
            )}
            {wishlist.children.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[13px] font-medium text-gray-900 whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-gray-500" />
                {wishlist.children.length} {wishlist.children.length === 1 ? 'child' : 'children'}
              </span>
            )}
            {!readOnly && wishlist.shareCount > 0 && (
              <button
                className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[13px] font-medium text-gray-900 whitespace-nowrap hover:border-gray-200 transition-all"
                onClick={e => {
                  e.stopPropagation()
                  onShare?.(wishlist)
                }}
              >
                <div className="flex">
                  {wishlist.shares.slice(0, 2).map((s, i) => (
                    <span
                      key={s.id}
                      className="w-[18px] h-[18px] rounded-full bg-linear-to-br from-blue-100 to-red-100 border-2 border-white flex items-center justify-center text-[9px] font-semibold"
                      style={{ marginLeft: i === 0 ? 0 : -5 }}
                    >
                      {s.email[0].toUpperCase()}
                    </span>
                  ))}
                </div>
                Shared
              </button>
            )}
            {readOnly && sharedBy && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-[13px] font-medium text-blue-600 whitespace-nowrap">
                Shared by {sharedBy}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
