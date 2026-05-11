'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'

interface WelcomeHeroProps {
  emoji?: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export function WelcomeHero({
  emoji = '👋',
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: WelcomeHeroProps) {
  return (
    <div className="mb-10 rounded-3xl bg-gradient-to-br from-primary-50 via-primary-100/40 to-default-100 px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-background text-4xl shadow-md">
        {emoji}
      </div>
      <h2 className="mb-3 text-2xl font-bold text-secondary-500 sm:text-3xl">{title}</h2>
      <p className="mx-auto mb-8 max-w-xl text-base text-default-500 sm:text-lg">{subtitle}</p>
      <Button
        as={Link}
        href={ctaHref}
        color="secondary"
        radius="lg"
        size="lg"
        endContent={<ArrowRight size={18} />}
      >
        {ctaLabel}
      </Button>
    </div>
  )
}
