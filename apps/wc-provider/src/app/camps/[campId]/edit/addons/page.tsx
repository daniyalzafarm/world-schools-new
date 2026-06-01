'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addToast, Button, Switch } from '@heroui/react'
import { Info, X } from 'lucide-react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { ADD_ON_TYPE_BADGES, formatPrice } from '../../../../../types/add-ons'
import type { CampAddOn, UpdateCampAddOnItem } from '../../../../../services/camp-addons.service'
import * as campAddOnsService from '../../../../../services/camp-addons.service'

const CAMP_ADDONS_INFO_BANNER_DISMISSED_KEY = 'wc_provider_camp_addons_info_banner_dismissed'

export default function CampAddOnsEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string

  const currentCamp = useCampsStore(state => state.currentCamp)
  const [addOns, setAddOns] = useState<CampAddOn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  // Default to hidden so SSR/first paint never flashes a dismissed banner.
  const [showInfoBanner, setShowInfoBanner] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(CAMP_ADDONS_INFO_BANNER_DISMISSED_KEY) !== 'true') {
      setShowInfoBanner(true)
    }
  }, [])

  const handleDismissInfoBanner = () => {
    setShowInfoBanner(false)
    localStorage.setItem(CAMP_ADDONS_INFO_BANNER_DISMISSED_KEY, 'true')
  }

  useEffect(() => {
    const loadAddOns = async () => {
      setIsLoading(true)
      const response = await campAddOnsService.getCampAddOns(campId)
      setIsLoading(false)
      if (!response.success) {
        addToast({ title: 'Error', description: response.data.message, color: 'danger' })
        return
      }
      setAddOns(response.data.addOns)
      setIsLoaded(true)
      useCampsStore.setState({
        sidebarAddonEnabledCount: response.data.addOns.filter(a => a.isEnabled).length,
        sidebarAddonTotalCount: response.data.addOns.length,
      })
    }

    void loadAddOns()
  }, [campId])

  useAutosave(addOns, {
    enabled: isLoaded,
    debounceMs: 1000,
    save: async updatedAddOns => {
      const updateData: UpdateCampAddOnItem[] = updatedAddOns.map((addOn, index) => ({
        addOnId: addOn.id,
        isEnabled: addOn.isEnabled,
        sortOrder: index,
      }))
      const response = await campAddOnsService.updateCampAddOns(campId, { addOns: updateData })
      if (!response.success) {
        addToast({ title: 'Error', description: response.data.message, color: 'danger' })
        useCampsStore.setState({ error: response.data.message })
        return
      }
      useCampsStore.setState({
        sidebarAddonEnabledCount: updatedAddOns.filter(a => a.isEnabled).length,
      })
    },
  })

  const handleToggle = (addOnId: string, isEnabled: boolean) => {
    setAddOns(prev => prev.map(addOn => (addOn.id === addOnId ? { ...addOn, isEnabled } : addOn)))
  }

  // Navigate to global add-ons management
  const handleManageAddOns = () => {
    router.push('/add-ons')
  }

  const enabledCount = addOns.filter(a => a.isEnabled).length
  const totalCount = addOns.length

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Optional Add-ons</h1>
        <p className="text-base leading-normal text-default-500">
          Enable or disable add-ons for this camp. Add-ons are shared across all your camps.
        </p>
      </div>

      {/* Info Banner */}
      {showInfoBanner && (
        <div className="relative flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/40 dark:bg-primary-900/10">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div className="flex-1 pr-8">
            <div className="text-sm font-semibold text-default-900">
              Add-ons are shared across all your camps
            </div>
            <div className="mt-1 text-sm leading-normal text-default-500">
              Toggle individual add-ons on/off for this specific camp. To create new add-ons or edit
              existing ones, use the global add-ons management page.
            </div>
          </div>
          <Button
            isIconOnly
            onPress={handleDismissInfoBanner}
            aria-label="Dismiss"
            size="sm"
            variant="flat"
            radius="full"
            color="primary"
          >
            <X className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </Button>
        </div>
      )}

      {/* Add-ons List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">Available Add-ons</span>
            <span className="text-sm text-default-400">
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
        {isLoading && <div className="py-12 text-center text-default-400">Loading add-ons...</div>}

        {/* Empty State */}
        {!isLoading && addOns.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-default-200 bg-default-50 py-12 text-center">
            <div className="mb-4 text-5xl">📦</div>
            <div className="mb-2 text-lg font-semibold text-foreground">No add-ons yet</div>
            <div className="mx-auto mb-6 max-w-md text-sm text-default-500">
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-default-100 text-2xl">
                    {addOn.icon || '📦'}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-base font-semibold text-foreground">{addOn.name}</div>
                    {addOn.description && (
                      <div className="mb-2 line-clamp-1 text-sm text-default-500">
                        {addOn.description}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${typeBadge.className}`}
                      >
                        {typeBadge.label}
                      </span>
                      {addOn.minAge && addOn.maxAge && (
                        <span className="text-sm text-default-400">
                          Ages {addOn.minAge}-{addOn.maxAge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="min-w-28 shrink-0 text-right">
                    <div className="text-lg font-bold text-foreground">
                      {currentCamp?.currency} {price.toFixed(0)}
                    </div>
                    <div className="text-xs text-default-400">
                      {currentCamp
                        ? formatPrice(price, currentCamp.currency, addOn.pricingUnit)
                            .split(' ')
                            .slice(2)
                            .join(' ')
                        : null}
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
                  <div className="shrink-0">
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
