'use client'

import config from '@/config/config'
import { GoogleMapsLoader } from '@/components/map/GoogleMapsLoader'
import { GoogleMapWithSearch } from '@/components/map/GoogleMapWithSearch'

export function BookingDetailMapPanel({
  lat,
  lng,
  placeName,
}: {
  lat: number | null
  lng: number | null
  placeName: string
}) {
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)

  if (!hasCoords) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 bg-default-100 text-default-500 lg:min-h-0">
        <span className="text-3xl" aria-hidden>
          🗺️
        </span>
        <p className="text-sm font-medium">Location unavailable</p>
        <p className="max-w-xs px-4 text-center text-xs text-default-400">
          This camp has not published map coordinates yet.
        </p>
      </div>
    )
  }

  return (
    <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
      <div className="h-full min-h-[280px] w-full lg:min-h-0">
        <GoogleMapWithSearch
          selectedPlace={{
            lat,
            lng,
            name: placeName,
          }}
        />
      </div>
    </GoogleMapsLoader>
  )
}
