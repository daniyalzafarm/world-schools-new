'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
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
import {
  Building,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Percent,
  Phone,
  Shield,
  Star,
  Upload,
} from 'lucide-react'
import { getCountryName, getInitials } from '@world-schools/ui-web'
import { campsService } from '@/services/camps.services'
import * as adminSettingsService from '@/services/admin-settings.services'
import { AppFeeModal } from '@/components/providers/app-fee-modal'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageSlot } from '@/components/layout/page-slot'
import { useProvidersStore } from '@/stores/providers-store'
import type { ApprovalStatus } from '@/types/application-review'
import type { ProviderCampSummary, ProviderDetail, ProviderRecentBooking } from '@/types/providers'
import config from '@/config/config'

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
      return 'Pending Review'
    case 'info_requested':
      return 'Info Requested'
    case 'suspended':
      return 'Suspended'
    default:
      return 'Pending'
  }
}

const getDocReviewStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'needs_reupload':
      return 'warning'
    default:
      return 'default'
  }
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatCurrency = (amount: number, currency: string | null) => {
  if (!currency) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

const getCampStatusColor = (status: string) => {
  switch (status) {
    case 'published':
      return 'success'
    case 'draft':
      return 'default'
    case 'archived':
      return 'danger'
    default:
      return 'default'
  }
}

export default function ProviderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const providerId = params.id as string

  const { detail, isLoading, error, fetchDetail, clearDetail } = useProvidersStore()

  useEffect(() => {
    if (providerId) {
      void fetchDetail(providerId)
    }
    return () => clearDetail()
  }, [providerId, fetchDetail, clearDetail])

  if (isLoading || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  if (error) {
    return (
      <PageSlot>
        <Card className="bg-danger-50 border-danger-200">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      </PageSlot>
    )
  }

  const location = [
    detail.legalCity,
    detail.legalStateProvince,
    getCountryName(detail.legalCountry),
  ]
    .filter(Boolean)
    .join(', ')

  const currency = detail.settings?.currency ?? null

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'All Providers', href: '/providers' },
            { label: detail.legalCompanyName ?? detail.businessName },
          ]}
        />

        {/* Profile Header Card */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardBody className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              {detail.logoUrl ? (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-default-200 bg-white overflow-hidden">
                  <img
                    src={detail.logoUrl}
                    alt="Provider logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xl font-semibold">
                    {getInitials(detail.legalCompanyName ?? detail.businessName)}
                  </span>
                </div>
              )}

              {/* Main info */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {detail.legalCompanyName ?? detail.businessName}
                  </h1>
                  <Chip size="sm" color={getStatusColor(detail.approvalStatus)} variant="flat">
                    {getStatusLabel(detail.approvalStatus)}
                  </Chip>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-default-500">
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {location}
                    </span>
                  )}
                  {detail.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" /> {detail.email}
                    </span>
                  )}
                  {detail.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {detail.phone}
                    </span>
                  )}
                  {detail.website && (
                    <a
                      href={detail.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" /> {detail.website}
                    </a>
                  )}
                </div>

                {detail.description && (
                  <p className="text-sm text-default-600">{detail.description}</p>
                )}

                {/* Quick stats */}
                <div className="flex flex-wrap gap-6 pt-2">
                  <div>
                    <div className="text-xl font-bold text-foreground">
                      {detail.stats.activeCampsCount}
                    </div>
                    <div className="text-xs text-default-500">Active Camps</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-foreground">
                      {detail.stats.totalSessionsCount}
                    </div>
                    <div className="text-xs text-default-500">Sessions</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-foreground">
                      {detail.stats.totalBookingsCount}
                    </div>
                    <div className="text-xs text-default-500">Total Bookings</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-foreground">
                      {formatCurrency(Number(detail.stats.totalRevenue), currency)}
                    </div>
                    <div className="text-xs text-default-500">Revenue (YTD)</div>
                  </div>
                  {detail.stats.averageRating !== null && (
                    <div>
                      <div className="flex items-center gap-1 text-xl font-bold text-foreground">
                        {detail.stats.averageRating.toFixed(1)}
                        <Star className="h-4 w-4 fill-warning text-warning" />
                      </div>
                      <div className="text-xs text-default-500">
                        Avg Rating ({detail.stats.reviewsCount})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Detail Tabs */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardBody className="p-0">
            <Tabs
              aria-label="Provider detail sections"
              variant="underlined"
              classNames={{
                base: 'border-b border-default-200 px-4 pt-2',
                tabList: 'p-0!',
                panel: 'p-6',
              }}
            >
              <Tab key="overview" title="Overview">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Left column (2/3) */}
                  <div className="space-y-6 lg:col-span-2">
                    {/* Contact Information */}
                    <ContactInfoCard detail={detail} />

                    {/* Camps List */}
                    {detail.camps.length > 0 && <CampsCard camps={detail.camps} />}

                    {/* Recent Bookings */}
                    {detail.bookingGroups.length > 0 && (
                      <RecentBookingsCard bookings={detail.bookingGroups} currency={currency} />
                    )}
                  </div>

                  {/* Right column (1/3) */}
                  <div className="space-y-6">
                    {/* Account Status */}
                    <AccountStatusCard detail={detail} />

                    {/* Verification Documents */}
                    {detail.verificationDocuments.length > 0 && (
                      <VerificationDocsCard documents={detail.verificationDocuments} />
                    )}
                  </div>
                </div>
              </Tab>

              <Tab key="camps" title={`Camps (${detail._count.camps})`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-default-500">
                      {detail._count.camps === 0
                        ? 'No camps yet. Import camps to get started.'
                        : `${detail._count.camps} camp${detail._count.camps !== 1 ? 's' : ''} for this provider.`}
                    </p>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<Upload className="h-4 w-4" />}
                      onPress={() => router.push(`/providers/${providerId}/import-camps`)}
                    >
                      Import Camps
                    </Button>
                  </div>
                  {detail.camps.length > 0 && (
                    <CampsCard camps={detail.camps} providerId={providerId} />
                  )}
                </div>
              </Tab>

              <Tab
                key="bookings"
                title={`Bookings (${detail._count.bookingGroups})`}
                isDisabled={detail._count.bookingGroups === 0}
              >
                <p className="text-sm text-default-500">Full bookings view coming soon.</p>
              </Tab>

              <Tab key="settings" title="Settings">
                <SettingsTab
                  detail={detail}
                  providerId={providerId}
                  onSaved={() => void fetchDetail(providerId)}
                />
              </Tab>

              <Tab
                key="documents"
                title={`Documents (${detail.verificationDocuments.length})`}
                isDisabled={detail.verificationDocuments.length === 0}
              >
                <VerificationDocsCard documents={detail.verificationDocuments} />
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </PageSlot>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ContactInfoCard({ detail }: { detail: ProviderDetail }) {
  if (!detail) return null
  const address = [
    detail.legalStreetAddress,
    detail.legalAptSuite,
    detail.legalCity,
    detail.legalStateProvince,
    detail.legalPostalCode,
    getCountryName(detail.legalCountry),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Contact Information</h3>
        <div className="space-y-2 text-sm">
          {(detail.contactFirstName || detail.contactLastName) && (
            <InfoRow label="Primary Contact">
              {[detail.contactFirstName, detail.contactLastName].filter(Boolean).join(' ')}
              {detail.contactRole && (
                <span className="text-default-400"> ({detail.contactRole})</span>
              )}
            </InfoRow>
          )}
          {detail.contactEmail && (
            <InfoRow label="Email">
              <a
                href={`mailto:${detail.contactEmail}`}
                className="text-primary-600 hover:underline"
              >
                {detail.contactEmail}
              </a>
            </InfoRow>
          )}
          {detail.contactPhone && <InfoRow label="Phone">{detail.contactPhone}</InfoRow>}
          {address && <InfoRow label="Business Address">{address}</InfoRow>}
          {detail.website && (
            <InfoRow label="Website">
              <a
                href={detail.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                {detail.website}
              </a>
            </InfoRow>
          )}
          {detail.yearFounded && <InfoRow label="Year Founded">{detail.yearFounded}</InfoRow>}
        </div>
      </CardBody>
    </Card>
  )
}

function CampsCard({ camps, providerId }: { camps: ProviderCampSummary[]; providerId?: string }) {
  const router = useRouter()

  const handleViewCamp = async (camp: ProviderCampSummary) => {
    try {
      let url = `${config.app.bookingAppUrl}/camps/${camp.slug}`
      if (camp.status === 'draft') {
        const token = await campsService.generatePreviewToken(camp.id)
        url += `?preview=${token}`
      }
      window.open(url, '_blank')
    } catch {
      addToast({ title: 'Error', description: 'Failed to open camp preview.', color: 'danger' })
    }
  }

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Camps</h3>
        <div className="divide-y divide-default-100">
          {camps.map(camp => (
            <div key={camp.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-default-500">
                <Building className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium text-foreground hover:text-foreground-600 truncate cursor-pointer underline"
                  onClick={() => handleViewCamp(camp)}
                >
                  {camp.name}
                </div>

                <div className="text-xs text-default-400 capitalize">{camp.type}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-center text-sm">
                {providerId && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<Upload className="h-3.5 w-3.5" />}
                    onPress={() =>
                      router.push(`/providers/${providerId}/camps/${camp.id}/import-sessions`)
                    }
                  >
                    Import Sessions
                  </Button>
                )}
                <div>
                  <div className="font-semibold text-foreground">{camp._count.sessions}</div>
                  <div className="text-xs text-default-400">Sessions</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">{camp._count.bookingGroups}</div>
                  <div className="text-xs text-default-400">Bookings</div>
                </div>
                <Chip
                  size="sm"
                  color={getCampStatusColor(camp.status)}
                  className="capitalize"
                  variant="flat"
                >
                  {camp.status}
                </Chip>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function RecentBookingsCard({
  bookings,
  currency,
}: {
  bookings: ProviderRecentBooking[]
  currency: string | null
}) {
  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'fully_paid':
      case 'deposit_paid':
      case 'completed':
        return 'success'
      case 'request':
      case 'accepted':
        return 'primary'
      case 'declined':
      case 'cancelled':
        return 'danger'
      case 'expired':
        return 'default'
      default:
        return 'default'
    }
  }

  const formatBookingStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Recent Bookings</h3>
        <Table
          aria-label="Recent bookings"
          classNames={{ wrapper: 'shadow-none p-0', th: 'bg-transparent' }}
          removeWrapper
        >
          <TableHeader>
            <TableColumn className="text-xs font-semibold uppercase text-default-500">
              Reference
            </TableColumn>
            <TableColumn className="text-xs font-semibold uppercase text-default-500">
              Parent
            </TableColumn>
            <TableColumn className="text-xs font-semibold uppercase text-default-500">
              Camp / Session
            </TableColumn>
            <TableColumn className="text-right text-xs font-semibold uppercase text-default-500">
              Amount
            </TableColumn>
            <TableColumn className="text-xs font-semibold uppercase text-default-500">
              Status
            </TableColumn>
          </TableHeader>
          <TableBody items={bookings}>
            {booking => (
              <TableRow key={booking.id}>
                <TableCell>
                  <span className="font-mono text-xs text-default-600">
                    #{booking.bookingGroupNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {[booking.parent.user.firstName, booking.parent.user.lastName]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm font-medium">{booking.camp.name}</div>
                    <div className="text-xs text-default-400">{booking.session.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-semibold">
                    {formatCurrency(Number(booking.totalAmount), currency)}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color={getBookingStatusColor(booking.status)} variant="flat">
                    {formatBookingStatus(booking.status)}
                  </Chip>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )
}

function AccountStatusCard({ detail }: { detail: ProviderDetail }) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Account Status</h3>
        <div className="space-y-2 text-sm">
          <InfoRow label="Status">
            <Chip size="sm" color={getStatusColor(detail.approvalStatus)} variant="flat">
              {getStatusLabel(detail.approvalStatus)}
            </Chip>
          </InfoRow>
          <InfoRow label="Joined">{formatDate(detail.createdAt)}</InfoRow>
          {detail.approvalDecisionAt && (
            <InfoRow label="Approved">{formatDate(detail.approvalDecisionAt)}</InfoRow>
          )}
          {detail.lastLoginAt && (
            <InfoRow label="Last Active">{formatDate(detail.lastLoginAt)}</InfoRow>
          )}
          {detail.trustScore !== null && detail.trustScore !== undefined && (
            <InfoRow label="Trust Score">
              <span className="font-semibold">{detail.trustScore}/100</span>
            </InfoRow>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function VerificationDocsCard({
  documents,
}: {
  documents: ProviderDetail['verificationDocuments']
}) {
  if (!documents) return null

  const formatDocType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-default-500" />
          <h3 className="font-semibold text-foreground">Verification</h3>
        </div>
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-default-100 p-2"
            >
              <div className="flex items-center gap-2 w-4/6">
                <FileText className="h-4 w-4 shrink-0 text-default-400" />
                <div className="truncate">
                  <div className="text-sm font-medium truncate">{doc.fileName}</div>
                  <div className="text-xs text-default-400 truncate">
                    {formatDocType(doc.documentType)}
                  </div>
                </div>
              </div>
              <Chip
                size="sm"
                color={getDocReviewStatusColor(doc.reviewStatus)}
                variant="flat"
                className="shrink-0 capitalize"
              >
                {doc.reviewStatus}
              </Chip>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// Helper
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-default-500 shrink-0">{label}</span>
      <span className="text-foreground text-right w-4/6">{children}</span>
    </div>
  )
}

function SettingsTab({
  detail,
  providerId,
  onSaved,
}: {
  detail: ProviderDetail
  providerId: string
  onSaved: () => void
}) {
  const [systemDefaultAppFee, setSystemDefaultAppFee] = useState<number | null>(null)
  const [appFeeOpen, setAppFeeOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = await adminSettingsService.getSystemSettings()
      if (!cancelled && response.success && response.data) {
        setSystemDefaultAppFee(Number(response.data.defaultAppFee))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const formatAdmin = (
    admin: { firstName?: string | null; lastName?: string | null; email: string } | null | undefined
  ) => {
    if (!admin) return ''
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ').trim()
    return name || admin.email
  }

  const formatTimestamp = (iso: string | null | undefined) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* App Fee Card */}
      <Card shadow="none" className="border border-default-200">
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-default-500" />
              <h3 className="font-semibold text-foreground">App Fee</h3>
            </div>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setAppFeeOpen(true)}
              isDisabled={systemDefaultAppFee == null}
            >
              Edit
            </Button>
          </div>

          <div className="text-sm">
            {detail.appFeeCustom && detail.appFeePercentage != null ? (
              <div>
                <span className="text-default-500">Custom app fee: </span>
                <span className="font-semibold text-foreground">
                  {Number(detail.appFeePercentage).toFixed(2)}%
                </span>
              </div>
            ) : (
              <div>
                <span className="text-default-500">Default app fee: </span>
                <span className="font-semibold text-foreground">
                  {systemDefaultAppFee != null ? `${systemDefaultAppFee}%` : '—'}
                </span>
                <span className="text-default-400"> — no override set</span>
              </div>
            )}
          </div>

          {detail.appFeeUpdatedAt && (
            <div className="text-xs text-default-400">
              Last changed {formatTimestamp(detail.appFeeUpdatedAt)}
              {detail.appFeeUpdatedByAdmin ? ` by ${formatAdmin(detail.appFeeUpdatedByAdmin)}` : ''}
            </div>
          )}
        </CardBody>
      </Card>

      <AppFeeModal
        isOpen={appFeeOpen}
        onClose={() => setAppFeeOpen(false)}
        providerId={providerId}
        currentCustom={detail.appFeeCustom}
        currentPercentage={detail.appFeePercentage != null ? Number(detail.appFeePercentage) : null}
        systemDefault={systemDefaultAppFee ?? 0}
        onSaved={onSaved}
      />
    </div>
  )
}
