'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  NewSupportTicketFormContent,
  useNewSupportTicketForm,
  useSupportTicketCategories,
} from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'

export default function SupportNewTicketPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const { categories, loading: categoriesLoading } = useSupportTicketCategories(
    supportTicketsService.listCategories.bind(supportTicketsService)
  )

  const form = useNewSupportTicketForm({
    requesterType: 'PROVIDER',
    sourceApp: 'WC_PROVIDER',
    getRequesterUserId: () => user?.id,
    getRequesterProviderId: () =>
      (user as unknown as { providerId?: string | null } | null)?.providerId ?? undefined,
    createTicket: supportTicketsService.createTicket.bind(supportTicketsService),
    uploadAttachment: file => messagingAttachmentsService.uploadAttachment(file),
  })

  return (
    <NewSupportTicketFormContent
      categoryKey={form.categoryKey}
      onCategoryChange={form.setCategoryKey}
      subject={form.subject}
      onSubjectChange={form.setSubject}
      description={form.description}
      onDescriptionChange={form.setDescription}
      attachments={form.attachments}
      onAttachmentsChange={form.setAttachments}
      submitting={form.submitting}
      error={form.error}
      successTicketNumber={form.successTicketNumber}
      onSubmit={form.handleSubmit}
      onCancel={() => router.push('/support/tickets')}
      categories={categories}
      categoriesLoading={categoriesLoading}
      accentColorClass="bg-secondary"
      helpSubtitle="Tell us what you need help with and we'll get back to you."
    />
  )
}
