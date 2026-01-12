'use client'

import { useEffect, useState } from 'react'
import { PageSlot } from '@/components/layout/page-slot'
import { useAddOnsStore } from '@/stores/add-ons.store'
import { AddOnCard } from '@/components/add-ons/add-on-card'
import { AddOnModal } from '@/components/add-ons/add-on-modal'
import { Button } from '@heroui/react'
import type { AddOn } from '@/types/add-ons'

export default function AddOnsPage() {
  const { addOns, isLoading, fetchAddOns } = useAddOnsStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  const [showInfoBanner, setShowInfoBanner] = useState(true)

  useEffect(() => {
    fetchAddOns().catch(error => {
      console.error('Failed to fetch add-ons:', error)
    })
  }, [fetchAddOns])

  const handleOpenModal = (addOn?: AddOn) => {
    setEditingAddOn(addOn ?? null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAddOn(null)
  }

  const handleSuccess = () => {
    handleCloseModal()
    fetchAddOns().catch(error => {
      console.error('Failed to fetch add-ons:', error)
    })
  }

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-[24px] font-semibold text-default-900 mb-1.5">Optional Add-ons</h1>
          <p className="text-[15px] text-default-500 max-w-[600px]">
            Create optional extras that parents can purchase when booking. These are reusable across
            all your camps.
          </p>
        </header>

        {/* Info Banner */}
        {showInfoBanner && (
          <div className="flex items-start gap-3 p-4 bg-primary-50 rounded-xl relative">
            <span className="text-[20px]">💡</span>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-default-900 mb-1">
                Add-ons are shared across all your camps
              </div>
              <div className="text-[13px] text-default-500 leading-[1.5]">
                Create an add-on once and enable it for any camp. Changes will apply everywhere it's
                used. Toggle individual add-ons on/off for this specific camp.
              </div>
            </div>
            <button
              onClick={() => setShowInfoBanner(false)}
              className="absolute top-3 right-3 w-6 h-6 rounded-full hover:bg-default-200 flex items-center justify-center text-default-400 hover:text-default-600 transition-colors"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Add-ons List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-default-900">Your Add-ons</span>
              <span className="text-[14px] text-default-400">({addOns.length} total)</span>
            </div>
            <Button color="primary" onPress={() => handleOpenModal()} className="font-semibold">
              + Add New
            </Button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12 text-default-400">Loading add-ons...</div>
          )}

          {/* Empty State */}
          {!isLoading && addOns.length === 0 && (
            <div className="text-center py-12">
              <div className="text-[48px] mb-4">📦</div>
              <div className="text-[18px] font-semibold text-default-900 mb-2">No add-ons yet</div>
              <div className="text-[14px] text-default-500 mb-6 max-w-[400px] mx-auto">
                Create your first add-on to offer optional extras like activities, services, or
                equipment rentals.
              </div>
              <Button color="primary" onPress={() => handleOpenModal()} className="font-semibold">
                Create Your First Add-on
              </Button>
            </div>
          )}

          {/* Add-ons Grid */}
          {!isLoading && addOns.length > 0 && (
            <div className="space-y-3">
              {addOns.map(addOn => (
                <AddOnCard key={addOn.id} addOn={addOn} onEdit={() => handleOpenModal(addOn)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Add/Edit Modal */}
      <AddOnModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        addOn={editingAddOn}
      />
    </PageSlot>
  )
}
