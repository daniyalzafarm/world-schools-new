'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'

interface WelcomeHeroStat {
  label: string
  value: string | number
}

interface WelcomeHeroProps {
  emoji?: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref?: string
  onCtaPress?: () => void | Promise<void>
  stats?: WelcomeHeroStat[]
}

export function WelcomeHero({
  emoji = '🎉',
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  onCtaPress,
  stats,
}: WelcomeHeroProps) {
  const buttonCommon = {
    color: 'secondary' as const,
    radius: 'lg' as const,
    size: 'lg' as const,
    endContent: <ArrowRight size={18} />,
  }

  return (
    <div className="mb-10 rounded-3xl bg-gradient-to-br from-[#DCFCE7] via-[#E6FCF5] to-[#DBEAFE] px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-background text-4xl shadow-md">
        {emoji}
      </div>
      <h2 className="mb-3 text-2xl font-bold text-secondary-500 sm:text-3xl">{title}</h2>
      <p className="mx-auto mb-6 max-w-xl text-base text-default-500 sm:text-lg">{subtitle}</p>
      {stats && stats.length > 0 && (
        <div className="mx-auto mb-8 flex max-w-md flex-wrap items-start justify-center gap-x-10 gap-y-4">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-secondary-500 sm:text-3xl">{s.value}</p>
              <p className="text-xs font-medium text-default-500 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {(!stats || stats.length === 0) && <div className="mb-2" />}
      {onCtaPress ? (
        <Button {...buttonCommon} onPress={() => void onCtaPress()}>
          {ctaLabel}
        </Button>
      ) : ctaHref ? (
        <Button {...buttonCommon} as={Link} href={ctaHref}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}
