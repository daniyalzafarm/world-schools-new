'use client'

import { useEffect, useState } from 'react'
import { Button, Card, CardBody, Pagination, Spinner } from '@heroui/react'
import { Info, PackageOpen, Plus, Search, X } from 'lucide-react'
import { Input, SelectField, useDebounce } from '@world-schools/ui-web'
import { PageSlot } from '@/components/layout/page-slot'
import { useAddOnsStore } from '@/stores/add-ons.store'
import { AddOnCard } from '@/components/add-ons/add-on-card'
import { AddOnModal } from '@/components/add-ons/add-on-modal'
import { ADD_ON_TYPES, type AddOn, type AddOnType } from '@/types/add-ons'

const ADDONS_INFO_BANNER_DISMISSED_KEY = 'wc_provider_addons_info_banner_dismissed'

export default function AddOnsPage() {
  const {
    addOns,
    isLoading,
    error,
    filters,
    pagination,
    fetchAddOns,
    setFilters,
    clearFilters,
    setPage,
    clearError,
  } = useAddOnsStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  // Default to hidden so SSR/first paint never flashes a dismissed banner.
  const [showInfoBanner, setShowInfoBanner] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(ADDONS_INFO_BANNER_DISMISSED_KEY) !== 'true') {
      setShowInfoBanner(true)
    }
  }, [])

  const handleDismissInfoBanner = () => {
    setShowInfoBanner(false)
    localStorage.setItem(ADDONS_INFO_BANNER_DISMISSED_KEY, 'true')
  }

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)

  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  useEffect(() => {
    void fetchAddOns()
  }, [fetchAddOns, filters, pagination.page, pagination.limit])

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
    void fetchAddOns()
  }

  const handleClearAllFilters = () => {
    setSearchInput('')
    clearFilters()
  }

  const hasActiveFilters = searchInput !== '' || filters.type !== undefined

  const typeFilterValue = filters.type ?? 'all'
  const typeFilterOptions = [
    { value: 'all', label: 'All types' },
    ...ADD_ON_TYPES.map(t => ({ value: t.value, label: t.label })),
  ]

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Optional Add-ons</h1>
            <p className="text-default-600 mt-1">
              Create optional extras that parents can purchase when booking. These are reusable
              across all your camps.
            </p>
          </div>
          <Button
            color="primary"
            startContent={<Plus className="h-5 w-5" />}
            onPress={() => handleOpenModal()}
          >
            Create Add-on
          </Button>
        </header>

        {showInfoBanner && (
          <div className="relative flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/40 dark:bg-primary-900/10">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="flex-1 pr-8">
              <div className="text-sm font-semibold text-default-900">
                Add-ons are shared across all your camps
              </div>
              <div className="mt-1 text-sm text-default-500 leading-normal">
                Create an add-on once and enable it for any camp. Changes will apply everywhere it's
                used.
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
              <X className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </Button>
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
            <Button
              className="mt-4"
              variant="flat"
              onPress={() => {
                clearError()
                void fetchAddOns()
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
                <Input
                  aria-label="Search add-ons"
                  placeholder="Search add-ons…"
                  className="w-full max-w-sm shrink-0"
                  value={searchInput}
                  onValueChange={setSearchInput}
                  isClearable
                  onClear={() => setSearchInput('')}
                  startContent={<Search className="h-4 w-4 text-default-400" />}
                />
                <SelectField
                  aria-label="Type"
                  placeholder="Type"
                  className="w-44 shrink-0"
                  value={typeFilterValue}
                  onChange={value => {
                    setFilters({ type: value === 'all' ? undefined : (value as AddOnType) })
                  }}
                  options={typeFilterOptions}
                />
                {hasActiveFilters ? (
                  <Button
                    variant="flat"
                    className="ml-auto shrink-0"
                    startContent={<X className="h-4 w-4" />}
                    onPress={handleClearAllFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" label="Loading add-ons" />
                </div>
              ) : addOns.length === 0 ? (
                <div className="m-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-default-300 px-6 py-16 text-center">
                  <PackageOpen className="h-10 w-10 text-default-400" />
                  <div>
                    <div className="text-base font-semibold text-default-900">
                      {hasActiveFilters ? 'No add-ons match your filters' : 'No add-ons yet'}
                    </div>
                    <p className="mt-1 max-w-md text-sm text-default-500">
                      {hasActiveFilters
                        ? 'Try a different search term or clear filters to see all add-ons.'
                        : 'Create your first add-on to offer optional extras like activities, services, or equipment rentals.'}
                    </p>
                  </div>
                  {!hasActiveFilters && (
                    <Button
                      color="primary"
                      startContent={<Plus className="h-4 w-4" />}
                      onPress={() => handleOpenModal()}
                    >
                      Create Your First Add-on
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-default-200">
                  {addOns.map(addOn => (
                    <li key={addOn.id}>
                      <AddOnCard addOn={addOn} onEdit={() => handleOpenModal(addOn)} />
                    </li>
                  ))}
                </ul>
              )}

              {pagination.total > 0 && (
                <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="text-sm text-default-500">
                    Showing {addOns.length} of {pagination.total} add-ons
                  </span>
                  {pagination.totalPages > 1 ? (
                    <Pagination
                      total={pagination.totalPages}
                      page={pagination.page}
                      onChange={setPage}
                      showControls
                    />
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </section>

      <AddOnModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        addOn={editingAddOn}
      />
    </PageSlot>
  )
}
