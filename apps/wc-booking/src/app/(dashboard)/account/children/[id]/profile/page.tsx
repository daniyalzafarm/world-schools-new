'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { addToast, Alert, Progress, Radio, RadioGroup } from '@heroui/react'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { Camera } from 'lucide-react'
import {
  DatePicker,
  IconSelectField,
  type IconSelectOption,
  IconTagSelectField,
  Input,
  SelectField,
} from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'
import { useBeforeUnload } from '@/hooks/use-before-unload'
import { useChildDetailContext } from '@/components/children/ChildDetailContext'
import { LANGUAGE_OPTIONS_WITH_FLAGS } from '@/types/child'

interface FormData {
  firstName: string
  lastName: string
  nickname: string
  dateOfBirth: DateValue | null
  gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
  photoUrl: string
  schoolCountry: string
  schoolYear: string
  languagesSpoken: string[]
}

interface FormErrors {
  firstName?: string
  lastName?: string
  nickname?: string
  dateOfBirth?: string
  gender?: string
  photoUrl?: string
  schoolYear?: string
}

// School country options with flags
const SCHOOL_COUNTRY_OPTIONS: IconSelectOption[] = [
  { label: 'United Kingdom', value: 'UK', icon: '🇬🇧' },
  { label: 'Scotland', value: 'UK_SCT', icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { label: 'United States', value: 'US', icon: '🇺🇸' },
  { label: 'France', value: 'FR', icon: '🇫🇷' },
  { label: 'Germany', value: 'DE', icon: '🇩🇪' },
  { label: 'Switzerland (German)', value: 'CH_DE', icon: '🇨🇭' },
  { label: 'Switzerland (French)', value: 'CH_FR', icon: '🇨🇭' },
  { label: 'Spain', value: 'ES', icon: '🇪🇸' },
  { label: 'Italy', value: 'IT', icon: '🇮🇹' },
  { label: 'Netherlands', value: 'NL', icon: '🇳🇱' },
  { label: 'Australia', value: 'AU', icon: '🇦🇺' },
  { label: 'International / IB', value: 'INT', icon: '🌍' },
]

// School year data - normalized with country-specific labels
interface SchoolYearData {
  normalized: number
  age: string
  [key: string]: string | number
}

const SCHOOL_YEAR_DATA: SchoolYearData[] = [
  {
    normalized: 1,
    age: '5-6',
    UK: 'Year 1',
    UK_SCT: 'Primary 2',
    US: 'Kindergarten',
    FR: 'CP',
    DE: '1. Klasse',
    CH_DE: '1. Klasse',
    CH_FR: '3H',
    ES: '1º Primaria',
    IT: '1ª Elementare',
    NL: 'Groep 3',
    AU: 'Year 1',
    INT: 'Grade 1',
  },
  {
    normalized: 2,
    age: '6-7',
    UK: 'Year 2',
    UK_SCT: 'Primary 3',
    US: '1st Grade',
    FR: 'CE1',
    DE: '2. Klasse',
    CH_DE: '2. Klasse',
    CH_FR: '4H',
    ES: '2º Primaria',
    IT: '2ª Elementare',
    NL: 'Groep 4',
    AU: 'Year 2',
    INT: 'Grade 2',
  },
  {
    normalized: 3,
    age: '7-8',
    UK: 'Year 3',
    UK_SCT: 'Primary 4',
    US: '2nd Grade',
    FR: 'CE2',
    DE: '3. Klasse',
    CH_DE: '3. Klasse',
    CH_FR: '5H',
    ES: '3º Primaria',
    IT: '3ª Elementare',
    NL: 'Groep 5',
    AU: 'Year 3',
    INT: 'Grade 3',
  },
  {
    normalized: 4,
    age: '8-9',
    UK: 'Year 4',
    UK_SCT: 'Primary 5',
    US: '3rd Grade',
    FR: 'CM1',
    DE: '4. Klasse',
    CH_DE: '4. Klasse',
    CH_FR: '6H',
    ES: '4º Primaria',
    IT: '4ª Elementare',
    NL: 'Groep 6',
    AU: 'Year 4',
    INT: 'Grade 4',
  },
  {
    normalized: 5,
    age: '9-10',
    UK: 'Year 5',
    UK_SCT: 'Primary 6',
    US: '4th Grade',
    FR: 'CM2',
    DE: '5. Klasse',
    CH_DE: '5. Klasse',
    CH_FR: '7H',
    ES: '5º Primaria',
    IT: '5ª Elementare',
    NL: 'Groep 7',
    AU: 'Year 5',
    INT: 'Grade 5',
  },
  {
    normalized: 6,
    age: '10-11',
    UK: 'Year 6',
    UK_SCT: 'Primary 7',
    US: '5th Grade',
    FR: '6ème',
    DE: '6. Klasse',
    CH_DE: '6. Klasse',
    CH_FR: '8H',
    ES: '6º Primaria',
    IT: '1ª Media',
    NL: 'Groep 8',
    AU: 'Year 6',
    INT: 'Grade 6',
  },
  {
    normalized: 7,
    age: '11-12',
    UK: 'Year 7',
    UK_SCT: 'S1',
    US: '6th Grade',
    FR: '5ème',
    DE: '7. Klasse',
    CH_DE: '1. Oberstufe',
    CH_FR: '9H',
    ES: '1º ESO',
    IT: '2ª Media',
    NL: 'Brugklas',
    AU: 'Year 7',
    INT: 'Grade 7',
  },
  {
    normalized: 8,
    age: '12-13',
    UK: 'Year 8',
    UK_SCT: 'S2',
    US: '7th Grade',
    FR: '4ème',
    DE: '8. Klasse',
    CH_DE: '2. Oberstufe',
    CH_FR: '10H',
    ES: '2º ESO',
    IT: '3ª Media',
    NL: '2e klas',
    AU: 'Year 8',
    INT: 'Grade 8',
  },
  {
    normalized: 9,
    age: '13-14',
    UK: 'Year 9',
    UK_SCT: 'S3',
    US: '8th Grade',
    FR: '3ème',
    DE: '9. Klasse',
    CH_DE: '3. Oberstufe',
    CH_FR: '11H',
    ES: '3º ESO',
    IT: '1ª Superiore',
    NL: '3e klas',
    AU: 'Year 9',
    INT: 'Grade 9',
  },
  {
    normalized: 10,
    age: '14-15',
    UK: 'Year 10',
    UK_SCT: 'S4',
    US: '9th Grade',
    FR: '2nde',
    DE: '10. Klasse',
    CH_DE: '1. Gymnasium',
    CH_FR: '1ère Gymnase',
    ES: '4º ESO',
    IT: '2ª Superiore',
    NL: '4e klas',
    AU: 'Year 10',
    INT: 'Grade 10',
  },
  {
    normalized: 11,
    age: '15-16',
    UK: 'Year 11',
    UK_SCT: 'S5',
    US: '10th Grade',
    FR: '1ère',
    DE: '11. Klasse',
    CH_DE: '2. Gymnasium',
    CH_FR: '2ème Gymnase',
    ES: '1º Bachillerato',
    IT: '3ª Superiore',
    NL: '5e klas',
    AU: 'Year 11',
    INT: 'Grade 11',
  },
  {
    normalized: 12,
    age: '16-17',
    UK: 'Year 12',
    UK_SCT: 'S6',
    US: '11th Grade',
    FR: 'Terminale',
    DE: '12. Klasse',
    CH_DE: '3. Gymnasium',
    CH_FR: '3ème Gymnase',
    ES: '2º Bachillerato',
    IT: '4ª Superiore',
    NL: '6e klas',
    AU: 'Year 12',
    INT: 'Grade 12',
  },
  {
    normalized: 13,
    age: '17-18',
    UK: 'Year 13',
    UK_SCT: 'S6',
    US: '12th Grade',
    FR: '—',
    DE: '13. Klasse',
    CH_DE: '4. Gymnasium',
    CH_FR: 'Maturité',
    ES: '—',
    IT: '5ª Superiore',
    NL: '—',
    AU: 'Year 13',
    INT: 'Gap Year',
  },
]

export default function ChildProfilePage() {
  const params = useParams()
  const childId = params.id as string

  const { getChildById, updateChild, isLoading } = useChildrenStore()
  const child = getChildById(childId)
  const { setFormState } = useChildDetailContext()

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    nickname: '',
    dateOfBirth: null,
    gender: 'boy',
    photoUrl: '',
    schoolCountry: '',
    schoolYear: '',
    languagesSpoken: [],
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isModified, setIsModified] = useState(false)
  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([])
  const [schoolYearEquivalent, setSchoolYearEquivalent] = useState<string>('')

  // Warn before leaving page with unsaved changes
  useBeforeUnload(isModified)

  // Update context when form state changes
  useEffect(() => {
    setFormState({ isModified, isSaving })
  }, [isModified, isSaving, setFormState])

  // Helper function to convert language labels to IDs (for loading from API)
  const convertLanguageLabelsToIds = (languages: string[]): string[] => {
    return languages.map(lang => {
      // Check if it's already an ID (lowercase)
      const existingId = LANGUAGE_OPTIONS_WITH_FLAGS.find(opt => opt.id === lang.toLowerCase())
      if (existingId) return existingId.id

      // Otherwise, find by label (case-insensitive)
      const byLabel = LANGUAGE_OPTIONS_WITH_FLAGS.find(
        opt => opt.label.toLowerCase() === lang.toLowerCase()
      )
      return byLabel ? byLabel.id : lang.toLowerCase()
    })
  }

  // Helper function to convert language IDs to labels (for saving to API)
  const convertLanguageIdsToLabels = (languageIds: string[]): string[] => {
    return languageIds.map(id => {
      const language = LANGUAGE_OPTIONS_WITH_FLAGS.find(opt => opt.id === id)
      return language ? language.label : id
    })
  }

  // Function to update school year options based on selected country
  const updateSchoolYearOptions = React.useCallback((country: string) => {
    if (!country) {
      setSchoolYearOptions([])
      setSchoolYearEquivalent('')
      return
    }

    // Populate with country-specific labels
    const options = SCHOOL_YEAR_DATA.filter(year => {
      const label = year[country]
      return label && label !== '—'
    }).map(year => {
      const label = year[country] as string
      return `${year.normalized}|${label} (ages ${year.age})`
    })

    setSchoolYearOptions(options)
  }, [])

  // Function to update school year equivalent hint
  const updateSchoolYearEquivalent = React.useCallback((country: string, yearLabel: string) => {
    if (!country || !yearLabel) {
      setSchoolYearEquivalent('')
      return
    }

    // Extract normalized year by parsing the year label directly
    // yearLabel format: "Year 7 (ages 11-12)" or similar
    // We need to find the matching year data by comparing labels
    let normalized: number | null = null

    for (const yearData of SCHOOL_YEAR_DATA) {
      const label = yearData[country] as string
      if (label && `${label} (ages ${yearData.age})` === yearLabel) {
        normalized = yearData.normalized
        break
      }
    }

    if (normalized === null) {
      setSchoolYearEquivalent('')
      return
    }

    // Find year data
    const yearData = SCHOOL_YEAR_DATA.find(y => y.normalized === normalized)
    if (!yearData) {
      setSchoolYearEquivalent('')
      return
    }

    // Show equivalents in other common systems (UK, US, INT) excluding current country
    const equivalents: string[] = []
    const showCountries = ['UK', 'US', 'INT'].filter(c => c !== country)
    const countryLabels: Record<string, string> = { UK: '🇬🇧', US: '🇺🇸', INT: '🌍' }

    showCountries.forEach(c => {
      const label = yearData[c]
      if (label && label !== '—') {
        equivalents.push(`${countryLabels[c]} ${label}`)
      }
    })

    if (equivalents.length > 0) {
      setSchoolYearEquivalent(equivalents.join(' · '))
    } else {
      setSchoolYearEquivalent('')
    }
  }, [])

  // Initialize form data from child
  useEffect(() => {
    if (child) {
      const schoolCountry = child.schoolCountry || ''
      const normalizedYear = child.schoolYear || ''

      // Update school year options first if country is set
      if (schoolCountry) {
        updateSchoolYearOptions(schoolCountry)
      }

      // Convert normalized year to display label
      let displayYear = ''
      if (normalizedYear && schoolCountry) {
        const yearData = SCHOOL_YEAR_DATA.find(y => y.normalized.toString() === normalizedYear)
        if (yearData) {
          const label = yearData[schoolCountry] as string
          if (label && label !== '—') {
            displayYear = `${label} (ages ${yearData.age})`
          }
        }
      }

      setFormData({
        firstName: child.firstName || '',
        lastName: child.lastName || '',
        nickname: child.nickname || '',
        dateOfBirth: convertDateToCalendarDate(child.dateOfBirth),
        gender: child.gender || 'boy',
        photoUrl: child.photoUrl || '',
        schoolCountry,
        schoolYear: displayYear,
        languagesSpoken: convertLanguageLabelsToIds(child.languages ?? []),
      })

      // Update equivalent hint if both country and year are set
      if (displayYear && schoolCountry) {
        updateSchoolYearEquivalent(schoolCountry, displayYear)
      } else {
        setSchoolYearEquivalent('')
      }
    }
  }, [child, updateSchoolYearOptions, updateSchoolYearEquivalent])

  // Helper to convert Date to CalendarDate
  const convertDateToCalendarDate = (date: Date | string | undefined): CalendarDate | null => {
    if (!date) return null
    const d = typeof date === 'string' ? new Date(date) : date
    return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }

  // Helper to convert DateValue to ISO string
  const dateValueToString = (date: DateValue | null): string => {
    if (!date) return ''
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  }

  // Calculate age from date of birth
  const calculateAge = (dob: DateValue | null): number | null => {
    if (!dob) return null
    const today = new Date()
    const birthDate = new Date(dob.year, dob.month - 1, dob.day)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Validation
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

    // Last name validation (optional)
    if (formData.lastName.trim()) {
      if (formData.lastName.trim().length < 2) {
        newErrors.lastName = 'Last name must be at least 2 characters'
      } else if (formData.lastName.trim().length > 50) {
        newErrors.lastName = 'Last name must be at most 50 characters'
      }
    }

    // Nickname validation (optional)
    if (formData.nickname.trim()) {
      if (formData.nickname.trim().length < 2) {
        newErrors.nickname = 'Nickname must be at least 2 characters'
      } else if (formData.nickname.trim().length > 30) {
        newErrors.nickname = 'Nickname must be at most 30 characters'
      }
    }

    // Date of birth validation
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required'
    } else {
      const age = calculateAge(formData.dateOfBirth)
      if (age !== null && age < 3) {
        newErrors.dateOfBirth = 'Child must be at least 3 years old'
      } else if (age !== null && age > 18) {
        newErrors.dateOfBirth = 'Child must be at most 18 years old'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)

    try {
      // Convert display year label back to normalized number
      let normalizedYear: string | null | undefined = undefined

      // Only convert if both country and year are selected
      if (formData.schoolYear && formData.schoolCountry) {
        const selectedOption = schoolYearOptions.find(opt => {
          const [, label] = opt.split('|')
          return label === formData.schoolYear
        })
        if (selectedOption) {
          const [normalized] = selectedOption.split('|')
          normalizedYear = normalized
        }
      }
      // If school year is explicitly empty (cleared), send null to clear the database value
      // Note: undefined means "don't update", null means "clear the field"
      else if (!formData.schoolYear) {
        normalizedYear = null
      }

      const updateData: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        nickname: formData.nickname.trim() || undefined,
        dateOfBirth: dateValueToString(formData.dateOfBirth),
        gender: formData.gender,
        photoUrl: formData.photoUrl.trim() || undefined,
        schoolCountry: formData.schoolCountry || undefined,
        schoolYear: normalizedYear,
        languages: convertLanguageIdsToLabels(formData.languagesSpoken),
      }

      const success = await updateChild(childId, updateData)

      if (success) {
        addToast({
          title: 'Success',
          description: 'Profile information updated successfully',
          color: 'success',
        })
        setIsModified(false)
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to update profile. Please try again.',
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
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
    setFormData(prev => {
      const updated = { ...prev, [field]: value }

      // If school country changes, clear school year and update options
      if (field === 'schoolCountry') {
        updated.schoolYear = ''
        updateSchoolYearOptions(value)
        setSchoolYearEquivalent('')
      }

      // If school year changes, update equivalent hint
      if (field === 'schoolYear') {
        updateSchoolYearEquivalent(prev.schoolCountry, value)
      }

      return updated
    })
    setIsModified(true)
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Loading state
  if (isLoading || !child) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  const age = calculateAge(formData.dateOfBirth)
  const profileCompletion = child.profileCompletion || 0

  return (
    <div className="space-y-6">
      {/* Header with Profile Completion */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Profile Information</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Basic information about your child
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Profile Completion
            </div>
            <div className="flex items-center gap-2">
              <Progress
                aria-label="profile-progress"
                value={profileCompletion}
                className="w-24"
                color={profileCompletion >= 75 ? 'success' : 'warning'}
              />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {profileCompletion}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner for Incomplete Profile */}
      {profileCompletion < 75 && (
        <Alert color="warning" className="mb-6">
          <div className="font-semibold">Profile Incomplete</div>
          <div className="text-sm mt-1">
            Complete your child's profile to at least 75% to enable booking. Fill in all required
            fields and add emergency contact information.
          </div>
        </Alert>
      )}

      {/* Form */}
      <form id="profile-form" onSubmit={handleSubmit} className="flex flex-col gap-10">
        {/* Photo Upload Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Profile Photo
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              {formData.photoUrl ? (
                <img
                  src={formData.photoUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-teal-50 dark:from-blue-900 dark:to-teal-900 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
                  <span className="text-3xl font-semibold text-slate-900 dark:text-white">
                    {formData.firstName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary hover:bg-primary-dark rounded-full flex items-center justify-center shadow-lg transition-colors"
                onClick={() => {
                  // TODO: Implement photo upload
                  addToast({
                    title: 'Coming Soon',
                    description: 'Photo upload functionality will be available soon',
                    color: 'primary',
                  })
                }}
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Upload a photo of your child (optional)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                JPG or PNG, max 5MB. Recommended size: 400x400px
              </p>
            </div>
          </div>
        </div>

        {/* Basic Information Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <Input
            label="First Name"
            labelPlacement="outside"
            placeholder="Enter first name"
            value={formData.firstName}
            onValueChange={value => handleFieldChange('firstName', value)}
            isInvalid={!!errors.firstName}
            errorMessage={errors.firstName}
            isRequired
          />

          {/* Last Name */}
          <Input
            label="Last Name"
            labelPlacement="outside"
            placeholder="Enter last name (optional)"
            value={formData.lastName}
            onValueChange={value => handleFieldChange('lastName', value)}
            isInvalid={!!errors.lastName}
            errorMessage={errors.lastName}
          />

          {/* Nickname */}
          <Input
            label="Nickname"
            labelPlacement="outside"
            placeholder="Enter nickname (optional)"
            value={formData.nickname}
            onValueChange={value => handleFieldChange('nickname', value)}
            isInvalid={!!errors.nickname}
            errorMessage={errors.nickname}
            description="How your child prefers to be called"
          />

          {/* Date of Birth */}
          <div>
            <DatePicker
              label="Date of Birth"
              labelPlacement="outside"
              placeholderValue={new CalendarDate(2015, 1, 1)}
              value={formData.dateOfBirth}
              onChange={date => handleFieldChange('dateOfBirth', date)}
              showMonthAndYearPickers
              isRequired
            />
            {errors.dateOfBirth && <p className="text-xs text-danger mt-1">{errors.dateOfBirth}</p>}
            {age !== null && !errors.dateOfBirth && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Age: {age} years old
              </p>
            )}
          </div>
        </div>

        {/* Gender & School Year Section */}
        <div className="flex flex-col gap-8">
          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Gender <span className="text-danger">*</span>
            </label>
            <RadioGroup
              value={formData.gender}
              onValueChange={value => handleFieldChange('gender', value as FormData['gender'])}
              orientation="horizontal"
              classNames={{
                wrapper: 'gap-4',
              }}
            >
              <Radio value="girl">Girl</Radio>
              <Radio value="boy">Boy</Radio>
              <Radio value="non_binary">Non-binary</Radio>
              <Radio value="prefer_not_to_say">Prefer not to say</Radio>
            </RadioGroup>
            {errors.gender && <p className="text-xs text-danger mt-1">{errors.gender}</p>}
          </div>

          {/* School Country & Year Section */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* School Country */}
              <IconSelectField
                label="School country"
                labelPlacement="outside"
                placeholder="Select country..."
                value={formData.schoolCountry}
                onChange={value => handleFieldChange('schoolCountry', value)}
                options={SCHOOL_COUNTRY_OPTIONS}
                aria-label="School country"
              />

              {/* School Year */}
              <SelectField
                label="School year"
                labelPlacement="outside"
                placeholder="Select year..."
                value={formData.schoolYear}
                onChange={value => handleFieldChange('schoolYear', value)}
                options={schoolYearOptions.map(opt => {
                  const [, label] = opt.split('|')
                  return label
                })}
                isDisabled={!formData.schoolCountry}
                aria-label="School year"
              />
            </div>

            {/* School Year Equivalent Hint */}
            {schoolYearEquivalent && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Equivalent to:{' '}
                <span className="text-primary-600 dark:text-primary-400 font-medium">
                  {schoolYearEquivalent}
                </span>
              </p>
            )}
          </div>

          {/* Languages Spoken */}
          <IconTagSelectField
            label="Languages Spoken"
            value={formData.languagesSpoken}
            onChange={value => handleFieldChange('languagesSpoken', value)}
            items={LANGUAGE_OPTIONS_WITH_FLAGS.map(lang => ({
              id: lang.id,
              label: lang.label,
              icon: lang.flag,
            }))}
            placeholder="Add language"
            aria-label="profile-languages-spoken"
          />
        </div>
      </form>
    </div>
  )
}
