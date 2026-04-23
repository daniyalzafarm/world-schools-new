'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Checkbox } from '@heroui/react'
import { Input, Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { Plus, Trash2 } from 'lucide-react'

const MAX_SUPERVISION_LENGTH = 600
const MAX_SCREEN_LENGTH = 400

const RATIO_VALUE_REGEX = /^\d+:\d+$/

/** HeroUI Checkbox slots — matches previous native checkbox + card look */
const safetyFeatureCheckboxSlots = {
  wrapper:
    'm-0 shrink-0 before:border-default-300 group-data-[selected=true]:before:border-primary',
  label: 'min-w-0 flex-1 wrap-break-word text-sm leading-snug text-foreground',
} as const

interface StaffRatio {
  label: string
  value: string
}

interface SafetySupervisionData {
  description: string
  staffRatios: StaffRatio[]
  items: string[]
}

const DEFAULT_SAFETY_FEATURES = [
  'DBS / background-checked staff',
  'First aid certified staff',
  '24h on-site nurse',
  'Qualified lifeguards',
  'Secure perimeter',
  'CCTV on site',
  'No unsupervised time',
  'Daily parent updates',
  'Safeguarding trained staff',
  'Medical room on site',
]

const SCREEN_TEMPLATES = [
  {
    id: 'free-time',
    title: 'Free time only',
    desc: 'Devices permitted during free time. No phones during activities, meals, or group sessions.',
    text: 'Devices are permitted during free time only. No phones during training, meals, or evening group activities. Wi-Fi is available in common areas. We believe in digital boundaries that support full immersion in the camp experience.',
  },
  {
    id: 'no-devices',
    title: 'No devices',
    desc: 'Phones and devices are not permitted for the duration of the camp.',
    text: 'Phones and personal devices are not permitted during the camp. Devices are collected on arrival and returned at the end of the session. Campers may use a shared phone to contact parents if needed.',
  },
  {
    id: 'custom',
    title: 'Custom',
    desc: 'Write your own policy below.',
    text: '',
  },
]

export default function SafetyPoliciesEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()

  // Safety & supervision state
  const [safetyData, setSafetyData] = useState<SafetySupervisionData>({
    description: '',
    staffRatios: [],
    items: [],
  })
  const [newItem, setNewItem] = useState('')

  // Screen policy state
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [screenDescription, setScreenDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('free-time')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (currentCamp) {
      if (currentCamp.safetySupervision) {
        const s = currentCamp.safetySupervision as any
        setSafetyData({
          description: s.description || '',
          staffRatios: s.staffRatios || [],
          items: s.items || [],
        })
      }
      if (currentCamp.screenPolicy) {
        const p = currentCamp.screenPolicy as any
        const desc = p.description || ''
        setScreenDescription(desc)
        setScreenEnabled(true)
        const matched = SCREEN_TEMPLATES.find(t => t.id !== 'custom' && t.text === desc)
        setSelectedTemplate(matched ? matched.id : 'custom')
      }
      setIsLoaded(true)
    }
  }, [currentCamp])

  const allRatiosValid = safetyData.staffRatios.every(
    r => r.label.trim() !== '' && RATIO_VALUE_REGEX.test(r.value)
  )

  const autosavePayload = useMemo(
    () => ({ safetyData, screenEnabled, screenDescription }),
    [safetyData, screenEnabled, screenDescription]
  )

  useAutosave(autosavePayload, {
    enabled: isLoaded && allRatiosValid,
    save: async ({ safetyData: safety, screenEnabled: enabled, screenDescription: desc }) => {
      const screenPayload = enabled && desc.trim() ? { description: desc } : null
      await updateSection(campId, 'safety-policies', {
        safetySupervision: safety,
        screenPolicy: screenPayload,
      })
    },
  })

  const updateRatioLabel = (index: number, label: string) => {
    setSafetyData(prev => ({
      ...prev,
      staffRatios: prev.staffRatios.map((r, i) => (i === index ? { ...r, label } : r)),
    }))
  }

  const updateRatioValue = (index: number, value: string) => {
    setSafetyData(prev => ({
      ...prev,
      staffRatios: prev.staffRatios.map((r, i) => (i === index ? { ...r, value } : r)),
    }))
  }

  const handleAddRatio = () => {
    setSafetyData(prev => ({
      ...prev,
      staffRatios: [...prev.staffRatios, { label: '', value: '' }],
    }))
  }

  const handleRemoveRatio = (index: number) => {
    setSafetyData(prev => ({
      ...prev,
      staffRatios: prev.staffRatios.filter((_, i) => i !== index),
    }))
  }

  const toggleFeature = (item: string) => {
    setSafetyData(prev => ({
      ...prev,
      items: prev.items.includes(item) ? prev.items.filter(i => i !== item) : [...prev.items, item],
    }))
  }

  const handleRemoveCustomFeature = (item: string) => {
    setSafetyData(prev => ({ ...prev, items: prev.items.filter(i => i !== item) }))
  }

  const handleAddCustomFeature = () => {
    if (!newItem.trim() || safetyData.items.includes(newItem.trim())) return
    setSafetyData(prev => ({ ...prev, items: [...prev.items, newItem.trim()] }))
    setNewItem('')
  }

  const handleDescriptionChange = (value: string) => {
    setSafetyData(prev => ({ ...prev, description: value }))
  }

  const handleScreenToggle = (enabled: boolean) => {
    setScreenEnabled(enabled)
    if (enabled && !screenDescription && selectedTemplate !== 'custom') {
      const template = SCREEN_TEMPLATES.find(t => t.id === selectedTemplate)
      if (template) setScreenDescription(template.text)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    if (templateId !== 'custom') {
      const template = SCREEN_TEMPLATES.find(t => t.id === templateId)
      if (template) setScreenDescription(template.text)
    } else {
      setScreenDescription('')
    }
  }

  const handleScreenDescriptionChange = (value: string) => {
    if (selectedTemplate !== 'custom') setSelectedTemplate('custom')
    setScreenDescription(value)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Safety & Policies</h1>
        <p className="text-base leading-normal text-default-500">
          Tell parents how you keep children safe and what your camp rules are. This appears on your
          public profile and contributes to your trust score.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Card 1: Staff Ratios ─────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-default-200">
          <div className="px-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl">
                👥
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Staff ratios</p>
                <p className="mt-0.5 text-sm leading-snug text-default-500">
                  How many staff per child, for different parts of the day or activity. Shown on
                  your profile and in your trust score.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5 pt-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-default-500">
              Ratios
            </label>

            {safetyData.staffRatios.length > 0 && (
              <div className="mb-3 space-y-2.5">
                {safetyData.staffRatios.map((ratio, index) => (
                  <div key={index} className="flex min-w-0 items-center gap-2.5">
                    <Input
                      placeholder="e.g. Staff to child ratio"
                      value={ratio.label}
                      onValueChange={val => updateRatioLabel(index, val)}
                      size="sm"
                      classNames={{ base: 'flex-1' }}
                    />
                    <span className="shrink-0 text-sm text-default-400">→</span>
                    <Input
                      placeholder="1:6"
                      value={ratio.value}
                      onValueChange={val => updateRatioValue(index, val)}
                      size="sm"
                      isInvalid={ratio.value.length > 0 && !RATIO_VALUE_REGEX.test(ratio.value)}
                      classNames={{ base: 'w-24', input: 'text-center font-semibold' }}
                    />
                    <Button
                      onPress={() => handleRemoveRatio(index)}
                      isIconOnly
                      size="sm"
                      color="danger"
                      variant="light"
                      aria-label="Remove ratio"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onPress={handleAddRatio}
              size="sm"
              variant="bordered"
              startContent={<Plus size={14} />}
              className="border-dashed"
            >
              Add ratio
            </Button>
          </div>
        </div>

        {/* ── Card 2: Safety Features ──────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-default-200">
          <div className="px-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl">
                🛡️
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Safety features</p>
                <p className="mt-0.5 text-sm leading-snug text-default-500">
                  Select everything that applies. Shown as a checklist on your camp profile.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5 pt-4">
            <div className="mb-3.5 grid min-w-0 grid-cols-2 gap-2">
              {DEFAULT_SAFETY_FEATURES.map(feature => {
                const isChecked = safetyData.items.includes(feature)
                return (
                  <Checkbox
                    key={feature}
                    color="primary"
                    isSelected={isChecked}
                    onValueChange={() => toggleFeature(feature)}
                    classNames={{
                      base: `flex min-w-0 w-full max-w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all m-0 ${
                        isChecked
                          ? 'border-primary bg-primary/5'
                          : 'border-default-200 bg-white hover:border-primary hover:bg-primary/5'
                      }`,
                      ...safetyFeatureCheckboxSlots,
                    }}
                  >
                    {feature}
                  </Checkbox>
                )
              })}
              {safetyData.items
                .filter(item => !DEFAULT_SAFETY_FEATURES.includes(item))
                .map(item => (
                  <Checkbox
                    key={item}
                    size="sm"
                    color="primary"
                    isSelected
                    onValueChange={selected => {
                      if (!selected) handleRemoveCustomFeature(item)
                    }}
                    classNames={{
                      base: 'flex min-w-0 w-full max-w-full cursor-pointer items-center gap-2.5 rounded-xl border border-primary bg-primary/5 px-3.5 py-2.5 transition-all m-0 hover:border-primary hover:bg-primary/5',
                      ...safetyFeatureCheckboxSlots,
                    }}
                  >
                    {item}
                  </Checkbox>
                ))}
            </div>

            <div className="flex min-w-0 gap-2">
              <Input
                placeholder="Add your own feature…"
                value={newItem}
                onValueChange={setNewItem}
                size="sm"
                classNames={{ base: 'flex-1' }}
                onKeyDown={e => e.key === 'Enter' && handleAddCustomFeature()}
              />
              <Button
                size="sm"
                variant="bordered"
                onPress={handleAddCustomFeature}
                isDisabled={!newItem.trim()}
                className="shrink-0"
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* ── Card 3: Supervision Description ─────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-default-200">
          <div className="px-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl">
                📝
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Supervision description</p>
                <p className="mt-0.5 text-sm leading-snug text-default-500">
                  Optional. A paragraph about your safety approach in your own words — reassures
                  parents beyond the checklist.
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 px-6 pb-5 pt-4">
            <Textarea
              placeholder="Describe your safety and supervision approach, staff qualifications, and emergency procedures..."
              value={safetyData.description}
              onChange={e => handleDescriptionChange(e.target.value)}
              minRows={5}
              maxLength={MAX_SUPERVISION_LENGTH}
              showCharacterCount
              classNames={{ base: 'min-w-0' }}
            />
          </div>
        </div>

        {/* ── Screen Time Policy sub-section ──────────────────────────────── */}
        <div className="pt-4">
          <h2 className="text-lg font-bold text-foreground">Screen time policy</h2>
          <p className="mt-1 text-sm leading-normal text-default-500">
            Let parents know your rules around phones and devices. This appears in the camp profile
            accordion.
          </p>
        </div>

        {/* ── Card 4: Device Rules ─────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-default-200">
          <div className="flex items-start justify-between px-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl">
                📱
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Device rules</p>
                <p className="mt-0.5 text-sm leading-snug text-default-500">
                  Choose a template or write your own.
                </p>
              </div>
            </div>
            <label className="relative ml-4 h-6 w-11 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={screenEnabled}
                onChange={e => handleScreenToggle(e.target.checked)}
              />
              <span className="absolute inset-0 rounded-full bg-default-300 transition-colors peer-checked:bg-primary" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>

          <div
            className={`min-w-0 px-6 pb-5 pt-4 transition-opacity ${
              screenEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
            }`}
          >
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-default-500">
              Template
            </label>
            <div className="mb-4 space-y-2" role="radiogroup">
              {SCREEN_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  role="radio"
                  aria-checked={selectedTemplate === template.id}
                  tabIndex={0}
                  onClick={() => handleTemplateSelect(template.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleTemplateSelect(template.id)
                    }
                  }}
                  className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                    selectedTemplate === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-default-200 bg-white hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-primary-700 bg-primary-700'
                        : 'border-default-300'
                    }`}
                  >
                    {selectedTemplate === template.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {template.title}
                    </span>
                    <span className="mt-0.5 block wrap-break-word text-xs leading-snug text-default-500">
                      {template.desc}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-default-500">
              Description shown to parents
            </label>
            <Textarea
              placeholder="Describe your camp's approach to devices, social media, and screen time..."
              value={screenDescription}
              onChange={e => handleScreenDescriptionChange(e.target.value)}
              minRows={4}
              maxLength={MAX_SCREEN_LENGTH}
              showCharacterCount
              classNames={{ base: 'min-w-0' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
