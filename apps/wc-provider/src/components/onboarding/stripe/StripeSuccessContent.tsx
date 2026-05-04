'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import Confetti from 'react-confetti'
import type {
  StripeAccountStatus,
  StripePayoutSchedule,
} from '../../../services/stripe-connect.services'

interface StripeSuccessContentProps {
  status: StripeAccountStatus
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  SGD: 'S$',
  HKD: 'HK$',
  JPY: '¥',
}

function maskAccountId(id: string | null): string | null {
  if (!id) return null
  if (id.length <= 8) return id
  // Stripe account IDs look like `acct_1NvAbC...XXXX`. Show the prefix +
  // last 4 chars and mask the middle so the screen reveals only enough
  // for the user to recognise it as theirs.
  const prefix = id.slice(0, 7)
  const suffix = id.slice(-4)
  return `${prefix}•••••${suffix}`
}

function formatPayoutSchedule(schedule: StripePayoutSchedule | null): string {
  if (!schedule?.interval) return '—'
  switch (schedule.interval) {
    case 'manual':
      return 'Manual (per booking)'
    case 'daily':
      return 'Daily'
    case 'weekly': {
      const day = schedule.weeklyAnchor
        ? schedule.weeklyAnchor.charAt(0).toUpperCase() + schedule.weeklyAnchor.slice(1)
        : null
      return day ? `Weekly (every ${day})` : 'Weekly'
    }
    case 'monthly':
      return schedule.monthlyAnchor ? `Monthly (day ${schedule.monthlyAnchor})` : 'Monthly'
    default:
      return schedule.interval.charAt(0).toUpperCase() + schedule.interval.slice(1)
  }
}

function formatCurrency(currency: string): string {
  const code = currency.toUpperCase()
  const symbol = CURRENCY_SYMBOLS[code]
  return symbol ? `${code} (${symbol})` : code
}

export function StripeSuccessContent({ status }: StripeSuccessContentProps) {
  const router = useRouter()

  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const accountIdMasked = maskAccountId(status.stripeAccountId)
  const bank =
    status.externalAccounts.find(a => a.defaultForCurrency) ?? status.externalAccounts[0] ?? null
  const bankLast4 = bank?.last4 ?? null
  const payoutLabel = formatPayoutSchedule(status.payoutSchedule)
  const currencyLabel = formatCurrency(status.currency)

  return (
    <>
      {size.w > 0 && (
        <Confetti
          width={size.w}
          height={size.h}
          numberOfPieces={250}
          recycle={false}
          tweenDuration={4000}
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
        />
      )}

      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center text-center">
        {/* Success Icon */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-foreground">
          <span className="text-4xl font-bold leading-none">✓</span>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-[28px] font-bold leading-tight text-foreground">
          Stripe Connected! 🎉
        </h1>
        <p className="mb-8 text-base text-default-500">
          Your payment account is ready.
          <br />
          You can now receive bookings from parents worldwide.
        </p>

        {/* Stripe Account Card */}
        <div className="mb-8 w-full rounded-xl border border-default-200 bg-default-50 p-5 text-left">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#635BFF] text-xs font-bold text-white">
              S
            </div>
            <div className="flex-1 text-[15px] font-bold text-foreground">Stripe Account</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Connected
            </div>
          </div>

          <div className="flex flex-col gap-2.5 text-sm">
            {accountIdMasked && (
              <div className="flex items-center justify-between">
                <span className="text-default-500">Account ID</span>
                <span className="font-mono font-medium tracking-wide text-foreground">
                  {accountIdMasked}
                </span>
              </div>
            )}
            {bankLast4 && (
              <div className="flex items-center justify-between">
                <span className="text-default-500">Bank account</span>
                <span className="font-mono font-medium tracking-wide text-foreground">
                  •••• •••• •••• {bankLast4}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-default-500">Payout schedule</span>
              <span className="font-medium text-foreground">{payoutLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-default-500">Currency</span>
              <span className="font-medium text-foreground">{currencyLabel}</span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="w-full">
          <h2 className="mb-4 text-center text-base font-bold text-foreground">
            What&apos;s Next?
          </h2>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3.5 rounded-xl border border-default-200 bg-white px-[18px] py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-[13px] font-bold text-default-500">
                1
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
                2
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-foreground">
                  Create your first session
                </div>
                <div className="text-xs text-default-500">
                  ~5 minutes • Set dates, pricing, capacity
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-xl border border-default-200 bg-white px-[18px] py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-[13px] font-bold text-default-500">
                3
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-foreground">
                  Start receiving bookings!
                </div>
                <div className="text-xs text-default-500">
                  Your camp will be visible to families worldwide
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 w-full">
          <Button
            color="primary"
            size="lg"
            className="w-full py-4 font-bold"
            onPress={() => router.push('/camps/create/basic-info')}
          >
            Create Your Camp
          </Button>
        </div>
      </div>
    </>
  )
}
