'use client'

import { useState } from 'react'
import { Button, Checkbox, Tooltip } from '@heroui/react'
import { getLocalTimeZone, today } from '@internationalized/date'
import { Info, X } from 'lucide-react'
import { DatePicker, Input, SelectField, useConfirmDialog } from '@world-schools/ui-web'
import type { GlobalDiscount, SessionSpecificDiscount } from '@/types/discounts'
import type { Camp } from '@/types/camps'

interface SessionDiscountsCreationSectionProps {
  camp: Camp
  pricingType: string
  globalDiscounts: GlobalDiscount[]
  selectedGlobalDiscountIds: string[]
  onToggleGlobalDiscount: (discountId: string) => void
  sessionSpecificDiscounts: Omit<SessionSpecificDiscount, 'id'>[]
  onAddSessionDiscount: (discount: Omit<SessionSpecificDiscount, 'id'>) => void
  onRemoveSessionDiscount: (index: number) => void
}

export function SessionDiscountsCreationSection({
  camp,
  pricingType,
  globalDiscounts,
  selectedGlobalDiscountIds,
  onToggleGlobalDiscount,
  sessionSpecificDiscounts,
  onAddSessionDiscount,
  onRemoveSessionDiscount,
}: SessionDiscountsCreationSectionProps) {
  const { confirm } = useConfirmDialog()

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

  // Determine if age group selector should be shown
  const showAgeGroupSelector =
    camp.ageGroups && camp.ageGroups.length >= 2 && pricingType === 'age_group'

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

    // Prepare data
    const discount: Omit<SessionSpecificDiscount, 'id'> = {
      name: formData.name.trim(),
      type: formData.type,
      value: parseFloat(formData.value),
      validUntil: formData.validUntil ? formData.validUntil.toString() : null,
      ageGroups: formData.ageGroups.length > 0 ? formData.ageGroups : [],
    }

    onAddSessionDiscount(discount)

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
  }

  const handleRemoveManualDiscount = async (index: number) => {
    const confirmed = await confirm({
      title: 'Remove Session-Specific Discount',
      message:
        'Are you sure you want to remove this session-specific discount? This action cannot be undone.',
      confirmText: 'Yes, remove',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    onRemoveSessionDiscount(index)
  }

  const handleToggleGlobalDiscount = async (discountId: string) => {
    const isCurrentlyApplied = selectedGlobalDiscountIds.includes(discountId)
    const discount = globalDiscounts.find(d => d.id === discountId)

    const confirmed = await confirm({
      title: isCurrentlyApplied ? 'Remove Global Discount' : 'Apply Global Discount',
      message: isCurrentlyApplied
        ? `Are you sure you want to remove the "${discount?.category}" discount from this session?`
        : `Are you sure you want to apply the "${discount?.category}" discount to this session?`,
      confirmText: isCurrentlyApplied ? 'Yes, remove' : 'Yes, apply',
      cancelText: 'Cancel',
      variant: isCurrentlyApplied ? 'danger' : 'warning',
    })

    if (!confirmed) return

    onToggleGlobalDiscount(discountId)
  }

  const handleRemoveSelectedGlobalDiscount = async (discountId: string) => {
    const discount = globalDiscounts.find(d => d.id === discountId)

    const confirmed = await confirm({
      title: 'Remove Global Discount',
      message: `Are you sure you want to remove the "${getCategoryLabel(discount?.category || '')}" discount from this session?`,
      confirmText: 'Yes, remove',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    onToggleGlobalDiscount(discountId)
  }

  // Get enabled global discounts
  const enabledGlobalDiscounts = globalDiscounts.filter(d => d.isEnabled)

  // Get selected global discounts for display
  const selectedGlobalDiscounts = enabledGlobalDiscounts.filter(d =>
    selectedGlobalDiscountIds.includes(d.id)
  )

  // Helper functions for displaying discount information
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

  const formatDiscountValue = (type: string, value: number) => {
    return type === 'percent' ? `-${value}%` : `-${camp.currency ?? 'USD'}${value}`
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
      parts.push('Previous camper discount')
    } else if (gd.category === 'multi_week') {
      parts.push(`${gd.entries.length} tier${gd.entries.length > 1 ? 's' : ''}`)
    } else if (gd.category === 'group_booking') {
      parts.push(`${gd.entries.length} tier${gd.entries.length > 1 ? 's' : ''}`)
    } else if (gd.category === 'promo_code') {
      parts.push(`${gd.entries.length} code${gd.entries.length > 1 ? 's' : ''}`)
    }

    return parts.join(' • ')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Session Discounts</h3>
        <p className="text-sm text-default-500 mb-4">
          Select global discounts to apply to this session, or add session-specific discounts.
        </p>
      </div>

      {/* Global Discounts Section */}
      {enabledGlobalDiscounts.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-default-700">Global Discounts</h4>
          <div className="flex gap-3 my-4">
            {enabledGlobalDiscounts.map(discount => {
              const firstEntry = discount.entries[0]
              if (!firstEntry) return null
              const isApplied = selectedGlobalDiscountIds.includes(discount.id)
              return (
                <Checkbox
                  key={discount.id}
                  isSelected={isApplied}
                  onValueChange={() => handleToggleGlobalDiscount(discount.id)}
                >
                  <span className="font-medium capitalize">
                    {discount.category.replace(/_/g, ' ')}
                  </span>
                </Checkbox>
              )
            })}
          </div>

          {/* Selected Global Discounts List */}
          {selectedGlobalDiscounts.length > 0 && (
            <div className="border border-default-200 rounded-lg">
              {selectedGlobalDiscounts.map((gd, index) => {
                const firstEntry = gd.entries[0]
                if (!firstEntry) return null

                return (
                  <div
                    key={gd.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      index < selectedGlobalDiscounts.length - 1
                        ? 'border-b border-default-200'
                        : ''
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
                      onPress={() => handleRemoveSelectedGlobalDiscount(gd.id)}
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
          )}
        </div>
      )}

      {/* Session-Specific Discounts Section */}
      <div className="space-y-3">
        <h4 className="font-medium text-default-700">Session-Specific Discounts</h4>

        {/* Existing Session-Specific Discounts */}
        {sessionSpecificDiscounts.length > 0 && (
          <div className="space-y-2">
            {sessionSpecificDiscounts.map((discount, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-default-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{discount.name}</span>
                    <span className="text-xs text-default-500">
                      ({discount.type === 'percent' ? `${discount.value}%` : `$${discount.value}`})
                    </span>
                  </div>
                  {discount.validUntil && (
                    <p className="text-xs text-default-500 mt-1">
                      Valid until: {new Date(discount.validUntil).toLocaleDateString()}
                    </p>
                  )}
                  {discount.ageGroups && discount.ageGroups.length > 0 && (
                    <p className="text-xs text-default-500 mt-1">
                      Age groups: {discount.ageGroups.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => handleRemoveManualDiscount(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {!showManualForm && (
          <Button
            onPress={() => setShowManualForm(true)}
            variant="bordered"
            className="border-dashed w-full"
          >
            + Add manual discount
          </Button>
        )}

        {/* Manual Discount Form */}
        {showManualForm && (
          <div className="border border-default-200 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Add Manual Discount</h5>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => {
                  setShowManualForm(false)
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
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Name */}
            <Input
              label="Discount Name"
              labelPlacement="outside"
              placeholder="e.g., Special Offer"
              value={formData.name}
              onValueChange={value => {
                setFormData(prev => ({ ...prev, name: value }))
                if (formErrors.name) {
                  setFormErrors(prev => ({ ...prev, name: '' }))
                }
              }}
              isInvalid={!!formErrors.name}
              errorMessage={formErrors.name}
              description="Maximum 30 characters"
            />

            {/* Type */}
            <SelectField
              label="Discount Type"
              labelPlacement="outside"
              value={formData.type}
              onChange={value =>
                setFormData(prev => ({ ...prev, type: value as 'percent' | 'fixed' }))
              }
              options={['percent', 'fixed']}
              placeholder="Select discount type"
            />

            {/* Value */}
            <Input
              label="Discount Value"
              labelPlacement="outside"
              type="number"
              placeholder={formData.type === 'percent' ? 'e.g., 10' : 'e.g., 50'}
              value={formData.value}
              onValueChange={value => {
                setFormData(prev => ({ ...prev, value }))
                if (formErrors.value) {
                  setFormErrors(prev => ({ ...prev, value: '' }))
                }
              }}
              isInvalid={!!formErrors.value}
              errorMessage={formErrors.value}
              description={
                formData.type === 'percent'
                  ? 'Enter a percentage value (0-100)'
                  : 'Enter a fixed dollar amount'
              }
            />

            {/* Valid Until */}
            <div className="flex w-full items-center gap-2">
              <DatePicker
                label="Valid Until (Optional)"
                labelPlacement="outside"
                value={formData.validUntil}
                onChange={value => {
                  setFormData(prev => ({ ...prev, validUntil: value }))
                  if (formErrors.validUntil) {
                    setFormErrors(prev => ({ ...prev, validUntil: '' }))
                  }
                }}
                minValue={today(getLocalTimeZone())}
                isInvalid={!!formErrors.validUntil}
                errorMessage={formErrors.validUntil}
                description="Leave empty for no expiration"
              />
              {formData.validUntil && (
                <Tooltip content="Clear date">
                  <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onPress={() => {
                      setFormData(prev => ({ ...prev, validUntil: null }))
                      setFormErrors(prev => ({ ...prev, validUntil: '' }))
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </Tooltip>
              )}
            </div>

            {/* Age Groups (conditional) */}
            {showAgeGroupSelector && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Target Age Groups (Optional)</label>
                  <Tooltip content="Select specific age groups for this discount. Leave empty to apply to all age groups.">
                    <Info className="w-4 h-4 text-default-400" />
                  </Tooltip>
                </div>
                <div className="flex gap-3">
                  {camp.ageGroups.map(ag => {
                    const ageGroupId = `${ag.min}-${ag.max}`
                    return (
                      <Checkbox
                        key={ageGroupId}
                        isSelected={formData.ageGroups.includes(ageGroupId)}
                        onValueChange={checked => {
                          setFormData(prev => ({
                            ...prev,
                            ageGroups: checked
                              ? [...prev.ageGroups, ageGroupId]
                              : prev.ageGroups.filter(id => id !== ageGroupId),
                          }))
                        }}
                      >
                        Ages {ag.min}-{ag.max}
                      </Checkbox>
                    )
                  })}
                </div>
                <p className="text-sm font-semibold text-default-500">
                  {formData.ageGroups.length === 0
                    ? 'Discount will apply to all age groups'
                    : `Discount will apply to ${formData.ageGroups.length} selected age group(s)`}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button color="primary" onPress={handleAddManualDiscount}>
                Add Discount
              </Button>
              <Button
                variant="flat"
                onPress={() => {
                  setShowManualForm(false)
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
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
