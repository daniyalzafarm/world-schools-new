'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { HelpCircle } from 'lucide-react'

interface HelpBannerProps {
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export function HelpBanner({ title, subtitle, ctaLabel, ctaHref }: HelpBannerProps) {
  return (
    <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl bg-secondary-500 p-6 text-white sm:flex-row sm:items-center sm:gap-5 sm:p-7">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
        <HelpCircle size={22} />
      </div>
      <div className="flex-1">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-white/80">{subtitle}</p>
      </div>
      <Button
        as={Link}
        href={ctaHref}
        radius="lg"
        className="bg-white text-secondary-500 hover:bg-white/90"
      >
        {ctaLabel}
      </Button>
    </div>
  )
}
