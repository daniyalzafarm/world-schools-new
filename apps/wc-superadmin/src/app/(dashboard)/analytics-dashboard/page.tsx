'use client'

import { Button, Card, CardBody, CardHeader, Chip, Progress } from '@heroui/react'
import { ArrowUpRight, Download, LineChart, Users } from 'lucide-react'

const KPI_CARDS = [
  {
    label: 'Active providers',
    value: '248',
    delta: '+12%',
    icon: <Users size={18} />,
  },
  {
    label: 'Conversion rate',
    value: '38.4%',
    delta: '+4.8%',
    icon: <ArrowUpRight size={18} />,
  },
  {
    label: 'Monthly revenue',
    value: '$182k',
    delta: '+9.3%',
    icon: <LineChart size={18} />,
  },
]

const PIPELINE_STEPS = [
  { label: 'New requests', value: 34, color: 'primary' },
  { label: 'Under review', value: 19, color: 'warning' },
  { label: 'Approved', value: 12, color: 'success' },
]

export default function AnalyticsDashboardPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Executive</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
            <p className="text-slate-500">Monitor provider performance and platform health in real time.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="flat" radius="full">
              Share report
            </Button>
            <Button color="primary" radius="full" startContent={<Download size={16} />}>
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_CARDS.map(card => (
          <Card key={card.label} shadow="sm" className="rounded-3xl border border-slate-200 dark:border-slate-800">
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{card.label}</span>
              <Chip color="success" variant="flat" size="sm">
                {card.delta}
              </Chip>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</span>
                <span className="text-slate-400">vs last month</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">{card.icon} Updated just now</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 lg:col-span-2" shadow="sm">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Weekly arrivals</h2>
              <p className="text-sm text-slate-500">Camp check-ins across the platform</p>
            </div>
            <Chip color="primary" variant="dot">
              12% growth WoW
            </Chip>
          </CardHeader>
          <CardBody className="min-h-[260px] flex items-center justify-center">
            <div className="w-full h-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
              Trend chart placeholder
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Onboarding pipeline</h2>
              <p className="text-sm text-slate-500">Status of new provider requests</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {PIPELINE_STEPS.map(step => (
              <div key={step.label} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{step.label}</span>
                  <span>{step.value}</span>
                </div>
                <Progress
                  value={step.value}
                  maxValue={40}
                  radius="full"
                  color={step.color as any}
                  classNames={{
                    base: 'h-2 bg-slate-200 dark:bg-slate-800',
                  }}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </section>
  )
}
