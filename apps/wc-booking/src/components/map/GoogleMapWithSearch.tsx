'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

interface GoogleMapWithSearchProps {
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  selectedPlace?: { lat: number; lng: number; name: string } | null
}

export function GoogleMapWithSearch({ selectedPlace }: GoogleMapWithSearchProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<any>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize Google Maps - runs once on mount
  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      try {
        // Check if Google Maps is already loaded
        if (typeof google === 'undefined' || !google.maps) {
          console.error('Google Maps API not loaded')
          if (isMounted) {
            setError('Google Maps API not loaded')
            setIsLoading(false)
          }
          return
        }

        if (!mapRef.current) {
          console.warn('Map container ref not available')
          return
        }

        console.log('Initializing Google Maps...')

        // Import the Map library using dynamic import
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary

        if (!isMounted) return

        // Use selectedPlace if available, otherwise use default
        const defaultLocation = { lat: 37.7749, lng: -122.4194 }
        const initialCenter = selectedPlace
          ? { lat: selectedPlace.lat, lng: selectedPlace.lng }
          : defaultLocation
        const initialZoom = selectedPlace ? 15 : 12

        console.log('Creating map with center:', initialCenter)

        // Create map - simplified without geolocation to avoid delays
        const mapInstance = new Map(mapRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
        })

        console.log('Map instance created successfully')

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
  }, []) // Empty dependency array - only run once

  // Update marker when selectedPlace changes - FIXED: removed marker from dependencies
  useEffect(() => {
    if (!map || !selectedPlace) return

    let isMounted = true

    const addMarker = async () => {
      try {
        console.log('Adding marker at:', selectedPlace)

        // Import the marker library using dynamic import
        const { AdvancedMarkerElement } = (await google.maps.importLibrary(
          'marker'
        )) as google.maps.MarkerLibrary

        if (!isMounted) return

        // Remove existing marker
        if (markerRef.current) {
          console.log('Removing existing marker')
          markerRef.current.map = null
          markerRef.current = null
        }

        // Create new marker using AdvancedMarkerElement
        const newMarker = new AdvancedMarkerElement({
          position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
          map: map,
          title: selectedPlace.name,
        })

        console.log('Marker created successfully')

        // Center and zoom to the selected place
        map.setCenter({ lat: selectedPlace.lat, lng: selectedPlace.lng })
        map.setZoom(15)

        markerRef.current = newMarker
      } catch (err) {
        console.error('Error creating marker:', err)
      }
    }

    void addMarker()

    return () => {
      isMounted = false
    }
  }, [map, selectedPlace]) // FIXED: removed marker from dependencies to prevent infinite loop

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
