'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  addToast,
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { getChildAge } from '@/types/child'
import { formatCurrency, getCampCurrency } from '@/utils/currency'
import type { CampBookingAddOnSelectionMode } from '@/types/camp-booking'
import {
  formatAddOnAgeRange,
  getAddOnMode,
  getAddOnTileLabel,
  getAddOnUnitNoun,
} from '@/utils/addon-pricing'
import { MobileBookingFooter } from '@/components/camp-booking/mobile-booking-footer'
import { DesktopSessionsSidebar } from '@/components/camp-booking/desktop-sessions-sidebar'
import { DesktopChildrenSidebar } from '@/components/camp-booking/desktop-children-sidebar'
import { DesktopAddonsSidebar } from '@/components/camp-booking/desktop-addons-sidebar'
import { DesktopReviewSidebar } from '@/components/camp-booking/desktop-review-sidebar'
import { SidebarRatingsRow } from '@/components/camp-booking/sidebar-camp-info-card'
import { useBookingRatings } from '@/components/camp-booking/use-booking-ratings'
import {
  StripePaymentSection,
  type StripePaymentSectionHandle,
} from '@/components/camp-booking/stripe-payment-section'
import { computePaymentPlan } from '@/utils/payment-plan'
import { isSessionBookable, PROVIDER_RESPONSE_WINDOW_HOURS } from '@world-schools/wc-utils'
import { getChildrenEligibility, type IneligibleReason } from '@/utils/child-eligibility'
import { DuplicateDraftModal } from '@/components/camp-booking/duplicate-draft-modal'
import { CampRulesModal } from '@/components/camp-booking/camp-rules-modal'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { BookingTermsModal } from '@/components/camp-booking/booking-terms-modal'
import { BookingConfirmModal } from '@/components/camp-booking/booking-confirm-modal'
import {
  getChildUnitPrice,
  getSelectedChildrenPriceBreakdown,
  getSelectedChildrenSubtotal,
} from '@/components/camp-booking/booking-flow-pricing'
import { AddChildForm, type AddChildPayload } from '@/components/children/add-child-form-fields'
import { Check, ChevronDown, ChevronRight, Minus, Plus, X } from 'lucide-react'

