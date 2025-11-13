'use client'

import { Button, Card, CardBody, CardHeader, Chip, Switch } from '@heroui/react'
import { BellRing } from 'lucide-react'

const CHANNELS = [
  { name: 'Provider approvals', description: 'Alerts when a provider requires manual approval', enabled: true },
  { name: 'Financial releases', description: 'Notifications before large payouts are released', enabled: true },
  { name: 'Security events', description: 'Login from new devices or permission escalations', enabled: false },
]

export default function NotificationsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Controls</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Notifications</h1>
        <p className="text-slate-500">Fine-tune alerts to stay informed without noise.</p>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <BellRing size={20} className="text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Alert channels</h2>
              <p className="text-sm text-slate-500">Choose the updates the Superadmin team receives.</p>
            </div>
          </div>
          <Button radius="full" variant="flat">Pause all</Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {CHANNELS.map(channel => (
            <div key={channel.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{channel.name}</p>
                <p className="text-sm text-slate-500">{channel.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Chip variant="flat" color={channel.enabled ? 'success' : 'default'}>
                  {channel.enabled ? 'Enabled' : 'Disabled'}
                </Chip>
                <Switch defaultSelected={channel.enabled} color="primary" aria-label={channel.name} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </section>
  )
}
