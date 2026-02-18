'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
} from '@heroui/react'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { DatePicker, Input } from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'

interface AddChildModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormData {
  firstName: string
  lastName: string
  dateOfBirth: DateValue | null
  gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
}

interface FormErrors {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  gender?: string
}

export function AddChildModal({ isOpen, onClose }: AddChildModalProps) {
  const router = useRouter()
  const { addChild, isLoading } = useChildrenStore()

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    gender: 'boy',
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // Helper to convert DateValue to ISO string
  const calendarDateToString = (date: DateValue | null): string => {
    if (!date) return ''
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  }

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    } else if (formData.firstName.trim().length > 50) {
      newErrors.firstName = 'First name must be at most 50 characters'
    }

    // Last name validation (optional but must meet length requirements if provided)
    if (formData.lastName.trim()) {
      if (formData.lastName.trim().length < 2) {
        newErrors.lastName = 'Last name must be at least 2 characters'
      } else if (formData.lastName.trim().length > 50) {
        newErrors.lastName = 'Last name must be at most 50 characters'
      }
    }

    // Date of birth validation
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required'
    } else {
      // Check age (must be 3-18 years old)
      const today = new Date()
      const birthDate = new Date(
        formData.dateOfBirth.year,
        formData.dateOfBirth.month - 1,
        formData.dateOfBirth.day
      )
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const adjustedAge =
        monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age

      if (adjustedAge < 3) {
        newErrors.dateOfBirth = 'Child must be at least 3 years old'
      } else if (adjustedAge > 18) {
        newErrors.dateOfBirth = 'Child must be at most 18 years old'
      }
    }

    // Gender validation
    if (!formData.gender) {
      newErrors.gender = 'Gender is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return

    const childData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim() || undefined,
      dateOfBirth: calendarDateToString(formData.dateOfBirth),
      gender: formData.gender,
    }

    const success = await addChild(childData)

    if (success) {
      // Get the newly created child ID from the store
      const children = useChildrenStore.getState().children
      const newChild = children[children.length - 1]

      // Show success toast
      addToast({
        title: 'Success',
        description: 'Profile created! Complete the remaining sections to enable booking.',
        color: 'success',
      })

      // Close modal and reset form
      onClose()
      setFormData({
        firstName: '',
        lastName: '',
        dateOfBirth: null,
        gender: 'boy',
      })
      setErrors({})

      // Redirect to child profile page
      router.push(`/children/${newChild.id}/profile`)
    }
  }

  // Handle modal close
  const handleClose = () => {
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: null,
      gender: 'boy',
    })
    setErrors({})
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Add a child</ModalHeader>
        <ModalBody className="gap-5">
          <div className="flex gap-4">
            {/* First Name */}
            <Input
              label="First name"
              labelPlacement="outside"
              placeholder="Enter first name"
              value={formData.firstName}
              onValueChange={value => {
                setFormData(prev => ({ ...prev, firstName: value }))
                if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined }))
              }}
              isRequired
              isInvalid={!!errors.firstName}
              errorMessage={errors.firstName}
            />

            {/* Last Name */}
            <Input
              label="Last name"
              labelPlacement="outside"
              placeholder="Enter last name (optional)"
              value={formData.lastName}
              onValueChange={value => {
                setFormData(prev => ({ ...prev, lastName: value }))
                if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined }))
              }}
              isInvalid={!!errors.lastName}
              errorMessage={errors.lastName}
            />
          </div>

          {/* Date of Birth */}
          <div>
            <DatePicker
              label="Date of birth"
              labelPlacement="outside"
              placeholderValue={new CalendarDate(2015, 1, 1)}
              value={formData.dateOfBirth}
              onChange={date => {
                setFormData(prev => ({ ...prev, dateOfBirth: date }))
                if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: undefined }))
              }}
              showMonthAndYearPickers
              isRequired
              isInvalid={!!errors.dateOfBirth}
              errorMessage={errors.dateOfBirth}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Gender <span className="text-danger">*</span>
            </label>
            <RadioGroup
              value={formData.gender}
              onValueChange={value => {
                setFormData(prev => ({
                  ...prev,
                  gender: value as 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say',
                }))
                if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined }))
              }}
              orientation="horizontal"
              classNames={{
                wrapper: 'gap-3',
              }}
            >
              <Radio value="girl">Girl</Radio>
              <Radio value="boy">Boy</Radio>
              <Radio value="non_binary">Non-binary</Radio>
              <Radio value="prefer_not_to_say">Prefer not to say</Radio>
            </RadioGroup>
            {errors.gender && <p className="text-xs text-danger mt-1">{errors.gender}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button color="secondary" onPress={handleSubmit} isLoading={isLoading}>
            Create profile
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
