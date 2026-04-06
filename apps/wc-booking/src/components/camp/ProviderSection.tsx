'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useMessagingStore } from '@/stores/messaging-store'
import { ContextType } from '@world-schools/wc-frontend-utils'
import { Button } from '@heroui/react'

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
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
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0"
            style={{ background: getAvatarGradient(displayName) }}
          >
            {getInitials(displayName)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold text-gray-900 leading-snug">{displayName}</div>
            {location && <div className="text-[13px] text-gray-500 mt-0.5">{location}</div>}

            {isVerified && (
              <>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-[18px] h-[18px] bg-[#16a34a] rounded-full flex items-center justify-center shrink-0">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-semibold text-[#16a34a]">
                    Verified organizer
                  </span>
                  {yearFounded && (
                    <span className="text-[13px] text-gray-400">· Founded {yearFounded}</span>
                  )}
                </div>
                <div className="text-[12px] text-gray-500 mt-1">Verified by World Camps</div>
              </>
            )}
            {!isVerified && yearFounded && (
              <div className="text-[13px] text-gray-400 mt-1.5">Founded {yearFounded}</div>
            )}
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="py-3.5 px-4 text-center">
            <span className="text-[16px] font-bold text-gray-900 block mb-0.5">
              {responseRate != null ? `${Math.round(responseRate)}%` : '—'}
            </span>
            <span className="text-[11px] text-gray-500 uppercase tracking-[0.04em]">
              Response rate
            </span>
          </div>
          <div className="py-3.5 px-4 text-center">
            <span className="text-[16px] font-bold text-gray-900 block mb-0.5">
              {avgReplyTimeMinutes != null ? formatReplyTime(avgReplyTimeMinutes) : '—'}
            </span>
            <span className="text-[11px] text-gray-500 uppercase tracking-[0.04em]">
              Avg reply time
            </span>
          </div>
          <div className="py-3.5 px-4 text-center">
            <span className="text-[16px] font-bold text-gray-900 block mb-0.5">{totalCamps}</span>
            <span className="text-[11px] text-gray-500 uppercase tracking-[0.04em]">
              Camps listed
            </span>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="px-5 py-4 flex gap-2.5">
          <Button onPress={handleMessageOrganizer} className="w-full" color="secondary">
            Message the camp
          </Button>
          {totalCamps > 1 && (
            <a
              href={`/providers/${provider.id}/camps`}
              className="flex-1 bg-secondary text-white rounded-xl py-3.5 text-[14px] font-bold text-center hover:opacity-85 transition-opacity"
            >
              View all {totalCamps} camps
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
