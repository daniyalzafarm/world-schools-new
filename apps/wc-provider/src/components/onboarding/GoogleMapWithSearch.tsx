'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

interface GoogleMapWithSearchProps {
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  selectedPlace?: { lat: number; lng: number; name: string } | null
  className?: string
}

export function GoogleMapWithSearch({ selectedPlace, className = '' }: GoogleMapWithSearchProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [marker, setMarker] = useState<google.maps.Marker | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        // Check if Google Maps is already loaded
        if (typeof google === 'undefined' || !google.maps) {
          setError('Google Maps API not loaded')
          setIsLoading(false)
          return
        }

        if (!mapRef.current) return

        // Default location (San Francisco)
        const defaultLocation = { lat: 37.7749, lng: -122.4194 }
        let initialCenter = defaultLocation
        let initialZoom = 12

        // Try to get user's current location
        if (navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 0,
                enableHighAccuracy: true,
              })
            })

            initialCenter = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            initialZoom = 13
            // Using user's current location
          } catch (geoError) {
            console.warn('Geolocation failed, using default location:', geoError)
            // Continue with default location
          }
        }

        // Create map centered on user's location or default
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        })

        setMap(mapInstance)
        setIsLoading(false)
      } catch (err) {
        console.error('Error initializing map:', err)
        setError('Failed to initialize map')
        setIsLoading(false)
      }
    }

    void initMap()
  }, [])

  // Update map when a place is selected
  useEffect(() => {
    if (!map || !selectedPlace) return

    // Validate that lat and lng are valid numbers
    if (
      typeof selectedPlace.lat !== 'number' ||
      typeof selectedPlace.lng !== 'number' ||
      !isFinite(selectedPlace.lat) ||
      !isFinite(selectedPlace.lng)
    ) {
      console.warn('Invalid lat/lng values in selectedPlace:', selectedPlace)
      return
    }

    // Remove existing marker
    if (marker) {
      marker.setMap(null)
    }

    // Create new marker
    const newMarker = new google.maps.Marker({
      position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
      map: map,
      title: selectedPlace.name,
      animation: google.maps.Animation.DROP,
    })

    // Center and zoom to the selected place
    map.setCenter({ lat: selectedPlace.lat, lng: selectedPlace.lng })
    map.setZoom(15)

    setMarker(newMarker)
  }, [map, selectedPlace])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Please ensure Google Maps API is properly configured
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Spinner size="lg" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  )
}
