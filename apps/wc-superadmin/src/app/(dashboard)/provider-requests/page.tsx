'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { EMOJI } from '@world-schools/wc-frontend-utils'
import { useApplicationReviewStore } from '../../../stores/application-review-store'
import type { ApprovalStatus } from '../../../types/application-review'

const STATUS_OPTIONS: { value: ApprovalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'info_requested', label: 'Info Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]

export default function ProviderRequestsPage() {
  const router = useRouter()
  const { applications, totalPages, isLoading, fetchApplications } = useApplicationReviewStore()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadApplications()
  }, [currentPage, status])

  const loadApplications = () => {
    const query: any = {
      page: Math.max(1, Math.floor(currentPage)), // Ensure page is at least 1 and an integer
      limit: 20, // Fixed limit of 20 items per page
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    }

    if (status !== 'all') {
      query.status = status
    }

    if (search?.trim()) {
      query.search = search.trim()
    }

    fetchApplications(query).catch(error => {
      console.error('Failed to fetch applications:', error)
    })
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadApplications()
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
    if (score >= 70) return 'success'
    if (score >= 50) return 'warning'
    return 'danger'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          {EMOJI.DOCUMENT} Provider Requests
        </h1>
        <p className="text-default-600">Review and manage provider onboarding applications</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex gap-4">
            <Input
              placeholder="Search by business name, email, or legal name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              startContent={<span>{EMOJI.SEARCH}</span>}
            />
            <Select
              placeholder="Filter by status"
              selectedKeys={[status]}
              onChange={e => setStatus(e.target.value as any)}
              className="w-64"
            >
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} textValue={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
            <Button color="primary" onPress={handleSearch}>
              {EMOJI.SEARCH} Search
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" color="primary" />
            </div>
          ) : !applications || applications.length === 0 ? (
            <div className="py-8 text-center text-default-400">
              <p>{EMOJI.DOCUMENT} No applications found</p>
            </div>
          ) : (
            <>
              <Table aria-label="Applications table">
                <TableHeader>
                  <TableColumn>BUSINESS NAME</TableColumn>
                  <TableColumn>CONTACT</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn>TRUST SCORE</TableColumn>
                  <TableColumn>SUBMITTED</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody>
                  {applications.map(app => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{app.businessName}</div>
                          {app.legalCompanyName && (
                            <div className="text-sm text-default-500">{app.legalCompanyName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm text-foreground">
                            {app.contactFirstName} {app.contactLastName}
                          </div>
                          <div className="text-sm text-default-500">{app.email}</div>
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
                          <span className="text-sm text-default-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-default-600">
                          {app.onboardingCompletedAt
                            ? new Date(app.onboardingCompletedAt).toLocaleDateString()
                            : 'In Progress'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          onClick={() => router.push(`/provider-requests/${app.id}`)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination
                    total={totalPages}
                    page={currentPage}
                    onChange={setCurrentPage}
                    showControls
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
