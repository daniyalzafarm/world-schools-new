'use client'

import { Button } from '@heroui/react'
import { useRouter } from 'next/navigation'
import type { OnboardingStatus } from '../../../types/onboarding'

interface ApprovedContentProps {
  status: OnboardingStatus
  contactFirstName?: string
  businessName?: string
}

export function ApprovedContent({ status, contactFirstName, businessName }: ApprovedContentProps) {
  const router = useRouter()
  const firstName = contactFirstName || 'there'
  const campName = businessName || 'Your camp'
  const stripeCompleted = status.stripeOnboardingCompleted

  const ctaLabel = stripeCompleted ? 'Go to Dashboard' : 'Connect Stripe'
  const ctaHref = stripeCompleted ? '/dashboard' : '/onboarding/stripe-connect'

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center text-center">
      {/* Success Icon */}
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-foreground">
        <span className="text-4xl font-bold leading-none">✓</span>
      </div>

      {/* Title */}
      <h1 className="mb-2 text-[28px] font-bold leading-tight text-foreground">
        You&apos;re Approved! 🎉
      </h1>
      <p className="mb-8 text-base text-default-500">
        Welcome to World-Camps, <span className="font-semibold text-primary-700">{firstName}</span>!
        <br />
        <span className="font-semibold text-primary-700">{campName}</span> is ready to go live.
      </p>

      {/* Verification Card */}
      <div className="mb-8 w-full rounded-xl border border-default-200 bg-default-50 p-5 text-left">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm">
            🛡️
          </div>
          <div className="text-[15px] font-bold text-foreground">
            Automatic Verification Complete
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2.5 py-1 text-sm text-foreground">
            <span className="text-base text-success">✓</span>
            Google Business verified
          </li>
          <li className="flex items-center gap-2.5 py-1 text-sm text-foreground">
            <span className="text-base text-success">✓</span>
            Insurance coverage confirmed
          </li>
          <li className="flex items-center gap-2.5 py-1 text-sm text-foreground">
            <span className="text-base text-success">✓</span>
            Safety certifications on file
          </li>
          <li className="flex items-center gap-2.5 py-1 text-sm text-foreground">
            <span className="text-base text-success">✓</span>
            Payment settings configured
          </li>
        </ul>
      </div>

      {/* Next Steps */}
      <div className="w-full">
        <h2 className="mb-4 text-center text-base font-bold text-foreground">What&apos;s Next?</h2>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3.5 rounded-xl border border-default-200 bg-white px-[18px] py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-[13px] font-bold text-default-500">
              1
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">
                Connect Stripe for payments
              </div>
              <div className="text-xs text-default-500">
                ~10 minutes • Required to receive bookings
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-xl border border-default-200 bg-white px-[18px] py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-[13px] font-bold text-default-500">
              2
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">Create your first camp</div>
              <div className="text-xs text-default-500">
                ~15 minutes • Add photos, activities, descriptions
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-xl border border-default-200 bg-white px-[18px] py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-[13px] font-bold text-default-500">
              3
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">Create your first session</div>
              <div className="text-xs text-default-500">
                ~5 minutes • Set dates, pricing, capacity
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTA */}
      <div className="mt-8 w-full">
        <Button color="primary" fullWidth size="lg" onPress={() => router.push(ctaHref)}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
