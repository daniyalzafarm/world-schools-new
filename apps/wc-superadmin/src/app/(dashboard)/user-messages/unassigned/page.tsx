'use client'

import { Button, Card, CardBody, CardHeader, Chip, Input, Listbox, ListboxItem } from '@heroui/react'
import { Users } from 'lucide-react'

const REQUESTS = [
  { id: '1', subject: 'Unable to reset password', user: 'David Martinez', waitTime: '1h 32m' },
  { id: '2', subject: 'Booking confirmation not received', user: 'Lisa Anderson', waitTime: '3h 18m' },
  { id: '3', subject: 'Refund request inquiry', user: 'James Thompson', waitTime: '5h 27m' },
]

export default function UserUnassignedInboxPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">User Messages</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Unassigned</h1>
            <p className="text-slate-500">Messages waiting to be triaged and assigned to an owner.</p>
          </div>
          <Button radius="full" color="primary" startContent={<Users size={16} />}>Auto-assign</Button>
        </div>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Input placeholder="Filter by user or topic" radius="full" className="max-w-lg" />
          <Chip variant="flat" color="warning">Response time SLA: 4h</Chip>
        </CardHeader>
        <CardBody>
          <Listbox aria-label="Unassigned threads" className="rounded-2xl overflow-hidden">
            {REQUESTS.map(item => (
              <ListboxItem
                key={item.id}
                className="px-6 py-4 border-b border-slate-100 dark:border-slate-800"
                endContent={<span className="text-xs text-slate-400">Waiting {item.waitTime}</span>}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900 dark:text-white">{item.subject}</span>
                  <span className="text-sm text-slate-500">{item.user}</span>
                </div>
              </ListboxItem>
            ))}
          </Listbox>
        </CardBody>
      </Card>
    </section>
  )
}

