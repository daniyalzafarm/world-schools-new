'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useChildrenStore } from '@/stores/children-store'
import type { Wishlist } from '@/types/wishlists'
import { Check } from 'lucide-react'

interface CreateWishlistModalProps {
  isOpen: boolean
  onClose: () => void
  wishlist?: Wishlist
}

export function CreateWishlistModal({ isOpen, onClose, wishlist }: CreateWishlistModalProps) {
  const isEditMode = !!wishlist
  const { createWishlist, updateWishlist } = useWishlistsStore()
  const { children } = useChildrenStore()

  const [name, setName] = useState('')
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Sync form state when the modal opens or the target wishlist changes
  useEffect(() => {
    if (isOpen) {
      setName(wishlist?.name ?? '')
      setSelectedChildIds(wishlist?.children.map(c => c.childId) ?? [])
    }
  }, [isOpen, wishlist])

  function toggleChild(id: string) {
    setSelectedChildIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]))
  }

  function handleClose() {
    setName('')
    setSelectedChildIds([])
    onClose()
  }

  async function handleSubmit() {
    if (!name.trim()) return
    setIsSaving(true)

    if (isEditMode) {
      const ok = await updateWishlist(wishlist.id, {
        name: name.trim(),
        childIds: selectedChildIds,
      })
      setIsSaving(false)
      if (ok) {
        handleClose()
      } else {
        addToast({ title: 'Error', description: 'Failed to update wishlist', color: 'danger' })
      }
    } else {
      const result = await createWishlist({
        name: name.trim(),
        childIds: selectedChildIds.length > 0 ? selectedChildIds : undefined,
      })
      setIsSaving(false)
      if (result) {
        handleClose()
      } else {
        addToast({ title: 'Error', description: 'Failed to create wishlist', color: 'danger' })
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">
          {isEditMode ? 'Edit list' : 'Create new list'}
        </ModalHeader>
        <ModalBody className="gap-5 pb-2">
          {/* Name input */}
          <div>
            <Input
              label="List name"
              labelPlacement="outside"
              placeholder="e.g. Summer 2025, Spring Break…"
              value={name}
              onValueChange={setName}
              isRequired
              autoFocus
              maxLength={120}
            />
          </div>

          {/* Children selector */}
          {children.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2.5">
                For which children? <span className="text-gray-400 font-normal">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map(child => {
                  const isSelected = selectedChildIds.includes(child.id)
                  const initials = (child.firstName?.[0] ?? '?').toUpperCase()
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-gray-900 bg-gray-100'
                          : 'border-gray-200 bg-white hover:border-gray-900'
                      }`}
                      onClick={() => toggleChild(child.id)}
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-linear-to-br from-pink-100 to-green-100 flex items-center justify-center text-xs font-semibold text-gray-700 shrink-0 overflow-hidden">
                        {child.photoUrl ? (
                          <img
                            src={child.photoUrl}
                            alt={child.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <span>{child.firstName}</span>
                      {/* Check */}
                      <div
                        className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button
            className="bg-[#1A2B49] text-white font-semibold"
            onPress={handleSubmit}
            isLoading={isSaving}
            isDisabled={!name.trim()}
          >
            {isEditMode ? 'Save' : 'Create'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
