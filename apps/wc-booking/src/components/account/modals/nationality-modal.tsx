'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import Select, { type SingleValue } from 'react-select'
import { selectFieldClassNames, selectFieldPortalStyles } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'

interface NationalityModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrimaryNationality?: string
  currentSecondaryNationality?: string
  onSuccess?: () => void
}

type NationalityOption = { value: string; label: string }

// Common nationalities list
const NATIONALITIES = [
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Andorran',
  'Angolan',
  'Argentine',
  'Armenian',
  'Australian',
  'Austrian',
  'Azerbaijani',
  'Bahamian',
  'Bahraini',
  'Bangladeshi',
  'Barbadian',
  'Belarusian',
  'Belgian',
  'Belizean',
  'Beninese',
  'Bhutanese',
  'Bolivian',
  'Bosnian',
  'Brazilian',
  'British',
  'Bruneian',
  'Bulgarian',
  'Burkinabe',
  'Burmese',
  'Burundian',
  'Cambodian',
  'Cameroonian',
  'Canadian',
  'Cape Verdean',
  'Central African',
  'Chadian',
  'Chilean',
  'Chinese',
  'Colombian',
  'Comoran',
  'Congolese',
  'Costa Rican',
  'Croatian',
  'Cuban',
  'Cypriot',
  'Czech',
  'Danish',
  'Djiboutian',
  'Dominican',
  'Dutch',
  'East Timorese',
  'Ecuadorean',
  'Egyptian',
  'Emirati',
  'Equatorial Guinean',
  'Eritrean',
  'Estonian',
  'Ethiopian',
  'Fijian',
  'Filipino',
  'Finnish',
  'French',
  'Gabonese',
  'Gambian',
  'Georgian',
  'German',
  'Ghanaian',
  'Greek',
  'Grenadian',
  'Guatemalan',
  'Guinean',
  'Guyanese',
  'Haitian',
  'Honduran',
  'Hungarian',
  'Icelandic',
  'Indian',
  'Indonesian',
  'Iranian',
  'Iraqi',
  'Irish',
  'Israeli',
  'Italian',
  'Ivorian',
  'Jamaican',
  'Japanese',
  'Jordanian',
  'Kazakhstani',
  'Kenyan',
  'Kuwaiti',
  'Kyrgyz',
  'Laotian',
  'Latvian',
  'Lebanese',
  'Liberian',
  'Libyan',
  'Liechtensteiner',
  'Lithuanian',
  'Luxembourger',
  'Macedonian',
  'Malagasy',
  'Malawian',
  'Malaysian',
  'Maldivian',
  'Malian',
  'Maltese',
  'Mauritanian',
  'Mauritian',
  'Mexican',
  'Moldovan',
  'Monacan',
  'Mongolian',
  'Montenegrin',
  'Moroccan',
  'Mozambican',
  'Namibian',
  'Nepalese',
  'New Zealander',
  'Nicaraguan',
  'Nigerian',
  'Nigerien',
  'North Korean',
  'Norwegian',
  'Omani',
  'Pakistani',
  'Palauan',
  'Palestinian',
  'Panamanian',
  'Papua New Guinean',
  'Paraguayan',
  'Peruvian',
  'Polish',
  'Portuguese',
  'Qatari',
  'Romanian',
  'Russian',
  'Rwandan',
  'Saudi',
  'Senegalese',
  'Serbian',
  'Singaporean',
  'Slovak',
  'Slovenian',
  'Somali',
  'South African',
  'South Korean',
  'Spanish',
  'Sri Lankan',
  'Sudanese',
  'Surinamese',
  'Swazi',
  'Swedish',
  'Swiss',
  'Syrian',
  'Taiwanese',
  'Tajik',
  'Tanzanian',
  'Thai',
  'Togolese',
  'Trinidadian',
  'Tunisian',
  'Turkish',
  'Turkmen',
  'Ugandan',
  'Ukrainian',
  'Uruguayan',
  'Uzbekistani',
  'Venezuelan',
  'Vietnamese',
  'Yemeni',
  'Zambian',
  'Zimbabwean',
]

const NATIONALITY_OPTIONS: NationalityOption[] = NATIONALITIES.map(n => ({ value: n, label: n }))

export const NationalityModal: React.FC<NationalityModalProps> = ({
  isOpen,
  onClose,
  currentPrimaryNationality = '',
  currentSecondaryNationality = '',
  onSuccess,
}) => {
  const [primaryNationality, setPrimaryNationality] = useState(currentPrimaryNationality)
  const [secondaryNationality, setSecondaryNationality] = useState(currentSecondaryNationality)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrimaryNationality(currentPrimaryNationality)
      setSecondaryNationality(currentSecondaryNationality)
      setError(null)
    }
  }, [isOpen, currentPrimaryNationality, currentSecondaryNationality])

  const handleSave = async () => {
    // Validation
    if (!primaryNationality) {
      setError('Primary nationality is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        primaryNationality,
        secondaryNationality: secondaryNationality || undefined,
      })

      addToast({
        title: 'Success',
        description: 'Nationality updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update nationality')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update nationality',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit nationality</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="primary-nationality"
              className="block text-sm font-medium text-slate-900 dark:text-white mb-2"
            >
              Primary nationality <span className="text-danger">*</span>
            </label>
            <Select<NationalityOption>
              inputId="primary-nationality"
              unstyled
              menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
              styles={selectFieldPortalStyles<NationalityOption>()}
              classNames={selectFieldClassNames<NationalityOption>()}
              options={NATIONALITY_OPTIONS}
              value={NATIONALITY_OPTIONS.find(o => o.value === primaryNationality) ?? null}
              onChange={(selected: SingleValue<NationalityOption>) => {
                setPrimaryNationality(selected?.value ?? '')
                if (error) setError(null)
              }}
              placeholder="Select primary nationality"
              isDisabled={isSaving}
              aria-required
            />
          </div>

          <div>
            <label
              htmlFor="secondary-nationality"
              className="block text-sm font-medium text-slate-900 dark:text-white mb-2"
            >
              Secondary nationality (optional)
            </label>
            <Select<NationalityOption>
              inputId="secondary-nationality"
              unstyled
              isClearable
              menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
              styles={selectFieldPortalStyles<NationalityOption>()}
              classNames={selectFieldClassNames<NationalityOption>()}
              options={NATIONALITY_OPTIONS}
              value={NATIONALITY_OPTIONS.find(o => o.value === secondaryNationality) ?? null}
              onChange={(selected: SingleValue<NationalityOption>) =>
                setSecondaryNationality(selected?.value ?? '')
              }
              placeholder="Select secondary nationality"
              isDisabled={isSaving}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleSave}
            isLoading={isSaving}
            isDisabled={!primaryNationality}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
