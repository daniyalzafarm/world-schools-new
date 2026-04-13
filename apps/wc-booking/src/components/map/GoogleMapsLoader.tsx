'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@heroui/react'

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
    let isMounted = true

    // If already loaded, just update state
    if (isLoaded) {
      console.log('Google Maps already loaded')
      setLoaded(true)
      return
    }

    // If currently loading, wait for it
    if (isLoading) {
      console.log('Google Maps is currently loading, waiting...')
      const checkLoaded = setInterval(() => {
        if (isLoaded && isMounted) {
          console.log('Google Maps finished loading')
          setLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      return () => {
        isMounted = false
        clearInterval(checkLoaded)
      }
    }

    // Start loading
    isLoading = true
    console.log('Starting to load Google Maps API...')

    const loadGoogleMaps = () => {
      if (!apiKey) {
        console.error('Google Maps API key not configured')
        setError('Google Maps API key not configured')
        isLoading = false
        return
      }

      console.log('API key present, checking for existing script...')

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        console.log('Google Maps script already exists in DOM')
        isLoaded = true
        setLoaded(true)
        isLoading = false
        return
      }

      console.log('Creating Google Maps script element...')

      // Create script element
      const script = document.createElement('script')
      // Using dynamic library import (importLibrary) instead of libraries parameter
      // This is the recommended approach for loading Google Maps JavaScript API
      // See: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initGoogleMaps`
      script.async = true
      script.defer = true

      console.log('Script URL:', script.src)

      // Set up callback
      ;(window as any).initGoogleMaps = () => {
        console.log('Google Maps API loaded successfully!')
        isLoaded = true
        if (isMounted) {
          setLoaded(true)
        }
        isLoading = false
      }

      script.onerror = e => {
        console.error('Failed to load Google Maps API script:', e)
        const errorMsg =
          'Failed to load Google Maps API. Please check your API key and network connection.'
        if (isMounted) {
          setError(errorMsg)
        }
        isLoading = false
      }

      document.head.appendChild(script)
      console.log('Google Maps script added to document head')
    }

    loadGoogleMaps()

    return () => {
      isMounted = false
    }
  }, [apiKey])

  if (error) {
    return (
      <div className="flex min-h-48 items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center p-6">
          <p className="text-sm text-red-500 font-medium">{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Please check your Google Maps API configuration in the console
          </p>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex w-full h-full min-h-48 items-center justify-center bg-gray-50 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <div className="text-sm text-gray-500">Loading Google Maps...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
