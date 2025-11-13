'use client'

import { Avatar, AvatarGroup, Button, Card, CardBody, CardHeader, Chip, Divider, Input } from '@heroui/react'
import { AlignLeft, UserPlus } from 'lucide-react'

const TEAM_MEMBERS = [
  { name: 'Alex Ramirez' },
  { name: 'Priya Singh' },
  { name: 'Marta Kowalski' },
]

export default function UserTeamInboxPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">User Messages</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Inbox</h1>
            <p className="text-slate-500">Collaborate on user communication with shared visibility.</p>
          </div>
          <div className="flex gap-3">
            <Button radius="full" variant="flat" startContent={<UserPlus size={16} />}>Invite teammate</Button>
            <Button radius="full" color="primary" startContent={<AlignLeft size={16} />}>Playbooks</Button>
          </div>
        </div>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Input placeholder="Search shared threads" radius="full" className="max-w-lg" />
            <Chip color="primary" variant="flat">SLA met for 95% of threads</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Active collaborators:</span>
            <AvatarGroup isBordered max={5} size="sm">
              {TEAM_MEMBERS.map(member => (
                <Avatar key={member.name} name={member.name} className="bg-primary/10 text-primary" />
              ))}
            </AvatarGroup>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="text-sm text-slate-500 space-y-4">
          <p>
            Use the team inbox to coordinate responses, leave internal notes, and track service levels
            across user relationships. Attachments and labels sync in real time for every teammate.
          </p>
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-slate-400">
            Conversation timeline and notes placeholder
          </div>
        </CardBody>
      </Card>
    </section>
  )
}

