import { storage } from '@/config/firebase'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage'

export interface UploadProgress {
  bytesTransferred: number
  totalBytes: number
  progress: number
}

export interface UploadResult {
  downloadURL: string
  fullPath: string
  name: string
}

/**
 * Upload a file to Firebase Storage
 */
export const uploadFile = async (
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const storageRef = ref(storage, path)

  if (onProgress) {
    // Use resumable upload for progress tracking
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file)

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress,
          })
        },
        error => {
          reject(error)
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            resolve({
              downloadURL,
              fullPath: uploadTask.snapshot.ref.fullPath,
              name: uploadTask.snapshot.ref.name,
            })
          } catch (error) {
            reject(error)
          }
        }
      )
    })
  } else {
    // Simple upload without progress tracking
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)

    return {
      downloadURL,
      fullPath: snapshot.ref.fullPath,
      name: snapshot.ref.name,
    }
  }
}

/**
 * Delete a file from Firebase Storage
 */
export const deleteFile = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

/**
 * Get download URL for a file
 */
export const getFileURL = async (path: string): Promise<string> => {
  const storageRef = ref(storage, path)
  return await getDownloadURL(storageRef)
}

/**
 * Generate a unique filename with timestamp
 */
export const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()
  const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '')

  return `${nameWithoutExtension}_${timestamp}_${randomString}.${extension}`
}
