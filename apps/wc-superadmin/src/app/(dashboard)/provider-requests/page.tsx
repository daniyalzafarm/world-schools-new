'use client'

import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from '@heroui/react'
import { EllipsisVertical, Eye } from 'lucide-react'

const PROVIDER_REQUESTS = [
  {
    legalName: 'American International School-Salzburg',
    website: 'ais-salzburg.at',
    representative: 'John Doe',
    title: 'Booking Manager',
    email: 'john.doe@provider.com',
    phone: '+41 21 310 04 00',
    status: 'Pending',
  },
  {
    legalName: 'Branksome Hall Asia',
    website: 'branksome.asia',
    representative: 'John Doe',
    title: 'Booking Manager',
    email: 'john.doe@provider.com',
    phone: '+41 21 310 04 00',
    status: 'Revision',
  },
  {
    legalName: 'Brillantmont International School',
    website: 'campnorthstarmaince.com',
    representative: 'John Doe',
    title: 'Booking Manager',
    email: 'john.doe@provider.com',
    phone: '+41 21 310 04 00',
    status: 'Under Review',
  },
] as const

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Revision: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-blue-100 text-blue-700',
}

export default function ProviderRequestsPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Operations</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Provider Requests</h1>
            <p className="text-slate-500">
              Review and approve new provider applications for the World Camps marketplace.
            </p>
          </div>
          <Button color="primary" radius="full" className="self-start">
            Invite Provider
          </Button>
        </div>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4 p-6 border-b border-slate-200/70 dark:border-slate-800/70">
          <Input
            placeholder="Search provider…"
            radius="full"
            size="lg"
            classNames={{
              inputWrapper:
                'border border-slate-200 bg-white dark:bg-slate-800 hover:border-primary focus-within:border-primary',
            }}
          />
          <div className="hidden sm:flex gap-3">
            <Button radius="full" variant="flat">
              Export CSV
            </Button>
            <Button radius="full" variant="flat">
              Filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">Legal Name</th>
                <th className="px-6 py-4">Website</th>
                <th className="px-6 py-4">Representative</th>
                <th className="px-6 py-4">Rep. Contact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PROVIDER_REQUESTS.map(request => (
                <tr key={request.legalName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={request.legalName} className="bg-primary/10 text-primary" />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{request.legalName}</p>
                        <p className="text-xs text-slate-500">Provider</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <a
                      href={`https://${request.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-semibold"
                    >
                      {request.website}
                    </a>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{request.representative}</p>
                      <p className="text-xs text-slate-500">{request.title}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-900 dark:text-slate-200">{request.email}</p>
                      <p className="text-xs text-slate-400">{request.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ' +
                        STATUS_STYLES[request.status]
                      }
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <Button isIconOnly variant="light" radius="full">
                        <Eye size={18} />
                      </Button>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly variant="light" radius="full">
                            <EllipsisVertical size={18} />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Provider request actions">
                          <DropdownItem key="approve">Approve application</DropdownItem>
                          <DropdownItem key="revision">Request revisions</DropdownItem>
                          <DropdownItem key="reject" className="text-danger" color="danger">
                            Reject application
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
