'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

export interface MapSelectedPlace {
  lat: number
  lng: number
  name: string
  /** Google Maps place id — kept for backward compat, used to build a Maps link. */
  placeId?: string | null
}

interface GoogleMapWithSearchProps {
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  selectedPlace?: MapSelectedPlace | null
}

function buildGoogleMapsUrl(place: MapSelectedPlace): string {
  if (place.placeId?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`place_id:${place.placeId.trim()}`)}`
  }
  return `https://www.google.com/maps?q=${place.lat},${place.lng}`
}

function createPinElement(label: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText =
    'display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform 0.2s;'

  const pill = document.createElement('div')
  pill.textContent = label
  pill.style.cssText =
    'background:white;padding:5px 10px;border:1.5px solid #d1d5e1;border-radius:20px;font-size:12px;font-weight:700;color:#111827;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;font-family:system-ui,-apple-system,sans-serif;line-height:1.4;'

  const dot = document.createElement('div')
  dot.style.cssText =
    'width:8px;height:8px;background:#1E2A4A;border-radius:50%;margin-top:-2px;flex-shrink:0;'

  wrapper.appendChild(pill)
  wrapper.appendChild(dot)

  wrapper.addEventListener('mouseenter', () => {
    pill.style.background = '#1E2A4A'
    pill.style.color = 'white'
    pill.style.border = 'none'
    dot.style.background = '#45F0B5'
    wrapper.style.transform = 'scale(1.1)'
  })
  wrapper.addEventListener('mouseleave', () => {
    pill.style.background = 'white'
    pill.style.color = '#111827'
    pill.style.border = '1.5px solid #d1d5e1'
    dot.style.background = '#1E2A4A'
    wrapper.style.transform = 'scale(1)'
  })

  return wrapper
}

export function GoogleMapWithSearch({ selectedPlace }: GoogleMapWithSearchProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
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

        if (!mapRef.current) return

        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary

        if (!isMounted) return

        const hasCoords =
          selectedPlace &&
          (selectedPlace.lat !== 0 || selectedPlace.lng !== 0) &&
          !Number.isNaN(selectedPlace.lat) &&
          !Number.isNaN(selectedPlace.lng)

        const initialCenter = hasCoords
          ? { lat: selectedPlace!.lat, lng: selectedPlace!.lng }
          : { lat: 46, lng: 8 }

        const mapInstance = new Map(mapRef.current, {
          center: initialCenter,
          zoom: hasCoords ? 14 : 6,
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

  // Place marker
  useEffect(() => {
    if (!map || !selectedPlace) return

    let cancelled = false

    const cleanup = () => {
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      if (markerRef.current) {
        markerRef.current.map = null
        markerRef.current = null
      }
    }

    const run = async () => {
      cleanup()

      const hasCoords =
        (selectedPlace.lat !== 0 || selectedPlace.lng !== 0) &&
        !Number.isNaN(selectedPlace.lat) &&
        !Number.isNaN(selectedPlace.lng)

      if (!hasCoords) return

      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        'marker'
      )) as google.maps.MarkerLibrary

      if (cancelled) return

      const mapsUrl = buildGoogleMapsUrl(selectedPlace)

      // Build a custom popup div anchored above the pill
      const popup = document.createElement('div')
      popup.style.cssText =
        'position:absolute;display:none;flex-direction:column;align-items:center;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);z-index:10;pointer-events:auto;'
      const card = document.createElement('div')
      card.style.cssText =
        'background:#1E2A4A;border-radius:14px;padding:12px 16px;min-width:160px;max-width:240px;box-shadow:0 4px 16px rgba(0,0,0,0.22);white-space:nowrap;'
      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:14px;color:#fff;line-height:1.4;">${selectedPlace.name}</div>
          <button data-popup-close style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:rgba(255,255,255,0.6);font-size:16px;flex-shrink:0;margin-top:1px;">✕</button>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
           style="font-family:system-ui,-apple-system,sans-serif;display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#45F0B5;text-decoration:none;">
          View on Google Maps →
        </a>`
      // Small caret pointing down
      const caret = document.createElement('div')
      caret.style.cssText =
        'width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #1E2A4A;'
      popup.appendChild(card)
      popup.appendChild(caret)

      const pinEl = createPinElement(selectedPlace.name)
      pinEl.style.position = 'relative'
      pinEl.appendChild(popup)
      popupRef.current = popup

      let popupOpen = false
      pinEl.addEventListener('click', e => {
        const target = e.target as HTMLElement
        if (target.closest('[data-popup-close]')) {
          popupOpen = false
          popup.style.display = 'none'
          return
        }
        popupOpen = !popupOpen
        popup.style.display = popupOpen ? 'flex' : 'none'
      })

      const marker = new AdvancedMarkerElement({
        position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
        map,
        content: pinEl,
        title: selectedPlace.name,
      })
      markerRef.current = marker

      map.setCenter({ lat: selectedPlace.lat, lng: selectedPlace.lng })
      map.setZoom(15)
    }

    void run()

    return () => {
      cancelled = true
      cleanup()
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
