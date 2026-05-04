'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@heroui/react'
import { UserAvatar } from '@world-schools/ui-web'

interface ProviderLogoSectionProps {
  logoUrl?: string | null
  providerName?: string
  onLogoChange?: (file: File) => Promise<void>
  onLogoRemove?: () => Promise<void>
}

export const ProviderLogoSection: React.FC<ProviderLogoSectionProps> = ({
  logoUrl,
  providerName,
  onLogoChange,
  onLogoRemove,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await onLogoChange?.(file)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await onLogoRemove?.()
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-6 pb-8 border-b border-gray-200 dark:border-gray-700">
      <UserAvatar photoUrl={logoUrl} fullName={providerName} />

      <div className="flex-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Company logo
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Your logo will appear on your public camp listings.
        </p>
        <div className="flex gap-3">
          <Button
            color="secondary"
            onPress={handleUploadClick}
            isLoading={isUploading}
            isDisabled={isRemoving}
          >
            {isUploading ? 'Uploading...' : 'Upload logo'}
          </Button>
          {logoUrl && (
            <Button
              variant="bordered"
              onPress={handleRemove}
              isLoading={isRemoving}
              isDisabled={isUploading}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
