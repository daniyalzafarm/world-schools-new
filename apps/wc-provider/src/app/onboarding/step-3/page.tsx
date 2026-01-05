'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner, Textarea } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

export default function OnboardingStep3Page() {
  const router = useRouter()
  const { status, isLoading, saveCampInfo } = useOnboardingStore()
  const [description, setDescription] = useState('')
  const [campTypes, setCampTypes] = useState<string[]>([])
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')

  const charCount = description.length
  const isDescriptionValid = charCount >= 100 && charCount <= 300

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Load saved camp info
  useEffect(() => {
    const loadCampInfo = async () => {
      const savedInfo = await onboardingService.getCampInfo()
      if (savedInfo) {
        setDescription(savedInfo.description)
        setCampTypes(savedInfo.campTypes)
        setMinAge(savedInfo.minAge.toString())
        setMaxAge(savedInfo.maxAge.toString())
      }
    }
    void loadCampInfo()
  }, [])

  // Route protection: Check if user can access Step 3
  useEffect(() => {
    if (status && !canAccessStep(3, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  const toggleCampType = (type: string) => {
    if (isReadOnly) return // Prevent changes in read-only mode
    setCampTypes(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]))
  }

  const handleContinue = async () => {
    try {
      await saveCampInfo({
        description,
        campTypes,
        minAge: parseInt(minAge),
        maxAge: parseInt(maxAge),
      })
      router.push('/onboarding/step-4')
    } catch (error) {
      console.error('Failed to save camp info:', error)
    }
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / About Your Camp"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="light" onClick={() => router.push('/onboarding/step-2')}>
            ← Back
          </Button>
          <Button
            className="bg-primary font-semibold text-foreground hover:bg-primary-600"
            size="lg"
            onClick={isReadOnly ? () => router.push('/onboarding/step-4') : handleContinue}
            isDisabled={
              !isReadOnly && (!isDescriptionValid || campTypes.length === 0 || !minAge || !maxAge)
            }
            isLoading={isLoading}
          >
            {isReadOnly ? 'Next →' : 'Save & Continue →'}
          </Button>
        </div>
      }
    >
      {/* Content */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-[32px] font-bold leading-tight text-foreground">About your camp</h1>
            <TrustScoreBadge section="step3" maxPoints={10} />
          </div>
          <p className="text-[16px] text-default-500">
            Help us understand your programs so we can review your application
          </p>
        </div>

        {/* Form */}
        <div className="space-y-8">
          {/* Brief Description */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <label className="text-[15px] font-semibold text-foreground">
                Brief Description
                <span className="ml-1 text-danger">*</span>
              </label>
              <div className="group relative">
                <span className="cursor-help text-default-500">ⓘ</span>
                <div className="invisible absolute left-0 top-full z-10 mt-1 w-64 rounded-lg bg-foreground p-3 text-xs text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  Helps our team understand your camp during review
                </div>
              </div>
            </div>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell us about your camp programs, specialty, and what makes you unique..."
              maxLength={300}
              minLength={100}
              isDisabled={isReadOnly}
              classNames={{
                input: 'text-base',
                inputWrapper:
                  'border border-default-200 rounded-lg hover:border-default-500 data-[focus=true]:border-foreground data-[disabled=true]:bg-default-100 data-[disabled=true]:cursor-not-allowed',
              }}
              minRows={4}
            />
            <div className="mt-2 text-right text-sm">
              <span className={charCount < 100 ? 'text-danger' : 'text-default-500'}>
                {charCount}
              </span>{' '}
              <span className="text-default-500">/ 300 characters (minimum 100)</span>
            </div>
          </div>

          {/* Camp Type */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <label className="text-[15px] font-semibold text-foreground">
                Camp Type
                <span className="ml-1 text-danger">*</span>
              </label>
              <div className="group relative">
                <span className="cursor-help text-default-500">ⓘ</span>
                <div className="invisible absolute left-0 top-full z-10 mt-1 w-64 rounded-lg bg-foreground p-3 text-xs text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  Choose the type of camp you operate
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Day Camp */}
              <button
                type="button"
                onClick={() => toggleCampType('day')}
                disabled={isReadOnly}
                className={`cursor-pointer flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                  campTypes.includes('day')
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-500'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="text-3xl">☀️</div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-foreground">Day Camp</div>
                  <div className="text-sm text-default-500">Campers go home daily</div>
                </div>
              </button>

              {/* Overnight Camp */}
              <button
                type="button"
                onClick={() => toggleCampType('overnight')}
                disabled={isReadOnly}
                className={`cursor-pointer flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                  campTypes.includes('overnight')
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-500'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="text-3xl">🌙</div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-foreground">Overnight Camp</div>
                  <div className="text-sm text-default-500">Campers stay overnight</div>
                </div>
              </button>
            </div>
          </div>

          {/* Age Range */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <label className="text-[15px] font-semibold text-foreground">
                Age Range Served
                <span className="ml-1 text-danger">*</span>
              </label>
              <div className="group relative">
                <span className="cursor-help text-default-500">ⓘ</span>
                <div className="invisible absolute left-0 top-full z-10 mt-1 w-64 rounded-lg bg-foreground p-3 text-xs text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  Specify the age range of campers you serve
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={minAge}
                onChange={e => setMinAge(e.target.value)}
                placeholder="Min age"
                min="0"
                max="99"
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              <span className="text-default-500">to</span>
              <input
                type="number"
                value={maxAge}
                onChange={e => setMaxAge(e.target.value)}
                placeholder="Max age"
                min="0"
                max="99"
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
            </div>
          </div>
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
