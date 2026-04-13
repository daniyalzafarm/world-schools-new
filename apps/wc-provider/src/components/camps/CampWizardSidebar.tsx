'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@heroui/react'
import { Logo } from '@/components/layout/logo'
import { useCampsStore } from '@/stores/camps-store'
import type { Camp } from '@/types/camps'

interface CampWizardSidebarProps {
  currentStep: number
  campId?: string
}

const WIZARD_STEPS = [
  { number: 1, title: 'Basic Info', subtitle: 'Camp details', path: 'basic-info' },
  { number: 2, title: 'Audience', subtitle: 'Target campers', path: 'audience' },
  { number: 3, title: 'Programs', subtitle: 'Activities', path: 'programs' },
  { number: 4, title: 'Photos', subtitle: 'Gallery', path: 'photos' },
  { number: 5, title: 'Sessions', subtitle: 'Dates & pricing', path: 'sessions' },
]

// Helper function to check if a step is completed
function isStepCompleted(step: number, camp: Camp | null): boolean {
  if (!camp) return false

  switch (step) {
    case 1: // Basic Info - completed if camp exists with required fields
      return !!(camp.name && camp.type && camp.description)
    case 2: // Audience - completed if ageGroups, languages, and gender are set
      return !!(
        camp.ageGroups &&
        Array.isArray(camp.ageGroups) &&
        camp.ageGroups.length > 0 &&
        camp.languages &&
        camp.languages.length > 0 &&
        camp.gender
      )
    case 3: // Programs - completed if activities are selected
      return !!(camp.activities && camp.activities.length > 0)
    case 4: // Photos - completed if at least 5 photos are uploaded
      return !!(camp.photos && Array.isArray(camp.photos) && camp.photos.length >= 5)
    case 5: // Sessions - completed if sessionType is set
      return !!camp.sessionType
    default:
      return false
  }
}

export function CampWizardSidebar({ currentStep, campId }: CampWizardSidebarProps) {
  const router = useRouter()
  const { wizardCamp } = useCampsStore()

  const handleStepClick = (step: number, path: string) => {
    // Navigate to the step
    if (step === 1) {
      router.push(`/camps/create/${path}${campId ? `?id=${campId}` : ''}`)
    } else if (campId) {
      router.push(`/camps/create/${path}?id=${campId}`)
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-100 flex h-screen w-72 flex-col overflow-y-auto border-r border-default-200 bg-default-50">
      {/* Logo Header */}
      <div className="flex min-h-16 items-center bg-default-50 px-5 py-5">
        <div className="flex items-center">
          <Logo size={'md'} showText={true} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6">
        <div className="mb-3 px-5 text-xs font-bold uppercase tracking-[0.5px] text-default-500">
          CREATE NEW CAMP
        </div>

        {WIZARD_STEPS.map(step => {
          const isCurrent = step.number === currentStep
          const isCompleted = isStepCompleted(step.number, wizardCamp)

          // Enable step based on completion of previous steps (like onboarding)
          let isEnabled = false
          if (step.number === 1) {
            isEnabled = true // Step 1 is always enabled
          } else if (step.number === 2) {
            isEnabled = campId !== undefined && isStepCompleted(1, wizardCamp)
          } else if (step.number === 3) {
            isEnabled =
              campId !== undefined &&
              isStepCompleted(1, wizardCamp) &&
              isStepCompleted(2, wizardCamp)
          } else if (step.number === 4) {
            isEnabled =
              campId !== undefined &&
              isStepCompleted(1, wizardCamp) &&
              isStepCompleted(2, wizardCamp) &&
              isStepCompleted(3, wizardCamp)
          } else if (step.number === 5) {
            isEnabled =
              campId !== undefined &&
              isStepCompleted(1, wizardCamp) &&
              isStepCompleted(2, wizardCamp) &&
              isStepCompleted(3, wizardCamp) &&
              isStepCompleted(4, wizardCamp)
          }

          const content = (
            <>
              {/* Active Indicator */}
              {isCurrent && isEnabled && (
                <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />
              )}

              {/* Step Number */}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  {
                    'border-primary bg-primary text-foreground':
                      (isCurrent || isCompleted) && isEnabled,
                    'border-default-300 text-default-500': !isCurrent && !isCompleted && isEnabled,
                    'border-default-300 bg-default-200 text-default-400': !isEnabled,
                  }
                )}
              >
                {isCompleted ? '✓' : step.number}
              </div>

              {/* Step Info */}
              <div className="flex flex-col text-start">
                <p className="text-sm font-semibold">{step.title}</p>
                <p
                  className={cn('text-xs', {
                    'text-default-500': isEnabled,
                    'text-default-400': !isEnabled,
                  })}
                >
                  {step.subtitle}
                </p>
              </div>
            </>
          )

          // Render as a div if disabled, button if enabled
          if (!isEnabled) {
            return (
              <div
                key={step.number}
                className={cn(
                  'relative flex items-center gap-3 px-5 py-3 transition-all cursor-not-allowed font-medium text-default-400 opacity-50'
                )}
              >
                {content}
              </div>
            )
          }

          return (
            <button
              key={step.number}
              onClick={() => handleStepClick(step.number, step.path)}
              className={cn('relative flex w-full items-center gap-3 px-5 py-3 transition-all', {
                'bg-white font-semibold text-foreground': isCurrent,
                'font-medium text-foreground hover:bg-white/60': !isCurrent,
              })}
            >
              {content}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
