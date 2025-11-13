'use client'

import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { MessageSquare } from 'lucide-react'

export default function UserMessagesPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Engagement</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Messages</h1>
        <p className="text-slate-500">Monitor inbound questions from guardians and students.</p>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex items-center gap-3">
          <MessageSquare size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live conversation overview</h2>
            <p className="text-sm text-slate-500">Realtime data coming from the messaging service.</p>
          </div>
          <Chip color="warning" variant="flat" className="ml-auto">
            Integration pending
          </Chip>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-slate-500">
          <p>
            This view will highlight user conversations that need a response, average response times, and
            satisfaction scores. Use it to triage and allocate community managers.
          </p>
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-slate-400">
            Messaging chart placeholder
          </div>
        </CardBody>
      </Card>
    </section>
  )
}
