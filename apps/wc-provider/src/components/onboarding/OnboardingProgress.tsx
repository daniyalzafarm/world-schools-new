'use client'

import { EMOJI } from '@world-schools/wc-frontend-utils'
import { cn } from '@heroui/react'

interface Step {
  number: number
  title: string
  emoji: string
  completed: boolean
  current: boolean
}

interface OnboardingProgressProps {
  currentStep: number
  stepCompletion: {
    step1: boolean
    step2: boolean
    step3: boolean
    step4: boolean
    step5: boolean
    step6: boolean
    step7: boolean
  }
}

export function OnboardingProgress({ currentStep, stepCompletion }: OnboardingProgressProps) {
  const steps: Step[] = [
    {
      number: 1,
      title: 'Find Your Camp',
      emoji: EMOJI.SEARCH,
      completed: stepCompletion.step1,
      current: currentStep === 1,
    },
    {
      number: 2,
      title: 'Contact & Account',
      emoji: EMOJI.USER,
      completed: stepCompletion.step2,
      current: currentStep === 2,
    },
    {
      number: 3,
      title: 'About Your Camp',
      emoji: EMOJI.TENT,
      completed: stepCompletion.step3,
      current: currentStep === 3,
    },
    {
      number: 4,
      title: 'Verification',
      emoji: EMOJI.DOCUMENT,
      completed: stepCompletion.step4,
      current: currentStep === 4,
    },
    {
      number: 5,
      title: 'Deposit Settings',
      emoji: EMOJI.MONEY_BAG,
      completed: stepCompletion.step5,
      current: currentStep === 5,
    },
    {
      number: 6,
      title: 'Cancellation Policy',
      emoji: EMOJI.CREDIT_CARD,
      completed: stepCompletion.step6,
      current: currentStep === 6,
    },
    {
      number: 7,
      title: 'Review & Submit',
      emoji: EMOJI.CHECK_MARK,
      completed: stepCompletion.step7,
      current: currentStep === 7,
    },
  ]

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex flex-1 items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl transition-all',
                  {
                    'border-primary bg-primary text-white': step.completed,
                    'border-primary bg-white text-primary': step.current && !step.completed,
                    'border-default-300 bg-white text-default-400':
                      !step.current && !step.completed,
                  }
                )}
              >
                {step.completed ? EMOJI.CHECK_MARK : step.emoji}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={cn('text-xs font-medium', {
                    'text-primary': step.current || step.completed,
                    'text-default-600': !step.current && !step.completed,
                  })}
                >
                  Step {step.number}
                </div>
                <div
                  className={cn('text-xs', {
                    'text-foreground': step.current || step.completed,
                    'text-default-400': !step.current && !step.completed,
                  })}
                >
                  {step.title}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 bg-default-200">
                <div
                  className={cn('h-full bg-primary transition-all', {
                    'w-full': step.completed,
                    'w-0': !step.completed,
                  })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
