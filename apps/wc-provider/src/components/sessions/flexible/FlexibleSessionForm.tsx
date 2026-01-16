'use client'

import { useEffect, useState } from 'react'
import { Button, Card, CardBody, Divider, Input } from '@heroui/react'
import { Calendar, Plus, Trash2 } from 'lucide-react'
import type { BlackoutDate, Duration, FlexibleSession } from '@/types/sessions'
import { useSessionValidation } from '@/hooks/useSessionValidation'
import { formatDateForInput } from '@/utils/sessionFormatters'

interface FlexibleSessionFormProps {
  session?: FlexibleSession
  onSubmit: (data: FlexibleSessionFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export interface FlexibleSessionFormData {
  name: string
  startDate: string
  endDate: string
  durations: Duration[]
  blackoutDates: BlackoutDate[]
}

/**
 * Flexible Session Form Component
 * Form for creating/editing flexible sessions
 * Reference: Design flex-session-3.2.png
 */
export function FlexibleSessionForm({
  session,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: FlexibleSessionFormProps) {
  const validation = useSessionValidation()

  // Form state
  const [formData, setFormData] = useState<FlexibleSessionFormData>({
    name: session?.name || '',
    startDate: session?.startDate ? formatDateForInput(session.startDate) : '',
    endDate: session?.endDate ? formatDateForInput(session.endDate) : '',
    durations: session?.durations ?? [{ weeks: 2, price: 0 }],
    blackoutDates: session?.blackoutDates ?? [],
  })

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate name
    const nameError = validation.validateSessionName(formData.name)
    if (nameError) newErrors.name = nameError

    // Validate dates
    const dateError = validation.validateDateRange(formData.startDate, formData.endDate)
    if (dateError) newErrors.dates = dateError

    // Validate durations
    const durationsError = validation.validateDurations(formData.durations)
    if (durationsError) newErrors.durations = durationsError

    // Validate blackout dates
    if (formData.blackoutDates.length > 0) {
      const blackoutError = validation.validateBlackoutDates(
        formData.blackoutDates,
        formData.startDate,
        formData.endDate
      )
      if (blackoutError) newErrors.blackoutDates = blackoutError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  // Add duration
  const addDuration = () => {
    setFormData(prev => ({
      ...prev,
      durations: [...prev.durations, { weeks: 1, price: 0 }],
    }))
  }

  // Remove duration
  const removeDuration = (index: number) => {
    setFormData(prev => ({
      ...prev,
      durations: prev.durations.filter((_, i) => i !== index),
    }))
  }

  // Update duration
  const updateDuration = (index: number, field: keyof Duration, value: number) => {
    setFormData(prev => ({
      ...prev,
      durations: prev.durations.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  // Add blackout date
  const addBlackoutDate = () => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: [...prev.blackoutDates, { start: '', end: '' }],
    }))
  }

  // Remove blackout date
  const removeBlackoutDate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: prev.blackoutDates.filter((_, i) => i !== index),
    }))
  }

  // Update blackout date
  const updateBlackoutDate = (index: number, field: keyof BlackoutDate, value: string) => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: prev.blackoutDates.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold text-default-900 mb-2">
          {session ? 'Edit Flexible Session' : 'Create Flexible Session'}
        </h2>
        <p className="text-[14px] text-default-600">
          Set up a flexible session where parents can choose their own start date and duration.
        </p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <h3 className="text-[18px] font-semibold text-default-900">Basic Information</h3>

          {/* Session Name */}
          <Input
            label="Session Name"
            placeholder="e.g., Summer 2024 Language Immersion"
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
              value={formData.startDate}
              onValueChange={value => setFormData(prev => ({ ...prev, startDate: value }))}
              isInvalid={!!errors.dates}
              isRequired
            />
            <Input
              type="date"
              label="End Date"
              value={formData.endDate}
              onValueChange={value => setFormData(prev => ({ ...prev, endDate: value }))}
              isInvalid={!!errors.dates}
              errorMessage={errors.dates}
              isRequired
            />
          </div>
        </CardBody>
      </Card>

      {/* Duration Options */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-default-900">Duration Options</h3>
              <p className="text-[13px] text-default-600 mt-1">
                Add different duration options with their respective pricing
              </p>
            </div>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              startContent={<Plus className="w-4 h-4" />}
              onPress={addDuration}
            >
              Add Duration
            </Button>
          </div>

          {errors.durations && (
            <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-3">
              <p className="text-[13px] text-danger-700 dark:text-danger-300">{errors.durations}</p>
            </div>
          )}

          <div className="space-y-3">
            {formData.durations.map((duration, index) => (
              <div key={index} className="flex items-end gap-3">
                <Input
                  type="number"
                  label="Weeks"
                  placeholder="2"
                  value={duration.weeks.toString()}
                  onValueChange={value => updateDuration(index, 'weeks', parseInt(value) || 0)}
                  min={1}
                  max={12}
                  className="flex-1"
                />
                <Input
                  type="number"
                  label="Days (optional)"
                  placeholder="0"
                  value={duration.days?.toString() || '0'}
                  onValueChange={value => updateDuration(index, 'days', parseInt(value) || 0)}
                  min={0}
                  max={6}
                  className="flex-1"
                />
                <Input
                  type="number"
                  label="Price (USD)"
                  placeholder="1200"
                  value={duration.price.toString()}
                  onValueChange={value => updateDuration(index, 'price', parseFloat(value) || 0)}
                  min={0}
                  className="flex-1"
                />
                {formData.durations.length > 1 && (
                  <Button
                    isIconOnly
                    color="danger"
                    variant="flat"
                    onPress={() => removeDuration(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Blackout Dates */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-default-900">
                Blackout Dates (Optional)
              </h3>
              <p className="text-[13px] text-default-600 mt-1">
                Block specific date ranges when the camp is closed
              </p>
            </div>
            <Button
              size="sm"
              color="default"
              variant="flat"
              startContent={<Plus className="w-4 h-4" />}
              onPress={addBlackoutDate}
            >
              Add Blackout
            </Button>
          </div>

          {errors.blackoutDates && (
            <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-3">
              <p className="text-[13px] text-danger-700 dark:text-danger-300">
                {errors.blackoutDates}
              </p>
            </div>
          )}

          {formData.blackoutDates.length > 0 && (
            <div className="space-y-3">
              {formData.blackoutDates.map((blackout, index) => (
                <div key={index} className="flex items-end gap-3">
                  <Input
                    type="date"
                    label="Start Date"
                    value={blackout.start}
                    onValueChange={value => updateBlackoutDate(index, 'start', value)}
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    label="End Date"
                    value={blackout.end}
                    onValueChange={value => updateBlackoutDate(index, 'end', value)}
                    className="flex-1"
                  />
                  <Button
                    isIconOnly
                    color="danger"
                    variant="flat"
                    onPress={() => removeBlackoutDate(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {formData.blackoutDates.length === 0 && (
            <div className="text-center py-6 text-default-400 text-[13px]">
              No blackout dates added
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
