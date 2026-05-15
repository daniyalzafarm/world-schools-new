'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { Zap } from 'lucide-react'

interface DemandBannerProps {
  hotSessionCount: number
}

export function DemandBanner({ hotSessionCount }: DemandBannerProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-warning-500 to-warning-600 p-6 text-white sm:p-10">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Zap size={20} />
        </div>
        <div className="flex-1">
          <p className="mb-1 text-sm font-medium uppercase tracking-wider text-white/80">
            High Demand
          </p>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">
            {hotSessionCount} {hotSessionCount === 1 ? 'session is' : 'sessions are'} 90%+ full
          </h2>
          <p className="mb-6 max-w-xl text-sm text-white/90 sm:text-base">
            You&apos;re getting strong demand. Add capacity, open more sessions, or enable a
            waitlist before parents miss out.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button as={Link} href="/camps" color="default" radius="lg">
              Add session
            </Button>
            <Button
              as={Link}
              href="/bookings"
              variant="bordered"
              radius="lg"
              className="border-white/40 text-white hover:bg-white/10"
            >
              Review requests
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