function SessionsStep() {
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const selectSession = useCampBookingStore(state => state.selectSession)
  const setStep = useCampBookingStore(state => state.setStep)
  const camp = useCampBookingStore(state => state.camp)

  const currency = getCampCurrency(camp, 'camp-booking-flow')

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
    // Hide sessions that are no longer bookable (already started / past), matching
    // the backend gate so parents never pick a session that submit will reject.
    if (!isSessionBookable({ startDate: session.startDate, endDate: session.endDate })) return false

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
              isSelected ? 'border-secondary' : 'border-gray-200 hover:border-gray-300',
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
                        isSelected ? 'border-secondary bg-secondary' : 'border-gray-300 bg-white',
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

/**
 * Renders an ineligibility reason, linking ONLY the actionable noun phrase
 * (e.g. "emergency contact") to the relevant profile section — not the whole
 * sentence. Falls back to plain text when there's no link or the phrase isn't
 * found in the message.
 */
function IneligibleReasonText({ reason }: { reason: IneligibleReason }) {
  const phraseStart = reason.linkText && reason.href ? reason.message.indexOf(reason.linkText) : -1

  if (phraseStart === -1 || !reason.linkText || !reason.href) {
    return <span>{reason.message}</span>
  }

  const before = reason.message.slice(0, phraseStart)
  const after = reason.message.slice(phraseStart + reason.linkText.length)
  return (
    <span>
      {before}
      <Link href={reason.href} className="underline underline-offset-2 hover:text-error-600">
        {reason.linkText}
      </Link>
      {after}
    </span>
  )
}

function ChildrenStep() {
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const sessions = useCampBookingStore(state => state.sessions)
  const session = sessions.find(item => item.id === selectedSessionId)
  const maxSpots = session?.totalSpots ?? null
  const [showWaitlist, setShowWaitlist] = useState(false)

  const children = useCampBookingStore(state => state.children)
  const childBookingRanges = useCampBookingStore(state => state.childBookingRanges)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const toggleChild = useCampBookingStore(state => state.toggleChild)
  const guardianConsent = useCampBookingStore(state => state.guardianConsent)
  const setGuardianConsent = useCampBookingStore(state => state.setGuardianConsent)
  const createDraftBookingGroup = useCampBookingStore(state => state.createDraftBookingGroup)
  const addChild = useCampBookingStore(state => state.addChild)
  const camp = useCampBookingStore(state => state.camp)
  const currency = useCampBookingStore(state => getCampCurrency(state.camp, 'camp-booking-flow'))
  const [isAddingChild, setIsAddingChild] = useState(false)

  const eligibleChildren = useMemo(
    () => getChildrenEligibility(camp, session, children, childBookingRanges),
    [children, camp, session, childBookingRanges]
  )

  // Continue is only valid when at least one *eligible* child is selected.
  // Guards against a stale/ineligible selection (e.g. session change) leaving
  // the button enabled with nothing actually bookable.
  const hasValidSelection = useMemo(
    () => eligibleChildren.some(e => e.isEligible && selectedChildIds.includes(e.child.id)),
    [eligibleChildren, selectedChildIds]
  )

  // Names + pronoun of the currently-selected eligible children, for the
  // guardian confirmation copy. A single child uses their gendered pronoun
  // ("his"/"her"); multiple (or unexpectedly empty) fall back to "their".
  const { selectedChildNames, guardianPronoun } = useMemo(() => {
    const selected = eligibleChildren.filter(
      e => e.isEligible && selectedChildIds.includes(e.child.id)
    )
    const names = selected.map(e => e.child.firstName)
    const pronoun =
      selected.length === 1 ? (selected[0].child.gender === 'girl' ? 'her' : 'his') : 'their'
    return {
      selectedChildNames: names.length ? names.join(', ') : 'this child',
      guardianPronoun: pronoun,
    }
  }, [eligibleChildren, selectedChildIds])

  const onContinue = async () => {
    await createDraftBookingGroup()
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
        {eligibleChildren.map(({ child, age, isEligible, ineligibleReasons }) => {
          const selected = selectedChildIds.includes(child.id)
          const unitPrice = getChildUnitPrice(session, camp, child)
          return (
            <div
              key={child.id}
              className={[
                'rounded-xl border p-4 transition',
                selected ? 'border-secondary' : 'border-gray-200',
                !isEligible ? 'bg-gray-50' : 'hover:border-gray-300',
              ].join(' ')}
            >
              <button
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
                  'flex w-full items-start justify-between gap-3 text-left transition',
                  isEligible ? 'cursor-pointer hover:opacity-hover' : 'cursor-not-allowed',
                ].join(' ')}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={[
                      'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      selected ? 'border-secondary bg-secondary' : 'border-gray-300 bg-white',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>

                  <div className="min-w-0">
                    <p
                      className={`font-semibold text-gray-900 truncate ${!isEligible ? 'opacity-60' : ''}`}
                    >
                      {child.firstName} {child.lastName}
                    </p>
                    <p className={`text-sm text-gray-500 ${!isEligible ? 'opacity-60' : ''}`}>
                      {age !== null ? `${age} years old` : 'Unknown age'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p
                    className={`text-lg font-bold text-gray-900 whitespace-nowrap ${!isEligible ? 'opacity-60' : ''}`}
                  >
                    {formatCurrency(unitPrice, currency)}
                  </p>
                </div>
              </button>

              {!isEligible ? (
                ineligibleReasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 pl-9">
                    {ineligibleReasons.map((reason, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-1 text-xs font-semibold text-error-500"
                      >
                        <span aria-hidden="true">•</span>
                        <IneligibleReasonText reason={reason} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 pl-9 text-xs font-semibold text-error-500">Not eligible</p>
                )
              ) : null}
            </div>
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
                // Only auto-select the new child if it actually passes the
                // eligibility gate. The quick-add form omits emergency contacts
                // and medical info, so most newly-added children are not yet
                // bookable — selecting them would re-introduce invalid selections.
                const isEligible =
                  getChildrenEligibility(camp, session, [createdChild])[0]?.isEligible ?? false
                if (isEligible && (maxSpots === null || selectedChildIds.length < maxSpots)) {
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
      {hasValidSelection && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Checkbox
            color="secondary"
            isSelected={guardianConsent}
            onValueChange={setGuardianConsent}
            classNames={{ base: 'items-start max-w-full', label: 'text-sm text-gray-700' }}
          >
            I confirm I am the legal parent or guardian of{' '}
            <span className="font-semibold">{selectedChildNames}</span> and am authorised to make
            this booking on {guardianPronoun} behalf.
          </Checkbox>
        </div>
      )}
      <div className="hidden pt-4 lg:block">
        <Button
          color="primary"
          className="w-full"
          isDisabled={!hasValidSelection || !guardianConsent}
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
  const currency = getCampCurrency(camp, 'camp-booking-flow')

  const inferMode = (addon: (typeof addOns)[number]): CampBookingAddOnSelectionMode =>
    getAddOnMode(addon)

  const sortedAddOns = addOns.slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const selectedChildren = children.filter(c => selectedChildIds.includes(c.id))

  // Add-ons can be age-restricted (minAge/maxAge). Mirror the backend guard so
  // an ineligible child can't be assigned the add-on; backend re-validates.
  const isChildAddOnEligible = (
    child: (typeof children)[number],
    addon: { minAge?: number | null; maxAge?: number | null }
  ): boolean => {
    if (addon.minAge == null && addon.maxAge == null) return true
    const age = getChildAge(child)
    if (age === null) return false
    if (addon.minAge != null && age < addon.minAge) return false
    if (addon.maxAge != null && age > addon.maxAge) return false
    return true
  }

  const [sheetAddonId, setSheetAddonId] = useState<string | null>(null)
  const [sheetDraft, setSheetDraft] = useState<{
    mode: CampBookingAddOnSelectionMode
    childIds?: string[]
    childQuantities?: Array<{ childId: string; quantity: number }>
    quantity?: number
  } | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  const sheetAddon = sheetAddonId ? addOns.find(a => a.addOnId === sheetAddonId) : undefined
  const sheetMode = sheetDraft?.mode ?? (sheetAddon ? inferMode(sheetAddon) : null)
  const isConfiguratorOpen = Boolean(sheetAddonId && sheetAddon && sheetDraft)
  // Age-restriction label for the open add-on, e.g. "ages 8–12" (null = no limit).
  const sheetAddonAgeRange = sheetAddon ? formatAddOnAgeRange(sheetAddon) : null
  const ineligibleAgeMessage = sheetAddonAgeRange
    ? `Only available for ${sheetAddonAgeRange}`
    : "Not available for this child's age"

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const getSelectionQuantity = (selection: {
    mode: CampBookingAddOnSelectionMode
    childIds?: string[]
    childQuantities?: Array<{ childId: string; quantity: number }>
    quantity?: number
  }) => {
    if (selection.mode === 'per_child') return selection.childIds?.length ?? 0
    if (selection.mode === 'per_child_qty') {
      return (selection.childQuantities ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
    }
    return selection.quantity ?? 0
  }

  const openAddonConfigurator = (addOnId: string) => {
    const addon = addOns.find(item => item.addOnId === addOnId)
    if (!addon) return
    const existing = addOnSelectionsById[addOnId]
    const mode = existing?.mode ?? inferMode(addon)

    if (existing) {
      setSheetDraft({
        mode: existing.mode,
        childIds: [...(existing.childIds ?? [])],
        childQuantities: (existing.childQuantities ?? []).map(item => ({
          childId: item.childId,
          quantity: item.quantity ?? 0,
        })),
        quantity: existing.quantity ?? 0,
      })
    } else if (mode === 'per_child') {
      setSheetDraft({
        mode,
        childIds: [],
      })
    } else if (mode === 'per_child_qty') {
      setSheetDraft({
        mode,
        childQuantities: selectedChildren.map(child => ({ childId: child.id, quantity: 0 })),
      })
    } else {
      setSheetDraft({
        mode,
        quantity: 0,
      })
    }
    setSheetAddonId(addOnId)
  }

  const closeAddonConfigurator = () => {
    setSheetAddonId(null)
    setSheetDraft(null)
  }

  const submitAddonConfigurator = () => {
    if (!sheetAddonId || !sheetDraft) return closeAddonConfigurator()

    const nextQty = getSelectionQuantity(sheetDraft)
    let liveSelection = useCampBookingStore.getState().addOnSelectionsById[sheetAddonId]

    if (!liveSelection && nextQty <= 0) return closeAddonConfigurator()
    if (!liveSelection && nextQty > 0) {
      toggleAddOn(sheetAddonId)
      liveSelection = useCampBookingStore.getState().addOnSelectionsById[sheetAddonId]
    }
    if (liveSelection && nextQty <= 0) {
      toggleAddOn(sheetAddonId)
      return closeAddonConfigurator()
    }

    const mode = sheetDraft.mode
    if (mode === 'per_child') {
      const currentIds = new Set(liveSelection?.childIds ?? [])
      const nextIds = new Set(sheetDraft.childIds ?? [])
      const idsToAdd = [...nextIds].filter(childId => !currentIds.has(childId))
      const idsToRemove = [...currentIds].filter(childId => !nextIds.has(childId))

      // Add first, then remove. The store drops empty selections on remove,
      // so this ordering avoids losing later adds in "switch child" flows.
      idsToAdd.forEach(childId => toggleAddOnChild(sheetAddonId, childId))
      idsToRemove.forEach(childId => toggleAddOnChild(sheetAddonId, childId))
    } else if (mode === 'per_child_qty') {
      const nextById = new Map(
        (sheetDraft.childQuantities ?? []).map(item => [item.childId, item.quantity])
      )
      selectedChildren.forEach(child => {
        const qty = nextById.get(child.id) ?? 0
        setAddOnChildQuantity(sheetAddonId, child.id, qty)
      })
    } else {
      setAddOnQuantity(sheetAddonId, sheetDraft.quantity ?? 0)
    }

    closeAddonConfigurator()
  }

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
    const addon = addOns.find(item => item.addOnId === addOnId)
    if (addon) {
      const noun = getAddOnUnitNoun(addon)
      return `${qty} ${noun}${qty === 1 ? '' : 's'} selected`
    }
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
        <p className="text-sm font-bold uppercase tracking-wider text-gray-400">Optional extras</p>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-600">
          {extrasSelectedTypes} selected
        </span>
      </div>

      <div className="hidden lg:block divide-y divide-gray-100">
        {sortedAddOns.map(addOn => {
          const selection = addOnSelectionsById[addOn.addOnId]
          const isSelected = !!selection
          const summary = getAddonSummary(addOn.addOnId)

          return (
            <div key={addOn.addOnId} className="flex items-center gap-4 py-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary-700">{addOn.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{addOn.name}</p>
                {addOn.description ? (
                  <p className="text-sm text-gray-500 line-clamp-2">{addOn.description}</p>
                ) : null}
                {summary ? <p className="text-sm text-gray-500">{summary}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-gray-900">{formatCurrency(addOn.price, currency)}</p>
                <p className="text-sm text-gray-500">{getAddOnTileLabel(addOn)}</p>
              </div>
              <div className="shrink-0">
                {!isSelected ? (
                  <Button
                    isIconOnly
                    radius="full"
                    aria-label={`Add ${addOn.name}`}
                    onPress={() => openAddonConfigurator(addOn.addOnId)}
                  >
                    <Plus size={16} />
                  </Button>
                ) : (
                  <Button
                    isIconOnly
                    radius="full"
                    color="secondary"
                    aria-label={`Add ${addOn.name}`}
                    onPress={() => openAddonConfigurator(addOn.addOnId)}
                  >
                    <Check size={16} />
                  </Button>
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

            return (
              <div
                key={addOn.addOnId}
                className="flex items-start justify-between gap-3 p-4"
                role="button"
                tabIndex={0}
                onClick={() => openAddonConfigurator(addOn.addOnId)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openAddonConfigurator(addOn.addOnId)
                  }
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-sm font-bold text-gray-700">{addOn.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{addOn.name}</p>
                    {addOn.description ? (
                      <p className="line-clamp-2 text-sm text-gray-500">{addOn.description}</p>
                    ) : null}
                    <p className="text-sm font-semibold text-gray-500">
                      +{formatCurrency(addOn.price, currency)} {getAddOnTileLabel(addOn)}
                    </p>
                  </div>
                </div>

                {!isSelected ? (
                  <Button
                    isIconOnly
                    radius="full"
                    aria-label={`Add ${addOn.name}`}
                    onPress={() => {
                      openAddonConfigurator(addOn.addOnId)
                    }}
                  >
                    <Plus size={16} />
                  </Button>
                ) : (
                  <Button
                    isIconOnly
                    radius="full"
                    color="secondary"
                    aria-label={`Configure ${addOn.name}`}
                    onPress={() => openAddonConfigurator(addOn.addOnId)}
                  >
                    <Check size={16} />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {sheetAddon && sheetDraft ? (
        <>
          <Modal
            isOpen={isConfiguratorOpen && isDesktop}
            onOpenChange={open => {
              if (!open) closeAddonConfigurator()
            }}
            size="lg"
            className="hidden lg:flex"
            scrollBehavior="inside"
          >
            <ModalContent>
              <ModalHeader>{sheetAddon.name}</ModalHeader>
              <ModalBody className="max-h-[60vh]">
                <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <span className="text-sm font-bold text-primary-700">{sheetAddon.icon}</span>
                  </div>
                  <div className="min-w-0 text-[13px] leading-snug text-gray-500">
                    <p className="line-clamp-2">{sheetAddon.description || sheetAddon.name}</p>
                    <p className="mt-1 font-semibold text-secondary">
                      {formatCurrency(sheetAddon.price, currency)} {getAddOnTileLabel(sheetAddon)}
                    </p>
                  </div>
                </div>
                {sheetMode === 'per_child' ? (
                  <div className="flex flex-col gap-3 divide-y divide-gray-100">
                    {selectedChildren.map(child => {
                      const checked = sheetDraft.childIds?.includes(child.id) ?? false
                      const ageEligible = isChildAddOnEligible(child, sheetAddon)
                      return (
                        <Checkbox
                          key={child.id}
                          aria-label={`${child.firstName} ${child.lastName}`}
                          color="secondary"
                          isSelected={checked}
                          isDisabled={!ageEligible}
                          onValueChange={() =>
                            setSheetDraft(prev => {
                              if (prev?.mode !== 'per_child') return prev
                              const current = new Set(prev.childIds ?? [])
                              if (current.has(child.id)) current.delete(child.id)
                              else current.add(child.id)
                              return { ...prev, childIds: [...current] }
                            })
                          }
                          classNames={{ base: 'py-4 max-w-full gap-2', label: 'w-full' }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {child.firstName} {child.lastName}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {getChildAge(child) !== null
                                  ? `${getChildAge(child)} years old`
                                  : 'Unknown age'}
                              </p>
                              {!ageEligible ? (
                                <p className="mt-0.5 text-xs font-medium text-warning-600">
                                  {ineligibleAgeMessage}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {checked ? `+${formatCurrency(sheetAddon.price, currency)}` : '—'}
                            </div>
                          </div>
                        </Checkbox>
                      )
                    })}
                  </div>
                ) : sheetMode === 'per_child_qty' ? (
                  <div className="divide-y divide-gray-100">
                    {selectedChildren.map(child => {
                      const cq = sheetDraft.childQuantities?.find(x => x.childId === child.id)
                      const qty = cq?.quantity ?? 0
                      const maxQuantity = sheetAddon.maxQuantity ?? null
                      const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity
                      const ageEligible = isChildAddOnEligible(child, sheetAddon)

                      return (
                        <div
                          key={child.id}
                          className="py-3 flex items-center justify-between gap-3"
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
                          <div className="flex items-center gap-3">
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              isDisabled={qty <= 0}
                              onPress={() =>
                                setSheetDraft(prev => {
                                  if (prev?.mode !== 'per_child_qty') return prev
                                  const map = new Map(
                                    (prev.childQuantities ?? []).map(item => [
                                      item.childId,
                                      item.quantity ?? 0,
                                    ])
                                  )
                                  map.set(child.id, Math.max(0, qty - 1))
                                  return {
                                    ...prev,
                                    childQuantities: selectedChildren.map(item => ({
                                      childId: item.id,
                                      quantity: map.get(item.id) ?? 0,
                                    })),
                                  }
                                })
                              }
                            >
                              <Minus size={16} />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold text-gray-900">
                              {qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              color="secondary"
                              isDisabled={atMax || !ageEligible}
                              onPress={() =>
                                setSheetDraft(prev => {
                                  if (prev?.mode !== 'per_child_qty') return prev
                                  const map = new Map(
                                    (prev.childQuantities ?? []).map(item => [
                                      item.childId,
                                      item.quantity ?? 0,
                                    ])
                                  )
                                  map.set(child.id, qty + 1)
                                  return {
                                    ...prev,
                                    childQuantities: selectedChildren.map(item => ({
                                      childId: item.id,
                                      quantity: map.get(item.id) ?? 0,
                                    })),
                                  }
                                })
                              }
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  (() => {
                    const qty = sheetDraft.quantity ?? 0
                    const maxQuantity = sheetAddon.maxQuantity ?? null
                    const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity
                    const noun = getAddOnUnitNoun(sheetAddon)
                    const unitLabel = `${noun}${noun.endsWith('s') ? '' : 's'}`
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-700">Number of {unitLabel}</p>
                          <div className="flex items-center gap-3">
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              isDisabled={qty <= 0}
                              onPress={() =>
                                setSheetDraft(prev =>
                                  prev?.mode === 'qty'
                                    ? { ...prev, quantity: Math.max(0, qty - 1) }
                                    : prev
                                )
                              }
                            >
                              <Minus size={16} />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold text-gray-900">
                              {qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              color="secondary"
                              isDisabled={atMax}
                              onPress={() =>
                                setSheetDraft(prev =>
                                  prev?.mode === 'qty' ? { ...prev, quantity: qty + 1 } : prev
                                )
                              }
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-[15px] font-bold text-gray-900">
                  <span>Total</span>
                  <span className="whitespace-nowrap">
                    +{formatCurrency(sheetAddon.price * getSelectionQuantity(sheetDraft), currency)}
                  </span>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="secondary"
                  radius="sm"
                  className="w-full"
                  onPress={submitAddonConfigurator}
                >
                  {getSelectionQuantity(sheetDraft) > 0
                    ? `Add · ${formatCurrency(sheetAddon.price * getSelectionQuantity(sheetDraft), currency)}`
                    : 'Done'}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Drawer
            isOpen={isConfiguratorOpen && !isDesktop}
            onOpenChange={open => {
              if (!open) closeAddonConfigurator()
            }}
            placement="bottom"
            hideCloseButton
          >
            <DrawerContent>
              <DrawerHeader className="border-b border-gray-200">{sheetAddon.name}</DrawerHeader>
              <DrawerBody className="max-h-[70vh] overflow-y-auto px-6 py-3 pb-28">
                {sheetAddon.description ? (
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <span className="text-sm font-bold text-primary-700">{sheetAddon.icon}</span>
                    </div>
                    <div className="min-w-0 text-[13px] leading-snug text-gray-500">
                      <p className="line-clamp-2">{sheetAddon.description}</p>
                      <p className="mt-1">
                        {formatCurrency(sheetAddon.price, currency)} per{' '}
                        {sheetMode === 'per_child' ? 'child' : (sheetAddon.quantityUnit ?? 'item')}
                        {sheetMode === 'per_child_qty' ? '/child' : ''}
                      </p>
                    </div>
                  </div>
                ) : null}
                {sheetMode === 'per_child' ? (
                  <div className="flex flex-col gap-4 divide-y divide-gray-100">
                    {selectedChildren.map(child => {
                      const checked = sheetDraft.childIds?.includes(child.id) ?? false
                      const ageEligible = isChildAddOnEligible(child, sheetAddon)
                      return (
                        <Checkbox
                          key={child.id}
                          aria-label={`${child.firstName} ${child.lastName}`}
                          color="secondary"
                          isSelected={checked}
                          isDisabled={!ageEligible}
                          onValueChange={() =>
                            setSheetDraft(prev => {
                              if (prev?.mode !== 'per_child') return prev
                              const current = new Set(prev.childIds ?? [])
                              if (current.has(child.id)) current.delete(child.id)
                              else current.add(child.id)
                              return { ...prev, childIds: [...current] }
                            })
                          }
                          classNames={{ base: 'py-4 max-w-full gap-2', label: 'w-full' }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {child.firstName} {child.lastName}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {getChildAge(child) !== null
                                  ? `${getChildAge(child)} years old`
                                  : 'Unknown age'}
                              </p>
                              {!ageEligible ? (
                                <p className="mt-0.5 text-xs font-medium text-warning-600">
                                  {ineligibleAgeMessage}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {checked ? `+${formatCurrency(sheetAddon.price, currency)}` : '—'}
                            </div>
                          </div>
                        </Checkbox>
                      )
                    })}
                  </div>
                ) : sheetMode === 'per_child_qty' ? (
                  <div className="divide-y divide-gray-100">
                    {selectedChildren.map(child => {
                      const cq = sheetDraft.childQuantities?.find(x => x.childId === child.id)
                      const qty = cq?.quantity ?? 0
                      const maxQuantity = sheetAddon.maxQuantity ?? null
                      const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity
                      const ageEligible = isChildAddOnEligible(child, sheetAddon)

                      return (
                        <div
                          key={child.id}
                          className="py-3 flex items-center justify-between gap-3"
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
                          <div className="flex items-center gap-3">
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              isDisabled={qty <= 0}
                              onPress={() =>
                                setSheetDraft(prev => {
                                  if (prev?.mode !== 'per_child_qty') return prev
                                  const map = new Map(
                                    (prev.childQuantities ?? []).map(item => [
                                      item.childId,
                                      item.quantity ?? 0,
                                    ])
                                  )
                                  map.set(child.id, Math.max(0, qty - 1))
                                  return {
                                    ...prev,
                                    childQuantities: selectedChildren.map(item => ({
                                      childId: item.id,
                                      quantity: map.get(item.id) ?? 0,
                                    })),
                                  }
                                })
                              }
                            >
                              <Minus size={16} />
                            </Button>
                            <span className="w-6 text-center font-semibold text-gray-900">
                              {qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              color="secondary"
                              isDisabled={atMax || !ageEligible}
                              onPress={() =>
                                setSheetDraft(prev => {
                                  if (prev?.mode !== 'per_child_qty') return prev
                                  const map = new Map(
                                    (prev.childQuantities ?? []).map(item => [
                                      item.childId,
                                      item.quantity ?? 0,
                                    ])
                                  )
                                  map.set(child.id, qty + 1)
                                  return {
                                    ...prev,
                                    childQuantities: selectedChildren.map(item => ({
                                      childId: item.id,
                                      quantity: map.get(item.id) ?? 0,
                                    })),
                                  }
                                })
                              }
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  (() => {
                    const qty = sheetDraft.quantity ?? 0
                    const maxQuantity = sheetAddon.maxQuantity ?? null
                    const atMax = typeof maxQuantity === 'number' && qty >= maxQuantity
                    const noun = getAddOnUnitNoun(sheetAddon)
                    const unitLabel = `${noun}${noun.endsWith('s') ? '' : 's'}`
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-700">Number of {unitLabel}</p>
                          <div className="flex items-center gap-3">
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              isDisabled={qty <= 0}
                              onPress={() =>
                                setSheetDraft(prev =>
                                  prev?.mode === 'qty'
                                    ? { ...prev, quantity: Math.max(0, qty - 1) }
                                    : prev
                                )
                              }
                            >
                              -
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold text-gray-900">
                              {qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              radius="full"
                              color="secondary"
                              isDisabled={atMax}
                              onPress={() =>
                                setSheetDraft(prev =>
                                  prev?.mode === 'qty' ? { ...prev, quantity: qty + 1 } : prev
                                )
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-[15px] font-bold text-gray-900">
                  <span>Total</span>
                  <span className="whitespace-nowrap">
                    +{formatCurrency(sheetAddon.price * getSelectionQuantity(sheetDraft), currency)}
                  </span>
                </div>
              </DrawerBody>
              <div className="border-t border-gray-200 bg-white px-4 py-3">
                <Button
                  color="secondary"
                  radius="sm"
                  className="w-full"
                  onPress={submitAddonConfigurator}
                >
                  {getSelectionQuantity(sheetDraft) > 0
                    ? `Add · ${formatCurrency(sheetAddon.price * getSelectionQuantity(sheetDraft), currency)}`
                    : 'Done'}
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </>
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
            ? 'No thanks'
            : `Add ${extrasSelectedTypes} extra${extrasSelectedTypes === 1 ? '' : 's'} · ${formatCurrency(extrasTotal, currency)}`}
        </Button>
      </div>
    </section>
  )
}

interface ReviewStepProps {
  stripeSectionRef: React.RefObject<StripePaymentSectionHandle | null>
  paymentPending: boolean
  setPaymentPending: (pending: boolean) => void
  paymentError: string | null
  setPaymentError: (error: string | null) => void
  onRequestSubmit: () => void
}

function ReviewStep({
  stripeSectionRef,
  paymentPending,
  setPaymentPending,
  paymentError,
  setPaymentError,
  onRequestSubmit,
}: ReviewStepProps) {
  const router = useRouter()
  const resetForNewBooking = useCampBookingStore(state => state.resetForNewBooking)
  const hasSubmitted = useCampBookingStore(state => state.hasSubmitted)
  const paymentConfirmed = useCampBookingStore(state => state.paymentConfirmed)
  const setStep = useCampBookingStore(state => state.setStep)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)
  const specialRequest = useCampBookingStore(state => state.specialRequest)
  const setSpecialRequest = useCampBookingStore(state => state.setSpecialRequest)
  const camp = useCampBookingStore(state => state.camp)
  const ratings = useBookingRatings()
  const [isCampRulesOpen, setIsCampRulesOpen] = useState(false)
  const [isCancellationOpen, setIsCancellationOpen] = useState(false)
  const [isBookingTermsOpen, setIsBookingTermsOpen] = useState(false)

  const session = useMemo(
    () => sessions.find(item => item.id === selectedSessionId),
    [sessions, selectedSessionId]
  )
  const selectedChildren = useMemo(
    () => children.filter(child => selectedChildIds.includes(child.id)),
    [children, selectedChildIds]
  )
  const selectedAddOns = useMemo(
    () => addOns.filter(addOn => !!addOnSelectionsById[addOn.addOnId]),
    [addOns, addOnSelectionsById]
  )

  const currency = useCampBookingStore(state => getCampCurrency(state.camp, 'camp-booking-flow'))
  // Stable lowercase reference for Stripe Elements `currency` option. The
  // <Elements> options object is memoized inside StripePaymentSection on
  // (currency, amount, isSetupOnly); a fresh string from .toLowerCase() each
  // render would defeat that memoization and risk an Elements remount mid-flow.
  const stripeCurrency = useMemo(() => currency.toLowerCase(), [currency])

  const addOnTotal = useMemo(
    () =>
      selectedAddOns.reduce((acc, addOn) => {
        const sel = addOnSelectionsById[addOn.addOnId]
        if (!sel) return acc
        if (sel.mode === 'per_child') return acc + addOn.price * (sel.childIds?.length ?? 0)
        if (sel.mode === 'per_child_qty') {
          const qty = (sel.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
          return acc + addOn.price * qty
        }
        return acc + addOn.price * (sel.quantity ?? 0)
      }, 0),
    [selectedAddOns, addOnSelectionsById]
  )
  const childrenSubtotal = useMemo(
    () =>
      getSelectedChildrenSubtotal({
        session,
        camp,
        children,
        selectedChildIds,
      }),
    [session, camp, children, selectedChildIds]
  )
  const total = useMemo(() => childrenSubtotal + addOnTotal, [childrenSubtotal, addOnTotal])

  const campFeeBreakdown = useMemo(
    () =>
      getSelectedChildrenPriceBreakdown({
        session,
        camp,
        children,
        selectedChildIds,
      }),
    [session, camp, children, selectedChildIds]
  )

  const extrasPriceRows = useMemo(() => {
    return Object.values(addOnSelectionsById)
      .map(selection => {
        const addon = addOns.find(a => a.addOnId === selection.addOnId)
        if (!addon) return null
        let qty = 0
        if (selection.mode === 'per_child') qty = selection.childIds?.length ?? 0
        else if (selection.mode === 'per_child_qty') {
          qty = (selection.childQuantities ?? []).reduce(
            (sum, item) => sum + (item.quantity ?? 0),
            0
          )
        } else qty = selection.quantity ?? 0
        if (qty <= 0) return null
        return {
          key: addon.addOnId,
          label: qty > 1 ? `${addon.name} × ${qty}` : addon.name,
          total: addon.price * qty,
        }
      })
      .filter(Boolean) as Array<{ key: string; label: string; total: number }>
  }, [addOnSelectionsById, addOns])

  const campPhotoUrl = useMemo(() => {
    const photos = camp?.photos ?? []
    const primary = photos.find(p => p.isPrimary)
    const chosen = primary ?? photos[0]
    return chosen?.url ?? chosen?.thumbnail ?? null
  }, [camp])
  const selectedChildrenLabel = selectedChildren
    .map(child => {
      const age = getChildAge(child)
      return `${child.firstName}${age !== null ? ` (${age})` : ''}`
    })
    .join(', ')
  const selectedAddOnsLabel = selectedAddOns
    .map(addOn => {
      const sel = addOnSelectionsById[addOn.addOnId]
      if (!sel) return null
      const qty =
        sel.mode === 'per_child'
          ? (sel.childIds?.length ?? 0)
          : sel.mode === 'per_child_qty'
            ? (sel.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
            : (sel.quantity ?? 0)
      if (qty <= 0) return null
      return qty > 1 ? `${addOn.name} x ${qty}` : addOn.name
    })
    .filter(Boolean)
    .join(', ')
  const sessionRangeLabel = useMemo(() => {
    if (!session) return ''
    const start = new Date(session.startDate)
    const end = new Date(session.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return session.name
    const dayDiff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    const weeks = Math.max(1, Math.round(dayDiff / 7))
    const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endFmt = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${startFmt} - ${endFmt} · ${weeks} week${weeks === 1 ? '' : 's'}`
  }, [session])

  // After successful Stripe confirmation, the store flips both `hasSubmitted`
  // and `paymentConfirmed` to true. Wait until BOTH are true before redirecting
  // — `hasSubmitted` alone is set by the legacy submit-without-payment flow
  // (deprecated after Phase 2 but kept for backwards-safety in tests).
  useEffect(() => {
    if (hasSubmitted && paymentConfirmed) {
      const handle = window.setTimeout(() => {
        resetForNewBooking()
        router.push('/bookings?submitted=1')
      }, 1500)
      return () => window.clearTimeout(handle)
    }
  }, [hasSubmitted, paymentConfirmed, resetForNewBooking, router])

  // Compute the client-side preview of what we're about to charge today. The
  // backend recomputes authoritatively at submit; this is purely UI state for
  // the Stripe Elements `mode`/`amount` props and the "you'll pay X today" copy.
  const sessionStartDateForPlan = useMemo(() => {
    if (!session) return null
    const parsed = new Date(session.startDate)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [session])
  const paymentPlan = useMemo(() => {
    if (!sessionStartDateForPlan || !total) return null
    return computePaymentPlan({
      total,
      sessionStartDate: sessionStartDateForPlan,
      // Deposit settings are the provider's (single source of truth). The
      // backend re-validates at submit so this is preview-only; we just need
      // the same shape.
      depositSettings: camp?.provider?.settings
        ? {
            depositRequired: camp.provider.settings.depositRequired,
            depositType: camp.provider.settings.depositType,
            depositPercentage: camp.provider.settings.depositPercentage,
            depositFixedAmount: camp.provider.settings.depositFixedAmount,
          }
        : null,
    })
  }, [total, sessionStartDateForPlan, camp])

  return (
    <>
      <section className="space-y-6">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Step 4 of 4</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Review and pay</h1>
          <p className="mt-2 text-sm text-gray-500">Check your booking details before confirming</p>
        </div>

        <div className="lg:hidden">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Review and pay</h2>
        </div>

        <div className="lg:hidden">
          <div className="flex gap-3 border-b border-gray-200 pb-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {campPhotoUrl ? (
                <img
                  src={campPhotoUrl}
                  alt={camp?.name ?? 'Camp'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">
                {camp?.name ?? 'Selected camp'}
              </p>
              <SidebarRatingsRow {...ratings} />
            </div>
          </div>
          <div className="py-3 border-b border-gray-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Session</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {sessionRangeLabel || session?.name || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('sessions')}
              className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Change
            </button>
          </div>
          <div className="py-3 border-b border-gray-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Children</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {selectedChildrenLabel || 'None selected'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('children')}
              className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Change
            </button>
          </div>
          {addOns.length > 0 && (
            <div className="pt-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Add-ons</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {selectedAddOnsLabel || 'No add-ons selected'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('addons')}
                className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Change
              </button>
            </div>
          )}
        </div>

        <div className="lg:hidden space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Price details</h3>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Camp fee
            </p>
            {campFeeBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">—</p>
            ) : (
              <div className="space-y-2">
                {campFeeBreakdown.map((row, idx) => (
                  <div
                    key={`${row.unitPrice}-${idx}`}
                    className="flex items-center justify-between gap-3 text-sm text-gray-900"
                  >
                    <span className="min-w-0">
                      {formatCurrency(row.unitPrice, currency)} × {row.count} child
                      {row.count === 1 ? '' : 'ren'}
                    </span>
                    <span className="shrink-0">{formatCurrency(row.lineTotal, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {extrasPriceRows.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Extras
              </p>
              <div className="space-y-2">
                {extrasPriceRows.map(row => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 text-sm text-gray-900"
                  >
                    <span className="min-w-0">{row.label}</span>
                    <span className="shrink-0">{formatCurrency(row.total, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="h-px bg-gray-200" />
          <div className="flex items-center justify-between text-base font-semibold text-gray-900">
            <span>Total due</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            The camp has{' '}
            <span className="font-semibold text-gray-700">
              {PROVIDER_RESPONSE_WINDOW_HOURS} hours
            </span>{' '}
            to confirm your booking. You will be charged after the request is accepted.
          </p>
        </div>

        {/*
          Render order matters for Stripe.js: the <StripePaymentSection> must
          mount once and stay mounted across re-renders. We render the success
          panel and the form as PEERS (both always in the DOM when paymentPlan
          is available) and let StripePaymentSection's internal hasSubmitted &&
          paymentConfirmed check hide the form. Wrapping the form in a
          conditional that swaps it for the success panel would unmount/remount
          the <Elements> subtree mid-flow and drop the form data queued by
          `elements.submit()`, which prevents `confirmPayment` from reaching
          Stripe.
        */}
        {hasSubmitted && paymentConfirmed ? (
          <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <p className="font-semibold">Booking request submitted</p>
            <p className="mt-1 text-xs">
              {paymentPlan?.kind === 'setup'
                ? 'Your card is saved on file. You will be charged when payment is due.'
                : 'Your card is authorized. You will be charged when the camp accepts your booking.'}
            </p>
          </div>
        ) : null}
        {paymentPlan && camp?.provider?.stripeAccountId ? (
          <div
            id="stripe-payment-form"
            className={
              hasSubmitted && paymentConfirmed ? 'pointer-events-none hidden' : 'space-y-3'
            }
            aria-hidden={hasSubmitted && paymentConfirmed}
          >
            <div className="rounded-xl border border-default-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
                {paymentPlan.kind === 'setup' ? 'Save card for later' : 'Pay today'}
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span className="text-sm text-default-500">
                  {paymentPlan.kind === 'deposit'
                    ? 'Non-refundable deposit'
                    : paymentPlan.kind === 'full'
                      ? 'Full program fee'
                      : 'No charge today'}
                </span>
                {paymentPlan.kind === 'setup' ? (
                  <span className="text-base font-semibold text-foreground">
                    {formatCurrency(paymentPlan.futureBalanceAmount, currency)} later
                  </span>
                ) : (
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(paymentPlan.chargeAmount, currency)}
                  </span>
                )}
              </div>
              {paymentPlan.kind === 'deposit' ? (
                <p className="mt-2 text-xs text-default-500">
                  The remaining balance of{' '}
                  <span className="font-semibold">
                    {formatCurrency(paymentPlan.futureBalanceAmount, currency)}
                  </span>{' '}
                  will be charged automatically before the camp starts.
                </p>
              ) : null}
              {paymentPlan.kind === 'setup' ? (
                <p className="mt-2 text-xs text-default-500">
                  Your card is saved now and the full amount is charged automatically about 90 days
                  before the camp starts.
                </p>
              ) : null}
            </div>
            <StripePaymentSection
              ref={stripeSectionRef}
              amountMajor={paymentPlan.chargeAmount}
              currency={stripeCurrency}
              isSetupOnly={paymentPlan.kind === 'setup'}
              stripeAccountId={camp.provider.stripeAccountId}
              onPendingChange={setPaymentPending}
              onError={setPaymentError}
            />
          </div>
        ) : !(hasSubmitted && paymentConfirmed) ? (
          <p className="text-sm text-default-500">Loading payment options…</p>
        ) : null}

        <div className="pt-5 border-t border-gray-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-gray-900">Message to camp</h3>
          </div>
          <Textarea
            minRows={5}
            maxLength={1000}
            placeholder="Introduce your children, mention any special requests (allergies, dietary needs, medical conditions, arrival details)..."
            value={specialRequest}
            onValueChange={setSpecialRequest}
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {specialRequest?.length ?? 0}/1000
          </p>
        </div>

        <p className="mt-3 hidden text-sm text-gray-500 lg:block">
          The camp has{' '}
          <span className="font-semibold text-gray-700">
            {PROVIDER_RESPONSE_WINDOW_HOURS} hours
          </span>{' '}
          to confirm your booking. You will be charged after the request is accepted.
        </p>

        <div className="hidden lg:block rounded-xl bg-gray-50 p-3 text-center text-xs leading-5 text-gray-500">
          By clicking the button to request to book, you agree to the{' '}
          <button
            type="button"
            onClick={() => setIsCampRulesOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Camp Rules
          </button>
          ,{' '}
          <button
            type="button"
            onClick={() => setIsCancellationOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Cancellation Policy
          </button>
          , and{' '}
          <button
            type="button"
            onClick={() => setIsBookingTermsOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Booking Terms
          </button>
          .
        </div>

        <div className="lg:hidden rounded-xl bg-gray-50 px-4 py-3 text-center text-xs leading-5 text-gray-500">
          By clicking the button to request to book, you agree to the{' '}
          <button
            type="button"
            onClick={() => setIsCampRulesOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Camp Rules
          </button>
          ,{' '}
          <button
            type="button"
            onClick={() => setIsCancellationOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Cancellation Policy
          </button>
          , and{' '}
          <button
            type="button"
            onClick={() => setIsBookingTermsOpen(true)}
            className="cursor-pointer underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            Booking Terms
          </button>
          .
        </div>

        {paymentPlan && camp?.provider?.stripeAccountId && !(hasSubmitted && paymentConfirmed) ? (
          <div className="space-y-3">
            {paymentError ? (
              <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {paymentError}
              </div>
            ) : null}
            <div className="hidden lg:block">
              <Button
                color="primary"
                className="w-full"
                isDisabled={paymentPending}
                isLoading={paymentPending}
                onPress={onRequestSubmit}
              >
                {paymentPlan.kind === 'setup'
                  ? 'Save card and submit request'
                  : 'Authorize and submit request'}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <CampRulesModal isOpen={isCampRulesOpen} onOpenChange={setIsCampRulesOpen} />

      <CancellationPolicyModal
        isOpen={isCancellationOpen}
        onOpenChange={setIsCancellationOpen}
        cancellationPolicy={camp?.provider?.settings?.cancellationPolicy}
        cancellationPolicyCustom={camp?.provider?.settings?.cancellationPolicyCustom}
        sessionStartDate={session?.startDate}
        bookingTotal={total}
        currency={currency}
      />

      <BookingTermsModal isOpen={isBookingTermsOpen} onOpenChange={setIsBookingTermsOpen} />
    </>
  )
}

export function CampBookingFlow() {
  const router = useRouter()
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
  const currency = useCampBookingStore(state => getCampCurrency(state.camp, 'camp-booking-flow'))

  // Lifted up so MobileBookingFooter (sibling to ReviewStep) can drive the
  // Stripe submit on review-and-pay — the inner <Elements> form must stay
  // mounted under ReviewStep, but the imperative `submit()` handle is
  // reachable from any component that holds this ref.
  const stripeSectionRef = useRef<StripePaymentSectionHandle>(null)
  const [paymentPending, setPaymentPending] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  // Final confirmation gate before the booking request is submitted. Both the
  // desktop button and the mobile footer open this modal; the actual Stripe
  // submit only fires once the parent confirms.
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false)

  // The mobile footer renders into a layout-level slot (see book/layout.tsx)
  // so it sits as a flex sibling of the scroll area, not overlaying it via
  // position:fixed. That way the scroll area is strictly bounded between the
  // sticky header and the footer — content can't slide above/behind either.
  // Resolve the slot post-mount to stay SSR-safe.
  const [mobileFooterSlot, setMobileFooterSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setMobileFooterSlot(document.getElementById('mobile-footer-slot'))
  }, [])

  const onSelectDraftPreview = async (bookingGroupId: string) => {
    clearDuplicateDraftConflict()
    await hydrateFromBookingGroupId(bookingGroupId)
  }

  const onCreateNewDraft = async () => {
    clearDuplicateDraftConflict()
    await createDraftBookingGroup({ forceNew: true })
  }

  const onSeeDraftBookings = () => {
    clearDuplicateDraftConflict()
    router.push('/bookings?tab=drafts')
  }

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
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
                  {currentStep === 'review-and-pay' && (
                    <ReviewStep
                      stripeSectionRef={stripeSectionRef}
                      paymentPending={paymentPending}
                      setPaymentPending={setPaymentPending}
                      paymentError={paymentError}
                      setPaymentError={setPaymentError}
                      onRequestSubmit={() => setIsConfirmSubmitOpen(true)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-4">
            {currentStep === 'sessions' ? <DesktopSessionsSidebar /> : null}
            {currentStep === 'children' ? <DesktopChildrenSidebar /> : null}
            {currentStep === 'addons' ? <DesktopAddonsSidebar /> : null}
            {currentStep === 'review-and-pay' ? <DesktopReviewSidebar /> : null}
          </div>
        </div>
      </main>
      {mobileFooterSlot
        ? createPortal(
            <MobileBookingFooter
              paymentPending={paymentPending}
              onSubmitPayment={() => setIsConfirmSubmitOpen(true)}
            />,
            mobileFooterSlot
          )
        : null}
      <BookingConfirmModal
        isOpen={isConfirmSubmitOpen}
        isSubmitting={paymentPending}
        onClose={() => setIsConfirmSubmitOpen(false)}
        onConfirm={() => {
          setIsConfirmSubmitOpen(false)
          void stripeSectionRef.current?.submit()
        }}
      />
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
        onClose={clearDuplicateDraftConflict}
      />
    </div>
  )
}
