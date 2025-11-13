'use client'

import { Button, Card, CardBody, CardHeader, Input, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { Plus } from 'lucide-react'

const PROVIDERS = [
  { id: '1', name: 'Camp Northstar Maine', region: 'North America', status: 'Active' },
  { id: '2', name: 'World Explorers Academy', region: 'Europe', status: 'In review' },
  { id: '3', name: 'BrightFuture Summer Labs', region: 'APAC', status: 'Active' },
]

export default function AllProvidersPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Directory</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">All Providers</h1>
          <p className="text-slate-500">Search and manage every provider on the platform.</p>
        </div>
        <Button color="primary" radius="full" startContent={<Plus size={16} />}>Add provider</Button>
      </header>

      <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Input placeholder="Search by provider or region" radius="full" className="max-w-xl" />
          <div className="flex gap-3">
            <Button variant="flat" radius="full">Filters</Button>
            <Button variant="flat" radius="full">Columns</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Providers" className="rounded-2xl overflow-hidden">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Region</TableColumn>
              <TableColumn>Status</TableColumn>
            </TableHeader>
            <TableBody>
              {PROVIDERS.map(provider => (
                <TableRow key={provider.id}>
                  <TableCell>{provider.name}</TableCell>
                  <TableCell>{provider.region}</TableCell>
                  <TableCell>{provider.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </section>
  )
}
