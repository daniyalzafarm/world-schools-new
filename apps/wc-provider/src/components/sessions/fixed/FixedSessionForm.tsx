'use client'

import { useState } from 'react'
import { Button, Switch } from '@heroui/react'
import { Input } from '@world-schools/ui-web'
import type { FixedSession } from '@/types/sessions'
import { useSessionValidation } from '@/hooks/useSessionValidation'
import { formatDateForInput } from '@/utils/sessionFormatters'

interface FixedSessionFormProps {
  session?: FixedSession
  onSubmit: (data: FixedSessionFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export interface FixedSessionFormData {
  name: string
  description: string
  sessionStartDate: string
  sessionEndDate: string
  price: number
  capacity?: number
}

/**
 * Fixed Session Form Component
 * Form for creating/editing fixed sessions
 */
export function FixedSessionForm({
  session,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: FixedSessionFormProps) {
  const validation = useSessionValidation()

  // Form state
  const [formData, setFormData] = useState<FixedSessionFormData>({
    name: session?.name || '',
    description: session?.description || '',
    sessionStartDate: session?.sessionStartDate ? formatDateForInput(session.sessionStartDate) : '',
    sessionEndDate: session?.sessionEndDate ? formatDateForInput(session.sessionEndDate) : '',
    price: session?.price ?? 0,
    capacity: session?.capacity,
  })

  // Capacity toggle
  const [hasCapacityLimit, setHasCapacityLimit] = useState(session?.capacity !== undefined)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate name
    const nameError = validation.validateSessionName(formData.name)
    if (nameError) newErrors.name = nameError

    // Validate dates
    const dateError = validation.validateDateRange(
      formData.sessionStartDate,
      formData.sessionEndDate
    )
    if (dateError) newErrors.dates = dateError

    // Validate price
    const priceError = validation.validatePricing(formData.price)
    if (priceError) newErrors.price = priceError

    // Validate capacity if enabled
    if (hasCapacityLimit) {
      const capacityError = validation.validateCapacity(formData.capacity)
      if (capacityError) newErrors.capacity = capacityError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = () => {
    if (validateForm()) {
      const submitData = {
        ...formData,
        capacity: hasCapacityLimit ? formData.capacity : undefined,
      }
      onSubmit(submitData)
    }
  }

  // Handle capacity toggle
  const handleCapacityToggle = (enabled: boolean) => {
    setHasCapacityLimit(enabled)
    if (!enabled) {
      setFormData(prev => ({ ...prev, capacity: undefined }))
      setErrors(prev => {
        const { capacity, ...rest } = prev
        return rest
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Session Name */}
      <Input
        type="text"
        label="Session Name"
        labelPlacement="outside"
        placeholder="e.g., Week 1 - Summer Camp"
        value={formData.name}
        onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
        isRequired
        isInvalid={!!errors.name}
        errorMessage={errors.name}
      />

      {/* Date Range */}
      <div>
        <div className="mb-2">
          <label className="text-base font-semibold text-foreground">
            Session Dates
            <span className="ml-1 text-danger">*</span>
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Start Date"
            labelPlacement="outside"
            value={formData.sessionStartDate}
            onValueChange={value => setFormData(prev => ({ ...prev, sessionStartDate: value }))}
            isRequired
            isInvalid={!!errors.dates}
          />
          <Input
            type="date"
            label="End Date"
            labelPlacement="outside"
            value={formData.sessionEndDate}
            onValueChange={value => setFormData(prev => ({ ...prev, sessionEndDate: value }))}
            isRequired
            isInvalid={!!errors.dates}
          />
        </div>
        {errors.dates && <p className="mt-1.5 text-sm text-danger">{errors.dates}</p>}
      </div>

      {/* Pricing */}
      <Input
        type="number"
        label="Price (USD)"
        labelPlacement="outside"
        placeholder="1200"
        value={formData.price.toString()}
        onValueChange={value => setFormData(prev => ({ ...prev, price: parseFloat(value) || 0 }))}
        min={0}
        isRequired
        isInvalid={!!errors.price}
        errorMessage={errors.price}
      />

      {/* Capacity */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-base font-semibold text-foreground">Capacity</label>
          <Switch isSelected={hasCapacityLimit} onValueChange={handleCapacityToggle} />
        </div>
        <p className="mb-4 text-sm leading-normal text-default-500">
          Set a maximum number of participants for this session
        </p>

        {hasCapacityLimit && (
          <Input
            type="number"
            label="Maximum Capacity"
            labelPlacement="outside"
            placeholder="50"
            value={formData.capacity?.toString() || ''}
            onValueChange={value =>
              setFormData(prev => ({ ...prev, capacity: parseInt(value) || undefined }))
            }
            min={1}
            isRequired
            isInvalid={!!errors.capacity}
            errorMessage={errors.capacity}
          />
        )}

        {!hasCapacityLimit && (
          <div className="rounded-lg bg-default-100 p-4">
            <p className="text-sm text-default-500">This session will have unlimited capacity</p>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button variant="flat" onPress={onCancel} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isLoading={isSubmitting}
          className="font-semibold"
        >
          {session ? 'Update Session' : 'Create Session'}
        </Button>
      </div>
    </div>
  )
}
