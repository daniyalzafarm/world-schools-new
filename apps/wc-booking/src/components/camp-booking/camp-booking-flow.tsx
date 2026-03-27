'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addToast,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Textarea,
} from '@heroui/react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { getChildAge } from '@/types/child'
import { formatCurrency } from '@/utils/currency'
import type { CampBookingAddOnSelectionMode } from '@/types/camp-booking'
import { MobileBookingFooter } from '@/components/camp-booking/mobile-booking-footer'
import { DesktopSessionsSidebar } from '@/components/camp-booking/desktop-sessions-sidebar'
import { DesktopChildrenSidebar } from '@/components/camp-booking/desktop-children-sidebar'
import { DesktopAddonsSidebar } from '@/components/camp-booking/desktop-addons-sidebar'
import { DuplicateDraftModal } from '@/components/camp-booking/duplicate-draft-modal'
import {
  getChildUnitPrice,
  getSelectedChildrenSubtotal,
} from '@/components/camp-booking/booking-flow-pricing'
import { AddChildForm, type AddChildPayload } from '@/components/children/add-child-form-fields'
import { ChevronDown, ChevronRight, X } from 'lucide-react'

function SessionsStep() {
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const selectSession = useCampBookingStore(state => state.selectSession)
  const setStep = useCampBookingStore(state => state.setStep)
  const camp = useCampBookingStore(state => state.camp)

  const currency = camp?.provider?.settings?.currency ?? 'EUR'

  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  const [ageRangeFilter, setAgeRangeFilter] = useState<string | null>(null)
  const [filterSheet, setFilterSheet] = useState<'month' | 'age' | null>(null)

  const AGE_FILTERS = [
    { value: '8-11', label: '8–11 yo', min: 8, max: 11 },
    { value: '12-17', label: '12–17 yo', min: 12, max: 17 },
  ] as const

  const hasActiveFilters = Boolean(monthFilter || ageRangeFilter)

  const getSessionCardUnitPrice = (session: (typeof sessions)[number]) => {
    // Reference design uses the minimum unit price for age-group pricing.
    if (session.pricingType === 'single') return Number(session.price ?? 0)
    if (session.pricingType === 'age_group') {
      const prices = session.ageGroupPrices ?? []
      return prices.length ? Math.min(...prices.map(p => Number(p.price ?? 0))) : 0
    }
    return Number(session.price ?? 0)
  }

  const parseDateUtc = (value: string | Date) => {
    // Most backend date values are date-only strings (YYYY-MM-DD). Parsing them as local
    // time can shift the day around DST; using UTC keeps day/month/year stable.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00Z`)
    }
    return new Date(value)
  }

  const getSessionNights = (start: string | Date, end: string | Date) => {
    const startDate = parseDateUtc(start)
    const endDate = parseDateUtc(end)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null

    const msPerDay = 24 * 60 * 60 * 1000
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay)
    return nights >= 0 ? nights : null
  }

  const formatSessionDateRange = (start: string | Date, end: string | Date) => {
    const startDate = parseDateUtc(start)
    const endDate = parseDateUtc(end)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`
    }

    const startYear = startDate.getUTCFullYear()
    const endYear = endDate.getUTCFullYear()
    const startMonth = startDate.getUTCMonth()
    const endMonth = endDate.getUTCMonth()
    const startDay = startDate.getUTCDate()
    const endDay = endDate.getUTCDate()

    const monthLongFmt = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
    const monthShortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

    if (startYear === endYear && startMonth === endMonth) {
      // "7–14 June 2026"
      return `${startDay}–${endDay} ${monthLongFmt.format(startDate)} ${startYear}`
    }

    if (startYear === endYear) {
      // "26 Jul–2 Aug 2026"
      return `${startDay} ${monthShortFmt.format(startDate)}–${endDay} ${monthShortFmt.format(
        endDate
      )} ${startYear}`
    }

    // Fallback for cross-year ranges: "28 Dec 2025–5 Jan 2026"
    return `${startDay} ${monthShortFmt.format(startDate)} ${startYear}–${endDay} ${monthShortFmt.format(
      endDate
    )} ${endYear}`
  }

  const selectedAgeGroupIds = useMemo(() => {
    if (!ageRangeFilter) return null
    const [minStr, maxStr] = ageRangeFilter.split('-')
    const min = Number(minStr)
    const max = Number(maxStr)
    if (Number.isNaN(min) || Number.isNaN(max)) return null

    // Camp ageGroups in our TS type don't include `id`, but the backend response may.
    const ags = (camp?.ageGroups ?? []) as any[]
    const match = ags.find(ag => ag.min === min && ag.max === max)
    const id = match?.id ?? match?.ageGroupId
    return id ? new Set<string>([String(id)]) : null
  }, [ageRangeFilter, camp])

  const filteredSessions = sessions.filter(session => {
    const month = new Date(session.startDate).toLocaleString('en-US', { month: 'short' })
    if (monthFilter && month !== monthFilter) return false

    if (selectedAgeGroupIds) {
      const hasMatchingAgeGroup =
        (session.ageGroupPrices ?? []).some(p => selectedAgeGroupIds.has(String(p.ageGroupId))) ||
        (session.ageGroupSpots ?? []).some(s => selectedAgeGroupIds.has(String(s.ageGroupId)))
      if (!hasMatchingAgeGroup) return false
    }

    return true
  })

  const availableMonths = Array.from(
    new Set(
      sessions.map(session =>
        new Date(session.startDate).toLocaleString('en-US', { month: 'short' })
      )
    )
  )

  return (
    <section className="space-y-4">
      <div className="lg:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Choose a session</h2>
      </div>

      <div className="hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Step 1 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Choose a session</h1>
        <p className="mt-2 text-sm text-gray-500">
          {sessions.length} sessions available ·{' '}
          {(() => {
            const startMonths = sessions.map(s => new Date(s.startDate))
            if (startMonths.length === 0) return '—'
            const sorted = startMonths.sort((a, b) => a.getTime() - b.getTime())
            const first = sorted[0]
            const last = sorted[sorted.length - 1]
            const firstMonth = first.toLocaleString('en-US', { month: 'short' })
            const lastMonth = last.toLocaleString('en-US', { month: 'short' })
            const year = first.getFullYear()
            const monthRange = firstMonth === lastMonth ? firstMonth : `${firstMonth}–${lastMonth}`
            return `${monthRange} ${year}`
          })()}
        </p>
      </div>

      <div className="lg:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterSheet('month')}
            className={`cursor-pointer flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition-all duration-150 ${
              monthFilter
                ? 'border-gray-900 bg-gray-900 text-white shadow-none'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span>{monthFilter ?? 'Month'}</span>
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => setFilterSheet('age')}
            className={`cursor-pointer flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition-all duration-150 ${
              ageRangeFilter
                ? 'border-gray-900 bg-gray-900 text-white shadow-none'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span>{ageRangeFilter ?? 'Age Range'}</span>
            <ChevronDown size={14} />
          </button>
          {hasActiveFilters ? (
            <Button
              onPress={() => {
                setMonthFilter(null)
                setAgeRangeFilter(null)
              }}
              startContent={<X size={12} />}
              color="default"
              variant="light"
              size="sm"
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="flex flex-wrap gap-y-2.5 gap-x-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 items-center">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
              Month
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableMonths.map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setMonthFilter(prev => (prev === month ? null : month))}
                  className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    monthFilter === month
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-600 hover:text-gray-900'
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-px bg-gray-200" />
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
              Age group
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGE_FILTERS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAgeRangeFilter(prev => (prev === opt.value ? null : opt.value))}
                  className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    ageRangeFilter === opt.value
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters ? (
            <Button
              onPress={() => {
                setMonthFilter(null)
                setAgeRangeFilter(null)
              }}
              startContent={<X size={12} />}
              color="default"
              variant="light"
              size="sm"
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Drawer
        isOpen={filterSheet !== null}
        onOpenChange={isOpen => {
          if (!isOpen) setFilterSheet(null)
        }}
        placement="bottom"
        size="2xl"
        hideCloseButton
        classNames={{
          base: 'max-w-full',
          body: 'p-0',
        }}
      >
        <DrawerContent>
          {onClose => (
            <>
              <DrawerHeader className="flex flex-col gap-3 px-6 py-4 border-b border-gray-200">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" />
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-gray-900">
                    {filterSheet === 'month' ? 'Filter' : 'Age Range'}
                  </h4>
                  <Button
                    onPress={() => {
                      onClose()
                      setFilterSheet(null)
                    }}
                    isIconOnly
                    variant="light"
                    size="sm"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </Button>
                </div>
              </DrawerHeader>

              <DrawerBody>
                <div className="max-h-1/2 py-4 overflow-y-auto divide-y divide-gray-100">
                  {(() => {
                    if (filterSheet === 'month') {
                      return availableMonths.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMonthFilter(m)
                            setFilterSheet(null)
                          }}
                          className="cursor-pointer flex w-full items-center justify-between gap-3 px-6 py-3 text-left"
                        >
                          <span className="text-sm font-semibold text-gray-900">{m}</span>
                          {monthFilter === m ? (
                            <span className="text-sm font-semibold text-success-600">✓</span>
                          ) : null}
                        </button>
                      ))
                    }

                    if (filterSheet === 'age') {
                      const ranges = Array.from(
                        new Set((camp?.ageGroups ?? []).map(ag => `${ag.min}-${ag.max}`))
                      )
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAgeRangeFilter(null)
                              setFilterSheet(null)
                            }}
                            className="cursor-pointer flex w-full items-center justify-between gap-3 px-6 py-3 text-left"
                          >
                            <span className="text-sm font-semibold text-gray-900">All ages</span>
                            {ageRangeFilter === null ? (
                              <span className="text-sm font-semibold text-success-600">✓</span>
                            ) : null}
                          </button>
                          {ranges.map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setAgeRangeFilter(r)
                                setFilterSheet(null)
                              }}
                              className="cursor-pointer flex w-full items-center justify-between gap-3 px-6 py-3 text-left"
                            >
                              <span className="text-sm font-semibold text-gray-900">{r}</span>
                              {ageRangeFilter === r ? (
                                <span className="text-sm font-semibold text-success-600">✓</span>
                              ) : null}
                            </button>
                          ))}
                        </>
                      )
                    }

                    return null
                  })()}
                </div>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
      <div className="grid gap-3">
        <div role="radiogroup" aria-label="Select a session" className="grid gap-3">
          {filteredSessions.map(session => {
            const isSelected = selectedSessionId === session.id
            const isSoldOut =
              typeof session.totalSpots === 'number' &&
              session.totalSpots >= 0 &&
              (typeof session.bookedCount === 'number'
                ? session.bookedCount >= session.totalSpots
                : session.totalSpots === 0)

            const cardClassName = [
              'cursor-pointer rounded-xl border p-4 text-left transition hover:opacity-hover',
              isSelected ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300',
              isSoldOut ? 'cursor-not-allowed opacity-40' : '',
            ].join(' ')

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session.id)}
                disabled={isSoldOut}
                role="radio"
                aria-checked={isSelected}
                className={cardClassName}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      className={[
                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        isSelected ? 'border-primary bg-primary' : 'border-gray-300 bg-white',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{session.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatSessionDateRange(session.startDate, session.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <p className="text-lg font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrency(getSessionCardUnitPrice(session), currency)}
                    </p>
                    {camp?.type === 'residential' ? (
                      <p className="text-sm text-gray-500 whitespace-nowrap">
                        {(() => {
                          const nights = getSessionNights(session.startDate, session.endDate)
                          return nights === null ? '—' : `${nights} night${nights === 1 ? '' : 's'}`
                        })()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="hidden pt-4 lg:block">
        <Button
          color="primary"
          className="w-full"
          isDisabled={!selectedSessionId}
          onPress={() => setStep('children')}
          endContent={<ChevronRight size={16} />}
        >
          Continue
        </Button>
      </div>
    </section>
  )
}

function ChildrenStep() {
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const sessions = useCampBookingStore(state => state.sessions)
  const session = sessions.find(item => item.id === selectedSessionId)
  const maxSpots = session?.totalSpots ?? null
  const [showWaitlist, setShowWaitlist] = useState(false)

  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const toggleChild = useCampBookingStore(state => state.toggleChild)
  const setStep = useCampBookingStore(state => state.setStep)
  const createDraftBookingGroup = useCampBookingStore(state => state.createDraftBookingGroup)
  const addChild = useCampBookingStore(state => state.addChild)
  const camp = useCampBookingStore(state => state.camp)
  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')
  const [isAddingChild, setIsAddingChild] = useState(false)

  const eligibleChildren = useMemo(
    () =>
      children.map(child => {
        const age = getChildAge(child)
        return { child, age, isEligible: age !== null && age >= 8 && age <= 17 }
      }),
    [children]
  )

  const onContinue = async () => {
    const { bookingGroupId } = await createDraftBookingGroup()
    if (bookingGroupId) setStep('addons')
  }

  return (
    <section className="space-y-4">
      <div className="lg:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Who's going to camp?</h2>
      </div>

      <div className="hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Step 2 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          Who's going to camp?
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Select{maxSpots ? ` up to ${maxSpots}` : ''} children for this booking
        </p>
      </div>
      <div className="grid gap-3">
        {eligibleChildren.map(({ child, age, isEligible }) => {
          const selected = selectedChildIds.includes(child.id)
          const unitPrice = getChildUnitPrice(session, camp, child)
          return (
            <button
              key={child.id}
              type="button"
              disabled={!isEligible}
              onClick={() => {
                if (!isEligible) return
                if (maxSpots !== null) {
                  const alreadySelected = selectedChildIds.includes(child.id)
                  const nextSelectedCount = alreadySelected
                    ? selectedChildIds.length - 1
                    : selectedChildIds.length + 1
                  if (!alreadySelected && nextSelectedCount > maxSpots) {
                    setShowWaitlist(true)
                    return
                  }
                }
                toggleChild(child.id)
              }}
              className={[
                'cursor-pointer rounded-xl border p-4 text-left transition hover:opacity-hover',
                selected ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300',
                !isEligible ? 'cursor-not-allowed bg-gray-50 opacity-60' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={[
                      'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      selected ? 'border-primary bg-primary' : 'border-gray-300 bg-white',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>

                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {child.firstName} {child.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {age !== null ? `${age} years old` : 'Unknown age'}
                    </p>
                    {!isEligible ? (
                      <p className="mt-1 text-xs font-semibold text-error-500">Not eligible</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className="text-lg font-bold text-gray-900 whitespace-nowrap">
                    {formatCurrency(unitPrice, currency)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}

        {!isAddingChild ? (
          <button
            type="button"
            onClick={() => setIsAddingChild(true)}
            className="cursor-pointer flex items-center justify-center gap-2.5 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl bg-white text-sm font-semibold text-gray-500 transition-all hover:border-gray-900 hover:text-gray-900"
          >
            <span className="text-base leading-none">+</span>
            Add child
          </button>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <AddChildForm
              submitLabel="Save child"
              submitColor="primary"
              onCancel={() => setIsAddingChild(false)}
              onSubmit={(payload: AddChildPayload) => addChild(payload)}
              onSuccess={createdChild => {
                if (maxSpots === null || selectedChildIds.length < maxSpots) {
                  toggleChild(createdChild.id)
                }
                addToast({
                  title: 'Success',
                  description: 'Child profile added to your account.',
                  color: 'success',
                })
                setIsAddingChild(false)
              }}
            />
          </div>
        )}
      </div>
      {showWaitlist && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm text-warning-700">
          This session has limited remaining spots. Additional children may be placed on waitlist.
          <div className="mt-2">
            <Button size="sm" color="warning" onPress={() => setShowWaitlist(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
      <div className="hidden pt-4 lg:block">
        <Button
          color="primary"
          className="w-full"
          isDisabled={selectedChildIds.length === 0}
          onPress={onContinue}
          endContent={<ChevronRight size={16} />}
        >
          Continue
        </Button>
      </div>
    </section>
  )
}

function AddonsStep() {
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)
  const toggleAddOn = useCampBookingStore(state => state.toggleAddOn)
  const toggleAddOnChild = useCampBookingStore(state => state.toggleAddOnChild)
  const setAddOnChildQuantity = useCampBookingStore(state => state.setAddOnChildQuantity)
  const setAddOnQuantity = useCampBookingStore(state => state.setAddOnQuantity)
  const saveAddOnsAndGoToReview = useCampBookingStore(state => state.saveAddOnsAndGoToReview)
  const setStep = useCampBookingStore(state => state.setStep)
  const camp = useCampBookingStore(state => state.camp)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const currency = camp?.provider?.settings?.currency || 'EUR'

  const inferMode = (addon: (typeof addOns)[number]): CampBookingAddOnSelectionMode => {
    const unit = (addon.quantityUnit || '').toLowerCase()
    if (unit.includes('trip') || addon.pricingUnit === 'one_time') return 'qty'
    const maxQuantity = addon.maxQuantity ?? null
    if (typeof maxQuantity === 'number' && maxQuantity > 1) return 'per_child_qty'
    return addon.pricingUnit === 'per_child' ? 'per_child' : 'per_child_qty'
  }

  const sortedAddOns = addOns.slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const selectedChildren = children.filter(c => selectedChildIds.includes(c.id))

  const [sheetAddonId, setSheetAddonId] = useState<string | null>(null)

  const sheetSelection = sheetAddonId ? addOnSelectionsById[sheetAddonId] : undefined
  const sheetAddon = sheetAddonId ? addOns.find(a => a.addOnId === sheetAddonId) : undefined
  const sheetMode = sheetSelection?.mode ?? (sheetAddon ? inferMode(sheetAddon) : null)

  // If the selection is removed while the sheet is open, close it.
  useEffect(() => {
    if (!sheetAddonId) return
    if (addOnSelectionsById[sheetAddonId]) return
    setSheetAddonId(null)
  }, [sheetAddonId, addOnSelectionsById])

  const extrasSelectedTypes = Object.values(addOnSelectionsById).length

  const calcAddOnTotalForSelection = (addonId: string) => {
    const selection = addOnSelectionsById[addonId]
    const addon = addOns.find(a => a.addOnId === addonId)
    if (!selection || !addon) return 0
    if (selection.mode === 'per_child') {
      return addon.price * (selection.childIds?.length ?? 0)
    }
    if (selection.mode === 'per_child_qty') {
      const qty = (selection.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
      return addon.price * qty
    }
    return addon.price * (selection.quantity ?? 0)
  }

  const extrasTotal = Object.keys(addOnSelectionsById).reduce(
    (sum, addonId) => sum + calcAddOnTotalForSelection(addonId),
    0
  )

  const getAddonSummary = (addOnId: string) => {
    const selection = addOnSelectionsById[addOnId]
    if (!selection) return null
    if (selection.mode === 'per_child') {
      const selectedChildrenCount = selection.childIds?.length ?? 0
      if (selectedChildrenCount === 0) return null
      return `${selectedChildrenCount} child${selectedChildrenCount === 1 ? '' : 'ren'} selected`
    }
    if (selection.mode === 'per_child_qty') {
      const qty = (selection.childQuantities ?? []).reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0
      )
      if (qty === 0) return null
      return `${qty} unit${qty === 1 ? '' : 's'} selected`
    }
    const qty = selection.quantity ?? 0
    if (qty === 0) return null
    return `${qty} selected`
  }

  return (
    <section className="space-y-4">
      <div className="hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Step 3 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Add extras</h1>
        <p className="mt-2 text-sm text-gray-500">
          Optional add-ons · choose for each child or skip
        </p>
      </div>

      <div className="lg:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Add extras</h2>
      </div>

      <div className="hidden lg:flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Optional extras</p>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {extrasSelectedTypes} selected
        </span>
      </div>

      <div className="hidden lg:block divide-y divide-gray-100">
        {sortedAddOns.map(addOn => {
          const selection = addOnSelectionsById[addOn.addOnId]
          const isSelected = !!selection
          const mode = selection?.mode ?? inferMode(addOn)
          const summary = getAddonSummary(addOn.addOnId)
          const qty = selection?.quantity ?? 0
          const maxQuantity = addOn.maxQuantity ?? null
          const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity

          return (
            <div key={addOn.addOnId} className="flex items-center gap-4 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary-700">+</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{addOn.name}</p>
                {addOn.description ? (
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{addOn.description}</p>
                ) : null}
                {summary ? <p className="mt-1 text-xs text-gray-500">{summary}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(addOn.price, currency)}
                </p>
                <p className="text-xs text-gray-500">
                  {mode === 'qty'
                    ? 'per item'
                    : mode === 'per_child'
                      ? 'per child'
                      : 'per unit/child'}
                </p>
              </div>
              <div className="shrink-0">
                {mode === 'qty' ? (
                  !isSelected ? (
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-800"
                      onClick={() => toggleAddOn(addOn.addOnId)}
                    >
                      +
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl disabled:opacity-50"
                        onClick={() => setAddOnQuantity(addOn.addOnId, Math.max(0, qty - 1))}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-gray-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={atMax}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xl text-white disabled:opacity-50"
                        onClick={() => setAddOnQuantity(addOn.addOnId, qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  )
                ) : !isSelected ? (
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-800"
                    onClick={() => toggleAddOn(addOn.addOnId)}
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white"
                    onClick={() => setSheetAddonId(addOn.addOnId)}
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="lg:hidden border-t border-gray-200 pt-4">
        <div className="divide-y divide-gray-200">
          {sortedAddOns.map(addOn => {
            const selection = addOnSelectionsById[addOn.addOnId]
            const isSelected = !!selection
            const mode = selection?.mode ?? inferMode(addOn)
            const qty = selection?.quantity ?? 0

            const maxQuantity = addOn.maxQuantity ?? null
            const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity

            return (
              <div key={addOn.addOnId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-sm font-bold text-gray-700">+</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{addOn.name}</p>
                    {addOn.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{addOn.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs font-medium text-gray-700">
                      +{formatCurrency(addOn.price, currency)}{' '}
                      {mode === 'per_child'
                        ? 'per child'
                        : mode === 'per_child_qty'
                          ? 'per child / unit'
                          : 'per item'}
                    </p>
                  </div>
                </div>

                {mode === 'qty' ? (
                  !isSelected ? (
                    <button
                      type="button"
                      aria-label={`Add ${addOn.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-800"
                      onClick={() => toggleAddOn(addOn.addOnId)}
                    >
                      +
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        aria-label="Decrease quantity"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl disabled:opacity-50"
                        onClick={() => setAddOnQuantity(addOn.addOnId, Math.max(0, qty - 1))}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-gray-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={atMax}
                        aria-label="Increase quantity"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white disabled:opacity-50"
                        onClick={() => setAddOnQuantity(addOn.addOnId, qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  )
                ) : !isSelected ? (
                  <button
                    type="button"
                    aria-label={`Add ${addOn.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-800"
                    onClick={() => toggleAddOn(addOn.addOnId)}
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Configure ${addOn.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white"
                    onClick={() => setSheetAddonId(addOn.addOnId)}
                  >
                    ✓
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {sheetAddonId && sheetAddon && sheetSelection ? (
        <div className="fixed inset-0 z-60">
          <div
            className="absolute inset-0 bg-black/40"
            role="button"
            tabIndex={0}
            onClick={() => setSheetAddonId(null)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-xl lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[460px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-200" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900">{sheetAddon.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetAddonId(null)}
                aria-label="Close"
                className="rounded-md p-1 text-gray-500 hover:bg-gray-50"
              >
                ×
              </button>
            </div>

            <div className="max-h-2/3 overflow-y-auto px-4 py-3 pb-28">
              {sheetMode === 'per_child' ? (
                <div className="divide-y divide-gray-100">
                  {selectedChildren.map(child => {
                    const checked = sheetSelection.childIds?.includes(child.id) ?? false
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className="w-full py-3 text-left flex items-center justify-between gap-3"
                        onClick={() => toggleAddOnChild(sheetAddon.addOnId, child.id)}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {child.firstName} {child.lastName}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {getChildAge(child) !== null
                              ? `${getChildAge(child)} years old`
                              : 'Unknown age'}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {checked ? `+${formatCurrency(sheetAddon.price, currency)}` : '—'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : sheetMode === 'per_child_qty' ? (
                <div className="divide-y divide-gray-100">
                  {selectedChildren.map(child => {
                    const cq = sheetSelection.childQuantities?.find(x => x.childId === child.id)
                    const qty = cq?.quantity ?? 0
                    const maxQuantity = sheetAddon.maxQuantity ?? null
                    const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity

                    return (
                      <div key={child.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {child.firstName} {child.lastName}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {getChildAge(child) !== null
                              ? `${getChildAge(child)} years old`
                              : 'Unknown age'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={qty <= 0}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl disabled:opacity-50"
                            onClick={() =>
                              setAddOnChildQuantity(
                                sheetAddon.addOnId,
                                child.id,
                                Math.max(0, qty - 1)
                              )
                            }
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-gray-900">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={atMax}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white disabled:opacity-50"
                            onClick={() =>
                              setAddOnChildQuantity(sheetAddon.addOnId, child.id, qty + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                (() => {
                  const qty = sheetSelection.quantity ?? 0
                  const maxQuantity = sheetAddon.maxQuantity ?? null
                  const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity
                  const unitLabel = sheetAddon.quantityUnit ?? 'items'
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">Number of {unitLabel}</p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={qty <= 0}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl disabled:opacity-50"
                            onClick={() =>
                              setAddOnQuantity(sheetAddon.addOnId, Math.max(0, qty - 1))
                            }
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-gray-900">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={atMax}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white disabled:opacity-50"
                            onClick={() => setAddOnQuantity(sheetAddon.addOnId, qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Total</span>
                          <span className="font-bold text-gray-900 whitespace-nowrap">
                            +{formatCurrency(sheetAddon.price * qty, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}
            </div>

            <div className="border-t border-gray-200 bg-white px-4 py-3">
              <Button color="primary" className="w-full" onPress={() => setSheetAddonId(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden pt-4 lg:block">
        <Button
          color="primary"
          className="w-full"
          onPress={async () => {
            const ok = await saveAddOnsAndGoToReview()
            if (ok) setStep('review-and-pay')
          }}
          endContent={<ChevronRight size={16} />}
        >
          {extrasSelectedTypes === 0
            ? `No thanks · ${formatCurrency(0, currency)}`
            : `Continue · ${formatCurrency(extrasTotal, currency)}`}
        </Button>
      </div>
    </section>
  )
}

function ReviewStep() {
  const submitBookingGroup = useCampBookingStore(state => state.submitBookingGroup)
  const hasSubmitted = useCampBookingStore(state => state.hasSubmitted)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)
  const specialRequest = useCampBookingStore(state => state.specialRequest)
  const setSpecialRequest = useCampBookingStore(state => state.setSpecialRequest)
  const camp = useCampBookingStore(state => state.camp)

  const session = sessions.find(item => item.id === selectedSessionId)
  const selectedChildren = children.filter(child => selectedChildIds.includes(child.id))
  const selectedAddOns = addOns.filter(addOn => !!addOnSelectionsById[addOn.addOnId])

  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')
  const addOnTotal = selectedAddOns.reduce((acc, addOn) => {
    const sel = addOnSelectionsById[addOn.addOnId]
    if (!sel) return acc
    if (sel.mode === 'per_child') return acc + addOn.price * (sel.childIds?.length ?? 0)
    if (sel.mode === 'per_child_qty') {
      const qty = (sel.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
      return acc + addOn.price * qty
    }
    return acc + addOn.price * (sel.quantity ?? 0)
  }, 0)
  const childrenSubtotal = getSelectedChildrenSubtotal({
    session,
    camp,
    children,
    selectedChildIds,
  })
  const total = childrenSubtotal + addOnTotal

  const onRequestToBook = async () => {
    await submitBookingGroup()
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Review and pay</h2>
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Session</p>
        <p className="font-semibold text-gray-900">{session?.name || 'No session selected'}</p>
      </div>
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Children</p>
        <div className="mt-1 space-y-1">
          {selectedChildren.map(child => (
            <p key={child.id} className="font-semibold text-gray-900">
              {child.firstName} {child.lastName}
            </p>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Add-ons</p>
        <div className="mt-1 space-y-1">
          {selectedAddOns.length === 0 ? (
            <p className="text-sm text-gray-500">No add-ons selected</p>
          ) : null}

          {selectedAddOns.map(addOn => {
            const sel = addOnSelectionsById[addOn.addOnId]
            if (!sel) return null

            const qty =
              sel.mode === 'per_child'
                ? (sel.childIds?.length ?? 0)
                : sel.mode === 'per_child_qty'
                  ? (sel.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
                  : (sel.quantity ?? 0)

            const label = qty > 1 ? `${addOn.name} × ${qty}` : addOn.name
            return (
              <p key={addOn.addOnId} className="font-semibold text-gray-900">
                {label}
              </p>
            )
          })}
        </div>
      </div>
      <Textarea
        label="Special request"
        labelPlacement="outside"
        placeholder="Add a note for the organizer..."
        value={specialRequest}
        onValueChange={setSpecialRequest}
      />
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(total, currency)}</span>
        </div>
      </div>
      {hasSubmitted ? (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          Booking request submitted successfully.
        </div>
      ) : (
        <div className="hidden lg:block">
          <Button color="primary" className="w-full md:w-auto" onPress={onRequestToBook}>
            Request to book
          </Button>
        </div>
      )}
    </section>
  )
}

export function CampBookingFlow() {
  const currentStep = useCampBookingStore(state => state.currentStep)
  const error = useCampBookingStore(state => state.error)
  const isLoading = useCampBookingStore(state => state.isLoading)
  const duplicateDraftConflict = useCampBookingStore(state => state.duplicateDraftConflict)
  const draftPreviews = useCampBookingStore(state => state.draftPreviews)
  const clearDuplicateDraftConflict = useCampBookingStore(
    state => state.clearDuplicateDraftConflict
  )
  const hydrateFromBookingGroupId = useCampBookingStore(state => state.hydrateFromBookingGroupId)
  const createDraftBookingGroup = useCampBookingStore(state => state.createDraftBookingGroup)
  const setStep = useCampBookingStore(state => state.setStep)
  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')

  const onSelectDraftPreview = async (bookingGroupId: string) => {
    clearDuplicateDraftConflict()
    await hydrateFromBookingGroupId(bookingGroupId)
    setStep('addons')
  }

  const onCreateNewDraft = async () => {
    clearDuplicateDraftConflict()
    const { bookingGroupId } = await createDraftBookingGroup({ forceNew: true })
    if (bookingGroupId) setStep('addons')
  }

  const onSeeDraftBookings = () => {
    clearDuplicateDraftConflict()
  }

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-0">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
          <div className="lg:col-span-8 lg:bg-white lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-sm lg:flex lg:flex-col">
            <div className="lg:p-7 lg:px-8">
              {error && (
                <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="flex min-h-1/2 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                </div>
              ) : (
                <>
                  {currentStep === 'sessions' && <SessionsStep />}
                  {currentStep === 'children' && <ChildrenStep />}
                  {currentStep === 'addons' && <AddonsStep />}
                  {currentStep === 'review-and-pay' && <ReviewStep />}
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-4">
            {currentStep === 'sessions' ? <DesktopSessionsSidebar /> : null}
            {currentStep === 'children' ? <DesktopChildrenSidebar /> : null}
            {currentStep === 'addons' ? <DesktopAddonsSidebar /> : null}
          </div>
        </div>
      </main>
      <MobileBookingFooter />
      <DuplicateDraftModal
        isOpen={Boolean(duplicateDraftConflict)}
        message={
          duplicateDraftConflict?.message ??
          'You already have a draft booking for this camp. Continue your existing booking or create a new one.'
        }
        previews={draftPreviews}
        currency={currency}
        onSelectDraft={onSelectDraftPreview}
        onCreateNewBooking={onCreateNewDraft}
        onSeeDraftBookings={onSeeDraftBookings}
      />
    </div>
  )
}
