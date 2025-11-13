'use client'

import { Button, Card, CardBody, CardHeader, Input, Listbox, ListboxItem } from '@heroui/react'
import { Filter } from 'lucide-react'

const THREADS = [
  { id: '1', subject: 'Welcome packet review', provider: 'Branksome Hall Asia', unread: true },
  { id: '2', subject: 'Insurance documents submitted', provider: 'Camp Northstar Maine', unread: false },
  { id: '3', subject: 'Question about commission tier', provider: 'AIS-Salzburg', unread: false },
]

export default function ProviderMyInboxPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Provider Messages</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Inbox</h1>
            <p className="text-slate-500">Messages assigned to you for follow-up.</p>
          </div>
          <Button radius="full" variant="flat" startContent={<Filter size={16} />}>Advanced filters</Button>
        </div>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="gap-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <Input placeholder="Search conversations" radius="full" className="max-w-lg" />
          <div className="flex gap-3">
            <Button variant="flat" radius="full">Assign</Button>
            <Button color="primary" radius="full">New message</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Listbox aria-label="Inbox threads" className="rounded-2xl overflow-hidden">
            {THREADS.map(thread => (
              <ListboxItem
                key={thread.id}
                className="px-6 py-4 border-b border-slate-100 dark:border-slate-800"
                endContent={
                  thread.unread ? <span className="text-xs font-semibold text-primary">Unread</span> : null
                }
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900 dark:text-white">{thread.subject}</span>
                  <span className="text-sm text-slate-500">{thread.provider}</span>
                </div>
              </ListboxItem>
            ))}
          </Listbox>
        </CardBody>
      </Card>
    </section>
  )
}
