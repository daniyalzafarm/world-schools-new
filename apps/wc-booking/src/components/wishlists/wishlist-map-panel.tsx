'use client'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

import { useEffect, useRef } from 'react'
import { GoogleMapsLoader } from '@/components/map/GoogleMapsLoader'
import config from '@/config/config'
import type { WishlistItem } from '@/types/wishlists'
import { formatCurrency } from '@/utils/currency'
import { MapPin } from 'lucide-react'

interface WishlistMapPanelProps {
  items: WishlistItem[]
  onPinClick?: (campId: string) => void
}

function getCampPriceLabel(item: WishlistItem): string {
  const currency = item.camp?.provider?.settings?.currency ?? 'CHF'
  const sessionsToCheck = item.selectedSession
    ? [item.selectedSession]
    : (item.camp?.sessions ?? [])

  let minPrice: number | undefined
  for (const session of sessionsToCheck) {
    let price: number | undefined
    if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
      price = Math.min(...session.ageGroupPrices.map(agp => Number(agp.price)))
    } else if (session.price != null) {
      price = Number(session.price)
    }
    if (price != null && !Number.isNaN(price) && (minPrice === undefined || price < minPrice)) {
      minPrice = price
    }
  }

  if (minPrice === undefined) return item.camp?.name ?? 'Camp'
  return formatCurrency(minPrice, currency)
}

function createPinElement(label: string, stacked = false): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText =
    'display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform 0.2s;'

  const pill = document.createElement('div')
  pill.textContent = label
  pill.style.cssText = `background:white;padding:5px 10px;border:1.5px solid #d1d5e1;border-radius:20px;font-size:12px;font-weight:700;color:#111827;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;font-family:system-ui,-apple-system,sans-serif;line-height:1.4;${stacked ? 'border:1.5px solid #1E2A4A;' : ''}`

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
    wrapper.style.zIndex = '10'
  })
  wrapper.addEventListener('mouseleave', () => {
    pill.style.background = 'white'
    pill.style.color = '#111827'
    pill.style.border = '1.5px solid #d1d5e1'
    dot.style.background = '#1E2A4A'
    wrapper.style.transform = 'scale(1)'
    wrapper.style.zIndex = '1'
  })

  return wrapper
}

function WishlistMapContent({ items, onPinClick }: WishlistMapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  const itemsKey = items.map(i => i.id).join(',')

  useEffect(() => {
    if (!mapRef.current || typeof google === 'undefined') return

    const campLocations = items
      .filter(item => {
        const lat = Number(item.camp?.locationLat)
        const lng = Number(item.camp?.locationLng)
        return (
          item.camp?.locationLat != null &&
          item.camp?.locationLng != null &&
          !Number.isNaN(lat) &&
          !Number.isNaN(lng)
        )
      })
      .map(item => ({
        id: item.id,
        campId: item.campId,
        lat: Number(item.camp!.locationLat),
        lng: Number(item.camp!.locationLng),
        label: getCampPriceLabel(item),
        title: item.camp!.name,
      }))

    let cancelled = false
    const markers: google.maps.marker.AdvancedMarkerElement[] = []

    const init = async () => {
      const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        'marker'
      )) as google.maps.MarkerLibrary

      if (cancelled || !mapRef.current) return

      const mapInstance = new Map(mapRef.current, {
        zoom: 6,
        center: { lat: 46, lng: 8 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID',
      })

      if (campLocations.length === 0 || cancelled) return

      const bounds = new google.maps.LatLngBounds()

      for (const loc of campLocations) {
        const pinEl = createPinElement(loc.label)

        const marker = new AdvancedMarkerElement({
          position: { lat: loc.lat, lng: loc.lng },
          map: mapInstance,
          content: pinEl,
          title: loc.title,
        })

        pinEl.addEventListener('mouseenter', () => {
          marker.zIndex = 999
        })
        pinEl.addEventListener('mouseleave', () => {
          marker.zIndex = 0
        })

        marker.addListener('gmp-click', () => {
          onPinClick?.(loc.campId)
          const cardEl = document.getElementById(`wishlist-camp-${loc.campId}`)
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            cardEl.style.boxShadow = '0 0 0 3px #45F0B5'
            setTimeout(() => {
              cardEl.style.boxShadow = ''
            }, 2000)
          }
        })

        markers.push(marker)
        bounds.extend({ lat: loc.lat, lng: loc.lng })
      }

      const uniqueCoords = new Set(campLocations.map(l => `${l.lat},${l.lng}`))
      if (uniqueCoords.size === 1) {
        mapInstance.setCenter({ lat: campLocations[0].lat, lng: campLocations[0].lng })
        mapInstance.setZoom(13)
      } else {
        mapInstance.fitBounds(bounds, 60)
        google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
          if ((mapInstance.getZoom() ?? 0) > 14) mapInstance.setZoom(14)
        })
      }
    }

    void init()

    return () => {
      cancelled = true
      markers.forEach(m => {
        m.map = null
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey])

  return <div ref={mapRef} className="h-full w-full" />
}

export function WishlistMapPanel({ items, onPinClick }: WishlistMapPanelProps) {
  const hasAnyCoords = items.some(item => {
    const lat = Number(item.camp?.locationLat)
    const lng = Number(item.camp?.locationLng)
    return (
      item.camp?.locationLat != null &&
      item.camp?.locationLng != null &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng)
    )
  })

  if (!hasAnyCoords) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#F8FAFC] text-gray-400">
        <MapPin className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">No locations available</p>
        <p className="text-xs text-center px-4 text-gray-400">
          Camp locations will appear here once added
        </p>
      </div>
    )
  }

  return (
    <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
      <WishlistMapContent items={items} onPinClick={onPinClick} />
    </GoogleMapsLoader>
  )
}
