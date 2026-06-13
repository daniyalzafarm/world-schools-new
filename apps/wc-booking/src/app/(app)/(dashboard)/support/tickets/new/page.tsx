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
    requesterType: 'PARENT',
    sourceApp: 'WC_BOOKING',
    getRequesterUserId: () => user?.id,
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
      accentColorClass="bg-slate-800"
      helpSubtitle="Can't find what you're looking for? Send us a message and we'll help you out."
    />
  )
}
