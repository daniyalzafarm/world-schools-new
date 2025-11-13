'use client'

import { Button, Card, CardBody, CardHeader, Chip, Divider } from '@heroui/react'
import { Lock } from 'lucide-react'

const ROLES = [
  { name: 'Superadmin', description: 'Full access to platform configuration and billing' },
  { name: 'Operations Lead', description: 'Manage providers, review requests, assign tasks' },
  { name: 'Finance Reviewer', description: 'View reports, approve payouts, manage invoices' },
]

export default function RolesPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Administration</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Roles & Permissions</h1>
        <p className="text-slate-500">Define the guardrails that keep your Superadmin console secure.</p>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Role templates</h2>
            <p className="text-sm text-slate-500">Start with recommended presets and customize granular permissions.</p>
          </div>
          <Button radius="full" color="primary" startContent={<Lock size={16} />}>Create role</Button>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          {ROLES.map(template => (
            <div key={template.name} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{template.name}</p>
                  <p className="text-sm text-slate-500">{template.description}</p>
                </div>
                <Chip variant="flat" color="success">Recommended</Chip>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </section>
  )
}
