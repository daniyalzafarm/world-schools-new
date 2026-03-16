import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  ContainerClient,
} from '@azure/storage-blob'
import {
  AzureStorageConfig,
  UploadFileOptions,
  UploadFileResult,
  FileValidationOptions,
  FileValidationResult,
} from './azure-storage.types'

@Injectable()
export class AzureStorageService {
  private readonly logger = new Logger(AzureStorageService.name)
  private readonly blobServiceClient: BlobServiceClient
  private readonly containerClient: ContainerClient
  private readonly sharedKeyCredential: StorageSharedKeyCredential
  private readonly sasTokenExpiryHours: number

  constructor(private readonly config: AzureStorageConfig) {
    // Validate configuration
    if (!config.accountName || !config.accountKey || !config.containerName) {
      throw new Error(
        'Azure Storage configuration is incomplete. Please provide accountName, accountKey, and containerName.'
      )
    }

    this.sasTokenExpiryHours = config.sasTokenExpiryHours || 24

    // Create shared key credential
    this.sharedKeyCredential = new StorageSharedKeyCredential(config.accountName, config.accountKey)

    // Create blob service client
    this.blobServiceClient = new BlobServiceClient(config.accountUrl, this.sharedKeyCredential)

    // Get container client
    this.containerClient = this.blobServiceClient.getContainerClient(config.containerName)

    this.logger.log(`Azure Storage Service initialized for container: ${config.containerName}`)
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: { size: number; mimetype: string },
    options?: FileValidationOptions
  ): FileValidationResult {
    const maxSize = options?.maxSizeBytes || 10 * 1024 * 1024 // Default 10MB
    const allowedMimeTypes = options?.allowedMimeTypes || [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]

    // Validate file size
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
      }
    }

    // Validate MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      }
    }

    return { isValid: true }
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    try {
      // Generate blob name with proper naming convention
      const blobName = this.generateBlobName(options)

      // Get block blob client
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

      // Upload file
      await blockBlobClient.upload(options.buffer, options.buffer.length, {
        blobHTTPHeaders: {
          blobContentType: options.mimeType,
        },
        metadata: options.metadata,
      })

      this.logger.log(`Uploaded file to Azure Blob Storage: ${blobName}`)

      return {
        blobName,
        url: blockBlobClient.url,
        fileSizeBytes: options.fileSizeBytes,
        mimeType: options.mimeType,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to upload file to Azure Blob Storage: ${errorMessage}`)
      throw new BadRequestException('Failed to upload file')
    }
  }

  /**
   * Generate a SAS URL for secure file access
   */
  async generateSasUrl(blobName: string, expiryHours?: number): Promise<string> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

      // Set expiry time
      const expiresOn = new Date()
      expiresOn.setHours(expiresOn.getHours() + (expiryHours || this.sasTokenExpiryHours))

      // Generate SAS token
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.config.containerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'), // Read-only permission
          expiresOn,
        },
        this.sharedKeyCredential
      ).toString()

      return `${blockBlobClient.url}?${sasToken}`
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to generate SAS URL: ${errorMessage}`)
      throw new BadRequestException('Failed to generate file access URL')
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(blobName: string): Promise<void> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
      await blockBlobClient.delete()
      this.logger.log(`Deleted file from Azure Blob Storage: ${blobName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to delete file from Azure Blob Storage: ${errorMessage}`)
      throw new BadRequestException('Failed to delete file')
    }
  }

  /**
   * Check if a file exists in Azure Blob Storage
   */
  async fileExists(blobName: string): Promise<boolean> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
      return await blockBlobClient.exists()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to check file existence: ${errorMessage}`)
      return false
    }
  }

  /**
   * Download a file from Azure Blob Storage
   */
  async downloadFile(blobName: string): Promise<Buffer> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
      const downloadResponse = await blockBlobClient.download()

      if (!downloadResponse.readableStreamBody) {
        throw new Error('No readable stream body')
      }

      const chunks: Buffer[] = []
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk))
      }

      return Buffer.concat(chunks)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to download file from Azure Blob Storage: ${errorMessage}`)
      throw new BadRequestException('Failed to download file')
    }
  }

  /**
   * Sanitize filename to remove special characters
   */
  private sanitizeFileName(fileName: string): string {
    // Remove path separators and special characters
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  /**
   * Generate blob name with proper folder structure and naming convention
   */
  private generateBlobName(options: UploadFileOptions): string {
    // Extract file extension
    const extension = this.getFileExtension(options.fileName)

    // Generate human-readable timestamp (YYYYMMDD-HHMMSS)
    const timestamp = this.generateTimestamp()

    // Build filename based on whether documentType is provided
    let fileName: string
    if (options.documentType) {
      // Format: {documentType}_{timestamp}.{extension}
      fileName = `${options.documentType}_${timestamp}.${extension}`
    } else {
      // Fallback to sanitized original filename with timestamp
      const sanitizedFileName = this.sanitizeFileName(options.fileName)
      fileName = `${timestamp}_${sanitizedFileName}`
    }

    // Combine with folder path if provided
    return options.folderPath ? `${options.folderPath}/${fileName}` : fileName
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : 'bin'
  }

  /**
   * Generate human-readable timestamp in YYYYMMDD-HHMMSS format
   */
  private generateTimestamp(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}-${hours}${minutes}${seconds}`
  }
}
