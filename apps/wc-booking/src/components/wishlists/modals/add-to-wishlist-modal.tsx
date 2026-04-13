'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ScrollShadow,
} from '@heroui/react'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useChildrenStore } from '@/stores/children-store'

type ViewType = 'select' | 'create' | 'success'

interface SavedToWishlist {
  id: string
  name: string
}

export function AddToWishlistModal({ skipSuccessView = false }: { skipSuccessView?: boolean }) {
  const router = useRouter()
  const {
    isAddToWishlistModalOpen,
    addToWishlistCampId,
    addToWishlistCampPreview,
    closeAddToWishlistModal,
    myWishlists,
    isLoadingList,
    createWishlist,
    syncCampWishlists,
    isCampInWishlist,
  } = useWishlistsStore()
  const { children, fetchChildren } = useChildrenStore()

  const [view, setView] = useState<ViewType>('create')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [initialIds, setInitialIds] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedTo, setSavedTo] = useState<SavedToWishlist | null>(null)
  const [savedToFirstId, setSavedToFirstId] = useState<string | null>(null)

  // Create view state
  const [newName, setNewName] = useState('')
  const [newChildIds, setNewChildIds] = useState<string[]>([])

  // Reset flags and form state when modal opens
  useEffect(() => {
    if (isAddToWishlistModalOpen) {
      setInitialized(false)
      setSavedTo(null)
      setSavedToFirstId(null)
      setNewName('')
      setNewChildIds([])
      if (children.length === 0) void fetchChildren()
    }
  }, [isAddToWishlistModalOpen])

  // Initialize view and pre-selections once wishlists have loaded
  useEffect(() => {
    if (!isAddToWishlistModalOpen || isLoadingList || initialized) return
    const preSelected = addToWishlistCampId
      ? myWishlists.filter(w => isCampInWishlist(w.id, addToWishlistCampId)).map(w => w.id)
      : []
    setSelectedIds(preSelected)
    setInitialIds(preSelected)
    setView(myWishlists.length === 0 ? 'create' : 'select')
    setInitialized(true)
  }, [isAddToWishlistModalOpen, isLoadingList, initialized])

  const campId = addToWishlistCampId

  function handleClose() {
    closeAddToWishlistModal()
  }

  function toggleWishlist(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]))
  }

  const toAdd = selectedIds.filter(id => !initialIds.includes(id))
  const toRemove = initialIds.filter(id => !selectedIds.includes(id))
  const hasChanges = toAdd.length > 0 || toRemove.length > 0

  async function handleSave() {
    if (!campId || !hasChanges) return
    setIsSaving(true)
    const ok = await syncCampWishlists(campId, selectedIds)
    setIsSaving(false)

    if (!ok) {
      addToast({
        title: 'Error',
        description: 'Failed to update wishlists. Please try again.',
        color: 'danger',
      })
      return
    }

    if (ok && skipSuccessView) {
      addToast({ title: 'Saved!', description: 'Wishlists updated!', color: 'success' })
    }

    if (toAdd.length > 0 && !skipSuccessView) {
      const firstAdded = myWishlists.find(w => w.id === toAdd[0])
      if (firstAdded) {
        setSavedTo({ id: firstAdded.id, name: firstAdded.name })
        setSavedToFirstId(firstAdded.id)
      }
      setView('success')
    } else {
      handleClose()
    }
  }

  async function handleCreateAndSave() {
    if (!campId || !newName.trim()) return
    setIsSaving(true)
    const wishlist = await createWishlist({
      name: newName.trim(),
      childIds: newChildIds.length > 0 ? newChildIds : undefined,
    })
    if (!wishlist) {
      addToast({ title: 'Error', description: 'Failed to create wishlist', color: 'danger' })
      setIsSaving(false)
      return
    }
    await syncCampWishlists(campId, [...selectedIds, wishlist.id])
    setIsSaving(false)
    if (skipSuccessView) {
      addToast({ title: 'Saved!', description: `Wishlists updated!`, color: 'success' })
      handleClose()
      return
    }
    setSavedTo({ id: wishlist.id, name: wishlist.name })
    setSavedToFirstId(wishlist.id)
    setView('success')
  }

  function toggleNewChild(id: string) {
    setNewChildIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]))
  }

  function getSaveLabel() {
    if (!hasChanges) return 'Save'
    if (toAdd.length > 0 && toRemove.length === 0) {
      return `Save to ${toAdd.length} new wishlist${toAdd.length > 1 ? 's' : ''}`
    }
    return 'Update wishlists'
  }

  return (
    <Modal isOpen={isAddToWishlistModalOpen} onClose={handleClose} size="sm" placement="center">
      <ModalContent>
        {view === 'success' ? (
          <>
            {/* Success state — replaces the preview with a check + confirmation */}
            <ModalBody className="flex flex-col items-center py-8 px-6 text-center">
              <div className="w-24 h-24 bg-primary rounded-xl flex items-center justify-center mb-3 animate-[scaleIn_0.3s_ease] shrink-0 overflow-hidden">
                {addToWishlistCampPreview?.thumbnail ? (
                  <div className="relative w-full h-full">
                    <img
                      src={addToWishlistCampPreview.thumbnail}
                      alt={addToWishlistCampPreview.name}
                      className="w-full h-full object-cover opacity-30"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-slate-800"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <svg
                    className="w-10 h-10 text-slate-800"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Saved!</h3>
              {savedTo && <p className="text-sm text-gray-500">Added to {savedTo.name}</p>}
            </ModalBody>
            <div className="flex gap-3 p-6 pt-0">
              <Button variant="bordered" className="flex-1 font-medium" onPress={handleClose}>
                Continue browsing
              </Button>
              <Button
                className="flex-1 bg-primary text-slate-800 font-semibold"
                onPress={() => {
                  handleClose()
                  if (savedToFirstId) router.push(`/wishlists/${savedToFirstId}`)
                }}
              >
                View wishlist
              </Button>
            </div>
          </>
        ) : view === 'create' ? (
          <>
            <ModalHeader className="flex items-center gap-2.5 pb-0">
              {myWishlists.length > 0 && (
                <button
                  className="cursor-pointer w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                  onClick={() => setView('select')}
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              <span className="text-lg font-semibold text-slate-800">Create new list</span>
            </ModalHeader>
            {addToWishlistCampPreview && <CampPreview preview={addToWishlistCampPreview} />}
            <ModalBody className="gap-4 pt-4 pb-2">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">List name</label>
                <Input
                  placeholder="e.g. Summer 2025"
                  value={newName}
                  onValueChange={setNewName}
                  autoFocus
                  maxLength={120}
                />
              </div>

              {children.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    For which children?
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {children.map(child => {
                      const isSelected = newChildIds.includes(child.id)
                      return (
                        <button
                          key={child.id}
                          type="button"
                          className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                            isSelected
                              ? 'border-gray-900 bg-gray-100'
                              : 'border-gray-200 bg-white hover:border-gray-900'
                          }`}
                          onClick={() => toggleNewChild(child.id)}
                        >
                          <div className="w-6 h-6 rounded-full bg-linear-to-br from-pink-100 to-green-100 flex items-center justify-center text-xs font-semibold shrink-0">
                            {child.firstName?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          {child.firstName}
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
                className="bg-primary text-slate-800 font-semibold"
                onPress={handleCreateAndSave}
                isLoading={isSaving}
                isDisabled={!newName.trim()}
              >
                Create &amp; Save
              </Button>
            </ModalFooter>
          </>
        ) : (
          // select view
          <>
            <ModalHeader className="text-lg font-semibold text-slate-800 pb-0">
              Save to wishlist
            </ModalHeader>
            {addToWishlistCampPreview && <CampPreview preview={addToWishlistCampPreview} />}
            <ModalBody className="pt-4 pb-0 px-0">
              <ScrollShadow className="px-6 pb-4 max-h-80">
                {/* Create new button */}
                <button
                  className="flex items-center gap-3 w-full p-3.5 bg-white border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:bg-emerald-50 transition-all mb-4 group"
                  onClick={() => setView('create')}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors">
                    <svg
                      className="w-5 h-5 text-gray-500 group-hover:text-slate-800"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-800">Create new list</span>
                </button>

                {/* Wishlists */}
                {myWishlists?.length && (
                  <p className="text-sm uppercase tracking-wide font-semibold text-gray-500 mb-2">
                    Your wishlists
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {myWishlists.map(w => {
                    const isSelected = selectedIds.includes(w.id)
                    return (
                      <button
                        key={w.id}
                        className={`flex items-center gap-3 p-3.5 bg-white border rounded-xl cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-slate-800 hover:bg-gray-50'
                        }`}
                        onClick={() => toggleWishlist(w.id)}
                      >
                        {/* Check circle */}
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {w.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {w.campCount} {w.campCount === 1 ? 'camp' : 'camps'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollShadow>
            </ModalBody>

            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50">
              <Button
                className="w-full bg-primary text-slate-800 font-semibold h-12 text-base"
                onPress={handleSave}
                isLoading={isSaving}
                isDisabled={!hasChanges}
              >
                {getSaveLabel()}
              </Button>
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

interface CampPreviewProps {
  preview: { name: string; thumbnail: string | null; location: string | null }
}

function CampPreview({ preview }: CampPreviewProps) {
  return (
    <div className="flex flex-col items-center px-6 pt-5 pb-4 text-center border-b border-gray-100">
      <div className="w-24 h-24 rounded-xl overflow-hidden mb-3 shrink-0 shadow-sm">
        {preview.thumbnail ? (
          <img src={preview.thumbnail} alt={preview.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#E8F4F8] to-[#D4E8E0]" />
        )}
      </div>
      <p className="text-base font-semibold text-slate-800 leading-snug">{preview.name}</p>
      {preview.location && <p className="text-sm text-gray-500 mt-0.5">{preview.location}</p>}
    </div>
  )
}
