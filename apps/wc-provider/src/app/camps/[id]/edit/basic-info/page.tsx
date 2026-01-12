'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Input, Radio, RadioGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function BasicInfoEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateBasicInfo, setHasUnsavedChanges, isLoading } = useCampsStore()

  const [formData, setFormData] = useState({
    name: '',
    type: 'day' as 'day' | 'residential',
    description: '',
    locationType: 'provider' as 'provider' | 'different',
    locationAddress: '',
  })

  useEffect(() => {
    if (currentCamp) {
      setFormData({
        name: currentCamp.name || '',
        type: currentCamp.type || 'day',
        description: currentCamp.description || '',
        locationType: currentCamp.locationType || 'provider',
        locationAddress: currentCamp.locationAddress || '',
      })
    }
  }, [currentCamp])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!campId) return

    try {
      await updateBasicInfo(campId, formData)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save basic info:', error)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Basic Information</h1>
        <p className="text-sm text-gray-600">Edit the basic details of your camp</p>
      </div>

      <div className="space-y-6">
        {/* Camp Name */}
        <Card>
          <CardBody>
            <Input
              label="Camp Name"
              placeholder="e.g., Summer Adventure Camp 2024"
              value={formData.name}
              onValueChange={value => handleChange('name', value)}
              maxLength={120}
              description={`${formData.name.length}/120 characters`}
              isRequired
            />
          </CardBody>
        </Card>

        {/* Camp Type */}
        <Card>
          <CardBody>
            <RadioGroup
              label="Camp Type"
              value={formData.type}
              onValueChange={value => handleChange('type', value)}
              isRequired
            >
              <Radio value="day">Day Camp</Radio>
              <Radio value="residential">Residential Camp</Radio>
            </RadioGroup>
          </CardBody>
        </Card>

        {/* Description */}
        <Card>
          <CardBody>
            <Textarea
              label="Camp Description"
              placeholder="Describe your camp..."
              value={formData.description}
              onValueChange={value => handleChange('description', value)}
              maxLength={500}
              minRows={4}
              description={`${formData.description.length}/500 characters`}
              isRequired
            />
          </CardBody>
        </Card>

        {/* Location Type */}
        <Card>
          <CardBody>
            <RadioGroup
              label="Location"
              value={formData.locationType}
              onValueChange={value => handleChange('locationType', value)}
              isRequired
            >
              <Radio value="provider">Same as provider location</Radio>
              <Radio value="different">Different location</Radio>
            </RadioGroup>

            {formData.locationType === 'different' && (
              <div className="mt-4 space-y-4">
                <Input
                  label="Address"
                  placeholder="Full address"
                  value={formData.locationAddress}
                  onValueChange={value => handleChange('locationAddress', value)}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
