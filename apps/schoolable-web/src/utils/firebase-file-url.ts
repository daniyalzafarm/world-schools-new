import { storage } from '@/config/firebase'
import { getDownloadURL, ref } from 'firebase/storage'

/**
 * Get Firebase download URL for a file path
 */
export const getFirebaseFileURL = async (filePath: string): Promise<string> => {
  try {
    const fileRef = ref(storage, filePath)
    const downloadURL = await getDownloadURL(fileRef)
    return downloadURL
  } catch (error) {
    console.error('Error getting Firebase file URL:', error)
    throw error
  }
}

/**
 * Check if a URL is a Firebase storage URL
 */
export const isFirebaseURL = (url: string): boolean => {
  return url.includes('firebasestorage.googleapis.com') || url.includes('firebase')
}

/**
 * Extract file path from Firebase download URL
 */
export const extractFilePathFromURL = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/)
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1])
    }
    return null
  } catch (error) {
    console.error('Error extracting file path from URL:', error)
    return null
  }
}

/**
 * Build Firebase storage path
 */
export const buildStoragePath = (folder: string, orgId: string, fileName: string): string => {
  return `${folder}/${orgId}/${fileName}`
}

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * Check if file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
  const extension = getFileExtension(filename)
  return imageExtensions.includes(extension)
}

/**
 * Check if file is a PDF
 */
export const isPDFFile = (filename: string): boolean => {
  return getFileExtension(filename) === 'pdf'
}

/**
 * Get file type category
 */
export const getFileTypeCategory = (filename: string): 'image' | 'pdf' | 'document' | 'other' => {
  const extension = getFileExtension(filename)

  if (isImageFile(filename)) return 'image'
  if (isPDFFile(filename)) return 'pdf'

  const documentExtensions = ['doc', 'docx', 'txt', 'rtf', 'odt']
  if (documentExtensions.includes(extension)) return 'document'

  return 'other'
}
