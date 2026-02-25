'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from '@heroui/react'
import { CheckboxButton, CurrencyInput, Input } from '@world-schools/ui-web'
import type { AddSessionDiscountDto, SessionSpecificDiscount } from '@/types/discounts'
import type { AgeGroup } from '@/types/camps'

interface DiscountFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AddSessionDiscountDto) => Promise<void>
  ageGroups: AgeGroup[]
  showAgeGroupSelector: boolean // Only show when camp has 2+ age groups AND pricing is age_group
  editDiscount?: SessionSpecificDiscount | null
  currency: string
}

export function DiscountFormModal({
  isOpen,
  onClose,
  onSubmit,
  ageGroups,
  showAgeGroupSelector,
  editDiscount,
  currency,
}: DiscountFormModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState<number>(0)
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form when editing
  useEffect(() => {
    if (editDiscount) {
      setName(editDiscount.name)
      setType(editDiscount.type)
      setValue(editDiscount.value)
      setSelectedAgeGroups(editDiscount.ageGroups || [])
    } else {
      // Reset form
      setName('')
      setType('percent')
      setValue(0)
      setSelectedAgeGroups([])
    }
    setErrors({})
  }, [editDiscount, isOpen])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Discount name is required'
    } else if (name.length > 30) {
      newErrors.name = 'Discount name must be 30 characters or less'
    }

    if (value <= 0) {
      newErrors.value = 'Discount value must be greater than 0'
    }

    if (type === 'percent' && value > 100) {
      newErrors.value = 'Percentage discount cannot exceed 100%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        value,
        ageGroups: selectedAgeGroups,
      })
      onClose()
    } catch (error) {
      console.error('Failed to save discount:', error)
      setErrors({ submit: 'Failed to save discount. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAgeGroup = (ageGroupId: string) => {
    setSelectedAgeGroups(prev =>
      prev.includes(ageGroupId) ? prev.filter(id => id !== ageGroupId) : [...prev, ageGroupId]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{editDiscount ? 'Edit Discount' : 'Add Session Discount'}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Discount Name */}
            <Input
              label="Discount Name"
              placeholder="e.g., Early Bird, Sibling Discount"
              value={name}
              onChange={e => setName(e.target.value)}
              isRequired
              errorMessage={errors.name}
              isInvalid={!!errors.name}
              maxLength={30}
            />

            {/* Discount Type */}
            <Select
              label="Discount Type"
              selectedKeys={[type]}
              onSelectionChange={keys => setType(Array.from(keys)[0] as 'percent' | 'fixed')}
              isRequired
              labelPlacement="outside"
            >
              <SelectItem key="percent">Percentage (%)</SelectItem>
              <SelectItem key="fixed">Fixed Amount ({currency})</SelectItem>
            </Select>

            {/* Discount Value */}
            {type === 'percent' ? (
              <Input
                label="Discount Percentage"
                type="number"
                value={value.toString()}
                onChange={e => setValue(parseFloat(e.target.value) || 0)}
                isRequired
                errorMessage={errors.value}
                isInvalid={!!errors.value}
                endContent={<span className="text-gray-500">%</span>}
                min={0}
                max={100}
                step={1}
              />
            ) : (
              <CurrencyInput
                label="Discount Amount"
                value={value}
                onValueChange={val => setValue(val ?? 0)}
                currency={currency}
                isRequired
                errorMessage={errors.value}
                isInvalid={!!errors.value}
              />
            )}

            {/* Age Group Selector - Conditional */}
            {showAgeGroupSelector && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Apply to Age Groups (optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">Leave empty to apply to all age groups</p>
                <div className="flex flex-wrap gap-2">
                  {ageGroups.map(ag => {
                    const ageGroupId = `${ag.min}-${ag.max}`
                    return (
                      <CheckboxButton
                        key={ageGroupId}
                        id={ageGroupId}
                        value={ageGroupId}
                        label={`${ag.min}-${ag.max} years`}
                        checked={selectedAgeGroups.includes(ageGroupId)}
                        onChange={() => toggleAgeGroup(ageGroupId)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors.submit && <div className="text-sm text-danger">{errors.submit}</div>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            {editDiscount ? 'Save Changes' : 'Add Discount'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
