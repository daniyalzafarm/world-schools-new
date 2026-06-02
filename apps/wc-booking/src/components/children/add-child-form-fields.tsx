'use client'

import React, { useState } from 'react'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { Button, Radio, RadioGroup } from '@heroui/react'
import { DatePicker, Input } from '@world-schools/ui-web'

export interface AddChildFormValues {
  firstName: string
  lastName: string
  dateOfBirth: DateValue | null
  gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
}

export interface AddChildFormErrors {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  gender?: string
}

export interface AddChildPayload {
  firstName: string
  lastName?: string
  dateOfBirth: string
  gender: AddChildFormValues['gender']
}

interface AddChildFormFieldsProps {
  formData: AddChildFormValues
  errors: AddChildFormErrors
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onDateOfBirthChange: (value: DateValue | null) => void
  onGenderChange: (value: AddChildFormValues['gender']) => void
}

function AddChildFormFields({
  formData,
  errors,
  onFirstNameChange,
  onLastNameChange,
  onDateOfBirthChange,
  onGenderChange,
}: AddChildFormFieldsProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="First name"
          labelPlacement="outside"
          placeholder="Enter first name"
          value={formData.firstName}
          onValueChange={onFirstNameChange}
          isRequired
          isInvalid={!!errors.firstName}
          errorMessage={errors.firstName}
        />

        <Input
          label="Last name"
          labelPlacement="outside"
          placeholder="Enter last name (optional)"
          value={formData.lastName}
          onValueChange={onLastNameChange}
          isInvalid={!!errors.lastName}
          errorMessage={errors.lastName}
        />
      </div>

      <DatePicker
        label="Date of birth"
        labelPlacement="outside"
        placeholderValue={new CalendarDate(2015, 1, 1)}
        value={formData.dateOfBirth}
        onChange={onDateOfBirthChange}
        showMonthAndYearPickers
        isRequired
        isInvalid={!!errors.dateOfBirth}
        errorMessage={errors.dateOfBirth}
      />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Gender <span className="text-danger">*</span>
        </label>
        <RadioGroup
          value={formData.gender}
          onValueChange={value => onGenderChange(value as AddChildFormValues['gender'])}
          orientation="horizontal"
          classNames={{ wrapper: 'gap-3' }}
        >
          <Radio value="girl">Girl</Radio>
          <Radio value="boy">Boy</Radio>
          <Radio value="non_binary">Non-binary</Radio>
          <Radio value="prefer_not_to_say">Prefer not to say</Radio>
        </RadioGroup>
        {errors.gender ? <p className="text-xs text-danger mt-1">{errors.gender}</p> : null}
      </div>
    </div>
  )
}

function calendarDateToString(date: DateValue | null): string {
  if (!date) return ''
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function validate(values: AddChildFormValues): AddChildFormErrors {
  const errors: AddChildFormErrors = {}

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required'
  } else if (values.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters'
  } else if (values.firstName.trim().length > 50) {
    errors.firstName = 'First name must be at most 50 characters'
  }

  if (values.lastName.trim()) {
    if (values.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters'
    } else if (values.lastName.trim().length > 50) {
      errors.lastName = 'Last name must be at most 50 characters'
    }
  }

  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else {
    const today = new Date()
    const birthDate = new Date(
      values.dateOfBirth.year,
      values.dateOfBirth.month - 1,
      values.dateOfBirth.day
    )
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const adjustedAge =
      monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age

    if (adjustedAge < 3) {
      errors.dateOfBirth = 'Child must be at least 3 years old'
    } else if (adjustedAge > 18) {
      errors.dateOfBirth = 'The child must not exceed 18 years of age'
    }
  }

  if (!values.gender) {
    errors.gender = 'Gender is required'
  }

  return errors
}

interface AddChildFormProps<T = unknown> {
  onSubmit: (payload: AddChildPayload) => Promise<T | null>
  onSuccess?: (result: T) => void | Promise<void>
  onCancel?: () => void
  submitLabel?: string
  submitColor?: 'primary' | 'secondary'
  cancelLabel?: string
  className?: string
}

export function AddChildForm<T = unknown>({
  onSubmit,
  onSuccess,
  onCancel,
  submitLabel = 'Create profile',
  submitColor = 'secondary',
  cancelLabel = 'Cancel',
  className,
}: AddChildFormProps<T>) {
  const [formData, setFormData] = useState<AddChildFormValues>({
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    gender: 'boy',
  })
  const [errors, setErrors] = useState<AddChildFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: null,
      gender: 'boy',
    })
    setErrors({})
  }

  const handleSubmit = async () => {
    const nextErrors = validate(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const result = await onSubmit({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        dateOfBirth: calendarDateToString(formData.dateOfBirth),
        gender: formData.gender,
      })

      if (result === null) return

      if (onSuccess) {
        await onSuccess(result as T)
      }
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <AddChildFormFields
        formData={formData}
        errors={errors}
        onFirstNameChange={value => {
          setFormData(prev => ({ ...prev, firstName: value }))
          if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined }))
        }}
        onLastNameChange={value => {
          setFormData(prev => ({ ...prev, lastName: value }))
          if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined }))
        }}
        onDateOfBirthChange={date => {
          setFormData(prev => ({ ...prev, dateOfBirth: date }))
          if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: undefined }))
        }}
        onGenderChange={value => {
          setFormData(prev => ({ ...prev, gender: value }))
          if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined }))
        }}
      />

      <p className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-5 text-gray-600">
        After adding, complete this child&apos;s{' '}
        <span className="font-semibold">emergency contact</span> (and medical info for overnight
        camps) in their profile — these are required to book.
      </p>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <Button
          variant="light"
          isDisabled={isSubmitting}
          onPress={() => {
            resetForm()
            onCancel?.()
          }}
        >
          {cancelLabel}
        </Button>
        <Button color={submitColor} isLoading={isSubmitting} onPress={handleSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
