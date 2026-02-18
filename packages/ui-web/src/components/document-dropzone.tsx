'use client'

import React, { useRef, useState } from 'react'
import { Spinner } from '@heroui/react'

interface DocumentDropzoneProps {
  /**
   * Callback function when a file is selected (single file mode)
   */
  onFileSelect?: (file: File) => void
  /**
   * Callback function when files are selected (multiple files mode)
   */
  onFilesSelect?: (files: File[]) => void
  /**
   * Accepted file types (e.g., '.pdf,.jpg,.jpeg,.png')
   * @default '.pdf,.jpg,.jpeg,.png'
   */
  accept?: string
  /**
   * Whether to allow multiple file selection
   * @default false
   */
  multiple?: boolean
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
  /**
   * Custom className for the dropzone container
   */
  className?: string
  /**
   * Custom style object for the dropzone container
   */
  style?: React.CSSProperties
  /**
   * Variant for the dropzone layout
   * - 'default': Full-size dropzone with large padding and text
   * - 'compact': Smaller dropzone suitable for grid layouts
   * @default 'default'
   */
  variant?: 'default' | 'compact'
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
 * - Single or multiple file selection
 *
 * @example
 * Single file mode:
 * ```tsx
 * <DocumentDropzone
 *   onFileSelect={(file) => handleUpload(file)}
 *   isUploading={uploading}
 *   icon="📄"
 *   title="Drag document here or click to browse"
 *   description="PDF or images only, max 10MB"
 * />
 * ```
 *
 * Multiple files mode:
 * ```tsx
 * <DocumentDropzone
 *   onFilesSelect={(files) => handleUpload(files)}
 *   multiple
 *   isUploading={uploading}
 *   icon="📸"
 *   title="Drag photos here or click to browse"
 *   description="JPG, PNG or WebP • Max 5MB each"
 * />
 * ```
 */
export const DocumentDropzone: React.FC<DocumentDropzoneProps> = ({
  onFileSelect,
  onFilesSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  multiple = false,
  isUploading = false,
  isDisabled = false,
  maxSize = 10,
  icon = '📄',
  title = 'Drag document here or click to browse',
  description = 'PDF or images only, max 10MB',
  className,
  style,
  variant = 'default',
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
      if (multiple && onFilesSelect) {
        // Multiple files mode
        const fileArray = Array.from(files)
        onFilesSelect(fileArray)
      } else if (onFileSelect) {
        // Single file mode
        const file = files[0]
        onFileSelect(file)
      }
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
      if (multiple && onFilesSelect) {
        // Multiple files mode
        const fileArray = Array.from(files)
        onFilesSelect(fileArray)
      } else if (onFileSelect) {
        // Single file mode
        onFileSelect(files[0])
      }
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }

  // Determine layout classes based on variant
  const isCompact = variant === 'compact'
  const baseClasses = `
    cursor-pointer rounded-lg border-2 border-dashed text-center transition-all
    ${
      isDragOver
        ? 'border-primary bg-primary/10'
        : 'border-default-200 bg-default-100 hover:border-primary hover:bg-primary/5'
    }
    ${isDisabled || isUploading ? 'cursor-not-allowed opacity-50' : ''}
  `
  const layoutClasses = isCompact ? 'flex items-center justify-center' : 'rounded-xl px-6 py-12'

  return (
    <>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${baseClasses} ${layoutClasses} ${className || ''}`}
        style={style}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size={isCompact ? 'sm' : 'lg'} color="primary" />
            {!isCompact && <div className="text-sm font-medium text-foreground">Uploading...</div>}
          </div>
        ) : (
          <>
            {isCompact ? (
              <div className="text-center">
                <div className={`mb-1 opacity-30 ${title ? 'text-3xl' : 'text-4xl'}`}>{icon}</div>
                {title && <div className="text-xs text-default-500">{title}</div>}
              </div>
            ) : (
              <>
                <div className="mb-3 text-5xl">{icon}</div>
                <div className="mb-1.5 text-base font-semibold text-foreground">{title}</div>
                {description && <div className="text-xs text-default-500">{description}</div>}
              </>
            )}
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled || isUploading}
      />
    </>
  )
}
