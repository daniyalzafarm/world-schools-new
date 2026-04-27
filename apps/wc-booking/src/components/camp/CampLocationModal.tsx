'use client'

import { Modal, ModalContent } from '@heroui/react'
import { X } from 'lucide-react'

import config from '@/config/config'

import { GoogleMapsLoader } from '../map/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../map/GoogleMapWithSearch'

interface CampLocationModalProps {
  isOpen: boolean
  onClose: () => void
  locationName: string
  locationAddress?: string
  lat?: number | null
  lng?: number | null
  placeId?: string | null
}

export function CampLocationModal({
  isOpen,
  onClose,
  locationName,
  locationAddress,
  lat,
  lng,
  placeId,
}: CampLocationModalProps) {
  const hasCoords =
    lat != null &&
    lng != null &&
    (lat !== 0 || lng !== 0) &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton
      size="5xl"
      classNames={{
        base: 'max-w-full! mx-0 my-0 sm:mx-40 sm:my-4 rounded-none sm:rounded-2xl overflow-hidden bg-white h-[100dvh] sm:h-[85vh] max-h-[100dvh] sm:max-h-[85vh]',
        backdrop: 'bg-black/50',
      }}
    >
      <ModalContent>
        <div className="flex h-full w-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 shrink-0">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-gray-900">{locationName}</p>
              {locationAddress && (
                <p className="mt-0.5 truncate text-xs text-gray-500">{locationAddress}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            {hasCoords || placeId ? (
              <GoogleMapsLoader apiKey={config.maps.googleApiKey}>
                <div className="h-full w-full">
                  <GoogleMapWithSearch
                    selectedPlace={{
                      lat: lat ?? 0,
                      lng: lng ?? 0,
                      name: locationName,
                      placeId: placeId ?? null,
                    }}
                  />
                </div>
              </GoogleMapsLoader>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                Location coordinates not available.
              </div>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}
