'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react'
import { EmojiPicker } from '@world-schools/ui-web'
import {
  ADD_ON_TYPES,
  type AddOn,
  type AddOnType,
  type CreateAddOnDto,
  PRICING_UNITS,
} from '@/types/add-ons'
import { useAddOnsStore } from '@/stores/add-ons.store'

interface AddOnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  addOn?: AddOn | null
}

export function AddOnModal({ isOpen, onClose, onSuccess, addOn }: AddOnModalProps) {
  const { createAddOn, updateAddOn, isLoading } = useAddOnsStore()

  const [formData, setFormData] = useState<CreateAddOnDto>({
    name: '',
    description: '',
    icon: '🎾',
    type: 'activity',
    price: 0,
    pricingUnit: 'per_child',
    maxQuantity: undefined,
    quantityUnit: '',
    minAge: undefined,
    maxAge: undefined,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (addOn) {
      setFormData({
        name: addOn.name,
        description: addOn.description || '',
        icon: addOn.icon || '🎾',
        type: addOn.type,
        price: addOn.price,
        pricingUnit: addOn.pricingUnit,
        maxQuantity: addOn.maxQuantity,
        quantityUnit: addOn.quantityUnit || '',
        minAge: addOn.minAge,
        maxAge: addOn.maxAge,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        icon: '🎾',
        type: 'activity',
        price: 0,
        pricingUnit: 'per_child',
        maxQuantity: undefined,
        quantityUnit: '',
        minAge: undefined,
        maxAge: undefined,
      })
    }
    setErrors({})
  }, [addOn, isOpen])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }

    if (formData.minAge && formData.maxAge && formData.minAge > formData.maxAge) {
      newErrors.minAge = 'Min age cannot be greater than max age'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      if (addOn) {
        await updateAddOn(addOn.id, formData)
      } else {
        await createAddOn(formData)
      }
      onSuccess()
    } catch (error) {
      console.error('Failed to save add-on:', error)
    }
  }

  const handleTypeSelect = (type: AddOnType) => {
    setFormData(prev => ({ ...prev, type }))
    // Set default icon based on type
    const typeConfig = ADD_ON_TYPES.find(t => t.value === type)
    if (typeConfig) {
      setFormData(prev => ({ ...prev, icon: typeConfig.icon }))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[90vh]',
      }}
    >
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">
          {addOn ? 'Edit Add-on' : 'Create Add-on'}
        </ModalHeader>
        <ModalBody className="gap-5">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Add-on Type <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ADD_ON_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeSelect(type.value as AddOnType)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    formData.type === type.value
                      ? 'border-primary bg-primary-50'
                      : 'border-default-200 hover:border-primary'
                  }`}
                >
                  <div className="text-xl mb-1">{type.icon}</div>
                  <div className="text-sm font-semibold text-default-900">{type.label}</div>
                  <div className="text-xs text-default-500 mt-0.5">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <Input
            label="Name"
            placeholder="e.g., Tennis Lessons, Airport Transfer"
            value={formData.name}
            onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
            isRequired
            errorMessage={errors.name}
            isInvalid={!!errors.name}
          />

          {/* Description */}
          <Textarea
            label="Description"
            placeholder="Describe what's included in this add-on..."
            value={formData.description}
            onValueChange={value => setFormData(prev => ({ ...prev, description: value }))}
            description="This will be shown to parents during booking"
            minRows={3}
          />

          {/* Icon */}
          <EmojiPicker
            value={formData.icon}
            onChange={value => setFormData(prev => ({ ...prev, icon: value }))}
            label="Icon"
            description="Choose an emoji to represent this add-on"
          />

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Price"
              placeholder="75"
              value={formData.price.toString()}
              onValueChange={value =>
                setFormData(prev => ({ ...prev, price: parseFloat(value) || 0 }))
              }
              isRequired
              errorMessage={errors.price}
              isInvalid={!!errors.price}
              startContent={<span className="text-default-400">CHF</span>}
            />
            <Select
              label="Charged Per"
              selectedKeys={[formData.pricingUnit]}
              onSelectionChange={keys => {
                const value = Array.from(keys)[0] as string
                setFormData(prev => ({ ...prev, pricingUnit: value as any }))
              }}
              isRequired
            >
              {PRICING_UNITS.map(unit => (
                <SelectItem key={unit.value}>{unit.label}</SelectItem>
              ))}
            </Select>
          </div>

          {/* Quantity Limits */}
          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Quantity Limits
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="3"
                value={formData.maxQuantity?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    maxQuantity: value ? parseInt(value) : undefined,
                  }))
                }
                className="max-w-28"
                startContent={<span className="text-default-400 text-sm">Max:</span>}
              />
              <Input
                placeholder="per week"
                value={formData.quantityUnit}
                onValueChange={value => setFormData(prev => ({ ...prev, quantityUnit: value }))}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-default-400 mt-1.5">Leave empty for no limit</p>
          </div>

          {/* Age Restriction */}
          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Age Restriction (optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Min Age"
                placeholder="Any"
                value={formData.minAge?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    minAge: value ? parseInt(value) : undefined,
                  }))
                }
                errorMessage={errors.minAge}
                isInvalid={!!errors.minAge}
              />
              <Input
                type="number"
                label="Max Age"
                placeholder="Any"
                value={formData.maxAge?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    maxAge: value ? parseInt(value) : undefined,
                  }))
                }
              />
            </div>
            <p className="text-sm text-default-400 mt-1.5">Leave empty if available for all ages</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isLoading}>
            {addOn ? 'Save Changes' : 'Create Add-on'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
