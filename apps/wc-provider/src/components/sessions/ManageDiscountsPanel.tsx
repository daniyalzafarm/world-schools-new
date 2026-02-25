'use client'

import { useEffect, useState } from 'react'
import { Button, Switch, Tooltip } from '@heroui/react'
import { DatePicker, Input } from '@world-schools/ui-web'
import { type CalendarDate, parseDate, toCalendarDate } from '@internationalized/date'
import type { DateValue } from '@react-types/datepicker'
import { Pencil, Trash2, X } from 'lucide-react'
import type { GlobalDiscount } from '@/types/discounts'
import { DISCOUNT_TYPES, type DiscountTypeConfig } from '@world-schools/wc-frontend-utils'
import {
  addDiscountEntry,
  createGlobalDiscount,
  getGlobalDiscounts,
  removeDiscountEntry,
  updateDiscountEntry,
  updateGlobalDiscount,
} from '@/services/discounts.service'
import {
  validateDateAfter,
  validateDateInFuture,
  validateDetails,
  validateInteger,
  validateName,
  validatePromoCode,
  validateSiblingTiers,
  validateValue,
  type ValidationErrors,
} from '@/utils/discountValidators'

// Helper functions to convert between string dates and CalendarDate
const stringToCalendarDate = (dateString: string): CalendarDate | null => {
  if (!dateString) return null
  try {
    return parseDate(dateString)
  } catch {
    return null
  }
}

const calendarDateToString = (date: DateValue): string => {
  const calDate = toCalendarDate(date)
  return `${calDate.year}-${String(calDate.month).padStart(2, '0')}-${String(calDate.day).padStart(2, '0')}`
}

interface ManageDiscountsPanelProps {
  campId: string
  onClose: () => void
}

export function ManageDiscountsPanel({ campId, onClose }: ManageDiscountsPanelProps) {
  const [globalDiscounts, setGlobalDiscounts] = useState<GlobalDiscount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    void loadDiscounts()
  }, [campId])

  const loadDiscounts = async () => {
    try {
      setIsLoading(true)
      const discounts = await getGlobalDiscounts(campId)
      setGlobalDiscounts(discounts || [])
    } catch (error) {
      console.error('Failed to load discounts:', error)
      setGlobalDiscounts([]) // Ensure state is never undefined on error
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (category: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedSections(newExpanded)
  }

  const handleToggleDiscount = async (
    discount: GlobalDiscount | undefined,
    typeConfig: DiscountTypeConfig
  ) => {
    try {
      if (!discount) {
        // Lazy creation: Create discount entry when enabling for the first time
        // Backend creates with empty entries array
        const newDiscount = await createGlobalDiscount(
          campId,
          typeConfig.category,
          typeConfig.sortOrder
        )
        console.log('Created new discount:', newDiscount)

        // Optimistically update state with the new discount
        setGlobalDiscounts(prev => [...prev, newDiscount])
      } else {
        // Update existing discount (toggle enabled state)
        const updatedDiscount = await updateGlobalDiscount(campId, discount.id, {
          isEnabled: !discount.isEnabled,
        })
        console.log('Updated discount:', updatedDiscount)

        // Optimistically update state with the updated discount
        setGlobalDiscounts(prev =>
          prev.map(d => (d.id === updatedDiscount.id ? updatedDiscount : d))
        )
      }
    } catch (error) {
      console.error('Failed to toggle discount:', error)
      // Reload on error to ensure consistency
      await loadDiscounts()
    }
  }

  const handleAddEntry = async (discountId: string, entry: any) => {
    try {
      const updatedDiscount = await addDiscountEntry(campId, discountId, entry)
      console.log('Added entry:', updatedDiscount)

      // Optimistically update state with the updated discount
      setGlobalDiscounts(prev => prev.map(d => (d.id === updatedDiscount.id ? updatedDiscount : d)))
    } catch (error) {
      console.error('Failed to add entry:', error)
      await loadDiscounts()
    }
  }

  const handleUpdateEntry = async (discountId: string, entryId: string, entry: any) => {
    try {
      const updatedDiscount = await updateDiscountEntry(campId, discountId, entryId, entry)
      console.log('Updated entry:', updatedDiscount)

      // Optimistically update state with the updated discount
      setGlobalDiscounts(prev => prev.map(d => (d.id === updatedDiscount.id ? updatedDiscount : d)))
    } catch (error) {
      console.error('Failed to update entry:', error)
      await loadDiscounts()
    }
  }

  const handleRemoveEntry = async (discountId: string, entryId: string) => {
    try {
      const updatedDiscount = await removeDiscountEntry(campId, discountId, entryId)
      console.log('Removed entry:', updatedDiscount)

      // Optimistically update state with the updated discount
      setGlobalDiscounts(prev => prev.map(d => (d.id === updatedDiscount.id ? updatedDiscount : d)))
    } catch (error) {
      console.error('Failed to remove entry:', error)
      await loadDiscounts()
    }
  }

  // Get discount by category
  const getDiscount = (category: string) => {
    return globalDiscounts?.find(d => d.category === category)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-gray-200 shadow-lg z-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 px-6 h-18  bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Discounts</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Discount Types
        </div>

        {/* Render all discount types from static configuration */}
        {DISCOUNT_TYPES.map(typeConfig => {
          const discount = getDiscount(typeConfig.category)
          return (
            <DiscountSection
              key={typeConfig.category}
              title={typeConfig.title}
              icon={typeConfig.icon}
              description={typeConfig.description}
              discount={discount}
              typeConfig={typeConfig}
              isExpanded={expandedSections.has(typeConfig.category)}
              onToggleSection={() => toggleSection(typeConfig.category)}
              onToggleEnabled={handleToggleDiscount}
              onAddEntry={handleAddEntry}
              onUpdateEntry={handleUpdateEntry}
              onRemoveEntry={handleRemoveEntry}
              allowMultipleEntries={typeConfig.allowMultipleEntries}
            >
              {renderDiscountFields(
                typeConfig,
                discount,
                handleAddEntry,
                handleUpdateEntry,
                handleRemoveEntry
              )}
            </DiscountSection>
          )
        })}
      </div>
    </div>
  )
}

// Helper function to render category-specific fields
function renderDiscountFields(
  typeConfig: DiscountTypeConfig,
  discount: GlobalDiscount | undefined,
  onAddEntry: (discountId: string, entry: any) => void,
  onUpdateEntry: (discountId: string, entryId: string, entry: any) => void,
  onRemoveEntry: (discountId: string, entryId: string) => void
) {
  if (!discount) return null

  switch (typeConfig.category) {
    case 'early_bird':
      return (
        <EarlyBirdFields
          discount={discount}
          typeConfig={typeConfig}
          onUpdateEntry={onUpdateEntry}
          onAddEntry={onAddEntry}
        />
      )
    case 'sibling':
      return (
        <SiblingFields
          discount={discount}
          typeConfig={typeConfig}
          onUpdateEntry={onUpdateEntry}
          onAddEntry={onAddEntry}
        />
      )
    case 'returning_camper':
      return (
        <ReturningCamperFields
          discount={discount}
          typeConfig={typeConfig}
          onUpdateEntry={onUpdateEntry}
          onAddEntry={onAddEntry}
        />
      )
    case 'multi_week':
      return (
        <MultiWeekFields
          discount={discount}
          typeConfig={typeConfig}
          onAddEntry={onAddEntry}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )
    case 'group_booking':
      return (
        <GroupBookingFields
          discount={discount}
          typeConfig={typeConfig}
          onAddEntry={onAddEntry}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )
    case 'promo_code':
      return (
        <PromoCodeFields
          discount={discount}
          typeConfig={typeConfig}
          onAddEntry={onAddEntry}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )
    default:
      return null
  }
}

// Reusable Discount Section Component
interface DiscountSectionProps {
  title: string
  icon: string
  description: string
  discount?: GlobalDiscount
  typeConfig: DiscountTypeConfig
  isExpanded: boolean
  onToggleSection: () => void
  onToggleEnabled: (discount: GlobalDiscount | undefined, typeConfig: DiscountTypeConfig) => void
  onAddEntry: (discountId: string, entry: any) => void
  onUpdateEntry: (discountId: string, entryId: string, entry: any) => void
  onRemoveEntry: (discountId: string, entryId: string) => void
  allowMultipleEntries: boolean
  children: React.ReactNode
}

function DiscountSection({
  title,
  icon,
  description,
  discount,
  typeConfig,
  isExpanded,
  onToggleSection,
  onToggleEnabled,
  children,
}: DiscountSectionProps) {
  const isEnabled = discount?.isEnabled ?? false
  const entries = discount?.entries ?? []
  const hasEntries = entries.length > 0

  // Determine status indicator
  const getStatusIndicator = () => {
    if (!isEnabled) return null

    const isConfigured = hasEntries
    const dotColor = isConfigured ? 'bg-green-500' : 'bg-red-500'
    const statusText = isConfigured
      ? 'Active and configured'
      : 'Active but not configured - please add entries'

    return (
      <Tooltip content={statusText}>
        <span
          className={`inline-block animate-pulse w-3 h-3 rounded-full ${dotColor}`}
          aria-label={statusText}
        />
      </Tooltip>
    )
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleSection}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-left">
            <div className="font-medium flex items-center gap-2">
              {title}
              {getStatusIndicator()}
            </div>
            <div className="text-sm text-gray-500">{description}</div>
          </div>
        </div>
        <span className="text-gray-500">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Enable {title.toLowerCase()}</span>
            <Switch
              isSelected={isEnabled}
              onValueChange={() => onToggleEnabled(discount, typeConfig)}
            />
          </div>

          {/* Configuration Fields */}
          {isEnabled && discount && <div className="flex flex-col gap-3 pt-2">{children}</div>}
        </div>
      )}
    </div>
  )
}

