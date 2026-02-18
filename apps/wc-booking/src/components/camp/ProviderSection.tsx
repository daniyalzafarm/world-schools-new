'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardBody } from '@heroui/react'
import { useAuth } from '@/hooks/use-auth'
import { conversationsService, useMessagingStore } from '@/stores/messaging-store'
import { ContextType } from '@world-schools/wc-frontend-utils'

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
}

export function ProviderSection({
  provider,
  campId,
  campSlug,
  campTitle,
}: ProviderSectionProps & { campTitle?: string }) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { setDraftConversation } = useMessagingStore()
  const {
    legalCompanyName,
    legalCity,
    legalStateProvince,
    legalCountry,
    yearFounded,
    googleBusinessProfile,
  } = provider

  // Use Google Business Profile data if available, otherwise fall back to provider data
  const displayName = googleBusinessProfile?.businessName || legalCompanyName
  const rating = googleBusinessProfile?.rating ? Number(googleBusinessProfile.rating) : null
  const reviewsCount = googleBusinessProfile?.reviewsCount ?? 0
  const location =
    googleBusinessProfile?.formattedAddress ||
    [legalCity, legalStateProvince, legalCountry].filter(Boolean).join(', ')

  // Calculate years in operation
  const yearsInOperation = yearFounded ? new Date().getFullYear() - yearFounded : null

  /**
   * Handle message organizer button click
   * - If not authenticated: redirect to login with return URL
   * - If authenticated: save draft conversation and navigate to /messages (WhatsApp Web pattern)
   */
  const handleMessageOrganizer = () => {
    // Check if user is authenticated
    if (!isAuthenticated || !user) {
      // Redirect to login with return URL
      const returnUrl = campSlug ? `/camps/${campSlug}` : window.location.pathname
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }

    // ✅ WhatsApp Web pattern: Save draft conversation metadata
    setDraftConversation({
      providerId: provider.id,
      providerName: provider.legalCompanyName || 'Provider',
      participantType: 'provider',
      contextType: campId ? ContextType.CAMP : undefined,
      contextId: campId,
      contextName: campTitle,
    })

    // Navigate to /messages (not /messages/new or /messages/:id)
    router.push('/messages')
  }

  return (
    <div className="mb-12 pb-8 border-b border-gray-300">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">About the Organizer</h2>
      </div>

      {/* Main Content Card */}
      <Card shadow="none" className="border border-gray-200">
        <CardBody className="p-6">
          <h3 className="text-xl mb-4 font-semibold text-gray-900">{displayName}</h3>
          {/* Rating and Reviews */}
          {rating && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">⭐</span>
                <span className="text-lg font-semibold text-gray-900">{rating.toFixed(1)}</span>
              </div>
              {reviewsCount > 0 && (
                <span className="text-base text-gray-600">
                  {reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'}
                </span>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Location */}
            {location && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-semibold text-gray-900 mb-1">📍 Location</div>
                <div className="text-base text-gray-600">{location}</div>
              </div>
            )}

            {/* Years in Operation */}
            {yearsInOperation && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  🏢 Years in Operation
                </div>
                <div className="text-base text-gray-600">{yearsInOperation} years</div>
              </div>
            )}
          </div>

          {/* Response Stats */}
          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Response rate</div>
                <div className="text-base font-semibold text-gray-900">100%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Response time</div>
                <div className="text-base font-semibold text-gray-900">Within an hour</div>
              </div>
            </div>
          </div>

          {/* Message Button */}
          <Button
            variant="bordered"
            size="lg"
            className="w-full md:w-auto font-semibold border-gray-900 text-gray-900"
            onPress={handleMessageOrganizer}
          >
            Message organizer
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
