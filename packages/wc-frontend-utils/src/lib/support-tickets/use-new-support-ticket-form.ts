import { useState } from 'react'
import type { ApiResult } from '@world-schools/wc-utils'
import type {
  CreateSupportTicketPayload,
  SupportTicket,
  SupportTicketRequesterType,
  SupportTicketSourceApp,
} from '@world-schools/wc-types'

interface UploadResult {
  id: string
}

export interface UseNewSupportTicketFormOptions {
  requesterType: SupportTicketRequesterType
  sourceApp: SupportTicketSourceApp
  /** Returns the logged-in user's ID (undefined if not authenticated). */
  getRequesterUserId: () => string | undefined
  /** Returns the provider ID for provider-facing apps. */
  getRequesterProviderId?: () => string | undefined
  createTicket: (payload: CreateSupportTicketPayload) => Promise<ApiResult<SupportTicket>>
  uploadAttachment: (file: File) => Promise<ApiResult<UploadResult>>
}

export interface UseNewSupportTicketFormResult {
  /** The raw category key sent to the API (e.g. 'booking_issue'). */
  categoryKey: string
  setCategoryKey: (key: string) => void
  subject: string
  setSubject: (v: string) => void
  description: string
  setDescription: (v: string) => void
  attachments: File[]
  setAttachments: (files: File[]) => void
  submitting: boolean
  error: string | null
  successTicketNumber: string | null
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

/**
 * Shared form logic for creating a new support ticket.
 *
 * The only per-app difference is:
 * - wc-booking: requesterType=PARENT, sourceApp=WC_BOOKING, no providerId
 * - wc-provider: requesterType=PROVIDER, sourceApp=WC_PROVIDER, providerId from user
 *
 * Both apps pass those as config via `options`.
 */
export function useNewSupportTicketForm({
  requesterType,
  sourceApp,
  getRequesterUserId,
  getRequesterProviderId,
  createTicket,
  uploadAttachment,
}: UseNewSupportTicketFormOptions): UseNewSupportTicketFormResult {
  const [categoryKey, setCategoryKey] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successTicketNumber, setSuccessTicketNumber] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userId = getRequesterUserId()
    if (!userId) {
      setError('You must be signed in to submit a ticket.')
      return
    }
    if (!categoryKey || !subject.trim() || !description.trim()) {
      setError('Please fill in topic, subject, and message.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      let attachmentIds: string[] | undefined

      if (attachments.length > 0) {
        const uploadResults = await Promise.all(attachments.map(file => uploadAttachment(file)))
        const failed = uploadResults.find(r => !r.success)
        if (failed) {
          const msg =
            failed.data && typeof failed.data === 'object' && 'message' in failed.data
              ? (failed.data as { message: string }).message
              : 'Failed to upload attachments.'
          setError(msg)
          setSubmitting(false)
          return
        }
        attachmentIds = uploadResults
          .map(r => (r.success ? r.data.id : null))
          .filter((id): id is string => id != null)
      }

      const result = await createTicket({
        requesterType,
        requesterUserId: userId,
        requesterProviderId: getRequesterProviderId?.(),
        sourceApp,
        categoryKey,
        subject: subject.trim(),
        description: description.trim(),
        attachmentIds,
      })

      if (!result.success) {
        const msg =
          'data' in result &&
          result.data &&
          typeof result.data === 'object' &&
          'message' in result.data
            ? (result.data as { message: string }).message
            : 'Failed to create ticket'
        setError(msg)
        setSubmitting(false)
        return
      }
      setSuccessTicketNumber(result.data.ticketNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    categoryKey,
    setCategoryKey,
    subject,
    setSubject,
    description,
    setDescription,
    attachments,
    setAttachments,
    submitting,
    error,
    successTicketNumber,
    handleSubmit,
  }
}
