import React from 'react'
import { cn } from '@world-schools/ui-web'

type InfoTone = 'warning' | 'primary' | 'success' | 'default'

const ICON_TONES: Record<InfoTone, string> = {
  warning: 'bg-warning-50 text-warning-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  default: 'bg-default-100 text-default-700',
}

export interface InfoTip {
  id: string
  icon: React.ReactNode
  title: string
  description: string
}

interface InfoTipsCardProps {
  icon: React.ReactNode
  iconTone?: InfoTone
  title: string
  subtitle?: string
  tips: InfoTip[]
}

export function InfoTipsCard({
  icon,
  iconTone = 'primary',
  title,
  subtitle,
  tips,
}: InfoTipsCardProps) {
  return (
    <section className="mb-8 rounded-2xl border border-default-200 bg-background p-6">
      <header className="mb-5 flex items-start gap-4">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            ICON_TONES[iconTone]
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-default-500">{subtitle}</p>}
        </div>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tips.map(tip => (
          <li key={tip.id} className="flex items-start gap-3 rounded-xl bg-default-50 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-default-600">
              {tip.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{tip.title}</p>
              <p className="text-xs text-default-500">{tip.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