// Type-specific field components - Single Entry Categories
// These components work with the first entry in the entries array
// If entries array is empty, they use defaultEntry as template and call onAddEntry

function EarlyBirdFields({ discount, typeConfig, onUpdateEntry, onAddEntry }: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []
  const hasEntry = entries.length > 0
  const originalEntry = hasEntry ? entries[0] : typeConfig?.defaultEntry || {}

  const [isEditing, setIsEditing] = useState(!hasEntry) // Auto-edit mode if no entry
  const [formData, setFormData] = useState(originalEntry)
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Update formData when originalEntry changes
  useEffect(() => {
    setFormData(originalEntry)
    setIsDirty(false)
    setValidationErrors({})
  }, [originalEntry.id])

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    // Clear validation error for this field when user starts typing
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    errors.name = validateName(formData.name)
    errors.value = validateValue(formData.value)
    errors.validUntil = validateDateInFuture(formData.validUntil)
    errors.details = validateDetails(formData.details)

    setValidationErrors(errors)

    // Return true if no errors
    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...validationErrors }

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'value') {
      errors.value = validateValue(formData.value)
    } else if (field === 'validUntil') {
      errors.validUntil = validateDateInFuture(formData.validUntil)
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    }

    setValidationErrors(errors)
  }

  const handleSave = () => {
    // Validate form before saving
    if (!validateForm()) {
      return
    }

    // Remove id property from formData before sending to API
    const { id, ...dataToSend } = formData

    if (hasEntry) {
      onUpdateEntry(discount.id, originalEntry.id, dataToSend)
      setIsEditing(false)
      setIsDirty(false)
    } else {
      onAddEntry(discount.id, dataToSend)
      setIsDirty(false)
    }
  }

  const handleCancel = () => {
    setFormData(originalEntry)
    setIsEditing(false)
    setIsDirty(false)
    setValidationErrors({})
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const hasValidationErrors = Object.values(validationErrors).some(error => error !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Discount Name"
        value={formData.name || 'Early Bird Discount'}
        onChange={e => handleFieldChange('name', e.target.value)}
        onBlur={() => handleBlur('name')}
        maxLength={30}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.name}
        errorMessage={validationErrors.name}
      />
      <Input
        label="Discount %"
        type="number"
        value={formData.value || 10}
        onChange={e => handleFieldChange('value', Number(e.target.value))}
        onBlur={() => handleBlur('value')}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.value}
        errorMessage={validationErrors.value}
      />
      <DatePicker
        label="Valid until"
        labelPlacement="outside"
        value={stringToCalendarDate(formData.validUntil || '')}
        onChange={value => {
          const dateString = value ? calendarDateToString(value) : ''
          handleFieldChange('validUntil', dateString)
        }}
        onBlur={() => handleBlur('validUntil')}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.validUntil}
        errorMessage={validationErrors.validUntil}
      />
      <Input
        label="Details (optional)"
        value={formData.details || ''}
        onChange={e => handleFieldChange('details', e.target.value)}
        onBlur={() => handleBlur('details')}
        placeholder="e.g., Book 30 days in advance"
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.details}
        errorMessage={validationErrors.details}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-2">
        {!isEditing ? (
          <Button onPress={handleEdit} color="secondary">
            Edit
          </Button>
        ) : (
          <>
            {hasEntry && (
              <Button onPress={handleCancel} variant="flat">
                Cancel
              </Button>
            )}
            <Button
              onPress={handleSave}
              color="secondary"
              isDisabled={(!isDirty && hasEntry) || hasValidationErrors}
            >
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function SiblingFields({ discount, typeConfig, onUpdateEntry, onAddEntry }: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []
  const hasEntry = entries.length > 0
  const originalEntry = hasEntry ? entries[0] : typeConfig?.defaultEntry || {}

  const [isEditing, setIsEditing] = useState(!hasEntry)
  const [formData, setFormData] = useState(originalEntry)
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  useEffect(() => {
    setFormData(originalEntry)
    setIsDirty(false)
    setValidationErrors({})
  }, [originalEntry.id])

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleConfigChange = (configField: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      config: { ...(prev.config || {}), [configField]: value },
    }))
    setIsDirty(true)
    if (validationErrors[configField as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [configField]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}
    const config = formData.config || {}

    errors.name = validateName(formData.name)
    errors.details = validateDetails(formData.details)

    // Validate sibling tiers
    const tierErrors = validateSiblingTiers(
      config.secondChild,
      config.thirdChild,
      config.fourthPlusChild
    )
    errors.secondChild = tierErrors.secondChild
    errors.thirdChild = tierErrors.thirdChild
    errors.fourthPlusChild = tierErrors.fourthPlusChild

    setValidationErrors(errors)

    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...validationErrors }
    const config = formData.config || {}

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    } else if (field === 'secondChild' || field === 'thirdChild' || field === 'fourthPlusChild') {
      // Validate all tiers together for ascending order check
      const tierErrors = validateSiblingTiers(
        config.secondChild,
        config.thirdChild,
        config.fourthPlusChild
      )
      errors.secondChild = tierErrors.secondChild
      errors.thirdChild = tierErrors.thirdChild
      errors.fourthPlusChild = tierErrors.fourthPlusChild
    }

    setValidationErrors(errors)
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }

    // Remove id property from formData before sending to API
    const { id, ...dataToSend } = formData

    if (hasEntry) {
      onUpdateEntry(discount.id, originalEntry.id, dataToSend)
      setIsEditing(false)
      setIsDirty(false)
    } else {
      onAddEntry(discount.id, dataToSend)
      setIsDirty(false)
    }
  }

  const handleCancel = () => {
    setFormData(originalEntry)
    setIsEditing(false)
    setIsDirty(false)
    setValidationErrors({})
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const hasValidationErrors = Object.values(validationErrors).some(error => error !== undefined)
  const config = formData.config || {}

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Discount Name"
        value={formData.name || 'Sibling Discount'}
        onChange={e => handleFieldChange('name', e.target.value)}
        onBlur={() => handleBlur('name')}
        maxLength={30}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.name}
        errorMessage={validationErrors.name}
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          label="2nd child %"
          type="number"
          value={config.secondChild || 10}
          onChange={e => handleConfigChange('secondChild', Number(e.target.value))}
          onBlur={() => handleBlur('secondChild')}
          isDisabled={!isEditing}
          isInvalid={!!validationErrors.secondChild}
          errorMessage={validationErrors.secondChild}
        />
        <Input
          label="3rd child %"
          type="number"
          value={config.thirdChild || 15}
          onChange={e => handleConfigChange('thirdChild', Number(e.target.value))}
          onBlur={() => handleBlur('thirdChild')}
          isDisabled={!isEditing}
          isInvalid={!!validationErrors.thirdChild}
          errorMessage={validationErrors.thirdChild}
        />
        <Input
          label="4th+ child %"
          type="number"
          value={config.fourthPlusChild || 20}
          onChange={e => handleConfigChange('fourthPlusChild', Number(e.target.value))}
          onBlur={() => handleBlur('fourthPlusChild')}
          isDisabled={!isEditing}
          isInvalid={!!validationErrors.fourthPlusChild}
          errorMessage={validationErrors.fourthPlusChild}
        />
      </div>
      <Input
        label="Details (optional)"
        value={formData.details || ''}
        onChange={e => handleFieldChange('details', e.target.value)}
        onBlur={() => handleBlur('details')}
        placeholder="e.g., Applies to all age groups"
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.details}
        errorMessage={validationErrors.details}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-2">
        {!isEditing ? (
          <Button onPress={handleEdit} color="secondary">
            Edit
          </Button>
        ) : (
          <>
            {hasEntry && (
              <Button onPress={handleCancel} variant="flat">
                Cancel
              </Button>
            )}
            <Button
              onPress={handleSave}
              color="secondary"
              isDisabled={(!isDirty && hasEntry) || hasValidationErrors}
            >
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function ReturningCamperFields({ discount, typeConfig, onUpdateEntry, onAddEntry }: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []
  const hasEntry = entries.length > 0
  const originalEntry = hasEntry ? entries[0] : typeConfig?.defaultEntry || {}

  const [isEditing, setIsEditing] = useState(!hasEntry)
  const [formData, setFormData] = useState(originalEntry)
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  useEffect(() => {
    setFormData(originalEntry)
    setIsDirty(false)
    setValidationErrors({})
  }, [originalEntry.id])

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    errors.name = validateName(formData.name)
    errors.value = validateValue(formData.value)
    errors.details = validateDetails(formData.details)

    setValidationErrors(errors)

    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...validationErrors }

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'value') {
      errors.value = validateValue(formData.value)
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    }

    setValidationErrors(errors)
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }

    // Remove id property from formData before sending to API
    const { id, ...dataToSend } = formData

    if (hasEntry) {
      onUpdateEntry(discount.id, originalEntry.id, dataToSend)
      setIsEditing(false)
      setIsDirty(false)
    } else {
      onAddEntry(discount.id, dataToSend)
      setIsDirty(false)
    }
  }

  const handleCancel = () => {
    setFormData(originalEntry)
    setIsEditing(false)
    setIsDirty(false)
    setValidationErrors({})
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const hasValidationErrors = Object.values(validationErrors).some(error => error !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Discount Name"
        value={formData.name || 'Returning Camper Discount'}
        onChange={e => handleFieldChange('name', e.target.value)}
        onBlur={() => handleBlur('name')}
        maxLength={30}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.name}
        errorMessage={validationErrors.name}
      />
      <Input
        label="Discount %"
        type="number"
        value={formData.value || 5}
        onChange={e => handleFieldChange('value', Number(e.target.value))}
        onBlur={() => handleBlur('value')}
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.value}
        errorMessage={validationErrors.value}
      />
      <Input
        label="Details (optional)"
        value={formData.details || ''}
        onChange={e => handleFieldChange('details', e.target.value)}
        onBlur={() => handleBlur('details')}
        placeholder="e.g., For campers who attended last year"
        isDisabled={!isEditing}
        isInvalid={!!validationErrors.details}
        errorMessage={validationErrors.details}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-2">
        {!isEditing ? (
          <Button onPress={handleEdit} color="secondary">
            Edit
          </Button>
        ) : (
          <>
            {hasEntry && (
              <Button onPress={handleCancel} variant="flat">
                Cancel
              </Button>
            )}
            <Button
              onPress={handleSave}
              color="secondary"
              isDisabled={(!isDirty && hasEntry) || hasValidationErrors}
            >
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// Type-specific field components - Multiple Entry Categories
// These components display a list of entries with add/edit/remove functionality

function MultiWeekFields({ discount, typeConfig, onAddEntry, onUpdateEntry, onRemoveEntry }: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [addFormData, setAddFormData] = useState<any>({
    name: '',
    value: 10,
    calculationType: 'percent',
    config: { minimumWeeks: 2 },
    details: '',
  })
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({})
  const [addValidationErrors, setAddValidationErrors] = useState<ValidationErrors>({})
  const [editValidationErrors, setEditValidationErrors] = useState<
    Record<string, ValidationErrors>
  >({})

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const validateAddForm = (): boolean => {
    const errors: ValidationErrors = {}

    errors.name = validateName(addFormData.name)
    errors.value = validateValue(addFormData.value)
    errors.minimumWeeks = validateInteger(addFormData.config.minimumWeeks, 'Minimum weeks', 2)
    errors.details = validateDetails(addFormData.details)

    setAddValidationErrors(errors)

    return !Object.values(errors).some(error => error !== undefined)
  }

  const validateEditForm = (entryId: string): boolean => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = {}

    errors.name = validateName(formData.name)
    errors.value = validateValue(formData.value)
    errors.minimumWeeks = validateInteger(formData.config?.minimumWeeks, 'Minimum weeks', 2)
    errors.details = validateDetails(formData.details)

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))

    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleShowAddForm = () => {
    setShowAddForm(true)
    setAddValidationErrors({})
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setAddFormData({
      name: '',
      value: 10,
      calculationType: 'percent',
      config: { minimumWeeks: 2 },
      details: '',
    })
    setAddValidationErrors({})
  }

  const handleSaveAdd = () => {
    if (!validateAddForm()) {
      return
    }

    // Remove id property from addFormData before sending to API
    const { id, ...dataToSend } = addFormData
    onAddEntry(discount.id, dataToSend)
    handleCancelAdd()
  }

  const handleEditEntry = (entry: any) => {
    setEditingEntryId(entry.id)
    setEditFormData({ [entry.id]: { ...entry } })
    setIsDirty({ [entry.id]: false })
    setEditValidationErrors({ [entry.id]: {} })
  }

  const handleCancelEdit = (entryId: string) => {
    setEditingEntryId(null)
    const newEditFormData = { ...editFormData }
    delete newEditFormData[entryId]
    setEditFormData(newEditFormData)
    const newIsDirty = { ...isDirty }
    delete newIsDirty[entryId]
    setIsDirty(newIsDirty)
    const newEditValidationErrors = { ...editValidationErrors }
    delete newEditValidationErrors[entryId]
    setEditValidationErrors(newEditValidationErrors)
  }

  const handleSaveEdit = (entryId: string) => {
    if (!validateEditForm(entryId)) {
      return
    }

    // Remove id property from editFormData before sending to API
    const { id, ...dataToSend } = editFormData[entryId]
    onUpdateEntry(discount.id, entryId, dataToSend)
    handleCancelEdit(entryId)
  }

  const handleEditFieldChange = (entryId: string, field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    // Clear validation error for this field
    if (editValidationErrors[entryId]?.[field as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [field]: undefined },
      }))
    }
  }

  const handleEditConfigChange = (entryId: string, configField: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        config: { ...(prev[entryId].config || {}), [configField]: value },
      },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    // Clear validation error for this field
    if (editValidationErrors[entryId]?.[configField as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [configField]: undefined },
      }))
    }
  }

  const handleAddFieldBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...addValidationErrors }

    if (field === 'name') {
      errors.name = validateName(addFormData.name)
    } else if (field === 'value') {
      errors.value = validateValue(addFormData.value)
    } else if (field === 'minimumWeeks') {
      errors.minimumWeeks = validateInteger(addFormData.config.minimumWeeks, 'Minimum weeks', 2)
    } else if (field === 'details') {
      errors.details = validateDetails(addFormData.details)
    }

    setAddValidationErrors(errors)
  }

  const handleEditFieldBlur = (entryId: string, field: keyof ValidationErrors) => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = { ...(editValidationErrors[entryId] || {}) }

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'value') {
      errors.value = validateValue(formData.value)
    } else if (field === 'minimumWeeks') {
      errors.minimumWeeks = validateInteger(formData.config?.minimumWeeks, 'Minimum weeks', 2)
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    }

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))
  }

  const hasAddValidationErrors = Object.values(addValidationErrors).some(
    error => error !== undefined
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => {
        const isEditing = editingEntryId === entry.id
        const formData = isEditing ? editFormData[entry.id] : entry
        const entryIsDirty = isDirty[entry.id] || false
        const entryValidationErrors = editValidationErrors[entry.id] || {}
        const hasEntryValidationErrors = Object.values(entryValidationErrors).some(
          error => error !== undefined
        )

        return (
          <div
            key={entry.id}
            className="border border-gray-200 dark:border-gray-700 rounded p-3 flex 3"
          >
            {isEditing ? (
              <>
                {/* Edit Form */}
                <Input
                  label="Rule Name"
                  value={formData.name}
                  onChange={e => handleEditFieldChange(entry.id, 'name', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'name')}
                  placeholder="e.g., 2+ weeks get 10%"
                  maxLength={30}
                  isInvalid={!!entryValidationErrors.name}
                  errorMessage={entryValidationErrors.name}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Minimum Weeks"
                    type="number"
                    value={formData.config?.minimumWeeks || 2}
                    onChange={e =>
                      handleEditConfigChange(entry.id, 'minimumWeeks', Number(e.target.value))
                    }
                    onBlur={() => handleEditFieldBlur(entry.id, 'minimumWeeks')}
                    isInvalid={!!entryValidationErrors.minimumWeeks}
                    errorMessage={entryValidationErrors.minimumWeeks}
                  />
                  <Input
                    label="Discount %"
                    type="number"
                    value={formData.value}
                    onChange={e => handleEditFieldChange(entry.id, 'value', Number(e.target.value))}
                    onBlur={() => handleEditFieldBlur(entry.id, 'value')}
                    isInvalid={!!entryValidationErrors.value}
                    errorMessage={entryValidationErrors.value}
                  />
                </div>
                <Input
                  label="Details (optional)"
                  value={formData.details || ''}
                  onChange={e => handleEditFieldChange(entry.id, 'details', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'details')}
                  placeholder="e.g., Consecutive weeks only"
                  isInvalid={!!entryValidationErrors.details}
                  errorMessage={entryValidationErrors.details}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="flat" onPress={() => handleCancelEdit(entry.id)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => handleSaveEdit(entry.id)}
                    isDisabled={!entryIsDirty || hasEntryValidationErrors}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Read-only Display */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{entry.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="danger"
                      isIconOnly
                      variant="flat"
                      onPress={() => onRemoveEntry(discount.id, entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      isIconOnly
                      onPress={() => handleEditEntry(entry)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {entry.calculationType === 'percent' ? `${entry.value}%` : `$${entry.value}`} off
                  {entry.config?.minimumWeeks && ` for ${entry.config.minimumWeeks}+ weeks`}
                </div>
                {entry.details && <div className="text-xs text-gray-500">{entry.details}</div>}
              </>
            )}
          </div>
        )
      })}

      {/* Add New Entry Button or Form */}
      {!showAddForm ? (
        <Button
          variant="bordered"
          className="w-full border-2 border-dashed"
          onPress={handleShowAddForm}
        >
          + Add Discount
        </Button>
      ) : (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded p-3 flex 3">
          <div className="font-medium text-gray-700 dark:text-gray-300">Add New Rule</div>
          <Input
            label="Rule Name"
            value={addFormData.name}
            onChange={e => {
              setAddFormData({ ...addFormData, name: e.target.value })
              if (addValidationErrors.name) {
                setAddValidationErrors(prev => ({ ...prev, name: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('name')}
            placeholder="e.g., 2+ weeks get 10%"
            maxLength={30}
            isInvalid={!!addValidationErrors.name}
            errorMessage={addValidationErrors.name}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Minimum Weeks"
              type="number"
              value={addFormData.config.minimumWeeks}
              onChange={e => {
                setAddFormData({
                  ...addFormData,
                  config: { ...addFormData.config, minimumWeeks: Number(e.target.value) },
                })
                if (addValidationErrors.minimumWeeks) {
                  setAddValidationErrors(prev => ({ ...prev, minimumWeeks: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('minimumWeeks')}
              isInvalid={!!addValidationErrors.minimumWeeks}
              errorMessage={addValidationErrors.minimumWeeks}
            />
            <Input
              label="Discount %"
              type="number"
              value={addFormData.value}
              onChange={e => {
                setAddFormData({ ...addFormData, value: Number(e.target.value) })
                if (addValidationErrors.value) {
                  setAddValidationErrors(prev => ({ ...prev, value: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('value')}
              isInvalid={!!addValidationErrors.value}
              errorMessage={addValidationErrors.value}
            />
          </div>
          <Input
            label="Details (optional)"
            value={addFormData.details || ''}
            onChange={e => {
              setAddFormData({ ...addFormData, details: e.target.value })
              if (addValidationErrors.details) {
                setAddValidationErrors(prev => ({ ...prev, details: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('details')}
            placeholder="e.g., Consecutive weeks only"
            isInvalid={!!addValidationErrors.details}
            errorMessage={addValidationErrors.details}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="flat" onPress={handleCancelAdd}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={handleSaveAdd}
              isDisabled={hasAddValidationErrors}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupBookingFields({
  discount,
  typeConfig,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [addFormData, setAddFormData] = useState<any>({
    name: '',
    value: 15,
    calculationType: 'percent',
    config: { minimumChildren: 3 },
    details: '',
  })
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({})
  const [addValidationErrors, setAddValidationErrors] = useState<ValidationErrors>({})
  const [editValidationErrors, setEditValidationErrors] = useState<
    Record<string, ValidationErrors>
  >({})

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const validateAddForm = (): boolean => {
    const errors: ValidationErrors = {}

    errors.name = validateName(addFormData.name)
    errors.value = validateValue(addFormData.value)
    errors.minimumChildren = validateInteger(
      addFormData.config.minimumChildren,
      'Minimum children',
      2
    )
    errors.details = validateDetails(addFormData.details)

    setAddValidationErrors(errors)

    return !Object.values(errors).some(error => error !== undefined)
  }

  const validateEditForm = (entryId: string): boolean => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = {}

    errors.name = validateName(formData.name)
    errors.value = validateValue(formData.value)
    errors.minimumChildren = validateInteger(
      formData.config?.minimumChildren,
      'Minimum children',
      2
    )
    errors.details = validateDetails(formData.details)

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))

    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleShowAddForm = () => {
    setShowAddForm(true)
    setAddValidationErrors({})
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setAddFormData({
      name: '',
      value: 15,
      calculationType: 'percent',
      config: { minimumChildren: 3 },
      details: '',
    })
    setAddValidationErrors({})
  }

  const handleSaveAdd = () => {
    if (!validateAddForm()) {
      return
    }

    // Remove id property from addFormData before sending to API
    const { id, ...dataToSend } = addFormData
    onAddEntry(discount.id, dataToSend)
    handleCancelAdd()
  }

  const handleEditEntry = (entry: any) => {
    setEditingEntryId(entry.id)
    setEditFormData({ [entry.id]: { ...entry } })
    setIsDirty({ [entry.id]: false })
    setEditValidationErrors({ [entry.id]: {} })
  }

  const handleCancelEdit = (entryId: string) => {
    setEditingEntryId(null)
    const newEditFormData = { ...editFormData }
    delete newEditFormData[entryId]
    setEditFormData(newEditFormData)
    const newIsDirty = { ...isDirty }
    delete newIsDirty[entryId]
    setIsDirty(newIsDirty)
    const newEditValidationErrors = { ...editValidationErrors }
    delete newEditValidationErrors[entryId]
    setEditValidationErrors(newEditValidationErrors)
  }

  const handleSaveEdit = (entryId: string) => {
    if (!validateEditForm(entryId)) {
      return
    }

    // Remove id property from editFormData before sending to API
    const { id, ...dataToSend } = editFormData[entryId]
    onUpdateEntry(discount.id, entryId, dataToSend)
    handleCancelEdit(entryId)
  }

  const handleEditFieldChange = (entryId: string, field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    if (editValidationErrors[entryId]?.[field as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [field]: undefined },
      }))
    }
  }

  const handleEditConfigChange = (entryId: string, configField: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        config: { ...(prev[entryId].config || {}), [configField]: value },
      },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    if (editValidationErrors[entryId]?.[configField as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [configField]: undefined },
      }))
    }
  }

  const handleAddFieldBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...addValidationErrors }

    if (field === 'name') {
      errors.name = validateName(addFormData.name)
    } else if (field === 'value') {
      errors.value = validateValue(addFormData.value)
    } else if (field === 'minimumChildren') {
      errors.minimumChildren = validateInteger(
        addFormData.config.minimumChildren,
        'Minimum children',
        2
      )
    } else if (field === 'details') {
      errors.details = validateDetails(addFormData.details)
    }

    setAddValidationErrors(errors)
  }

  const handleEditFieldBlur = (entryId: string, field: keyof ValidationErrors) => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = { ...(editValidationErrors[entryId] || {}) }

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'value') {
      errors.value = validateValue(formData.value)
    } else if (field === 'minimumChildren') {
      errors.minimumChildren = validateInteger(
        formData.config?.minimumChildren,
        'Minimum children',
        2
      )
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    }

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))
  }

  const hasAddValidationErrors = Object.values(addValidationErrors).some(
    error => error !== undefined
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => {
        const isEditing = editingEntryId === entry.id
        const formData = isEditing ? editFormData[entry.id] : entry
        const entryIsDirty = isDirty[entry.id] || false
        const entryValidationErrors = editValidationErrors[entry.id] || {}
        const hasEntryValidationErrors = Object.values(entryValidationErrors).some(
          error => error !== undefined
        )

        return (
          <div
            key={entry.id}
            className="border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col gap-3"
          >
            {isEditing ? (
              <>
                {/* Edit Form */}
                <Input
                  label="Tier Name"
                  value={formData.name}
                  onChange={e => handleEditFieldChange(entry.id, 'name', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'name')}
                  placeholder="e.g., 3-5 children: 10%"
                  maxLength={30}
                  isInvalid={!!entryValidationErrors.name}
                  errorMessage={entryValidationErrors.name}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Minimum Children"
                    type="number"
                    value={formData.config?.minimumChildren || 3}
                    onChange={e =>
                      handleEditConfigChange(entry.id, 'minimumChildren', Number(e.target.value))
                    }
                    onBlur={() => handleEditFieldBlur(entry.id, 'minimumChildren')}
                    isInvalid={!!entryValidationErrors.minimumChildren}
                    errorMessage={entryValidationErrors.minimumChildren}
                  />
                  <Input
                    label="Discount %"
                    type="number"
                    value={formData.value}
                    onChange={e => handleEditFieldChange(entry.id, 'value', Number(e.target.value))}
                    onBlur={() => handleEditFieldBlur(entry.id, 'value')}
                    isInvalid={!!entryValidationErrors.value}
                    errorMessage={entryValidationErrors.value}
                  />
                </div>
                <Input
                  label="Details (optional)"
                  value={formData.details || ''}
                  onChange={e => handleEditFieldChange(entry.id, 'details', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'details')}
                  placeholder="e.g., For schools and clubs"
                  isInvalid={!!entryValidationErrors.details}
                  errorMessage={entryValidationErrors.details}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="flat" onPress={() => handleCancelEdit(entry.id)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => handleSaveEdit(entry.id)}
                    isDisabled={!entryIsDirty || hasEntryValidationErrors}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Read-only Display */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{entry.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="danger"
                      isIconOnly
                      variant="flat"
                      onPress={() => onRemoveEntry(discount.id, entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      isIconOnly
                      onPress={() => handleEditEntry(entry)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {entry.value}% off for {entry.config?.minimumChildren}+ children
                </div>
                {entry.details && <div className="text-xs text-gray-500">{entry.details}</div>}
              </>
            )}
          </div>
        )
      })}

      {/* Add New Entry Button or Form */}
      {!showAddForm ? (
        <Button
          variant="bordered"
          className="w-full border-2 border-dashed"
          onPress={handleShowAddForm}
        >
          + Add Discount
        </Button>
      ) : (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded p-3 flex flex-col gap-3">
          <div className="font-medium text-gray-700 dark:text-gray-300">Add New Tier</div>
          <Input
            label="Tier Name"
            value={addFormData.name}
            onChange={e => {
              setAddFormData({ ...addFormData, name: e.target.value })
              if (addValidationErrors.name) {
                setAddValidationErrors(prev => ({ ...prev, name: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('name')}
            placeholder="e.g., 3-5 children: 10%"
            maxLength={30}
            isInvalid={!!addValidationErrors.name}
            errorMessage={addValidationErrors.name}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Minimum Children"
              type="number"
              value={addFormData.config.minimumChildren}
              onChange={e => {
                setAddFormData({
                  ...addFormData,
                  config: { ...addFormData.config, minimumChildren: Number(e.target.value) },
                })
                if (addValidationErrors.minimumChildren) {
                  setAddValidationErrors(prev => ({ ...prev, minimumChildren: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('minimumChildren')}
              isInvalid={!!addValidationErrors.minimumChildren}
              errorMessage={addValidationErrors.minimumChildren}
            />
            <Input
              label="Discount %"
              type="number"
              value={addFormData.value}
              onChange={e => {
                setAddFormData({ ...addFormData, value: Number(e.target.value) })
                if (addValidationErrors.value) {
                  setAddValidationErrors(prev => ({ ...prev, value: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('value')}
              isInvalid={!!addValidationErrors.value}
              errorMessage={addValidationErrors.value}
            />
          </div>
          <Input
            label="Details (optional)"
            value={addFormData.details || ''}
            onChange={e => {
              setAddFormData({ ...addFormData, details: e.target.value })
              if (addValidationErrors.details) {
                setAddValidationErrors(prev => ({ ...prev, details: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('details')}
            placeholder="e.g., For schools and clubs"
            isInvalid={!!addValidationErrors.details}
            errorMessage={addValidationErrors.details}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="flat" onPress={handleCancelAdd}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={handleSaveAdd}
              isDisabled={hasAddValidationErrors}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PromoCodeFields({ discount, typeConfig, onAddEntry, onUpdateEntry, onRemoveEntry }: any) {
  // Move all hooks BEFORE the early return
  const entries = (discount?.entries as any[]) || []

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [addFormData, setAddFormData] = useState<any>({
    name: '',
    value: 15,
    calculationType: 'percent',
    validFrom: '',
    validUntil: '',
    config: { code: '', usageLimit: 50 },
    details: '',
  })
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({})
  const [addValidationErrors, setAddValidationErrors] = useState<ValidationErrors>({})
  const [editValidationErrors, setEditValidationErrors] = useState<
    Record<string, ValidationErrors>
  >({})

  // NOW check for early return AFTER all hooks
  if (!discount) return null

  const validateAddForm = (): boolean => {
    const errors: ValidationErrors = {}

    errors.name = validateName(addFormData.name)
    errors.value = validateValue(addFormData.value)
    errors.code = validatePromoCode(addFormData.config.code)
    errors.usageLimit = validateInteger(addFormData.config.usageLimit, 'Usage limit', 1)
    errors.validFrom = validateDateInFuture(addFormData.validFrom)
    errors.validUntil = validateDateInFuture(addFormData.validUntil)

    // Check if validUntil is after validFrom
    if (
      !errors.validFrom &&
      !errors.validUntil &&
      addFormData.validFrom &&
      addFormData.validUntil
    ) {
      const dateAfterError = validateDateAfter(addFormData.validFrom, addFormData.validUntil)
      if (dateAfterError) {
        errors.validUntil = dateAfterError
      }
    }

    // Check for duplicate promo codes (frontend uniqueness check)
    if (!errors.code && addFormData.config.code) {
      const isDuplicate = entries.some(
        (entry: any) => entry.config?.code?.toUpperCase() === addFormData.config.code.toUpperCase()
      )
      if (isDuplicate) {
        errors.code = 'This promo code already exists for this camp'
      }
    }

    errors.details = validateDetails(addFormData.details)

    setAddValidationErrors(errors)

    return !Object.values(errors).some(error => error !== undefined)
  }

  const validateEditForm = (entryId: string): boolean => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = {}

    errors.name = validateName(formData.name)
    errors.value = validateValue(formData.value)
    errors.code = validatePromoCode(formData.config?.code)
    errors.usageLimit = validateInteger(formData.config?.usageLimit, 'Usage limit', 1)
    errors.validFrom = validateDateInFuture(formData.validFrom)
    errors.validUntil = validateDateInFuture(formData.validUntil)

    // Check if validUntil is after validFrom
    if (!errors.validFrom && !errors.validUntil && formData.validFrom && formData.validUntil) {
      const dateAfterError = validateDateAfter(formData.validFrom, formData.validUntil)
      if (dateAfterError) {
        errors.validUntil = dateAfterError
      }
    }

    // Check for duplicate promo codes (frontend uniqueness check)
    if (!errors.code && formData.config?.code) {
      const isDuplicate = entries.some(
        (entry: any) =>
          entry.id !== entryId &&
          entry.config?.code?.toUpperCase() === formData.config.code.toUpperCase()
      )
      if (isDuplicate) {
        errors.code = 'This promo code already exists for this camp'
      }
    }

    errors.details = validateDetails(formData.details)

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))

    return !Object.values(errors).some(error => error !== undefined)
  }

  const handleShowAddForm = () => {
    setShowAddForm(true)
    setAddValidationErrors({})
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setAddFormData({
      name: '',
      value: 15,
      calculationType: 'percent',
      validFrom: '',
      validUntil: '',
      config: { code: '', usageLimit: 50 },
      details: '',
    })
    setAddValidationErrors({})
  }

  const handleSaveAdd = () => {
    if (!validateAddForm()) {
      return
    }

    // Remove id property from addFormData before sending to API
    const { id, ...dataToSend } = addFormData
    onAddEntry(discount.id, dataToSend)
    handleCancelAdd()
  }

  const handleEditEntry = (entry: any) => {
    setEditingEntryId(entry.id)
    setEditFormData({ [entry.id]: { ...entry } })
    setIsDirty({ [entry.id]: false })
    setEditValidationErrors({ [entry.id]: {} })
  }

  const handleCancelEdit = (entryId: string) => {
    setEditingEntryId(null)
    const newEditFormData = { ...editFormData }
    delete newEditFormData[entryId]
    setEditFormData(newEditFormData)
    const newIsDirty = { ...isDirty }
    delete newIsDirty[entryId]
    setIsDirty(newIsDirty)
    const newEditValidationErrors = { ...editValidationErrors }
    delete newEditValidationErrors[entryId]
    setEditValidationErrors(newEditValidationErrors)
  }

  const handleSaveEdit = (entryId: string) => {
    if (!validateEditForm(entryId)) {
      return
    }

    // Remove id property from editFormData before sending to API
    const { id, ...dataToSend } = editFormData[entryId]
    onUpdateEntry(discount.id, entryId, dataToSend)
    handleCancelEdit(entryId)
  }

  const handleEditFieldChange = (entryId: string, field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    if (editValidationErrors[entryId]?.[field as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [field]: undefined },
      }))
    }
  }

  const handleEditConfigChange = (entryId: string, configField: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        config: { ...(prev[entryId].config || {}), [configField]: value },
      },
    }))
    setIsDirty(prev => ({ ...prev, [entryId]: true }))
    if (editValidationErrors[entryId]?.[configField as keyof ValidationErrors]) {
      setEditValidationErrors(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], [configField]: undefined },
      }))
    }
  }

  const handleAddFieldBlur = (field: keyof ValidationErrors) => {
    const errors: ValidationErrors = { ...addValidationErrors }

    if (field === 'name') {
      errors.name = validateName(addFormData.name)
    } else if (field === 'value') {
      errors.value = validateValue(addFormData.value)
    } else if (field === 'code') {
      errors.code = validatePromoCode(addFormData.config.code)
      // Check for duplicate promo codes
      if (!errors.code && addFormData.config.code) {
        const isDuplicate = entries.some(
          (entry: any) =>
            entry.config?.code?.toUpperCase() === addFormData.config.code.toUpperCase()
        )
        if (isDuplicate) {
          errors.code = 'This promo code already exists for this camp'
        }
      }
    } else if (field === 'usageLimit') {
      errors.usageLimit = validateInteger(addFormData.config.usageLimit, 'Usage limit', 1)
    } else if (field === 'validFrom') {
      errors.validFrom = validateDateInFuture(addFormData.validFrom)
      // Re-validate validUntil if it exists
      if (addFormData.validUntil) {
        errors.validUntil = validateDateInFuture(addFormData.validUntil)
        if (!errors.validFrom && !errors.validUntil && addFormData.validFrom) {
          const dateAfterError = validateDateAfter(addFormData.validFrom, addFormData.validUntil)
          if (dateAfterError) {
            errors.validUntil = dateAfterError
          }
        }
      }
    } else if (field === 'validUntil') {
      errors.validUntil = validateDateInFuture(addFormData.validUntil)
      if (!errors.validUntil && addFormData.validFrom && addFormData.validUntil) {
        const dateAfterError = validateDateAfter(addFormData.validFrom, addFormData.validUntil)
        if (dateAfterError) {
          errors.validUntil = dateAfterError
        }
      }
    } else if (field === 'details') {
      errors.details = validateDetails(addFormData.details)
    }

    setAddValidationErrors(errors)
  }

  const handleEditFieldBlur = (entryId: string, field: keyof ValidationErrors) => {
    const formData = editFormData[entryId]
    const errors: ValidationErrors = { ...(editValidationErrors[entryId] || {}) }

    if (field === 'name') {
      errors.name = validateName(formData.name)
    } else if (field === 'value') {
      errors.value = validateValue(formData.value)
    } else if (field === 'code') {
      errors.code = validatePromoCode(formData.config?.code)
      // Check for duplicate promo codes
      if (!errors.code && formData.config?.code) {
        const isDuplicate = entries.some(
          (entry: any) =>
            entry.id !== entryId &&
            entry.config?.code?.toUpperCase() === formData.config.code.toUpperCase()
        )
        if (isDuplicate) {
          errors.code = 'This promo code already exists for this camp'
        }
      }
    } else if (field === 'usageLimit') {
      errors.usageLimit = validateInteger(formData.config?.usageLimit, 'Usage limit', 1)
    } else if (field === 'validFrom') {
      errors.validFrom = validateDateInFuture(formData.validFrom)
      // Re-validate validUntil if it exists
      if (formData.validUntil) {
        errors.validUntil = validateDateInFuture(formData.validUntil)
        if (!errors.validFrom && !errors.validUntil && formData.validFrom) {
          const dateAfterError = validateDateAfter(formData.validFrom, formData.validUntil)
          if (dateAfterError) {
            errors.validUntil = dateAfterError
          }
        }
      }
    } else if (field === 'validUntil') {
      errors.validUntil = validateDateInFuture(formData.validUntil)
      if (!errors.validUntil && formData.validFrom && formData.validUntil) {
        const dateAfterError = validateDateAfter(formData.validFrom, formData.validUntil)
        if (dateAfterError) {
          errors.validUntil = dateAfterError
        }
      }
    } else if (field === 'details') {
      errors.details = validateDetails(formData.details)
    }

    setEditValidationErrors(prev => ({ ...prev, [entryId]: errors }))
  }

  const hasAddValidationErrors = Object.values(addValidationErrors).some(
    error => error !== undefined
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => {
        const isEditing = editingEntryId === entry.id
        const formData = isEditing ? editFormData[entry.id] : entry
        const entryIsDirty = isDirty[entry.id] || false
        const entryValidationErrors = editValidationErrors[entry.id] || {}
        const hasEntryValidationErrors = Object.values(entryValidationErrors).some(
          error => error !== undefined
        )

        return (
          <div
            key={entry.id}
            className="border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col gap-3"
          >
            {isEditing ? (
              <>
                {/* Edit Form */}
                <Input
                  label="Promo Name"
                  value={formData.name}
                  onChange={e => handleEditFieldChange(entry.id, 'name', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'name')}
                  placeholder="e.g., Summer 2026 Promo"
                  maxLength={30}
                  isInvalid={!!entryValidationErrors.name}
                  errorMessage={entryValidationErrors.name}
                />
                <Input
                  label="Promo Code"
                  value={formData.config?.code || ''}
                  onChange={e =>
                    handleEditConfigChange(entry.id, 'code', e.target.value.toUpperCase())
                  }
                  onBlur={() => handleEditFieldBlur(entry.id, 'code')}
                  placeholder="e.g., SUMMER2026"
                  isInvalid={!!entryValidationErrors.code}
                  errorMessage={entryValidationErrors.code}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Discount %"
                    type="number"
                    value={formData.value}
                    onChange={e => handleEditFieldChange(entry.id, 'value', Number(e.target.value))}
                    onBlur={() => handleEditFieldBlur(entry.id, 'value')}
                    isInvalid={!!entryValidationErrors.value}
                    errorMessage={entryValidationErrors.value}
                  />
                  <Input
                    label="Usage Limit"
                    type="number"
                    value={formData.config?.usageLimit || 50}
                    onChange={e =>
                      handleEditConfigChange(entry.id, 'usageLimit', Number(e.target.value))
                    }
                    onBlur={() => handleEditFieldBlur(entry.id, 'usageLimit')}
                    isInvalid={!!entryValidationErrors.usageLimit}
                    errorMessage={entryValidationErrors.usageLimit}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    label="Valid From"
                    labelPlacement="outside"
                    value={stringToCalendarDate(formData.validFrom || '')}
                    onChange={value => {
                      const dateString = value ? calendarDateToString(value) : ''
                      handleEditFieldChange(entry.id, 'validFrom', dateString)
                    }}
                    onBlur={() => handleEditFieldBlur(entry.id, 'validFrom')}
                    isInvalid={!!entryValidationErrors.validFrom}
                    errorMessage={entryValidationErrors.validFrom}
                  />
                  <DatePicker
                    label="Valid Until"
                    labelPlacement="outside"
                    value={stringToCalendarDate(formData.validUntil || '')}
                    onChange={value => {
                      const dateString = value ? calendarDateToString(value) : ''
                      handleEditFieldChange(entry.id, 'validUntil', dateString)
                    }}
                    onBlur={() => handleEditFieldBlur(entry.id, 'validUntil')}
                    isInvalid={!!entryValidationErrors.validUntil}
                    errorMessage={entryValidationErrors.validUntil}
                  />
                </div>
                <Input
                  label="Details (optional)"
                  value={formData.details || ''}
                  onChange={e => handleEditFieldChange(entry.id, 'details', e.target.value)}
                  onBlur={() => handleEditFieldBlur(entry.id, 'details')}
                  placeholder="e.g., Limited time offer"
                  isInvalid={!!entryValidationErrors.details}
                  errorMessage={entryValidationErrors.details}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="flat" onPress={() => handleCancelEdit(entry.id)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => handleSaveEdit(entry.id)}
                    isDisabled={!entryIsDirty || hasEntryValidationErrors}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Read-only Display */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{entry.name}</span>
                    <span className="ml-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {entry.config?.code}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="danger"
                      isIconOnly
                      variant="flat"
                      onPress={() => onRemoveEntry(discount.id, entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      isIconOnly
                      onPress={() => handleEditEntry(entry)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {entry.value}% off • Valid: {entry.validFrom} to {entry.validUntil}
                </div>
                <div className="text-xs text-gray-500">
                  Usage limit: {entry.config?.usageLimit || 'Unlimited'}
                </div>
                {entry.details && <div className="text-xs text-gray-500">{entry.details}</div>}
              </>
            )}
          </div>
        )
      })}

      {/* Add New Entry Button or Form */}
      {!showAddForm ? (
        <Button
          variant="bordered"
          className="w-full border-2 border-dashed"
          onPress={handleShowAddForm}
        >
          + Add Discount
        </Button>
      ) : (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded p-3 flex flex-col gap-3">
          <div className="font-medium text-gray-700 dark:text-gray-300">Add New Promo Code</div>
          <Input
            label="Promo Name"
            value={addFormData.name}
            onChange={e => {
              setAddFormData({ ...addFormData, name: e.target.value })
              if (addValidationErrors.name) {
                setAddValidationErrors(prev => ({ ...prev, name: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('name')}
            placeholder="e.g., Summer 2026 Promo"
            maxLength={30}
            isInvalid={!!addValidationErrors.name}
            errorMessage={addValidationErrors.name}
          />
          <Input
            label="Promo Code"
            value={addFormData.config.code}
            onChange={e => {
              setAddFormData({
                ...addFormData,
                config: { ...addFormData.config, code: e.target.value.toUpperCase() },
              })
              if (addValidationErrors.code) {
                setAddValidationErrors(prev => ({ ...prev, code: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('code')}
            placeholder="e.g., SUMMER2026"
            isInvalid={!!addValidationErrors.code}
            errorMessage={addValidationErrors.code}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Discount %"
              type="number"
              value={addFormData.value}
              onChange={e => {
                setAddFormData({ ...addFormData, value: Number(e.target.value) })
                if (addValidationErrors.value) {
                  setAddValidationErrors(prev => ({ ...prev, value: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('value')}
              isInvalid={!!addValidationErrors.value}
              errorMessage={addValidationErrors.value}
            />
            <Input
              label="Usage Limit"
              type="number"
              value={addFormData.config.usageLimit}
              onChange={e => {
                setAddFormData({
                  ...addFormData,
                  config: { ...addFormData.config, usageLimit: Number(e.target.value) },
                })
                if (addValidationErrors.usageLimit) {
                  setAddValidationErrors(prev => ({ ...prev, usageLimit: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('usageLimit')}
              isInvalid={!!addValidationErrors.usageLimit}
              errorMessage={addValidationErrors.usageLimit}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DatePicker
              label="Valid From"
              labelPlacement="outside"
              value={stringToCalendarDate(addFormData.validFrom)}
              onChange={value => {
                const dateString = value ? calendarDateToString(value) : ''
                setAddFormData({ ...addFormData, validFrom: dateString })
                if (addValidationErrors.validFrom) {
                  setAddValidationErrors(prev => ({ ...prev, validFrom: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('validFrom')}
              isInvalid={!!addValidationErrors.validFrom}
              errorMessage={addValidationErrors.validFrom}
            />
            <DatePicker
              label="Valid Until"
              labelPlacement="outside"
              value={stringToCalendarDate(addFormData.validUntil)}
              onChange={value => {
                const dateString = value ? calendarDateToString(value) : ''
                setAddFormData({ ...addFormData, validUntil: dateString })
                if (addValidationErrors.validUntil) {
                  setAddValidationErrors(prev => ({ ...prev, validUntil: undefined }))
                }
              }}
              onBlur={() => handleAddFieldBlur('validUntil')}
              isInvalid={!!addValidationErrors.validUntil}
              errorMessage={addValidationErrors.validUntil}
            />
          </div>
          <Input
            label="Details (optional)"
            value={addFormData.details || ''}
            onChange={e => {
              setAddFormData({ ...addFormData, details: e.target.value })
              if (addValidationErrors.details) {
                setAddValidationErrors(prev => ({ ...prev, details: undefined }))
              }
            }}
            onBlur={() => handleAddFieldBlur('details')}
            placeholder="e.g., Limited time offer"
            isInvalid={!!addValidationErrors.details}
            errorMessage={addValidationErrors.details}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="flat" onPress={handleCancelAdd}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={handleSaveAdd}
              isDisabled={hasAddValidationErrors}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
