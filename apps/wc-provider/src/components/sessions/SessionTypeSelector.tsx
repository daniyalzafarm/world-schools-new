'use client'

import { useState } from 'react'
import { Button, Card, CardBody } from '@heroui/react'
import { Check } from 'lucide-react'
import type { SessionType } from '@/types/sessions'

interface SessionTypeSelectorProps {
  campId: string
  onTypeSelected: (type: SessionType) => void
  isLoading?: boolean
}

/**
 * Session Type Selector Component
 * Allows users to choose between Flexible and Fixed session types
 * Reference: Design flex-session-1.png
 */
export function SessionTypeSelector({
  campId,
  onTypeSelected,
  isLoading = false,
}: SessionTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)

  const handleSelect = (type: SessionType) => {
    setSelectedType(type)
  }

  const handleContinue = () => {
    if (selectedType) {
      onTypeSelected(selectedType)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-[28px] font-bold text-default-900">Choose Your Session Type</h1>
        <p className="text-[16px] text-default-500 max-w-2xl mx-auto">
          Select how you want to structure your camp sessions. This choice will determine how
          parents book your camp.
        </p>
      </div>

      {/* Session Type Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Flexible Sessions Card */}
        <Card
          isPressable
          isHoverable
          onPress={() => handleSelect('flexible')}
          className={`border-2 transition-all ${
            selectedType === 'flexible'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
              : 'border-default-200 hover:border-default-300'
          }`}
        >
          <CardBody className="p-6 space-y-4">
            {/* Selection Indicator */}
            <div className="flex items-start justify-between">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-[24px]">
                🗓️
              </div>
              {selectedType === 'flexible' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <h3 className="text-[20px] font-bold text-default-900 mb-2">Flexible Sessions</h3>
              <p className="text-[14px] text-default-600 leading-relaxed">
                Parents choose their own start date and duration. Perfect for rolling admissions and
                camps that run continuously.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">
                  Parents pick start date within your range
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">
                  Multiple duration options (1-12 weeks)
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Different pricing per duration</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Optional blackout dates</span>
              </div>
            </div>

            {/* Best For */}
            <div className="pt-3 border-t border-default-200">
              <p className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-1">
                Best For
              </p>
              <p className="text-[13px] text-default-600">
                Language immersion, academic programs, year-round camps
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Fixed Sessions Card */}
        <Card
          isPressable
          isHoverable
          onPress={() => handleSelect('fixed')}
          className={`border-2 transition-all ${
            selectedType === 'fixed'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
              : 'border-default-200 hover:border-default-300'
          }`}
        >
          <CardBody className="p-6 space-y-4">
            {/* Selection Indicator */}
            <div className="flex items-start justify-between">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900 flex items-center justify-center text-[24px]">
                📅
              </div>
              {selectedType === 'fixed' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <h3 className="text-[20px] font-bold text-default-900 mb-2">Fixed Sessions</h3>
              <p className="text-[14px] text-default-600 leading-relaxed">
                Pre-defined sessions with set start and end dates. Ideal for traditional summer
                camps with specific weeks.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Set start and end dates</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Fixed pricing per session</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Capacity limits per session</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success-500 mt-0.5">✓</span>
                <span className="text-[13px] text-default-600">Easy to duplicate sessions</span>
              </div>
            </div>

            {/* Best For */}
            <div className="pt-3 border-t border-default-200">
              <p className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-1">
                Best For
              </p>
              <p className="text-[13px] text-default-600">
                Summer camps, sports camps, weekly programs
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Warning Notice */}
      <div className="bg-warning-50 dark:bg-warning-950 border border-warning-200 dark:border-warning-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-[20px] flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-warning-900 dark:text-warning-100 mb-1">
              Important: This choice is permanent
            </p>
            <p className="text-[13px] text-warning-700 dark:text-warning-300 leading-relaxed">
              Once you create your first session, you cannot change the session type. Choose
              carefully based on how you want parents to book your camp.
            </p>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          color="primary"
          size="lg"
          onPress={handleContinue}
          isDisabled={!selectedType}
          isLoading={isLoading}
          className="min-w-[200px] font-semibold"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
