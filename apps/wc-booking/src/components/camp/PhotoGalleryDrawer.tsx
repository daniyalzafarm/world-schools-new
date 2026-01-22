'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  useDisclosure,
} from '@heroui/react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

interface Photo {
  id: string
  url: string
  thumbnail: string
  order: number
  isPrimary: boolean
}

interface PhotoGalleryDrawerProps {
  photos: Photo[]
  campName: string
  trigger?: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  initialLightboxIndex?: number
}

export function PhotoGalleryDrawer({
  photos,
  campName,
  trigger,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  initialLightboxIndex = -1,
}: PhotoGalleryDrawerProps) {
  const internalDisclosure = useDisclosure()
  const [lightboxIndex, setLightboxIndex] = useState(initialLightboxIndex)

  // Use controlled or uncontrolled state
  const isOpen = controlledIsOpen ?? internalDisclosure.isOpen
  const onOpen = controlledOnOpenChange
    ? () => controlledOnOpenChange(true)
    : internalDisclosure.onOpen
  const onOpenChange = controlledOnOpenChange ?? internalDisclosure.onOpenChange

  // Update lightbox index when initialLightboxIndex changes
  useEffect(() => {
    if (isOpen && initialLightboxIndex >= 0) {
      setLightboxIndex(initialLightboxIndex)
    }
  }, [isOpen, initialLightboxIndex])

  // Sort photos by order
  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order)

  // Prepare slides for lightbox
  const lightboxSlides = sortedPhotos.map(photo => ({
    src: photo.url,
    alt: `${campName} photo`,
  }))

  const handlePhotoClick = (index: number) => {
    setLightboxIndex(index)
  }

  return (
    <>
      {/* Trigger Button */}
      {trigger ? (
        <div onClick={onOpen}>{trigger}</div>
      ) : (
        <Button className="bg-white text-gray-900" onPress={onOpen} startContent={<span>🖼️</span>}>
          Show all photos
        </Button>
      )}

      {/* Drawer */}
      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="full"
        placement="bottom"
        hideCloseButton
        classNames={{
          base: 'max-w-full',
          body: 'p-0',
        }}
      >
        <DrawerContent>
          {onClose => (
            <>
              <DrawerHeader className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={onClose}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {campName} - {sortedPhotos.length} Photos
                  </h2>
                </div>
              </DrawerHeader>

              <DrawerBody>
                <div className="container mx-auto px-6 py-8">
                  {/* Photo Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {sortedPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg"
                        onClick={() => handlePhotoClick(index)}
                      >
                        <img
                          src={photo.thumbnail || photo.url}
                          alt={`${campName} photo ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
                        {photo.isPrimary && (
                          <div className="absolute top-2 left-2 bg-black/75 text-white px-2 py-1 rounded text-xs font-medium">
                            Primary
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      </div>
                    ))}
                  </div>
                </div>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Lightbox */}
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={lightboxSlides}
        carousel={{ finite: false }}
        render={{
          buttonPrev: lightboxSlides.length <= 1 ? () => null : undefined,
          buttonNext: lightboxSlides.length <= 1 ? () => null : undefined,
        }}
      />
    </>
  )
}
