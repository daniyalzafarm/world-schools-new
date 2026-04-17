'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  type ChipProps,
  Pagination,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from '@heroui/react'
import { Eye, FilterX, Search, Users } from 'lucide-react'
import { Input, PageSlot, SelectField, useDebounce } from '@world-schools/ui-web'
import { useParentsStore } from '@/stores/parents-store'
import type { ParentStatus, ParentTab } from '@/types/parents'

const statusColorMap: Record<ParentStatus, ChipProps['color']> = {
  active: 'success',
  inactive: 'default',
  new: 'primary',
}

const statusLabelMap: Record<ParentStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  new: 'New',
}

interface StatCardProps {
  label: string
  value: number | string
  colorClass?: string
}

function StatCard({ label, value, colorClass = 'text-foreground' }: StatCardProps) {
  return (
    <Card shadow="sm" className="border border-default-200">
      <CardBody className="p-5">
        <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
        <div className="mt-1 text-sm text-default-500">{label}</div>
      </CardBody>
    </Card>
  )
}

function TabBadge({ count }: { count?: number }) {
  if (count === undefined || count === null) return null
  return (
    <Chip size="sm" variant="flat" color="default" className="ml-1.5 h-5 min-w-5 text-xs">
      {count}
    </Chip>
  )
}

function getChildAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null
  const now = new Date()
  const dob = new Date(dateOfBirth)
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export default function ParentsPage() {
  const [activeTab, setActiveTab] = useState<ParentTab>('all')
  const [searchInput, setSearchInput] = useState('')
  const hasInitialized = useRef(false)

  const debouncedSearch = useDebounce(searchInput, 500)

  const {
    parents,
    stats,
    isLoading,
    error,
    pagination,
    filters,
    fetchParents,
    fetchStats,
    setPage,
    setLimit,
    setFilters,
    clearFilters,
  } = useParentsStore()

  // One-time init — stats are fetched globally once and never re-fetched on pagination/filter changes
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      void Promise.all([fetchStats(), fetchParents()])
    }
    return () => {
      // Reset store on unmount so returning users start from a clean state
      clearFilters()
      hasInitialized.current = false
    }
  }, [])

  // Debounced search → update store filters
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch])

  // Re-fetch when pagination / filters change
  useEffect(() => {
    if (hasInitialized.current) {
      void fetchParents()
    }
  }, [pagination.page, pagination.limit, filters])

  const handleTabChange = (key: React.Key) => {
    const tab = key as ParentTab
    setActiveTab(tab)
    setFilters({ tab: tab === 'all' ? undefined : tab })
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setFilters({ search: undefined })
  }

  const hasActiveFilters = searchInput !== ''

  const showingFrom = Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)
  const showingTo = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Parents</h1>
            <p className="mt-1 text-slate-500">
              Manage registered parent accounts and their children
            </p>
          </div>
        </header>

        {/* Error alert */}
        {error && (
          <Card className="border-danger-200 bg-danger-50">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Parents" value={stats?.totalParents ?? '—'} />
          <StatCard label="Children Registered" value={stats?.childrenRegistered ?? '—'} />
          <StatCard
            label="Avg Children / Parent"
            value={stats ? stats.avgChildrenPerParent.toFixed(2) : '—'}
          />
          <StatCard
            label="Repeat Booking Rate"
            value={stats ? `${stats.repeatBookingRate}%` : '—'}
          />
        </div>

        {/* Main card */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            {/* Tabs */}
            <div className="border-b border-default-200 px-4 pt-2">
              <Tabs
                aria-label="Parent filter tabs"
                selectedKey={activeTab}
                onSelectionChange={handleTabChange}
                variant="underlined"
                classNames={{ base: 'w-full', tabList: 'p-0!' }}
              >
                <Tab
                  key="all"
                  title={
                    <span className="flex items-center">
                      All Parents
                      <TabBadge count={stats?.totalParents} />
                    </span>
                  }
                />
                <Tab
                  key="active"
                  title={
                    <span className="flex items-center">
                      Active
                      <TabBadge count={stats?.activeCount} />
                    </span>
                  }
                />
                <Tab
                  key="with_bookings"
                  title={
                    <span className="flex items-center">
                      With Bookings
                      <TabBadge count={stats?.withBookingsCount} />
                    </span>
                  }
                />
                <Tab
                  key="new_this_month"
                  title={
                    <span className="flex items-center">
                      New This Month
                      <TabBadge count={stats?.newThisMonthCount} />
                    </span>
                  }
                />
                <Tab
                  key="inactive"
                  title={
                    <span className="flex items-center">
                      Inactive
                      <TabBadge count={stats?.inactiveCount} />
                    </span>
                  }
                />
              </Tabs>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-default-200 px-4 py-3">
              <Input
                aria-label="Search parents"
                placeholder="Search by name or email…"
                className="w-full max-w-xs shrink-0"
                value={searchInput}
                onValueChange={setSearchInput}
                isClearable
                onClear={() => setSearchInput('')}
                startContent={<Search className="h-4 w-4 text-default-400" />}
              />
              {hasActiveFilters && (
                <Button
                  variant="flat"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" color="primary" />
              </div>
            ) : parents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-default-400">
                <Users className="mb-3 h-10 w-10 opacity-40" />
                <p>No parents found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Parents list" classNames={{ base: 'p-4' }} removeWrapper>
                  <TableHeader>
                    <TableColumn>PARENT</TableColumn>
                    <TableColumn>CHILDREN</TableColumn>
                    <TableColumn>BOOKINGS</TableColumn>
                    <TableColumn>TOTAL SPENT</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>JOINED</TableColumn>
                    {/* <TableColumn>ACTIONS</TableColumn> */}
                  </TableHeader>
                  <TableBody items={parents} emptyContent="No parents found">
                    {parent => (
                      <TableRow key={parent.id}>
                        {/* Parent cell */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                              <span className="text-sm font-semibold text-white">
                                {getInitials(parent.firstName, parent.lastName)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-foreground">
                                {parent.firstName} {parent.lastName}
                              </div>
                              <div className="truncate text-xs text-default-400">
                                {parent.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Children cell */}
                        <TableCell>
                          {parent.children.length === 0 ? (
                            <span className="text-sm text-default-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {parent.children.map(child => {
                                const age = getChildAge(child.dateOfBirth)
                                return (
                                  <Chip key={child.id} size="sm" variant="flat" color="default">
                                    {child.firstName}
                                    {age !== null ? ` (${age})` : ''}
                                  </Chip>
                                )
                              })}
                            </div>
                          )}
                        </TableCell>

                        {/* Bookings cell */}
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">
                              {parent.bookingCount}
                            </div>
                            <div className="text-xs text-default-400">
                              {parent.upcomingBookingCount > 0
                                ? `${parent.upcomingBookingCount} upcoming`
                                : 'No upcoming'}
                            </div>
                          </div>
                        </TableCell>

                        {/* Total spent cell */}
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">
                              {formatCurrency(parent.totalSpent)}
                            </div>
                            <div className="text-xs text-default-400">
                              {parent.bookingCount > 0
                                ? `Avg ${formatCurrency(parent.avgSpent)}`
                                : '—'}
                            </div>
                          </div>
                        </TableCell>

                        {/* Status cell */}
                        <TableCell>
                          <Chip size="sm" color={statusColorMap[parent.status]} variant="flat">
                            {statusLabelMap[parent.status]}
                          </Chip>
                        </TableCell>

                        {/* Joined cell */}
                        <TableCell>
                          <span className="text-sm text-default-500">
                            {formatDate(parent.joinedAt)}
                          </span>
                        </TableCell>

                        {/* Actions cell */}
                        {/* <TableCell>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            aria-label={`View ${parent.firstName} ${parent.lastName}`}
                            as="a"
                            href={`/parents/${parent.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell> */}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination footer */}
            {!isLoading && pagination.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-default-500">Rows per page:</span>
                  <SelectField
                    aria-label="Rows per page"
                    size="sm"
                    className="w-20"
                    value={String(pagination.limit)}
                    onChange={val => setLimit(Number(val))}
                    options={['10', '20', '50', '100']}
                  />
                </div>
                {pagination.totalPages > 1 && (
                  <Pagination
                    showControls
                    total={pagination.totalPages}
                    page={pagination.page}
                    onChange={setPage}
                  />
                )}
                <span className="text-sm text-default-500">
                  Showing {showingFrom}–{showingTo} of {pagination.total} parents
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
