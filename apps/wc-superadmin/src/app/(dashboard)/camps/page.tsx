'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Eye, FilterX, LayoutGrid, LayoutList, MapPin, Search, Star, Tent } from 'lucide-react'
import { Input, PageSlot, SelectField, useDebounce } from '@world-schools/ui-web'
import { useCampsStore } from '@/stores/camps-store'
import { CampCard } from '@/components/camps/camp-card'
import type { AdminCampStatus } from '@/types/camps'

const statusColorMap: Record<AdminCampStatus, ChipProps['color']> = {
  published: 'success',
  draft: 'default',
  archived: 'default',
  pending_review: 'warning',
  suspended: 'danger',
}
const statusLabelMap: Record<AdminCampStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  pending_review: 'Pending Review',
  suspended: 'Suspended',
}

type TabKey = 'all' | AdminCampStatus

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

function TabBadge({ count, warn }: { count?: number; warn?: boolean }) {
  if (count === undefined || count === null) return null
  return (
    <Chip
      size="sm"
      variant="flat"
      color={warn ? 'warning' : 'default'}
      className="ml-1.5 h-5 min-w-5 text-xs"
    >
      {count}
    </Chip>
  )
}

export default function CampsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchInput, setSearchInput] = useState('')
  const hasInitialized = useRef(false)

  const debouncedSearch = useDebounce(searchInput, 500)

  const {
    camps,
    stats,
    isLoading,
    error,
    pagination,
    filters,
    fetchCamps,
    fetchStats,
    setPage,
    setLimit,
    setFilters,
    clearFilters,
  } = useCampsStore()

  // One-time init: fetch stats + camps
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      clearFilters()
      void Promise.all([fetchStats(), fetchCamps()])
    }
  }, [])

  // Debounced search → update store filters
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch])

  // Re-fetch when pagination / filters change
  useEffect(() => {
    if (hasInitialized.current) {
      void fetchCamps()
    }
  }, [pagination.page, pagination.limit, filters])

  const handleTabChange = (key: React.Key) => {
    const tab = key as TabKey
    setActiveTab(tab)
    setFilters({ status: tab === 'all' ? undefined : tab })
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setActiveTab('all')
    clearFilters()
  }

  const hasActiveFilters =
    searchInput !== '' ||
    filters.status !== undefined ||
    !!filters.providerId ||
    !!filters.category ||
    !!filters.country

  const showingFrom = Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)
  const showingTo = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Camps</h1>
            <p className="mt-1 text-slate-500">Manage camp listings and content moderation</p>
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
          <StatCard label="Total Camps" value={stats?.totalCamps ?? '—'} />
          <StatCard label="Published" value={stats?.published ?? '—'} colorClass="text-success" />
          <StatCard label="Draft" value={stats?.draft ?? '—'} />
          <StatCard
            label="Pending Review"
            value={stats?.pendingReview ?? '—'}
            colorClass="text-warning"
          />
        </div>

        {/* Main card */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            {/* Tabs */}
            <div className="border-b border-default-200 px-4 pt-2">
              <Tabs
                aria-label="Camp status tabs"
                selectedKey={activeTab}
                onSelectionChange={handleTabChange}
                variant="underlined"
                classNames={{ base: 'w-full', tabList: 'p-0!' }}
              >
                <Tab
                  key="all"
                  title={
                    <span className="flex items-center">
                      All Camps
                      <TabBadge count={stats?.totalCamps} />
                    </span>
                  }
                />
                <Tab
                  key="published"
                  title={
                    <span className="flex items-center">
                      Published
                      <TabBadge count={stats?.published} />
                    </span>
                  }
                />
                <Tab
                  key="draft"
                  title={
                    <span className="flex items-center">
                      Draft
                      <TabBadge count={stats?.draft} />
                    </span>
                  }
                />
                <Tab
                  key="pending_review"
                  title={
                    <span className="flex items-center">
                      Pending Review
                      <TabBadge count={stats?.pendingReview} warn />
                    </span>
                  }
                />
                <Tab
                  key="suspended"
                  title={
                    <span className="flex items-center">
                      Suspended
                      <TabBadge count={stats?.suspended} />
                    </span>
                  }
                />
                <Tab
                  key="archived"
                  title={
                    <span className="flex items-center">
                      Archived
                      <TabBadge count={stats?.archived} />
                    </span>
                  }
                />
              </Tabs>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-default-200 px-4 py-3">
              <Input
                aria-label="Search camps"
                placeholder="Search camps by name or provider…"
                className="w-full max-w-xs shrink-0"
                value={searchInput}
                onValueChange={setSearchInput}
                isClearable
                onClear={() => setSearchInput('')}
                startContent={<Search className="h-4 w-4 text-default-400" />}
              />
              <SelectField
                aria-label="Provider filter"
                placeholder="All Providers"
                className="w-44 shrink-0"
                value={filters.providerId ?? ''}
                onChange={val => setFilters({ providerId: val || undefined })}
                options={[{ value: '', label: 'All Providers' }]}
              />
              <SelectField
                aria-label="Category filter"
                placeholder="All Categories"
                className="w-44 shrink-0"
                value={filters.category ?? ''}
                onChange={val => setFilters({ category: val || undefined })}
                options={[{ value: '', label: 'All Categories' }]}
              />
              <SelectField
                aria-label="Country filter"
                placeholder="All Countries"
                className="w-44 shrink-0"
                value={filters.country ?? ''}
                onChange={val => setFilters({ country: val || undefined })}
                options={[{ value: '', label: 'All Countries' }]}
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

              {/* View toggle — right-aligned */}
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-default-200 p-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant={viewMode === 'grid' ? 'solid' : 'light'}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  onPress={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant={viewMode === 'list' ? 'solid' : 'light'}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  onPress={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" color="primary" />
              </div>
            ) : camps.length === 0 ? (
              <div className="py-16 text-center text-default-400">No camps found</div>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {camps.map(camp => (
                  <CampCard key={camp.id} camp={camp} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Camps list" classNames={{ base: 'p-4' }} removeWrapper>
                  <TableHeader>
                    <TableColumn>CAMP</TableColumn>
                    <TableColumn>LOCATION</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>RATING</TableColumn>
                    <TableColumn>BOOKINGS</TableColumn>
                    <TableColumn>SESSIONS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody items={camps} emptyContent="No camps found">
                    {camp => (
                      <TableRow
                        key={camp.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/camps/${camp.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg">
                              {camp.coverImageUrl ? (
                                <img
                                  src={camp.coverImageUrl}
                                  alt={camp.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/30 to-secondary/60">
                                  <Tent className="h-4 w-4 text-white/60" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {camp.name}
                              </div>
                              <div className="truncate text-xs text-default-400">
                                {camp.providerName}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {camp.location ? (
                            <span className="flex items-center gap-1 text-sm text-default-500">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{camp.location}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-default-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" color={statusColorMap[camp.status]} variant="flat">
                            {statusLabelMap[camp.status]}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          {camp.averageRating !== null ? (
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {camp.averageRating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-sm text-default-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {camp.totalBookings}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {camp.sessionsCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() => router.push(`/camps/${camp.id}`)}
                            aria-label={`View ${camp.name}`}
                            onClick={e => e.stopPropagation()}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
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
                  Showing {showingFrom}–{showingTo} of {pagination.total} camps
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
