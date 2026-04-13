'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { addToast, Alert } from '@heroui/react'
import { Check } from 'lucide-react'
import { Input, Textarea } from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'
import { useBeforeUnload } from '@/hooks/use-before-unload'
import { useChildDetailContext } from '@/components/children/ChildDetailContext'
import type { MedicalInfo } from '@/types/child'

// Allergy categories matching reference design
const ALLERGY_CATEGORIES = [
  { id: 'none', label: 'No known allergies' },
  { id: 'food', label: 'Food allergies' },
  { id: 'medication', label: 'Medication allergies' },
  { id: 'environmental', label: 'Environmental allergies' },
] as const

// Dietary options matching reference design (single-select radio)
const DIETARY_OPTIONS = [
  { id: 'none', label: 'No restrictions' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'other', label: 'Other' },
] as const

// Swimming levels matching reference design
const SWIMMING_LEVELS = [
  { id: 'non_swimmer', label: 'Non-swimmer' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Strong swimmer' },
] as const

interface FormData {
  // Allergy categories (multi-select checkboxes)
  allergyCategories: string[]
  foodAllergiesDetails: string
  medicationAllergiesDetails: string
  environmentalAllergiesDetails: string

  // Dietary (single-select radio)
  dietaryRequirement: string
  dietaryOtherDetails: string

  // Medications (radio toggle)
  hasMedications: boolean
  medicationsDetails: string

  // Other fields
  medicalConditions: string
  swimmingAbility: string
}

interface FormErrors {
  foodAllergiesDetails?: string
  medicationAllergiesDetails?: string
  environmentalAllergiesDetails?: string
  dietaryOtherDetails?: string
  medicationsDetails?: string
  medicalConditions?: string
}

const MAX_TEXTAREA_LENGTH = 500

export default function ChildMedicalPage() {
  const params = useParams()
  const childId = params.id as string

  const { getChildById, updateChild, isLoading } = useChildrenStore()
  const child = getChildById(childId)
  const { setFormState } = useChildDetailContext()

  const [formData, setFormData] = useState<FormData>({
    allergyCategories: [],
    foodAllergiesDetails: '',
    medicationAllergiesDetails: '',
    environmentalAllergiesDetails: '',
    dietaryRequirement: 'none',
    dietaryOtherDetails: '',
    hasMedications: false,
    medicationsDetails: '',
    medicalConditions: '',
    swimmingAbility: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isModified, setIsModified] = useState(false)

  // Warn before leaving page with unsaved changes
  useBeforeUnload(isModified)

  // Update context when form state changes
  useEffect(() => {
    setFormState({ isModified, isSaving })
  }, [isModified, isSaving, setFormState])

  // Initialize form data from child - convert from backend format
  useEffect(() => {
    if (child?.medicalInfo) {
      const medical = child.medicalInfo

      // Convert allergies array to categories + details
      const allergyCategories: string[] = []
      let foodDetails = ''
      let medicationDetails = ''
      let environmentalDetails = ''

      if (medical.allergies && medical.allergies.length > 0) {
        // Check if "No known allergies" or similar
        const hasNoAllergies = medical.allergies.some(
          a => a.toLowerCase().includes('no known') || a.toLowerCase().includes('none')
        )

        if (hasNoAllergies) {
          allergyCategories.push('none')
        } else {
          // Categorize allergies (simplified - you may need more logic)
          const foodKeywords = [
            'peanut',
            'nut',
            'dairy',
            'egg',
            'soy',
            'wheat',
            'fish',
            'shellfish',
            'gluten',
            'sesame',
          ]
          const medKeywords = ['penicillin', 'aspirin', 'ibuprofen', 'medication']

          const foodAllergies = medical.allergies.filter(a =>
            foodKeywords.some(k => a.toLowerCase().includes(k))
          )
          const medAllergies = medical.allergies.filter(a =>
            medKeywords.some(k => a.toLowerCase().includes(k))
          )
          const otherAllergies = medical.allergies.filter(
            a => !foodAllergies.includes(a) && !medAllergies.includes(a)
          )

          if (foodAllergies.length > 0) {
            allergyCategories.push('food')
            foodDetails = foodAllergies.join(', ')
          }
          if (medAllergies.length > 0) {
            allergyCategories.push('medication')
            medicationDetails = medAllergies.join(', ')
          }
          if (otherAllergies.length > 0) {
            allergyCategories.push('environmental')
            environmentalDetails = otherAllergies.join(', ')
          }
        }
      }

      // Convert dietary requirements array to single value
      let dietaryReq = 'none'
      let dietaryOther = ''
      if (medical.dietaryRequirements && medical.dietaryRequirements.length > 0) {
        const firstDiet = medical.dietaryRequirements[0].toLowerCase()
        if (firstDiet.includes('vegetarian')) {
          dietaryReq = 'vegetarian'
        } else if (firstDiet.includes('vegan')) {
          dietaryReq = 'vegan'
        } else {
          dietaryReq = 'other'
          dietaryOther = medical.dietaryRequirements.join(', ')
        }
      }

      setFormData({
        allergyCategories,
        foodAllergiesDetails: foodDetails,
        medicationAllergiesDetails: medicationDetails,
        environmentalAllergiesDetails: environmentalDetails,
        dietaryRequirement: dietaryReq,
        dietaryOtherDetails: dietaryOther,
        hasMedications: !!medical.medications,
        medicationsDetails: medical.medications || '',
        medicalConditions: medical.medicalConditions || '',
        swimmingAbility: medical.swimmingAbility || '',
      })
    }
  }, [child])

  // Validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Allergy category validation - require details if category is selected
    if (formData.allergyCategories.includes('food') && !formData.foodAllergiesDetails.trim()) {
      newErrors.foodAllergiesDetails =
        'Please provide details about food allergies or uncheck this option'
    }
    if (
      formData.allergyCategories.includes('medication') &&
      !formData.medicationAllergiesDetails.trim()
    ) {
      newErrors.medicationAllergiesDetails =
        'Please provide details about medication allergies or uncheck this option'
    }
    if (
      formData.allergyCategories.includes('environmental') &&
      !formData.environmentalAllergiesDetails.trim()
    ) {
      newErrors.environmentalAllergiesDetails =
        'Please provide details about environmental allergies or uncheck this option'
    }

    // Dietary "Other" validation - require details if "other" is selected
    if (formData.dietaryRequirement === 'other' && !formData.dietaryOtherDetails.trim()) {
      newErrors.dietaryOtherDetails = 'Please specify dietary requirements or select another option'
    }

    // Medications validation - require details if "Yes" is selected
    if (formData.hasMedications && !formData.medicationsDetails.trim()) {
      newErrors.medicationsDetails =
        'Please provide medication details or select "No current medications"'
    }

    // Textarea length validation
    if (formData.medicationsDetails.length > MAX_TEXTAREA_LENGTH) {
      newErrors.medicationsDetails = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }
    if (formData.medicalConditions.length > MAX_TEXTAREA_LENGTH) {
      newErrors.medicalConditions = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }
    if (formData.foodAllergiesDetails.length > MAX_TEXTAREA_LENGTH) {
      newErrors.foodAllergiesDetails = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }
    if (formData.medicationAllergiesDetails.length > MAX_TEXTAREA_LENGTH) {
      newErrors.medicationAllergiesDetails = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }
    if (formData.environmentalAllergiesDetails.length > MAX_TEXTAREA_LENGTH) {
      newErrors.environmentalAllergiesDetails = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }
    if (formData.dietaryOtherDetails.length > MAX_TEXTAREA_LENGTH) {
      newErrors.dietaryOtherDetails = `Maximum ${MAX_TEXTAREA_LENGTH} characters`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission - convert to backend format
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)

    try {
      // Convert form data to backend MedicalInfo format
      const allergies: string[] = []

      if (formData.allergyCategories.includes('none')) {
        allergies.push('No known allergies')
      } else {
        if (formData.allergyCategories.includes('food') && formData.foodAllergiesDetails.trim()) {
          allergies.push(
            ...formData.foodAllergiesDetails
              .split(',')
              .map(a => a.trim())
              .filter(Boolean)
          )
        }
        if (
          formData.allergyCategories.includes('medication') &&
          formData.medicationAllergiesDetails.trim()
        ) {
          allergies.push(
            ...formData.medicationAllergiesDetails
              .split(',')
              .map(a => a.trim())
              .filter(Boolean)
          )
        }
        if (
          formData.allergyCategories.includes('environmental') &&
          formData.environmentalAllergiesDetails.trim()
        ) {
          allergies.push(
            ...formData.environmentalAllergiesDetails
              .split(',')
              .map(a => a.trim())
              .filter(Boolean)
          )
        }
      }

      const dietaryRequirements: string[] = []
      if (formData.dietaryRequirement === 'vegetarian') {
        dietaryRequirements.push('Vegetarian')
      } else if (formData.dietaryRequirement === 'vegan') {
        dietaryRequirements.push('Vegan')
      } else if (formData.dietaryRequirement === 'other' && formData.dietaryOtherDetails.trim()) {
        dietaryRequirements.push(
          ...formData.dietaryOtherDetails
            .split(',')
            .map(d => d.trim())
            .filter(Boolean)
        )
      }

      const medicalInfo: MedicalInfo = {
        allergies,
        dietaryRequirements,
        medications: formData.hasMedications
          ? formData.medicationsDetails.trim() || undefined
          : undefined,
        medicalConditions: formData.medicalConditions.trim() || undefined,
        swimmingAbility: formData.swimmingAbility
          ? (formData.swimmingAbility as MedicalInfo['swimmingAbility'])
          : undefined,
      }

      const success = await updateChild(childId, { medicalInfo })

      if (success) {
        addToast({
          title: 'Success',
          description: 'Medical information updated successfully',
          color: 'success',
        })
        setIsModified(false)
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to update medical information. Please try again.',
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error updating medical info:', error)
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
  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsModified(true)
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Toggle allergy category (checkbox)
  const toggleAllergyCategory = (categoryId: string) => {
    const newCategories = formData.allergyCategories.includes(categoryId)
      ? formData.allergyCategories.filter(c => c !== categoryId)
      : [...formData.allergyCategories, categoryId]

    // If selecting "none", clear all other categories
    if (categoryId === 'none' && !formData.allergyCategories.includes('none')) {
      handleFieldChange('allergyCategories', ['none'])
      handleFieldChange('foodAllergiesDetails', '')
      handleFieldChange('medicationAllergiesDetails', '')
      handleFieldChange('environmentalAllergiesDetails', '')
    } else if (categoryId !== 'none') {
      // If selecting any other category, remove "none"
      const filtered = newCategories.filter(c => c !== 'none')
      handleFieldChange('allergyCategories', filtered)
    } else {
      handleFieldChange('allergyCategories', newCategories)
    }
  }

  // Check if allergy category is selected
  const isAllergyCategorySelected = (categoryId: string) => {
    return formData.allergyCategories.includes(categoryId)
  }

  // Check if child has any allergies (for alert box)
  const hasAllergies = () => {
    return formData.allergyCategories.length > 0 && !formData.allergyCategories.includes('none')
  }

  // Loading state
  if (isLoading || !child) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading medical information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Medical & safety</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Important health information for {child.firstName}
        </p>
      </div>

      {/* Alert Box for Allergies (only show if child has allergies) */}
      {hasAllergies() && (
        <Alert color="warning" variant="flat" className="mb-6">
          <span className="text-sm">
            {child.firstName} has allergies. This information is shared with camps before booking.
          </span>
        </Alert>
      )}

      {/* Form */}
      <form id="medical-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Allergies Section */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-slate-900 dark:text-white">
            Allergies
          </label>
          <div className="space-y-2">
            {ALLERGY_CATEGORIES.map(category => (
              <React.Fragment key={category.id}>
                <label
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                    isAllergyCategorySelected(category.id)
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  onClick={() => toggleAllergyCategory(category.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isAllergyCategorySelected(category.id)
                        ? 'border-primary bg-primary'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isAllergyCategorySelected(category.id) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {category.label}
                  </span>
                </label>

                {/* Conditional text input for specific allergy categories */}
                {category.id === 'food' && isAllergyCategorySelected('food') && (
                  <div className="ml-8">
                    <Input
                      placeholder="List food allergies..."
                      value={formData.foodAllergiesDetails}
                      onValueChange={value => handleFieldChange('foodAllergiesDetails', value)}
                      isInvalid={!!errors.foodAllergiesDetails}
                      errorMessage={errors.foodAllergiesDetails}
                    />
                  </div>
                )}

                {category.id === 'medication' && isAllergyCategorySelected('medication') && (
                  <div className="ml-8">
                    <Input
                      placeholder="List medication allergies..."
                      value={formData.medicationAllergiesDetails}
                      onValueChange={value =>
                        handleFieldChange('medicationAllergiesDetails', value)
                      }
                      isInvalid={!!errors.medicationAllergiesDetails}
                      errorMessage={errors.medicationAllergiesDetails}
                    />
                  </div>
                )}

                {category.id === 'environmental' && isAllergyCategorySelected('environmental') && (
                  <div className="ml-8">
                    <Input
                      placeholder="List environmental allergies..."
                      value={formData.environmentalAllergiesDetails}
                      onValueChange={value =>
                        handleFieldChange('environmentalAllergiesDetails', value)
                      }
                      isInvalid={!!errors.environmentalAllergiesDetails}
                      errorMessage={errors.environmentalAllergiesDetails}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Dietary Requirements Section */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-slate-900 dark:text-white">
            Dietary requirements
          </label>
          <div className="space-y-2">
            {DIETARY_OPTIONS.map(option => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  formData.dietaryRequirement === option.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => handleFieldChange('dietaryRequirement', option.id)}
              >
                {/* Radio button */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.dietaryRequirement === option.id
                      ? 'border-primary bg-primary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  {formData.dietaryRequirement === option.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {option.label}
                </span>
              </label>
            ))}
          </div>

          {/* Conditional text input for "Other" */}
          {formData.dietaryRequirement === 'other' && (
            <div className="ml-8">
              <Input
                placeholder="Specify dietary requirements..."
                value={formData.dietaryOtherDetails}
                onValueChange={value => handleFieldChange('dietaryOtherDetails', value)}
                isInvalid={!!errors.dietaryOtherDetails}
                errorMessage={errors.dietaryOtherDetails}
              />
            </div>
          )}
        </div>

        {/* Current Medications Section */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-slate-900 dark:text-white">
            Current medications
          </label>
          <div className="space-y-2">
            <label
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                !formData.hasMedications
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onClick={() => {
                handleFieldChange('hasMedications', false)
                handleFieldChange('medicationsDetails', '')
              }}
            >
              {/* Radio button */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  !formData.hasMedications
                    ? 'border-primary bg-primary'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                }`}
              >
                {!formData.hasMedications && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                No current medications
              </span>
            </label>

            <label
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                formData.hasMedications
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onClick={() => handleFieldChange('hasMedications', true)}
            >
              {/* Radio button */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  formData.hasMedications
                    ? 'border-primary bg-primary'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                }`}
              >
                {formData.hasMedications && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                Yes, takes medications
              </span>
            </label>
          </div>

          {/* Conditional textarea for medications details */}
          {formData.hasMedications && (
            <div className="ml-8">
              <Textarea
                placeholder="List medications, dosages, and schedule..."
                value={formData.medicationsDetails}
                onValueChange={value => handleFieldChange('medicationsDetails', value)}
                isInvalid={!!errors.medicationsDetails}
                errorMessage={errors.medicationsDetails}
                description={`${formData.medicationsDetails.length}/${MAX_TEXTAREA_LENGTH} characters`}
                maxLength={MAX_TEXTAREA_LENGTH}
                minRows={3}
              />
            </div>
          )}
        </div>

        {/* Medical Conditions Section */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-slate-900 dark:text-white">
            Medical conditions{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              (optional)
            </span>
          </label>
          <Textarea
            placeholder="Any conditions the camp should know about (asthma, diabetes, etc.)"
            value={formData.medicalConditions}
            onValueChange={value => handleFieldChange('medicalConditions', value)}
            isInvalid={!!errors.medicalConditions}
            errorMessage={errors.medicalConditions}
            description={`${formData.medicalConditions.length}/${MAX_TEXTAREA_LENGTH} characters`}
            maxLength={MAX_TEXTAREA_LENGTH}
            minRows={3}
          />
        </div>

        {/* Swimming Ability Section */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-slate-900 dark:text-white">
            Swimming ability
          </label>
          <div className="space-y-2">
            {SWIMMING_LEVELS.map(level => (
              <label
                key={level.id}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  formData.swimmingAbility === level.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => handleFieldChange('swimmingAbility', level.id)}
              >
                {/* Radio button */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.swimmingAbility === level.id
                      ? 'border-primary bg-primary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  {formData.swimmingAbility === level.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {level.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Privacy Note */}
        {/* <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg mt-10">
          <Lock className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Medical information is encrypted and only shared with the medical staff at camps you
            book. Camps will never see this information before a confirmed booking.
          </p>
        </div> */}
      </form>
    </div>
  )
}
