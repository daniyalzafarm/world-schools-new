'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useMessagingStore } from '@/stores/messaging-store'
import { ContextType } from '@world-schools/wc-frontend-utils'
import { getInitials } from '@world-schools/ui-web'
import { Button } from '@heroui/react'
import { HiBadgeCheck } from 'react-icons/hi'

interface ProviderSectionProps {
  provider: {
    id: string
    legalCompanyName: string
    legalCity?: string
    legalStateProvince?: string
    legalCountry?: string
    phone?: string
    email?: string
    website?: string
    yearFounded?: number
    description?: string
    trustScore?: number | null
    approvalStatus?: string
    logoUrl?: string | null
    responseRate?: number | null
    avgReplyTimeMinutes?: number | null
    _count?: { camps: number }
    googleBusinessProfile?: {
      businessName: string
      formattedAddress: string
      rating?: number
      reviewsCount?: number
      phone?: string
      website?: string
    }
  }
  campId?: string
  campSlug?: string
  campTitle?: string
}

// Generate a deterministic gradient from provider name initials
function getAvatarGradient(name: string): string {
  const gradients = [
    'linear-gradient(135deg, #45F0B5, #1a1a2e)',
    'linear-gradient(135deg, #60a5fa, #1a1a2e)',
    'linear-gradient(135deg, #f472b6, #1a1a2e)',
    'linear-gradient(135deg, #a78bfa, #1a1a2e)',
    'linear-gradient(135deg, #fb923c, #1a1a2e)',
    'linear-gradient(135deg, #34d399, #1a1a2e)',
  ]
  const index = name.charCodeAt(0) % gradients.length
  return gradients[index]
}

function formatReplyTime(minutes: number): string {
  if (minutes < 60) return `<${minutes}m`
  const hours = Math.ceil(minutes / 60)
  if (hours <= 1) return '<1h'
  if (hours <= 2) return '<2h'
  if (hours <= 4) return '<4h'
  if (hours <= 24) return '<24h'
  return '24h+'
}

export function ProviderSection({ provider, campId, campSlug, campTitle }: ProviderSectionProps) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { setDraftConversation } = useMessagingStore()

  const {
    legalCity,
    legalStateProvince,
    legalCountry,
    yearFounded,
    approvalStatus,
    logoUrl,
    responseRate,
    avgReplyTimeMinutes,
    _count,
    googleBusinessProfile,
  } = provider

  const displayName = googleBusinessProfile?.businessName || provider.legalCompanyName
  const location =
    googleBusinessProfile?.formattedAddress ||
    [legalCity, legalStateProvince, legalCountry].filter(Boolean).join(', ')
  const isVerified = approvalStatus === 'approved'
  const totalCamps = _count?.camps ?? 1

  const handleMessageOrganizer = () => {
    if (!isAuthenticated || !user) {
      router.push(
        `/login?returnUrl=${encodeURIComponent(campSlug ? `/camps/${campSlug}` : window.location.pathname)}`
      )
      return
    }
    setDraftConversation({
      providerId: provider.id,
      providerName: provider.legalCompanyName || 'Provider',
      participantType: 'provider',
      contextType: campId ? ContextType.CAMP : undefined,
      contextId: campId,
      contextName: campTitle,
      contextImageUrl: provider.logoUrl ?? undefined,
    })
    router.push('/messages')
  }

  return (
    <section
      id="organizer"
      className="mb-10 scroll-mt-14 border-t border-gray-200 pt-10 md:mb-12 md:scroll-mt-16 md:pt-12"
    >
      <h2 className="text-[clamp(18px,3vw,24px)] font-bold text-gray-900 mb-6">
        About the Organizer
      </h2>

      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3.5 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${displayName} logo`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: getAvatarGradient(displayName) }}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-snug">{displayName}</div>
            {location && <div className="text-sm text-gray-500 mt-0.5">{location}</div>}

            {isVerified && (
              <>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-0.5 text-sm font-bold text-primary-600">
                    <HiBadgeCheck size={16} />
                    Verified
                  </span>
                  {yearFounded && (
                    <span className="text-sm text-gray-400 font-semibold">
                      · Founded {yearFounded}
                    </span>
                  )}
                </div>
              </>
            )}
            {!isVerified && yearFounded && (
              <div className="text-sm text-gray-400 mt-1.5">Founded {yearFounded}</div>
            )}
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="py-3.5 px-4 text-center">
            <span className="text-base font-bold text-gray-900 block mb-0.5">
              {responseRate != null ? `${Math.round(responseRate)}%` : '—'}
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Response rate</span>
          </div>
          <div className="py-3.5 px-4 text-center">
            <span className="text-base font-bold text-gray-900 block mb-0.5">
              {avgReplyTimeMinutes != null ? formatReplyTime(avgReplyTimeMinutes) : '—'}
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Avg reply time</span>
          </div>
          <div className="py-3.5 px-4 text-center">
            <span className="text-base font-bold text-gray-900 block mb-0.5">{totalCamps}</span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Camps listed</span>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="px-5 py-4 flex gap-2.5">
          <Button onPress={handleMessageOrganizer} className="w-full" color="secondary">
            Message the camp
          </Button>
          {/* {totalCamps > 1 && (
            <Button
              as={Link}
              className="w-full"
              color="secondary"
              href={`/providers/${provider.id}/camps`}
              variant="solid"
            >
              View all {totalCamps} camps
            </Button>
          )} */}
        </div>
      </div>
    </section>
  )
}
