'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

export interface MapSelectedPlace {
  lat: number
  lng: number
  name: string
  /** Google Maps place id (e.g. ChIJ…). When set, loads Place Details (New) and opens an info card. */
  placeId?: string | null
}

interface GoogleMapWithSearchProps {
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  selectedPlace?: MapSelectedPlace | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function displayNameFromPlace(place: { displayName?: string | { text?: string } | null }): string {
  const d = place.displayName
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && typeof d.text === 'string') return d.text
  return ''
}

function latLngFromPlaceLocation(
  location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined
): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof (location as google.maps.LatLng).lat === 'function') {
    const ll = location as google.maps.LatLng
    return { lat: ll.lat(), lng: ll.lng() }
  }
  const l = location as google.maps.LatLngLiteral
  if (typeof l.lat === 'number' && typeof l.lng === 'number') {
    return { lat: l.lat, lng: l.lng }
  }
  return null
}

/**
 * Fallback when Places has not returned {@link google.maps.places.Place.googleMapsURI} yet.
 * Uses `q=place_id:…` so Maps opens the place listing (search/?query_place_id often lands on generic search).
 */
function fallbackGoogleMapsUrlFromPlaceId(placeId: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`place_id:${placeId.trim()}`)}`
}

/** Prefer official listing URL from Place Details; see Place.googleMapsURI in Maps JS types. */
function resolveGoogleMapsListingUrl(place: google.maps.places.Place, placeId: string): string {
  const fromApi = place.googleMapsURI?.trim()
  if (fromApi) return fromApi
  return fallbackGoogleMapsUrlFromPlaceId(placeId)
}

function buildPlaceInfoCardHtml(
  place: {
    displayName?: string | { text?: string } | null
    formattedAddress?: string | null
    rating?: number | null
    userRatingCount?: number | null
    nationalPhoneNumber?: string | null
  },
  fallbackName: string,
  mapsUri: string
): string {
  const title = displayNameFromPlace(place) || fallbackName
  const addr = place.formattedAddress?.trim() ?? ''
  const rating = place.rating
  const reviews = place.userRatingCount
  const phone = place.nationalPhoneNumber?.trim() ?? ''

  const ratingLine =
    typeof rating === 'number'
      ? `<div style="font-size:13px;color:#5f6368;margin-top:4px;">★ ${rating.toFixed(1)}${typeof reviews === 'number' ? ` · ${reviews.toLocaleString()} reviews` : ''}</div>`
      : ''

  const phoneLine = phone
    ? `<div style="font-size:13px;color:#5f6368;margin-top:6px;">${escapeHtml(phone)}</div>`
    : ''

  const linkLine = mapsUri.trim()
    ? `<a href="${escapeHtml(mapsUri)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:500;color:#1a73e8;text-decoration:none;">View on Google Maps</a>`
    : ''

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:300px;padding:2px 4px 6px;">
      <div style="font-weight:600;font-size:15px;color:#202124;line-height:1.3;">${escapeHtml(title)}</div>
      ${addr ? `<div style="font-size:13px;color:#5f6368;margin-top:8px;line-height:1.4;">${escapeHtml(addr)}</div>` : ''}
      ${ratingLine}
      ${phoneLine}
      ${linkLine}
    </div>
  `
}

