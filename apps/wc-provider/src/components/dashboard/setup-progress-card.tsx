'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@world-schools/ui-web'

export type SetupStepStatus = 'completed' | 'current' | 'locked'

export interface SetupStep {
  id: string
  title: string
  status: SetupStepStatus
  doneText?: string
  ctaLabel?: string
  ctaHref?: string
  lockedText?: string
}

interface SetupProgressCardProps {
  title?: string
  steps: SetupStep[]
}

const STEP_TILE_TONES: Record<SetupStepStatus, string> = {
  completed: 'border-primary-300 bg-primary-50',
  current: 'border-blue-300 bg-blue-50 ring-2 ring-blue-200',
  locked: 'border-default-200 bg-default-50 opacity-70',
}

const INDICATOR_TONES: Record<SetupStepStatus, string> = {
  completed: 'bg-success-500 text-white',
  current: 'bg-blue-500 text-white',
  locked: 'bg-default-200 text-default-500',
}

export function SetupProgressCard({ title = 'Setup progress', steps }: SetupProgressCardProps) {
  const total = steps.length
  const completedCount = steps.filter(s => s.status === 'completed').length
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  return (
    <div className="mb-8 rounded-2xl border border-default-200 bg-background p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {title} — {completedCount} of {total} {total === 1 ? 'step' : 'steps'} complete
        </p>
        <span className="text-sm font-semibold text-default-500">{pct}%</span>
      </div>
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-default-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 transition-colors',
              STEP_TILE_TONES[step.status]
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                INDICATOR_TONES[step.status]
              )}
            >
              {step.status === 'completed' ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              {step.status === 'completed' && step.doneText && (
                <span className="text-xs font-semibold text-primary-700">{step.doneText}</span>
              )}
              {step.status === 'current' && step.ctaLabel && step.ctaHref && (
                <Link
                  href={step.ctaHref}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {step.ctaLabel}
                  <ArrowRight size={12} />
                </Link>
              )}
              {step.status === 'locked' && (
                <span className="text-xs text-default-400">{step.lockedText ?? 'Coming up'}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
