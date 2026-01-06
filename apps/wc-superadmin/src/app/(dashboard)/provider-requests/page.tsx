'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageSlot } from '@/components/layout/page-slot'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { Building, Eye, FilterX, Search } from 'lucide-react'
import { useDebounce } from '@world-schools/ui-web'
import { useApplicationReviewStore } from '@/stores/application-review-store'
import type { ApprovalStatus } from '@/types/application-review'

const STATUS_OPTIONS: { value: ApprovalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function ProviderRequestsPage() {
  const router = useRouter()
  const {
    applications,
    pagination,
    filters,
    isLoading,
    error,
    fetchApplications,
    fetchUnderReviewCount,
    setPage,
    setLimit,
    setFilters,
    clearFilters,
  } = useApplicationReviewStore()

  const [searchInput, setSearchInput] = useState('')
  const hasSetInitialFilter = useRef(false)

  // Debounce the search input with 500ms delay
  const debouncedSearch = useDebounce(searchInput, 500)

  // Set default status filter to "under_review" on initial mount only
  useEffect(() => {
    if (!hasSetInitialFilter.current && !filters.status) {
      setFilters({ status: 'under_review' })
      hasSetInitialFilter.current = true
    }
  }, [])

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  // Load applications when filters or pagination changes
  useEffect(() => {
    void fetchApplications()
    // Also refresh badge count when applications are fetched
    void fetchUnderReviewCount()
  }, [fetchApplications, fetchUnderReviewCount, pagination.page, pagination.limit, filters])

  const handleClearAllFilters = () => {
    setSearchInput('') // Clear the search input immediately
    clearFilters()
  }

  const hasActiveFilters = () => {
    return (
      searchInput !== '' ||
      (Object.keys(filters).length > 0 && Object.values(filters).some(v => v !== undefined))
    )
  }

  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'rejected':
        return 'danger'
      case 'under_review':
        return 'primary'
      case 'info_requested':
        return 'warning'
      case 'suspended':
        return 'default'
      default:
        return 'warning'
    }
  }

  const getStatusLabel = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'under_review':
        return 'Under Review'
      case 'info_requested':
        return 'Info Requested'
      case 'suspended':
        return 'Suspended'
      default:
        return 'Pending'
    }
  }

  const getTrustScoreColor = (score?: number | null) => {
    if (!score) return 'default'
    if (score >= 80) return 'success'
    if (score >= 50) return 'warning'
    return 'danger'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Provider Requests</h1>
            <p className="text-slate-500 mt-1">
              Review and manage provider onboarding applications
            </p>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex gap-4 flex-wrap items-end">
          <Input
            label="Search"
            labelPlacement="outside"
            placeholder="Search by business name, email, or legal name..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-[280px]"
            startContent={<Search className="h-5 w-5 text-gray-400" />}
          />
          <Select
            label="Status"
            labelPlacement="outside"
            placeholder="Select status"
            className="w-[180px]"
            selectedKeys={[filters.status || 'all']}
            onSelectionChange={keys => {
              const value = Array.from(keys)[0] as string | undefined
              setFilters({ status: value === 'all' ? undefined : (value as ApprovalStatus) })
            }}
          >
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>
          <Button
            variant="flat"
            color="default"
            startContent={<FilterX className="h-4 w-4" />}
            onPress={handleClearAllFilters}
            isDisabled={!hasActiveFilters()}
          >
            Clear Filters
          </Button>
        </div>

        {/* Provider Requests Table */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            <Table
              aria-label="Provider requests table"
              classNames={{
                wrapper: 'rounded-3xl',
              }}
              bottomContent={
                <div className="flex w-full justify-between items-center px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rows per page:</span>
                    <Select
                      aria-label="Rows per page"
                      size="sm"
                      className="w-20"
                      selectedKeys={[String(pagination.limit)]}
                      onSelectionChange={keys => {
                        const value = Array.from(keys)[0] as string
                        setLimit(Number(value))
                      }}
                    >
                      <SelectItem key="5">5</SelectItem>
                      <SelectItem key="10">10</SelectItem>
                      <SelectItem key="20">20</SelectItem>
                      <SelectItem key="50">50</SelectItem>
                    </Select>
                  </div>
                  {pagination.totalPages > 1 ? (
                    <Pagination
                      showControls
                      total={pagination.totalPages}
                      page={pagination.page}
                      onChange={setPage}
                    />
                  ) : (
                    <div />
                  )}
                  <div className="text-sm text-gray-500">
                    Total: {pagination.total} applications
                  </div>
                </div>
              }
            >
              <TableHeader>
                <TableColumn>BUSINESS</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>TRUST SCORE</TableColumn>
                <TableColumn>SUBMITTED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody
                items={applications}
                isLoading={isLoading}
                emptyContent={isLoading ? 'Loading...' : 'No provider requests found'}
              >
                {app => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-white text-sm font-medium min-w-10 min-h-10 rounded-full flex items-center justify-center">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{app.businessName}</div>
                          {app.legalCompanyName && (
                            <div className="text-sm text-gray-500">{app.legalCompanyName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {app.contactFirstName} {app.contactLastName}
                        </div>
                        <div className="text-sm text-gray-500">{app.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" color={getStatusColor(app.approvalStatus)} variant="flat">
                        {getStatusLabel(app.approvalStatus)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {app.trustScore !== null && app.trustScore !== undefined ? (
                        <Chip size="sm" color={getTrustScoreColor(app.trustScore)} variant="flat">
                          {app.trustScore}/100
                        </Chip>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">
                        {app.onboardingCompletedAt
                          ? formatDate(app.onboardingCompletedAt)
                          : 'In Progress'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => router.push(`/provider-requests/${app.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
