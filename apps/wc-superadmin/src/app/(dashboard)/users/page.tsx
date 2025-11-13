'use client'

import { Button, Card, CardBody, CardHeader, Chip, Input } from '@heroui/react'
import { Shield } from 'lucide-react'

export default function UsersPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Administration</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users</h1>
        <p className="text-slate-500">Manage internal access to the Superadmin console.</p>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Input placeholder="Search team members" radius="full" className="max-w-xl" />
          <div className="flex gap-3">
            <Button radius="full" variant="flat">Invite user</Button>
            <Button radius="full" color="primary" startContent={<Shield size={16} />}>Bulk permissions</Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-slate-500">
          <Chip variant="flat" color="primary" className="w-fit">Role mapping powered by RoleMatrix</Chip>
          <p>
            This area will list every teammate with their access level, MFA status, and login history. Add audit
            rules to track risky changes and require approvals for critical operations such as payouts.
          </p>
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-slate-400">
            User directory placeholder
          </div>
        </CardBody>
      </Card>
    </section>
  )
}