export function GoogleMapWithSearch({ selectedPlace }: GoogleMapWithSearchProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const markerClickListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize map once
  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      try {
        if (typeof google === 'undefined' || !google.maps) {
          if (isMounted) {
            setError('Google Maps API not loaded')
            setIsLoading(false)
          }
          return
        }

        if (!mapRef.current) {
          return
        }

        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary

        if (!isMounted) return

        const defaultLocation = { lat: 37.7749, lng: -122.4194 }
        const hasCoords =
          selectedPlace &&
          (selectedPlace.lat !== 0 || selectedPlace.lng !== 0) &&
          !Number.isNaN(selectedPlace.lat) &&
          !Number.isNaN(selectedPlace.lng)

        const initialCenter = hasCoords
          ? { lat: selectedPlace!.lat, lng: selectedPlace!.lng }
          : defaultLocation
        const initialZoom = hasCoords || selectedPlace?.placeId ? 14 : 12

        const mapInstance = new Map(mapRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          mapId: 'DEMO_MAP_ID',
        })

        if (isMounted) {
          setMap(mapInstance)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Error initializing map:', err)
        if (isMounted) {
          setError(
            `Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
          setIsLoading(false)
        }
      }
    }

    void initMap()

    return () => {
      isMounted = false
    }
  }, [])

  // Marker + optional Place Details card
  useEffect(() => {
    if (!map || !selectedPlace) return

    let cancelled = false

    const cleanupMarkerAndInfo = () => {
      infoWindowRef.current?.close()
      infoWindowRef.current = null
      if (markerClickListenerRef.current) {
        google.maps.event.removeListener(markerClickListenerRef.current)
        markerClickListenerRef.current = null
      }
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
    }

    /** Classic default marker (teardrop) + optional click to reopen InfoWindow. */
    const createMarker = (
      lat: number,
      lng: number,
      title: string,
      infoWindow: google.maps.InfoWindow | null
    ): google.maps.Marker => {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title,
        optimized: true,
      })
      if (infoWindow) {
        markerClickListenerRef.current = marker.addListener('click', () => {
          infoWindow.open({ map, anchor: marker })
        })
      }
      return marker
    }

    const addSimpleMarker = (lat: number, lng: number, title: string) => {
      if (cancelled) return
      const marker = createMarker(lat, lng, title, null)
      markerRef.current = marker
      map.setCenter({ lat, lng })
      map.setZoom(15)
    }

    const run = async () => {
      cleanupMarkerAndInfo()

      const placeId = selectedPlace.placeId?.trim()
      const hasCoords =
        (selectedPlace.lat !== 0 || selectedPlace.lng !== 0) &&
        !Number.isNaN(selectedPlace.lat) &&
        !Number.isNaN(selectedPlace.lng)

      if (placeId) {
        try {
          const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
          const place = new Place({ id: placeId })
          await place.fetchFields({
            fields: [
              'displayName',
              'formattedAddress',
              'location',
              'rating',
              'userRatingCount',
              'nationalPhoneNumber',
              // Official Maps URL for this place (capital URI — not `googleMapsUri`)
              'googleMapsURI',
            ],
          })

          if (cancelled) return

          const pos = latLngFromPlaceLocation(place.location)
          const lat = pos?.lat ?? (hasCoords ? selectedPlace.lat : null)
          const lng = pos?.lng ?? (hasCoords ? selectedPlace.lng : null)

          if (lat == null || lng == null) {
            if (hasCoords) {
              addSimpleMarker(selectedPlace.lat, selectedPlace.lng, selectedPlace.name)
            }
            return
          }

          map.setCenter({ lat, lng })
          map.setZoom(16)

          if (cancelled) return

          const mapsUri = resolveGoogleMapsListingUrl(place, placeId)
          const html = buildPlaceInfoCardHtml(place, selectedPlace.name, mapsUri)
          const iw = new google.maps.InfoWindow({ content: html, maxWidth: 320 })
          infoWindowRef.current = iw

          const marker = createMarker(
            lat,
            lng,
            displayNameFromPlace(place) || selectedPlace.name,
            iw
          )
          markerRef.current = marker
          iw.open({ map, anchor: marker })
        } catch (err) {
          console.error('Place Details (New) failed:', err)
          if (hasCoords) {
            addSimpleMarker(selectedPlace.lat, selectedPlace.lng, selectedPlace.name)
          }
        }
        return
      }

      if (hasCoords) {
        try {
          addSimpleMarker(selectedPlace.lat, selectedPlace.lng, selectedPlace.name)
        } catch (err) {
          console.error('Error creating marker:', err)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      cleanupMarkerAndInfo()
    }
  }, [map, selectedPlace?.lat, selectedPlace?.lng, selectedPlace?.name, selectedPlace?.placeId])

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-gray-100 rounded-xl">
        <div className="text-center p-6">
          <p className="text-sm text-red-500 font-medium">{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Please ensure Google Maps API is properly configured
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-xl">
          <Spinner size="lg" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full rounded-xl" style={{ minHeight: '400px' }} />
    </div>
  )
}
