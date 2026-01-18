'use client'

import { useState } from 'react'
import { Button, Card, CardBody, Input, Switch } from '@heroui/react'
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
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <h3 className="text-[18px] font-semibold text-default-900">Basic Information</h3>

          {/* Session Name */}
          <Input
            label="Session Name"
            placeholder="e.g., Week 1 - Summer Camp"
            value={formData.name}
            onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
            isInvalid={!!errors.name}
            errorMessage={errors.name}
            isRequired
          />

          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Start Date"
              value={formData.sessionStartDate}
              onValueChange={value => setFormData(prev => ({ ...prev, sessionStartDate: value }))}
              isInvalid={!!errors.dates}
              isRequired
            />
            <Input
              type="date"
              label="End Date"
              value={formData.sessionEndDate}
              onValueChange={value => setFormData(prev => ({ ...prev, sessionEndDate: value }))}
              isInvalid={!!errors.dates}
              errorMessage={errors.dates}
              isRequired
            />
          </div>
        </CardBody>
      </Card>

      {/* Pricing */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <h3 className="text-[18px] font-semibold text-default-900">Pricing</h3>

          <Input
            type="number"
            label="Price (USD)"
            placeholder="1200"
            value={formData.price.toString()}
            onValueChange={value =>
              setFormData(prev => ({ ...prev, price: parseFloat(value) || 0 }))
            }
            isInvalid={!!errors.price}
            errorMessage={errors.price}
            min={0}
            isRequired
          />
        </CardBody>
      </Card>

      {/* Capacity */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-default-900">Capacity</h3>
              <p className="text-[13px] text-default-600 mt-1">
                Set a maximum number of participants for this session
              </p>
            </div>
            <Switch isSelected={hasCapacityLimit} onValueChange={handleCapacityToggle} />
          </div>

          {hasCapacityLimit && (
            <Input
              type="number"
              label="Maximum Capacity"
              placeholder="50"
              value={formData.capacity?.toString() || ''}
              onValueChange={value =>
                setFormData(prev => ({ ...prev, capacity: parseInt(value) || undefined }))
              }
              isInvalid={!!errors.capacity}
              errorMessage={errors.capacity}
              min={1}
              isRequired
            />
          )}

          {!hasCapacityLimit && (
            <div className="bg-default-100 dark:bg-default-800 rounded-lg p-4">
              <p className="text-[13px] text-default-600">
                This session will have unlimited capacity
              </p>
            </div>
          )}
        </CardBody>
      </Card>

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
