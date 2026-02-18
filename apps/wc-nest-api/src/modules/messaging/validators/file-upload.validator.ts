import { BadRequestException } from '@nestjs/common'
import { sanitizeFileName } from '../utils/sanitization.util'

/**
 * File Upload Validator
 *
 * Validates file uploads for security and size constraints.
 */

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Allowed MIME types for file uploads
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/csv',

  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',

  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',

  // Video
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
]

/**
 * Dangerous file extensions that should be blocked
 */
export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.msi',
  '.app',
  '.deb',
  '.rpm',
  '.sh',
  '.bash',
  '.ps1',
]

/**
 * Validate file upload
 *
 * Checks file size, MIME type, and extension for security.
 *
 * @param file - Multer file object
 * @throws BadRequestException if validation fails
 */
export function validateFileUpload(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('No file provided')
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `File type ${file.mimetype} is not allowed. Allowed types: images, documents, archives, audio, video`
    )
  }

  // Validate file extension
  const fileName = file.originalname.toLowerCase()
  const hasBlockedExtension = BLOCKED_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (hasBlockedExtension) {
    throw new BadRequestException('File extension is not allowed for security reasons')
  }

  // Sanitize file name
  file.originalname = sanitizeFileName(file.originalname)
}

/**
 * Get file extension from MIME type
 *
 * @param mimeType - MIME type
 * @returns File extension with dot (e.g., '.jpg')
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
  }

  return mimeToExt[mimeType] || ''
}
