'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
} from '@heroui/react'
import { EmojiPicker, Input, Textarea } from '@world-schools/ui-web'
import { useKbCategoriesStore } from '@/stores/kb-categories-store'
import type { CreateCategoryData, UpdateCategoryData } from '@world-schools/wc-frontend-utils'

export function CategoryModal() {
  const { isModalOpen, modalMode, currentCategory, createCategory, updateCategory, closeModal } =
    useKbCategoriesStore()

  const [formData, setFormData] = useState<CreateCategoryData>({
    name: '',
    slug: '',
    description: '',
    icon: '📚',
    sortOrder: 0,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isModalOpen && modalMode === 'edit' && currentCategory) {
      setFormData({
        name: currentCategory.name,
        slug: currentCategory.slug,
        description: currentCategory.description || '',
        icon: currentCategory.icon || '📚',
        sortOrder: currentCategory.sortOrder,
        isActive: currentCategory.isActive,
      })
    } else if (isModalOpen && modalMode === 'create') {
      setFormData({
        name: '',
        slug: '',
        description: '',
        icon: '📚',
        sortOrder: 0,
        isActive: true,
      })
    }
    setErrors({})
  }, [isModalOpen, modalMode, currentCategory])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.icon?.trim()) {
      newErrors.icon = 'Icon is required'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required'
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      newErrors.slug = 'Slug must be lowercase, alphanumeric, and use hyphens to separate words'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      let success = false

      if (modalMode === 'create') {
        success = await createCategory(formData)
      } else if (modalMode === 'edit' && currentCategory) {
        const updateData: UpdateCategoryData = {
          ...formData,
        }
        success = await updateCategory(currentCategory.id, updateData)
      }

      if (success) {
        closeModal()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }))
    // Auto-generate slug from name if in create mode
    if (modalMode === 'create') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'rounded-3xl',
        header: 'border-b border-divider',
        footer: 'border-t border-divider',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">
            {modalMode === 'create' ? 'Create Category' : 'Edit Category'}
          </h2>
          <p className="text-sm text-default-500 font-normal">
            {modalMode === 'create'
              ? 'Add a new knowledge base category'
              : 'Update category information'}
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 py-6">
          <div className="flex gap-4">
            <EmojiPicker
              label="Icon"
              isRequired
              value={formData.icon || '📚'}
              onChange={emoji => setFormData(prev => ({ ...prev, icon: emoji }))}
            />
            <Input
              label="Name"
              labelPlacement="outside"
              placeholder="e.g., Getting Started"
              value={formData.name}
              onValueChange={handleNameChange}
              isRequired
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              classNames={{
                label: 'text-[14px] font-semibold',
              }}
            />
          </div>

          <Input
            label="Slug"
            labelPlacement="outside"
            placeholder="e.g., getting-started"
            value={formData.slug}
            onValueChange={value => setFormData(prev => ({ ...prev, slug: value }))}
            isRequired
            isInvalid={!!errors.slug}
            errorMessage={errors.slug}
            description="URL-friendly identifier (lowercase, alphanumeric, hyphens only)"
            classNames={{
              label: 'text-[14px] font-semibold',
            }}
          />

          <Textarea
            label="Description"
            labelPlacement="outside"
            placeholder="Brief description of this category"
            value={formData.description}
            onValueChange={value => setFormData(prev => ({ ...prev, description: value }))}
            minRows={3}
            classNames={{
              label: 'text-[14px] font-semibold',
            }}
          />

          {/* <Input
            label="Sort Order"
            labelPlacement="outside"
            type="number"
            placeholder="0"
            value={String(formData.sortOrder)}
            onValueChange={value => setFormData(prev => ({ ...prev, sortOrder: Number(value) }))}
            description="Lower numbers appear first"
            classNames={{
              label: 'text-[14px] font-semibold',
            }}
          />

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-semibold">Active Status</label>
              <p className="text-[13px] text-default-400">
                Inactive categories are hidden from users
              </p>
            </div>
            <Switch
              isSelected={formData.isActive}
              onValueChange={value => setFormData(prev => ({ ...prev, isActive: value }))}
            />
          </div> */}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={closeModal} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            {modalMode === 'create' ? 'Create Category' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
