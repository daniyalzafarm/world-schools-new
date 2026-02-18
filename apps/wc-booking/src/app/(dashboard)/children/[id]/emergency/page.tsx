'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  addToast,
  Alert,
  Button,
  Checkbox,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Edit, Mail, Phone, Plus, Save, Trash2, User } from 'lucide-react'
import { Input, PhoneInput, SelectField, Textarea, useConfirmDialog } from '@world-schools/ui-web'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { useChildrenStore } from '@/stores/children-store'
import { type EmergencyContact, RELATIONSHIP_SECTIONS } from '@/types/child'

interface ContactFormData {
  name: string
  relationship: EmergencyContact['relationship']
  primaryPhone: string
  secondaryPhone: string
  email: string
  authorizedForPickup: boolean
  notes: string
}

interface FormErrors {
  name?: string
  relationship?: string
  primaryPhone?: string
  secondaryPhone?: string
  email?: string
  notes?: string
}

const MAX_CONTACTS = 3
const MAX_NOTES_LENGTH = 200

export default function ChildEmergencyContactsPage() {
  const params = useParams()
  const childId = params.id as string

  const { getChildById, updateChild, isLoading } = useChildrenStore()
  const child = getChildById(childId)
  const { confirm } = useConfirmDialog()

  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    relationship: 'Father',
    primaryPhone: '',
    secondaryPhone: '',
    email: '',
    authorizedForPickup: true,
    notes: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // Initialize contacts from child
  useEffect(() => {
    if (child?.emergencyContacts) {
      setContacts(child.emergencyContacts)
    }
  }, [child])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      relationship: 'Father',
      primaryPhone: '',
      secondaryPhone: '',
      email: '',
      authorizedForPickup: true,
      notes: '',
    })
    setErrors({})
    setEditingContactId(null)
  }

  // Open modal for adding new contact
  const handleAddContact = () => {
    resetForm()
    setIsModalOpen(true)
  }

  // Open modal for editing contact
  const handleEditContact = (contact: EmergencyContact) => {
    setFormData({
      name: contact.name,
      relationship: contact.relationship,
      primaryPhone: contact.primaryPhone,
      secondaryPhone: contact.secondaryPhone || '',
      email: contact.email || '',
      authorizedForPickup: contact.authorizedForPickup,
      notes: contact.notes || '',
    })
    setEditingContactId(contact.id)
    setIsModalOpen(true)
  }

  // Validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be at most 100 characters'
    }

    // Relationship validation
    if (!formData.relationship?.trim()) {
      newErrors.relationship = 'Relationship is required'
    }

    // Primary phone validation
    if (!formData.primaryPhone.trim()) {
      newErrors.primaryPhone = 'Primary phone is required'
    } else if (!isValidPhoneNumber(formData.primaryPhone)) {
      newErrors.primaryPhone = 'Please enter a valid phone number'
    }

    // Secondary phone validation (optional)
    if (formData.secondaryPhone.trim() && !isValidPhoneNumber(formData.secondaryPhone)) {
      newErrors.secondaryPhone = 'Please enter a valid phone number'
    }

    // Email validation (optional)
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    // Notes validation
    if (formData.notes.length > MAX_NOTES_LENGTH) {
      newErrors.notes = `Maximum ${MAX_NOTES_LENGTH} characters`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save contact (add or update)
  const handleSaveContact = async () => {
    if (!validateForm()) return

    setIsSaving(true)

    try {
      let updatedContacts: EmergencyContact[]

      if (editingContactId) {
        // Update existing contact
        updatedContacts = contacts.map(contact =>
          contact.id === editingContactId
            ? {
                ...contact,
                name: formData.name.trim(),
                relationship: formData.relationship,
                primaryPhone: formData.primaryPhone.trim(),
                secondaryPhone: formData.secondaryPhone.trim() || undefined,
                email: formData.email.trim() || undefined,
                authorizedForPickup: formData.authorizedForPickup,
                notes: formData.notes.trim() || undefined,
              }
            : contact
        )
      } else {
        // Add new contact
        const newContact: EmergencyContact = {
          id: `contact_${Date.now()}`,
          name: formData.name.trim(),
          relationship: formData.relationship,
          primaryPhone: formData.primaryPhone.trim(),
          secondaryPhone: formData.secondaryPhone.trim() || undefined,
          email: formData.email.trim() || undefined,
          authorizedForPickup: formData.authorizedForPickup,
          notes: formData.notes.trim() || undefined,
        }
        updatedContacts = [...contacts, newContact]
      }

      const success = await updateChild(childId, { emergencyContacts: updatedContacts })

      if (success) {
        addToast({
          title: 'Success',
          description: editingContactId
            ? 'Emergency contact updated successfully'
            : 'Emergency contact added successfully',
          color: 'success',
        })
        setContacts(updatedContacts)
        setIsModalOpen(false)
        resetForm()
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to save contact. Please try again.',
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Delete contact
  const handleDeleteContact = async (contactId: string) => {
    const confirmed = await confirm({
      title: 'Delete Contact?',
      message:
        'Are you sure you want to delete this emergency contact? This action cannot be undone.',
      confirmText: 'Delete Contact',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    setIsSaving(true)

    try {
      const updatedContacts = contacts.filter(c => c.id !== contactId)
      const success = await updateChild(childId, { emergencyContacts: updatedContacts })

      if (success) {
        addToast({
          title: 'Success',
          description: 'Emergency contact deleted successfully',
          color: 'success',
        })
        setContacts(updatedContacts)
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to delete contact. Please try again.',
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle field changes
  const handleFieldChange = (field: keyof ContactFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Loading state
  if (isLoading || !child) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading emergency contacts...</p>
        </div>
      </div>
    )
  }

  const hasMinimumContacts = contacts.length >= 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Emergency Contacts</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Add up to {MAX_CONTACTS} emergency contacts for your child
        </p>
      </div>

      {/* Warning Banner for Missing Contacts */}
      {!hasMinimumContacts && (
        <Alert
          color="warning"
          variant="flat"
          className="border border-amber-200 dark:border-amber-800"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            At Least One Contact Required
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Please add at least one emergency contact to enable booking. This ensures we can reach
            someone in case of an emergency during camp activities.
          </p>
        </Alert>
      )}

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No Emergency Contacts
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Add at least one emergency contact to enable booking
          </p>
          <Button
            color="secondary"
            onPress={handleAddContact}
            startContent={<Plus className="w-4 h-4" />}
          >
            Add First Contact
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {contacts.map((contact, index) => (
            <div
              key={contact.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-100 to-teal-50 dark:from-blue-900 dark:to-teal-900 flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {contact.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {contact.relationship}
                        </p>
                        {index === 0 && (
                          <Chip color="success" variant="flat" size="sm">
                            Primary
                          </Chip>
                        )}
                        {contact.authorizedForPickup && (
                          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full w-fit">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Authorized for pickup
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700 dark:text-slate-300">
                        {contact.primaryPhone}
                      </span>
                    </div>
                    {contact.secondaryPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {contact.secondaryPhone}
                        </span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">{contact.email}</span>
                      </div>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 italic">
                      "{contact.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onPress={() => handleEditContact(contact)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    onPress={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Button */}
      {contacts.length > 0 && contacts.length < MAX_CONTACTS && (
        <button
          onClick={handleAddContact}
          className="w-full flex items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-transparent text-slate-700 dark:text-slate-300 font-medium text-[15px] underline hover:border-slate-900 dark:hover:border-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5 hidden sm:block" />
          Add emergency contact
        </button>
      )}

      {/* Add/Edit Contact Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          resetForm()
        }}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">
              {editingContactId ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
            </h2>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Name */}
              <Input
                label="Full Name"
                labelPlacement="outside"
                placeholder="Enter contact's full name"
                value={formData.name}
                onValueChange={value => handleFieldChange('name', value)}
                isInvalid={!!errors.name}
                errorMessage={errors.name}
                isRequired
              />

              {/* Relationship */}
              <SelectField
                label="Relationship"
                labelPlacement="outside"
                placeholder="Select relationship"
                value={formData.relationship}
                onChange={value =>
                  handleFieldChange('relationship', value as ContactFormData['relationship'])
                }
                sections={RELATIONSHIP_SECTIONS}
                isRequired
                isInvalid={!!errors.relationship}
                errorMessage={errors.relationship}
              />

              {/* Phone Numbers */}
              <PhoneInput
                label="Primary Phone"
                isRequired
                placeholder="Phone number"
                value={formData.primaryPhone}
                onChange={value => handleFieldChange('primaryPhone', value || '')}
                error={errors.primaryPhone}
              />
              {/* <PhoneInput
                label="Secondary Phone"
                placeholder="Phone number"
                value={formData.secondaryPhone}
                onChange={value => handleFieldChange('secondaryPhone', value || '')}
                error={errors.secondaryPhone}
              /> */}

              {/* Email */}
              {/* <Input
                label="Email Address"
                labelPlacement="outside"
                placeholder="contact@example.com"
                type="email"
                value={formData.email}
                onValueChange={value => handleFieldChange('email', value)}
                isInvalid={!!errors.email}
                errorMessage={errors.email}
              /> */}

              {/* Authorized for Pickup */}
              <Checkbox
                isSelected={formData.authorizedForPickup}
                onValueChange={value => handleFieldChange('authorizedForPickup', value)}
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Authorized to pick up child from camp
                </span>
              </Checkbox>

              {/* Notes */}
              <Textarea
                label="Additional Notes"
                labelPlacement="outside"
                placeholder="Any additional information about this contact (optional)"
                value={formData.notes}
                onValueChange={value => handleFieldChange('notes', value)}
                isInvalid={!!errors.notes}
                errorMessage={errors.notes}
                description={`${formData.notes.length}/${MAX_NOTES_LENGTH} characters`}
                maxLength={MAX_NOTES_LENGTH}
                minRows={2}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setIsModalOpen(false)
                resetForm()
              }}
              isDisabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              color="secondary"
              onPress={handleSaveContact}
              isLoading={isSaving}
              startContent={!isSaving && <Save className="w-4 h-4" />}
            >
              {isSaving ? 'Saving...' : editingContactId ? 'Update Contact' : 'Add Contact'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
