'use client'

import { Button, Card, CardBody, CardHeader, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { Calendar, Download, TrendingUp } from 'lucide-react'

const FORECAST = [
  { month: 'January', revenue: '$158,200', variance: '+6.2%' },
  { month: 'February', revenue: '$171,840', variance: '+8.6%' },
  { month: 'March', revenue: '$182,120', variance: '+3.8%' },
]

const LEDGER = [
  { id: '1', label: 'Commission payouts', amount: '$62,300', status: 'Scheduled' },
  { id: '2', label: 'Partner incentives', amount: '$24,500', status: 'Processing' },
  { id: '3', label: 'Platform fees collected', amount: '$86,120', status: 'Cleared' },
]

export default function FinancialDashboardPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Finance</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Financial Dashboard</h1>
            <p className="text-slate-500">Track revenue, payouts, and cashflow indicators.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="flat" radius="full" startContent={<Calendar size={16} />}>
              Last 90 days
            </Button>
            <Button color="primary" radius="full" startContent={<Download size={16} />}>
              Export ledger
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 lg:col-span-2" shadow="sm">
          <CardHeader className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue forecast</h2>
              <p className="text-sm text-slate-500">Projected platform revenue by month</p>
            </div>
            <Chip color="success" variant="dot">
              Model v2.3
            </Chip>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 h-56 flex items-center justify-center text-slate-400">
              Forecast chart placeholder
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {FORECAST.map(item => (
                <div key={item.month} className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">{item.month}</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{item.revenue}</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{item.variance}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payout summary</h2>
              <p className="text-sm text-slate-500">Releases scheduled this week</p>
            </div>
            <TrendingUp size={18} className="text-primary" />
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium">
              $112,800 to be released to 34 providers
            </div>
            <Table aria-label="Upcoming payouts" className="rounded-2xl overflow-hidden">
              <TableHeader>
                <TableColumn>Label</TableColumn>
                <TableColumn>Amount</TableColumn>
                <TableColumn>Status</TableColumn>
              </TableHeader>
              <TableBody>
                {LEDGER.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell>{entry.amount}</TableCell>
                    <TableCell>{entry.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </section>
  )
}
