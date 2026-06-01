'use client'

import { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { CurrencyInput, EmojiPicker, Input, SelectField, Textarea } from '@world-schools/ui-web'
import {
  ADD_ON_TYPES,
  type AddOn,
  type AddOnType,
  type CreateAddOnDto,
  PRICING_UNITS,
  type PricingUnit,
} from '@/types/add-ons'
import { useAddOnsStore } from '@/stores/add-ons.store'

interface AddOnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  addOn?: AddOn | null
  /** Provider's settlement currency. Add-on prices are always denominated in this. */
  providerCurrency: string
}

const DEFAULT_TYPE: AddOnType = 'activity'
const typeDefaultIcon = (type: AddOnType): string =>
  ADD_ON_TYPES.find(t => t.value === type)?.icon ?? ''

const buildInitialFormData = (addOn?: AddOn | null): CreateAddOnDto => {
  if (addOn) {
    return {
      name: addOn.name,
      description: addOn.description || '',
      icon: addOn.icon || typeDefaultIcon(addOn.type),
      type: addOn.type,
      price: addOn.price,
      pricingUnit: addOn.pricingUnit,
      maxQuantity: addOn.maxQuantity,
      quantityUnit: addOn.quantityUnit || '',
      minAge: addOn.minAge,
      maxAge: addOn.maxAge,
    }
  }
  return {
    name: '',
    description: '',
    icon: typeDefaultIcon(DEFAULT_TYPE),
    type: DEFAULT_TYPE,
    price: 0,
    pricingUnit: 'per_child',
    maxQuantity: undefined,
    quantityUnit: '',
    minAge: undefined,
    maxAge: undefined,
  }
}

export function AddOnModal({
  isOpen,
  onClose,
  onSuccess,
  addOn,
  providerCurrency,
}: AddOnModalProps) {
  const { createAddOn, updateAddOn, isLoading } = useAddOnsStore()

  const [formData, setFormData] = useState<CreateAddOnDto>(() => buildInitialFormData(addOn))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setFormData(buildInitialFormData(addOn))
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

    const result = addOn ? await updateAddOn(addOn.id, formData) : await createAddOn(formData)
    if (!result) return // store has already shown an error toast

    addToast({
      title: addOn ? 'Add-on updated' : 'Add-on created',
      color: 'success',
    })
    onSuccess()
  }

  const handleTypeSelect = (type: AddOnType) => {
    setFormData(prev => {
      const prevDefault = typeDefaultIcon(prev.type)
      const userCustomized = prev.icon && prev.icon !== prevDefault
      return {
        ...prev,
        type,
        icon: userCustomized ? prev.icon : typeDefaultIcon(type),
      }
    })
  }

  const currency = providerCurrency

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
          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Add-on Type <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add-on type">
              {ADD_ON_TYPES.map(type => {
                const selected = formData.type === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleTypeSelect(type.value as AddOnType)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                        : 'border-default-200 hover:border-default-300 bg-content1'
                    }`}
                  >
                    <div className="text-xl mb-1">{type.icon}</div>
                    <div className="text-sm font-semibold text-default-900">{type.label}</div>
                    <div className="text-xs text-default-500 mt-0.5">{type.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <EmojiPicker
              value={formData.icon}
              onChange={value => setFormData(prev => ({ ...prev, icon: value }))}
              label="Icon"
            />
            <Input
              label="Name"
              placeholder="e.g., Tennis Lessons, Airport Transfer"
              value={formData.name}
              onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
              isRequired
              errorMessage={errors.name}
              isInvalid={!!errors.name}
            />
          </div>

          <Textarea
            label="Description"
            placeholder="Describe what's included in this add-on..."
            value={formData.description}
            onValueChange={value => setFormData(prev => ({ ...prev, description: value }))}
            description="This will be shown to parents during booking"
            minRows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              label="Price"
              placeholder="75"
              value={formData.price}
              onValueChange={value => setFormData(prev => ({ ...prev, price: value ?? 0 }))}
              currency={currency}
              isRequired
              errorMessage={errors.price}
              isInvalid={!!errors.price}
            />
            <SelectField
              aria-label="Charged per"
              label="Charged Per"
              isRequired
              value={formData.pricingUnit}
              onChange={value =>
                setFormData(prev => ({ ...prev, pricingUnit: value as PricingUnit }))
              }
              options={PRICING_UNITS.map(unit => ({ value: unit.value, label: unit.label }))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Quantity Limits
            </label>
            <div className="flex items-end gap-4">
              <Input
                aria-label="Maximum quantity"
                type="number"
                placeholder="3"
                value={formData.maxQuantity?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    maxQuantity: value ? parseInt(value, 10) : undefined,
                  }))
                }
                className="max-w-32"
                startContent={<span className="text-sm text-default-400">Max:</span>}
              />
              <Input
                aria-label="Quantity unit"
                placeholder="per week"
                value={formData.quantityUnit}
                onValueChange={value => setFormData(prev => ({ ...prev, quantityUnit: value }))}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-default-400 mt-1.5">Leave empty for no limit</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-default-900 mb-2">
              Age Restriction (optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                label="Min Age"
                placeholder="Any"
                value={formData.minAge?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    minAge: value ? parseInt(value, 10) : undefined,
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
                    maxAge: value ? parseInt(value, 10) : undefined,
                  }))
                }
              />
            </div>
            <p className="text-sm text-default-400 mt-1.5">Leave empty if available for all ages</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isLoading}>
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
