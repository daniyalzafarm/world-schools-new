'use client'

import React, { useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { SupportTicketDetailContent } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'
import { useSupportTicketConversation } from '@/hooks/useSupportTicketConversation'
import type { SupportTicket } from '@/types/support-tickets'

export default function ProviderSupportTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const id = params?.id as string | undefined

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [isLoadingTicket, setIsLoadingTicket] = useState(true)
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setError(null)
    setIsLoadingTicket(true)
    supportTicketsService
      .getTicketById(id)
      .then(result => {
        if (result.success) setTicket(result.data)
        else setError('Failed to load ticket.')
      })
      .catch(() => setError('Failed to load ticket.'))
      .finally(() => setIsLoadingTicket(false))
  }, [id])

  const {
    messages,
    isLoading: isLoadingConversation,
    sendReply,
  } = useSupportTicketConversation(
    id ? { ticketId: id, conversationId: ticket?.conversationId } : { ticketId: '' }
  )

  const handleSendReply = async ({
    content,
    attachments,
  }: {
    content: string
    attachments: File[]
  }) => {
    const trimmed = content.trim()
    if (!id || !user?.id || sendingReply) return
    if (!trimmed && attachments.length === 0) return
    setSendingReply(true)
    try {
      let attachmentIds: string[] | undefined
      if (attachments.length > 0) {
        const results = await Promise.all(
          attachments.map(f => messagingAttachmentsService.uploadAttachment(f))
        )
        const failed = results.find(r => !r.success)
        if (failed) {
          console.error('Attachment upload failed', failed)
          return
        }
        attachmentIds = results
          .map(r => (r.success ? r.data.id : null))
          .filter((x): x is string => x != null)
      }
      await sendReply(trimmed, attachmentIds)
    } finally {
      setSendingReply(false)
    }
  }

  const handleMarkResolved = useCallback(async () => {
    if (!id || !ticket || updatingStatus) return
    setUpdatingStatus(true)
    setError(null)
    try {
      const res = await supportTicketsService.updateStatus(id, { status: 'RESOLVED' })
      if (!res.success) {
        setError('Failed to update ticket status.')
        return
      }
      setTicket(res.data)
    } catch {
      setError('Failed to update ticket status.')
    } finally {
      setUpdatingStatus(false)
    }
  }, [id, ticket, updatingStatus])

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Invalid ticket ID.</p>
        <Button
          as={Link}
          href="/support/tickets"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
        >
          Back to my tickets
        </Button>
      </div>
    )
  }

  if (error && !isLoadingTicket && !ticket) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button
          as={Link}
          href="/support/tickets"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
        >
          Back to my tickets
        </Button>
      </div>
    )
  }

  return (
    <SupportTicketDetailContent
      ticket={ticket}
      isLoadingTicket={isLoadingTicket}
      messages={messages}
      isLoadingConversation={isLoadingConversation}
      error={error}
      sendingReply={sendingReply}
      updatingStatus={updatingStatus}
      currentUserId={user?.id ?? ''}
      onSendReply={handleSendReply}
      onMarkResolved={() => void handleMarkResolved()}
      onBack={() => router.push('/support/tickets')}
    />
  )
}
