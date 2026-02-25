'use client'

import { useState } from 'react'
import { Button, Checkbox, Tooltip } from '@heroui/react'
import { getLocalTimeZone, today } from '@internationalized/date'
import { Info, X } from 'lucide-react'
import { DatePicker, Input, SelectField, useConfirmDialog } from '@world-schools/ui-web'
import type { AddSessionDiscountDto, GlobalDiscount } from '@/types/discounts'
import type { Camp } from '@/types/camps'
import {
  addSessionDiscount,
  applyGlobalDiscountToSession,
  removeGlobalDiscountFromSession,
  removeSessionDiscount,
} from '@/services/sessions.service'
import { useSessionsStore } from '@/stores/sessions-store'

interface SessionDiscountsSectionProps {
  sessionId: string
  camp: Camp
  globalDiscounts: GlobalDiscount[]
}

export function SessionDiscountsSection({
  sessionId,
  camp,
  globalDiscounts,
}: SessionDiscountsSectionProps) {
  const { confirm } = useConfirmDialog()
  const session = useSessionsStore(state => state.getSessionById(sessionId))
  const reload = useSessionsStore(state => state.reload)
  const [showManualForm, setShowManualForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    validUntil: null as any,
    ageGroups: [] as string[],
  })
  const [formErrors, setFormErrors] = useState({
    name: '',
    value: '',
    validUntil: '',
  })

  if (!session) {
    return null
  }

  const discounts = session.discounts ?? {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Filter only enabled global discounts
  const enabledGlobalDiscounts = globalDiscounts.filter(gd => gd.isEnabled && gd.entries.length)

  // Determine which global discounts are applied
  // A discount is applied if it's in globalApplied OR (enabled and NOT in globalRemoved)
  const appliedGlobalDiscounts = enabledGlobalDiscounts.filter(gd => {
    if (!discounts.globalApplied || discounts.globalRemoved.includes(gd.id)) return false
    // If explicitly applied, it's applied
    if (discounts.globalApplied.includes(gd.id)) return true

    return false
  })

  // Check if a discount is currently applied (for checkbox state)
  const isDiscountApplied = (discountId: string) => {
    // If explicitly removed, it's not applied
    if (!discounts.globalApplied || discounts.globalRemoved.includes(discountId)) return false
    // If explicitly applied, it's applied
    if (discounts.globalApplied.includes(discountId)) return true
    // Otherwise, enabled discounts are applied by default
    return false
  }

  // Check if age group selector should be shown
  const showAgeGroupSelector =
    camp.ageGroups && camp.ageGroups.length >= 2 && session.pricingType === 'age_group'

  const handleRemoveSessionDiscount = async (discountId: string) => {
    const confirmed = await confirm({
      title: 'Remove Session-Specific Discount',
      message:
        'Are you sure you want to remove this session-specific discount? This action cannot be undone.',
      confirmText: 'Yes, remove',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    await removeSessionDiscount(camp.id, session.id, discountId)
    await reload()
  }

  const handleRemoveGlobalDiscount = async (globalDiscountId: string) => {
    const confirmed = await confirm({
      title: 'Remove Discount',
      message: 'Are you sure you want to remove this discount from the session?',
      confirmText: 'Yes, remove',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    await removeGlobalDiscountFromSession(camp.id, session.id, { globalDiscountId })
    await reload()
  }

  const handleToggleGlobalDiscount = async (globalDiscountId: string) => {
    const isCurrentlyApplied = isDiscountApplied(globalDiscountId)

    // Show confirmation dialog
    const confirmed = await confirm({
      title: isCurrentlyApplied ? 'Remove Discount' : 'Apply Discount',
      message: isCurrentlyApplied
        ? 'Are you sure you want to remove this discount from the session?'
        : 'Are you sure you want to apply this discount to the session?',
      confirmText: isCurrentlyApplied ? 'Yes, remove' : 'Yes, apply',
      cancelText: 'Cancel',
      variant: isCurrentlyApplied ? 'danger' : 'warning',
    })

    if (!confirmed) return

    if (isCurrentlyApplied) {
      // Remove the discount
      await removeGlobalDiscountFromSession(camp.id, session.id, { globalDiscountId })
    } else {
      // Apply the discount
      await applyGlobalDiscountToSession(camp.id, session.id, { globalDiscountId })
    }

    await reload()
  }

  const validateForm = (): boolean => {
    const errors = {
      name: '',
      value: '',
      validUntil: '',
    }
    let isValid = true

    // Validate name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Discount name is required'
      isValid = false
    } else if (formData.name.length > 30) {
      errors.name = 'Discount name cannot exceed 30 characters'
      isValid = false
    }

    // Validate value
    if (!formData.value || formData.value.trim() === '') {
      errors.value = 'Discount value is required'
      isValid = false
    } else {
      const numValue = parseFloat(formData.value)
      if (isNaN(numValue) || numValue <= 0) {
        errors.value = 'Discount value must be a positive number'
        isValid = false
      } else if (formData.type === 'percent' && (numValue < 0 || numValue > 100)) {
        errors.value = 'Percentage discount must be between 0 and 100'
        isValid = false
      }
    }

    // Validate validUntil (if provided)
    if (formData.validUntil) {
      const selectedDate = formData.validUntil
      const todayDate = today(getLocalTimeZone())
      if (selectedDate.compare(todayDate) < 0) {
        errors.validUntil = 'Valid until date must be in the future'
        isValid = false
      }
    }

    setFormErrors(errors)
    return isValid
  }

  const handleAddManualDiscount = async () => {
    // Validate form first
    if (!validateForm()) {
      return
    }

    // Show confirmation dialog
    const confirmed = await confirm({
      title: 'Add Session-Specific Discount',
      message: 'Are you sure you want to add this session-specific discount?',
      confirmText: 'Add Discount',
      cancelText: 'Cancel',
      variant: 'info',
    })

    if (!confirmed) return

    // Prepare data for API
    const data: AddSessionDiscountDto = {
      name: formData.name.trim(),
      type: formData.type,
      value: parseFloat(formData.value),
      validUntil: formData.validUntil ? formData.validUntil.toString() : null,
      ageGroups: formData.ageGroups.length > 0 ? formData.ageGroups : [],
    }

    await addSessionDiscount(camp.id, session.id, data)

    // Reset form
    setFormData({
      name: '',
      type: 'percent',
      value: '',
      validUntil: null,
      ageGroups: [],
    })
    setFormErrors({
      name: '',
      value: '',
      validUntil: '',
    })
    setShowManualForm(false)
    await reload()
  }

  const formatDiscountValue = (type: string, value: number) => {
    return type === 'percent' ? `-${value}%` : `-${camp.currency ?? 'USD'}${value}`
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      early_bird: 'Early Bird',
      sibling: 'Sibling Discount',
      returning_camper: 'Returning Camper',
      multi_week: 'Multi-Week Booking',
      group_booking: 'Group Booking',
      promo_code: 'Promo Code',
    }
    return labels[category] || category
  }

  const getDiscountDetails = (gd: GlobalDiscount) => {
    const firstEntry = gd.entries[0]
    if (!firstEntry) return ''

    const parts: string[] = []

    // Add category-specific details
    if (gd.category === 'early_bird' && firstEntry.validUntil) {
      parts.push(`Book 60+ days in advance`)
      const date = new Date(firstEntry.validUntil)
      parts.push(
        `Valid until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      )
    } else if (gd.category === 'sibling') {
      parts.push('2+ children from same family')
    } else if (gd.category === 'returning_camper') {
      parts.push('For returning campers')
    } else if (gd.category === 'multi_week' && firstEntry.config?.minimumWeeks) {
      parts.push(`${firstEntry.config.minimumWeeks}+ weeks`)
    } else if (gd.category === 'group_booking' && firstEntry.config?.minimumChildren) {
      parts.push(`${firstEntry.config.minimumChildren}+ children`)
    } else if (gd.category === 'promo_code' && firstEntry.config?.code) {
      parts.push(`Code: ${firstEntry.config.code}`)
    }

    return parts.join(' • ')
  }

  const formatSessionDiscountDetails = (sd: any) => {
    const parts: string[] = ['Manual discount']

    if (sd.ageGroups && sd.ageGroups.length > 0) {
      parts.push(`Ages ${sd.ageGroups.join(', ')}`)
    }

    if (sd.validUntil) {
      const date = new Date(sd.validUntil)
      parts.push(
        `Valid until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      )
    }

    return parts.join(' • ')
  }

  return (
    <div className="space-y-6">
      {/* Global Discount Rules Applied */}
      {!!enabledGlobalDiscounts.length && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm font-medium text-default-900">
              Global discount rules applied
            </label>
            <Tooltip content="Camp-wide discounts automatically applied to all sessions">
              <Info size={16} className="text-default-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="flex gap-3 my-4">
            {enabledGlobalDiscounts.map(gd => {
              const firstEntry = gd.entries[0]

              const isChecked = isDiscountApplied(gd.id)

              return (
                <Checkbox
                  key={gd.id}
                  size="sm"
                  isSelected={isChecked}
                  onValueChange={() => handleToggleGlobalDiscount(gd.id)}
                >
                  {getCategoryLabel(gd.category)}
                </Checkbox>
              )
            })}
          </div>

          <div className="border border-default-200 rounded-lg">
            {appliedGlobalDiscounts.map((gd, index) => {
              const firstEntry = gd.entries[0]

              return (
                <div
                  key={gd.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index < appliedGlobalDiscounts.length - 1 ? 'border-b border-default-200' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-default-900 mb-0.5">
                      {getCategoryLabel(gd.category)}
                    </div>
                    <div className="text-xs text-default-500">{getDiscountDetails(gd)}</div>
                  </div>
                  <div className="text-base font-bold text-success mr-3">
                    {firstEntry.value &&
                      formatDiscountValue(
                        firstEntry.calculationType || 'percent',
                        firstEntry.value
                      )}
                  </div>
                  <Button
                    onPress={() => handleRemoveGlobalDiscount(gd.id)}
                    variant="bordered"
                    color="danger"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual Discount Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm font-medium text-default-900">Manual discount</label>
          <Tooltip content="Create a custom discount for this specific session">
            <Info size={16} className="text-default-400 cursor-help" />
          </Tooltip>
        </div>

        {/* Session-Specific Discounts List */}
        {discounts.sessionSpecific.length > 0 && (
          <div className="border border-default-200 rounded-lg mb-3">
            {discounts.sessionSpecific.map((sd, index) => (
              <div
                key={sd.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  index < discounts.sessionSpecific.length - 1 ? 'border-b border-default-200' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-default-900 mb-0.5">{sd.name}</div>
                  <div className="text-xs text-default-500">{formatSessionDiscountDetails(sd)}</div>
                </div>
                <div className="text-base font-bold text-success mr-3">
                  {formatDiscountValue(sd.type, sd.value)}
                </div>
                <Button
                  onPress={() => handleRemoveSessionDiscount(sd.id)}
                  variant="bordered"
                  color="danger"
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Manual Discount Form */}
        {showManualForm && (
          <div className="flex flex-col gap-2 border border-default-200 rounded-lg p-4 mb-3">
            {/* Discount Name */}
            <div>
              <Input
                label={
                  <div className="flex items-center gap-2">
                    <span>Discount name</span>
                    <span className="text-danger">*</span>
                    <Tooltip content="Name shown to parents on camp profile">
                      <Info size={14} className="text-default-400 cursor-help" />
                    </Tooltip>
                  </div>
                }
                labelPlacement="outside"
                placeholder="Last minute deal"
                maxLength={30}
                value={formData.name}
                onValueChange={value => {
                  setFormData({ ...formData, name: value })
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: '' })
                  }
                }}
                isInvalid={!!formErrors.name}
                errorMessage={formErrors.name}
                description="Max 30 characters (shown on camp profile)"
                classNames={{
                  inputWrapper: 'rounded-lg bg-white border border-gray-200 hover:border-gray-300',
                }}
              />
            </div>

            {/* Discount Type */}
            <div>
              <SelectField
                label={
                  <div className="flex items-center gap-2">
                    <span>Discount type</span>
                    <span className="text-danger">*</span>
                    <Tooltip content="Choose percentage off or fixed amount off">
                      <Info size={14} className="text-default-400 cursor-help" />
                    </Tooltip>
                  </div>
                }
                value={formData.type}
                onChange={value => setFormData({ ...formData, type: value as 'percent' | 'fixed' })}
                options={['percent', 'fixed']}
                placeholder="Select discount type"
              />
            </div>

            {/* Discount Value */}
            <div>
              <Input
                label={
                  <div className="flex items-center gap-2">
                    <span>Discount value</span>
                    <span className="text-danger">*</span>
                    <Tooltip content="Amount to discount (number only)">
                      <Info size={14} className="text-default-400 cursor-help" />
                    </Tooltip>
                  </div>
                }
                labelPlacement="outside"
                type="number"
                placeholder="10"
                value={formData.value}
                onValueChange={value => {
                  setFormData({ ...formData, value })
                  if (formErrors.value) {
                    setFormErrors({ ...formErrors, value: '' })
                  }
                }}
                isInvalid={!!formErrors.value}
                errorMessage={formErrors.value}
                description={
                  formData.type === 'percent'
                    ? 'Enter a percentage between 0 and 100'
                    : 'Enter a fixed amount'
                }
                classNames={{
                  inputWrapper: 'rounded-lg bg-white border border-gray-200 hover:border-gray-300',
                }}
              />
            </div>

            {/* Valid Until */}
            <div>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <DatePicker
                    label={
                      <div className="flex items-center gap-2">
                        <span>Valid until</span>
                        <Tooltip content="Optional expiry date for this discount">
                          <Info size={14} className="text-default-400 cursor-help" />
                        </Tooltip>
                      </div>
                    }
                    labelPlacement="outside"
                    value={formData.validUntil}
                    onChange={value => {
                      setFormData({ ...formData, validUntil: value })
                      if (formErrors.validUntil) {
                        setFormErrors({ ...formErrors, validUntil: '' })
                      }
                    }}
                    minValue={today(getLocalTimeZone())}
                    isInvalid={!!formErrors.validUntil}
                    errorMessage={formErrors.validUntil}
                    description="Optional expiry date for this discount"
                  />
                </div>
                {formData.validUntil && (
                  <Tooltip content="Clear date">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="mt-7"
                      onPress={() => {
                        setFormData({ ...formData, validUntil: null })
                        if (formErrors.validUntil) {
                          setFormErrors({ ...formErrors, validUntil: '' })
                        }
                      }}
                    >
                      <X size={16} />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Age Group Selector (Conditional) */}
            {showAgeGroupSelector && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium text-default-900">Apply discount to</label>
                  <Tooltip content="Leave unchecked to apply to all ages, or select specific age groups">
                    <Info size={14} className="text-default-400 cursor-help" />
                  </Tooltip>
                </div>
                <div className="space-y-2">
                  {camp.ageGroups?.map((ageGroup, index) => {
                    const ageGroupKey = `${ageGroup.min}-${ageGroup.max}`
                    return (
                      <label
                        key={index}
                        className="flex items-center gap-3 px-3 py-2.5 border border-default-200 rounded-lg cursor-pointer hover:border-default-300 hover:bg-default-50 transition-all"
                      >
                        <input
                          type="checkbox"
                          className="w-4.5 h-4.5 cursor-pointer accent-primary"
                          checked={formData.ageGroups.includes(ageGroupKey)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                ageGroups: [...formData.ageGroups, ageGroupKey],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                ageGroups: formData.ageGroups.filter(id => id !== ageGroupKey),
                              })
                            }
                          }}
                        />
                        <span className="text-sm font-medium text-default-900 flex-1">
                          Ages {ageGroup.min}-{ageGroup.max}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button onPress={() => setShowManualForm(false)} variant="bordered">
                Cancel
              </Button>
              <Button onPress={handleAddManualDiscount} color="secondary">
                Add discount
              </Button>
            </div>
          </div>
        )}

        {/* Add Manual Discount Button (Dashed) */}
        {!showManualForm && (
          <Button
            onPress={() => setShowManualForm(true)}
            variant="bordered"
            className="border-dashed w-full"
          >
            + Add manual discount
          </Button>
        )}
      </div>
    </div>
  )
}
