'use client'

import { useEffect, useState } from 'react'

interface GoogleMapsLoaderProps {
  children: React.ReactNode
  apiKey: string
}

let isLoading = false
let isLoaded = false

export function GoogleMapsLoader({ children, apiKey }: GoogleMapsLoaderProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If already loaded, just update state
    if (isLoaded) {
      setLoaded(true)
      return
    }

    // If currently loading, wait for it
    if (isLoading) {
      const checkLoaded = setInterval(() => {
        if (isLoaded) {
          setLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      return () => clearInterval(checkLoaded)
    }

    // Start loading
    isLoading = true

    const loadGoogleMaps = () => {
      if (!apiKey) {
        setError('Google Maps API key not configured')
        isLoading = false
        return
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        isLoaded = true
        setLoaded(true)
        isLoading = false
        return
      }

      // Create script element
      const script = document.createElement('script')
      // Add loading=async parameter to follow Google's best practices
      // See: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=initGoogleMaps`
      script.async = true
      script.defer = true

      // Set up callback
      ;(window as any).initGoogleMaps = () => {
        isLoaded = true
        setLoaded(true)
        isLoading = false
      }

      script.onerror = () => {
        setError('Failed to load Google Maps API')
        isLoading = false
      }

      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [apiKey])

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Please check your Google Maps API configuration
          </p>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-sm text-gray-500">Loading Google Maps...</div>
      </div>
    )
  }

  return <>{children}</>
}
