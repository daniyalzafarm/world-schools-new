'use client'

import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { GoogleBusinessProfile } from '../../types/application-review'

interface GoogleBusinessSectionProps {
  profile: GoogleBusinessProfile
}

export function GoogleBusinessSection({ profile }: GoogleBusinessSectionProps) {
  return (
    <div className="rounded-lg border border-default-200 p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        {EMOJI.SEARCH} Google Business Profile
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-default-600">Business Name</div>
          <div className="text-foreground">{profile.businessName}</div>
        </div>
        <div>
          <div className="text-sm text-default-600">Place ID</div>
          <div className="text-sm text-foreground">{profile.placeId}</div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-default-600">Address</div>
          <div className="text-foreground">{profile.formattedAddress}</div>
        </div>
        {profile.rating && (
          <div>
            <div className="text-sm text-default-600">Rating</div>
            <div className="text-foreground">
              {EMOJI.STAR} {profile.rating} ({profile.reviewsCount} reviews)
            </div>
          </div>
        )}
        {profile.phone && (
          <div>
            <div className="text-sm text-default-600">Phone</div>
            <div className="text-foreground">{profile.phone}</div>
          </div>
        )}
        {profile.website && (
          <div className="col-span-2">
            <div className="text-sm text-default-600">Website</div>
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-700 hover:underline"
            >
              {profile.website}
            </a>
          </div>
        )}
        {profile.types && profile.types.length > 0 && (
          <div className="col-span-2">
            <div className="text-sm text-default-600">Business Types</div>
            <div className="text-foreground">{profile.types.join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
