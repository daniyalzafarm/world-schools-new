'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ScrollShadow,
  Switch,
} from '@heroui/react'
import { Input, SelectField } from '@world-schools/ui-web'
import type { WishlistDetail, WishlistShareRole } from '@/types/wishlists'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { Trash2 } from 'lucide-react'

interface ShareWishlistModalProps {
  isOpen: boolean
  onClose: () => void
  wishlist: WishlistDetail
}

export function ShareWishlistModal({ isOpen, onClose, wishlist }: ShareWishlistModalProps) {
  const { addShare, removeShare, updateShareRole, toggleLinkSharing } = useWishlistsStore()
  const liveWishlist = useWishlistsStore(state =>
    state.activeWishlist?.id === wishlist.id ? state.activeWishlist : null
  )
  const w = liveWishlist ?? wishlist

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WishlistShareRole>('viewer')
  const [isInviting, setIsInviting] = useState(false)
  const [isTogglingLink, setIsTogglingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setRole('viewer')
    }
  }, [isOpen])

  async function handleInvite() {
    if (!email.trim()) return
    setIsInviting(true)
    const ok = await addShare(wishlist.id, { email: email.trim(), role })
    setIsInviting(false)
    if (ok) {
      setEmail('')
      setRole('viewer')
    } else {
      addToast({ title: 'Error', description: 'Failed to send invite', color: 'danger' })
    }
  }

  async function handleRemoveShare(shareId: string) {
    setRemovingIds(prev => new Set(prev).add(shareId))
    const ok = await removeShare(wishlist.id, shareId)
    if (!ok) {
      addToast({ title: 'Error', description: 'Failed to remove share', color: 'danger' })
    }
    setRemovingIds(prev => {
      const s = new Set(prev)
      s.delete(shareId)
      return s
    })
  }

  async function handleRoleChange(shareId: string, newRole: WishlistShareRole) {
    setUpdatingIds(prev => new Set(prev).add(shareId))
    const ok = await updateShareRole(wishlist.id, shareId, newRole)
    if (!ok) {
      addToast({ title: 'Error', description: 'Failed to update role', color: 'danger' })
    }
    setUpdatingIds(prev => {
      const s = new Set(prev)
      s.delete(shareId)
      return s
    })
  }

  async function handleToggleLink(enabled: boolean) {
    setIsTogglingLink(true)
    const ok = await toggleLinkSharing(wishlist.id, enabled)
    if (!ok) {
      addToast({ title: 'Error', description: 'Failed to update link sharing', color: 'danger' })
    }
    setIsTogglingLink(false)
  }

  function handleCopy() {
    if (!w.shareToken) return
    const url = `${origin}/wishlists/shared/${w.shareToken}`
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(err => {
        addToast({
          title: 'Error',
          description: `Failed to copy link: ${err.message}`,
          color: 'danger',
        })
      })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Share "{w.name}"</ModalHeader>

        <ModalBody className="gap-5 pb-2">
          {/* Invite row */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Invite by email"
                labelPlacement="outside"
                placeholder="Email address"
                type="email"
                value={email}
                onValueChange={setEmail}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="w-32 shrink-0">
              <SelectField
                label="Role"
                value={role}
                onChange={val => setRole(val as WishlistShareRole)}
                options={[
                  { value: 'viewer', label: 'Viewer' },
                  { value: 'editor', label: 'Editor' },
                ]}
                size="md"
              />
            </div>
            <Button
              className="bg-slate-800 text-white font-semibold shrink-0 h-10 self-end mb-0.5"
              onPress={handleInvite}
              isLoading={isInviting}
              isDisabled={!email.trim()}
            >
              Invite
            </Button>
          </div>

          {/* People with access */}
          {!!w.shares.length && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                People with access
              </p>

              <ScrollShadow className="max-h-56">
                {/* Owner row */}
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-100 to-red-100 flex items-center justify-center font-semibold text-sm shrink-0">
                    Me
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">You</div>
                  </div>
                  <span className="text-xs text-teal-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                    Owner
                  </span>
                </div>

                {/* Shares — newest first */}
                {[...w.shares]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map(share => (
                    <div key={share.id} className="flex items-center gap-3 px-3.5 py-3">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-100 to-red-100 flex items-center justify-center font-semibold text-sm shrink-0">
                        {share.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{share.email}</div>
                      </div>
                      {/* Role selector */}
                      <SelectField
                        aria-label={`Role for ${share.email}`}
                        value={share.role}
                        onChange={val => handleRoleChange(share.id, val as WishlistShareRole)}
                        isDisabled={updatingIds.has(share.id)}
                        options={[
                          { value: 'viewer', label: 'Viewer' },
                          { value: 'editor', label: 'Editor' },
                        ]}
                        fullWidth={false}
                        size="sm"
                      />
                      {/* Remove */}
                      <Button
                        onPress={() => handleRemoveShare(share.id)}
                        isDisabled={removingIds.has(share.id)}
                        aria-label={`Remove ${share.email}`}
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </ScrollShadow>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* Link sharing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Anyone with the link</p>
                <p className="text-sm text-gray-500">Anyone can view this wishlist</p>
              </div>
              <Switch
                isSelected={w.isLinkSharingEnabled}
                onValueChange={handleToggleLink}
                isDisabled={isTogglingLink}
                color="success"
              />
            </div>

            {w.isLinkSharingEnabled && w.shareToken && (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate">
                  {origin
                    ? `${origin}/wishlists/shared/${w.shareToken}`
                    : `/wishlists/shared/${w.shareToken}`}
                </div>
                <Button
                  size="sm"
                  variant="bordered"
                  className="shrink-0 font-medium"
                  onPress={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button className="bg-slate-800 text-white font-semibold" onPress={onClose}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
