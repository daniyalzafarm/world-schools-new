'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { SupportTicketsListContent, useSupportTicketsList } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'
import { globalWsService } from '@/lib/websocket-instance'

export default function SupportTicketsPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const { loading, error, activeTab, setActiveTab, tickets, fetchTickets } = useSupportTicketsList({
    listMyTickets: supportTicketsService.listMyTickets,
    wsService: globalWsService,
  })

  return (
    <SupportTicketsListContent
      tickets={tickets}
      loading={loading}
      error={error}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentUserId={user?.id ?? ''}
      accentColorClass="bg-secondary"
      containerClassName="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
      onNavigateToNew={() => router.push('/support/tickets/new')}
      onNavigateToTicket={id => router.push(`/support/tickets/${id}`)}
      onRetry={() => void fetchTickets()}
    />
  )
}
