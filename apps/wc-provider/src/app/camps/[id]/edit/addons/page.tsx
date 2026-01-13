'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Switch } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { ADD_ON_TYPE_BADGES, formatPrice } from '../../../../../types/add-ons'
import type { CampAddOn, UpdateCampAddOnItem } from '../../../../../services/camp-addons.service'
import * as campAddOnsService from '../../../../../services/camp-addons.service'

export default function CampAddOnsEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { currentCamp } = useCampsStore()

  const [addOns, setAddOns] = useState<CampAddOn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showInfoBanner, setShowInfoBanner] = useState(true)

  // Load camp add-ons
  useEffect(() => {
    const loadAddOns = async () => {
      try {
        setIsLoading(true)
        const response = await campAddOnsService.getCampAddOns(campId)
        setAddOns(response.addOns)
      } catch (error) {
        console.error('Failed to load add-ons:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAddOns().catch(error => {
      console.error('Failed to load add-ons:', error)
    })
  }, [campId])

  // Auto-save handler
  const handleSave = async (updatedAddOns: CampAddOn[]) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        const updateData: UpdateCampAddOnItem[] = updatedAddOns.map((addOn, index) => ({
          addOnId: addOn.id,
          isEnabled: addOn.isEnabled,
          sortOrder: index,
        }))

        await campAddOnsService.updateCampAddOns(campId, { addOns: updateData })
        setAutoSaveStatus('saved')

        setTimeout(() => {
          setAutoSaveStatus('idle')
        }, 2000)
      } catch (error) {
        console.error('Failed to save add-ons:', error)
        setAutoSaveStatus('error')
      }
    }, 1000)

    setSaveTimeout(timeout)
  }

  // Toggle add-on enabled status
  const handleToggle = (addOnId: string, isEnabled: boolean) => {
    const updatedAddOns = addOns.map(addOn =>
      addOn.id === addOnId ? { ...addOn, isEnabled } : addOn
    )
    setAddOns(updatedAddOns)
    handleSave(updatedAddOns).catch(error => {
      console.error('Failed to save add-ons:', error)
    })
  }

  // Navigate to global add-ons management
  const handleManageAddOns = () => {
    router.push('/add-ons')
  }

  const enabledCount = addOns.filter(a => a.isEnabled).length
  const totalCount = addOns.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-semibold text-default-900">Optional Add-ons</h1>
          <AutoSaveIndicator status={autoSaveStatus} />
        </div>
        <p className="text-[15px] text-default-500 max-w-[600px]">
          Enable or disable add-ons for this camp. Add-ons are shared across all your camps.
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
              Toggle individual add-ons on/off for this specific camp. To create new add-ons or edit
              existing ones, use the global add-ons management page.
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
            <span className="text-[16px] font-semibold text-default-900">Available Add-ons</span>
            <span className="text-[14px] text-default-400">
              ({enabledCount} of {totalCount} enabled)
            </span>
          </div>
          <Button
            color="default"
            variant="flat"
            onPress={handleManageAddOns}
            className="font-semibold"
          >
            Manage Add-ons
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && <div className="text-center py-12 text-default-400">Loading add-ons...</div>}

        {/* Empty State */}
        {!isLoading && addOns.length === 0 && (
          <div className="text-center py-12 bg-default-50 rounded-xl border-2 border-dashed border-default-200">
            <div className="text-[48px] mb-4">📦</div>
            <div className="text-[18px] font-semibold text-default-900 mb-2">No add-ons yet</div>
            <div className="text-[14px] text-default-500 mb-6 max-w-[400px] mx-auto">
              Create your first add-on to offer optional extras like activities, services, or
              equipment rentals.
            </div>
            <Button color="primary" onPress={handleManageAddOns} className="font-semibold">
              Create Your First Add-on
            </Button>
          </div>
        )}

        {/* Add-ons Grid */}
        {!isLoading && addOns.length > 0 && (
          <div className="space-y-3">
            {addOns.map(addOn => {
              const typeBadge = ADD_ON_TYPE_BADGES[addOn.type]
              const price =
                typeof addOn.price === 'number' ? addOn.price : parseFloat(String(addOn.price))

              return (
                <div
                  key={addOn.id}
                  className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${
                    addOn.isEnabled
                      ? 'bg-default-50 border-default-200 hover:border-default-300'
                      : 'bg-default-100 border-default-200 opacity-60'
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-default-100 flex items-center justify-center text-[24px]">
                    {addOn.icon || '📦'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-semibold text-default-900 mb-1">
                      {addOn.name}
                    </div>
                    {addOn.description && (
                      <div className="text-[14px] text-default-500 mb-2 line-clamp-1">
                        {addOn.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-md ${typeBadge.className}`}
                      >
                        {typeBadge.label}
                      </span>
                      {addOn.minAge && addOn.maxAge && (
                        <span className="text-[13px] text-default-400">
                          Ages {addOn.minAge}-{addOn.maxAge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="flex-shrink-0 text-right min-w-[120px]">
                    <div className="text-[18px] font-bold text-default-900">
                      {addOn.currency} {price.toFixed(0)}
                    </div>
                    <div className="text-[12px] text-default-400">
                      {formatPrice(price, addOn.currency, addOn.pricingUnit)
                        .split(' ')
                        .slice(2)
                        .join(' ')}
                      {addOn.maxQuantity && (
                        <span>
                          {' '}
                          (max {addOn.maxQuantity}
                          {addOn.quantityUnit ? ` ${addOn.quantityUnit}` : ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex-shrink-0">
                    <Switch
                      isSelected={addOn.isEnabled}
                      onValueChange={checked => handleToggle(addOn.id, checked)}
                      size="lg"
                      color="primary"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
