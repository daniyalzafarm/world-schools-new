'use client'

import config from '@/config/config'
import { GoogleMapsLoader } from '@/components/map/GoogleMapsLoader'
import { GoogleMapWithSearch } from '@/components/map/GoogleMapWithSearch'

export function BookingDetailMapPanel({
  lat,
  lng,
  placeName,
  placeId,
}: {
  lat: number | null
  lng: number | null
  placeName: string
  /** Google Maps place id for the business — enables Place Details card on the map. */
  placeId: string | null
}) {
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
  const hasPlaceId = Boolean(placeId?.trim())

  if (!hasCoords && !hasPlaceId) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 bg-default-100 text-default-500 lg:min-h-0">
        <span className="text-3xl" aria-hidden>
          🗺️
        </span>
        <p className="text-sm font-medium">Location unavailable</p>
        <p className="max-w-xs px-4 text-center text-xs text-default-400">
          This camp has not published a map location or Google place yet.
        </p>
      </div>
    )
  }

  return (
    <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
      <div className="h-full min-h-[280px] w-full lg:min-h-0">
        <GoogleMapWithSearch
          selectedPlace={{
            lat: hasCoords ? lat : 0,
            lng: hasCoords ? lng : 0,
            name: placeName,
            placeId: hasPlaceId ? placeId : null,
          }}
        />
      </div>
    </GoogleMapsLoader>
  )
}
