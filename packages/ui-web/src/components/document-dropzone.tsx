'use client'

import React, { useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

interface DocumentDropzoneProps {
  /**
   * Callback function when a file is selected
   */
  onFileSelect: (file: File) => void
  /**
   * Accepted file types (e.g., '.pdf,.jpg,.jpeg,.png')
   * @default '.pdf,.jpg,.jpeg,.png'
   */
  accept?: string
  /**
   * Whether the dropzone is in uploading state
   * @default false
   */
  isUploading?: boolean
  /**
   * Whether the dropzone is disabled
   * @default false
   */
  isDisabled?: boolean
  /**
   * Maximum file size in MB (for display purposes only - validation should be done separately)
   * @default 10
   */
  maxSize?: number
  /**
   * Icon to display in the dropzone (emoji or React component)
   * @default '📄'
   */
  icon?: React.ReactNode
  /**
   * Title text displayed in the dropzone
   * @default 'Drag document here or click to browse'
   */
  title?: string
  /**
   * Description text displayed below the title
   * @default 'PDF or images only, max 10MB'
   */
  description?: string
}

/**
 * DocumentDropzone component for drag-and-drop file uploads.
 *
 * Features:
 * - Drag-and-drop support with visual feedback
 * - Click-to-browse fallback
 * - Loading state with spinner
 * - Customizable icon, title, and description
 * - Disabled state support
 *
 * @example
 * ```tsx
 * <DocumentDropzone
 *   onFileSelect={(file) => handleUpload(file)}
 *   isUploading={uploading}
 *   icon="📄"
 *   title="Drag document here or click to browse"
 *   description="PDF or images only, max 10MB"
 * />
 * ```
 */
export const DocumentDropzone: React.FC<DocumentDropzoneProps> = ({
  onFileSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  isUploading = false,
  isDisabled = false,
  maxSize = 10,
  icon = '📄',
  title = 'Drag document here or click to browse',
  description = 'PDF or images only, max 10MB',
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDisabled && !isUploading) {
      setIsDragOver(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (isDisabled || isUploading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      onFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!isDisabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }

  return (
    <>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all
          ${
            isDragOver
              ? 'border-primary bg-primary/10'
              : 'border-default-200 bg-default-100 hover:border-primary hover:bg-primary/5'
          }
          ${isDisabled || isUploading ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" color="primary" />
            <div className="text-sm font-medium text-foreground">Uploading...</div>
          </div>
        ) : (
          <>
            <div className="mb-3 text-5xl">{icon}</div>
            <div className="mb-1.5 text-base font-semibold text-foreground">{title}</div>
            <div className="text-xs text-default-500">{description}</div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled || isUploading}
      />
    </>
  )
}

