/**
 * Azure Storage Service Types
 */

export interface AzureStorageConfig {
  /**
   * Azure Storage account name
   */
  accountName: string

  /**
   * Azure Storage account key
   */
  accountKey: string

  /**
   * Container name for storing files
   */
  containerName: string

  /**
   * SAS token expiry duration in hours (default: 24 hours)
   */
  sasTokenExpiryHours?: number
}

export interface UploadFileOptions {
  /**
   * File buffer to upload
   */
  buffer: Buffer

  /**
   * Original filename
   */
  fileName: string

  /**
   * MIME type of the file
   */
  mimeType: string

  /**
   * File size in bytes
   */
  fileSizeBytes: number

  /**
   * Optional folder path within the container
   */
  folderPath?: string

  /**
   * Optional document type for naming convention (e.g., 'business_registration')
   * When provided, the file will be named as: {documentType}_{timestamp}.{extension}
   */
  documentType?: string

  /**
   * Optional metadata to attach to the blob
   */
  metadata?: Record<string, string>
}

export interface UploadFileResult {
  /**
   * Unique blob name (includes folder path if provided)
   */
  blobName: string

  /**
   * Full URL to the blob
   */
  url: string

  /**
   * File size in bytes
   */
  fileSizeBytes: number

  /**
   * MIME type
   */
  mimeType: string
}

export interface FileValidationOptions {
  /**
   * Maximum file size in bytes
   */
  maxSizeBytes?: number

  /**
   * Allowed MIME types
   */
  allowedMimeTypes?: string[]
}

export interface FileValidationResult {
  /**
   * Whether the file is valid
   */
  isValid: boolean

  /**
   * Error message if validation failed
   */
  error?: string
}

