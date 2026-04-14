'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import {
  Clock,
  DollarSign,
  ExternalLink,
  Flag,
  Mail,
  MapPin,
  Star,
  Tag,
  Tent,
  Users,
} from 'lucide-react'
import { CollapsibleSection, StarRating } from '@world-schools/ui-web'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageSlot } from '@/components/layout/page-slot'
import { useCampsStore } from '@/stores/camps-store'
import { campsService } from '@/services/camps.services'
import type {
  AdminCampStatus,
  AgeGroup,
  CampBookingItem,
  CampDetail,
  CampReviewItem,
  CampSessionItem,
  CampUpcomingSession,
  PaginatedCampSubResponse,
} from '@/types/camps'

// ─── Inline helpers ────────────────────────────────────────────────────────

const getCampStatusColor = (status: AdminCampStatus): ChipProps['color'] => {
  const map: Record<AdminCampStatus, ChipProps['color']> = {
    published: 'success',
    draft: 'default',
    archived: 'default',
    pending_review: 'warning',
    suspended: 'danger',
  }
  return map[status]
}

const getCampStatusLabel = (status: AdminCampStatus): string => {
  const map: Record<AdminCampStatus, string> = {
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
    pending_review: 'Pending Review',
    suspended: 'Suspended',
  }
  return map[status]
}

const getSessionStatusColor = (status: string): ChipProps['color'] => {
  switch (status) {
    case 'upcoming':
      return 'primary'
    case 'full':
      return 'danger'
    case 'active':
      return 'success'
    default:
      return 'default'
  }
}

const formatDate = (d?: string | null): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

const formatAgeRange = (groups: AgeGroup[]): string => {
  if (!groups.length) return '—'
  const min = Math.min(...groups.map(g => g.min))
  const max = Math.max(...groups.map(g => g.max))
  return `${min}–${max} yrs`
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?'

// ─── Main Page Component ───────────────────────────────────────────────────

export default function CampDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { detail, isLoading, error, fetchDetail, clearDetail } = useCampsStore()

  useEffect(() => {
    if (campId) void fetchDetail(campId)
    return () => clearDetail()
  }, [campId, fetchDetail, clearDetail])

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
        <Card className="border-danger-200 bg-danger-50">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      </PageSlot>
    )
  }

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Camps', href: '/camps' }, { label: detail.name }]} />

        {/* Hero card */}
        <HeroCampCard detail={detail} router={router} />

        {/* Tabbed content */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            <Tabs
              aria-label="Camp detail sections"
              variant="underlined"
              classNames={{
                base: 'border-b border-default-200 px-4 pt-2',
                tabList: 'p-0!',
                panel: 'p-6',
              }}
            >
              <Tab key="overview" title="Overview">
                <OverviewTab detail={detail} router={router} />
              </Tab>
              <Tab key="camp-details" title="Camp Details">
                <CampDetailsTab detail={detail} />
              </Tab>
              <Tab key="sessions" title={`Sessions (${detail.sessionsCount})`}>
                <SessionsTab campId={detail.id} />
              </Tab>
              <Tab key="bookings" title={`Bookings (${detail.totalBookings})`}>
                <BookingsTab campId={detail.id} />
              </Tab>
              <Tab key="reviews" title={`Reviews (${detail.totalReviews})`}>
                <ReviewsTab campId={detail.id} detail={detail} />
              </Tab>
              <Tab key="activity" title="Activity Log">
                <ActivityLogTab />
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </PageSlot>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function HeroCampCard({
  detail,
  router,
}: {
  detail: CampDetail
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card
      className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      shadow="sm"
    >
      {/* Hero image / gradient */}
      <div className="relative h-48 w-full">
        {(detail.photos.find(p => p.isPrimary)?.url ?? detail.photos[0]?.url) ? (
          <img
            src={detail.photos.find(p => p.isPrimary)?.url ?? detail.photos[0].url}
            alt={detail.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/40 via-primary/20 to-secondary/50">
            <Tent className="h-16 w-16 text-white/30" />
          </div>
        )}
      </div>

      <CardBody className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{detail.name}</h1>
            <button
              className="text-sm text-primary hover:underline"
              onClick={() => router.push(`/providers/${detail.providerId}`)}
            >
              {detail.providerName}
            </button>
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" color={getCampStatusColor(detail.status)} variant="flat">
                {getCampStatusLabel(detail.status)}
              </Chip>
              {detail.isFeatured && (
                <Chip
                  size="sm"
                  variant="flat"
                  className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  Featured
                </Chip>
              )}
              {detail.isVerified && (
                <Chip size="sm" color="success" variant="flat">
                  Verified
                </Chip>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: key details */}
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-default-600">
              <MapPin className="h-4 w-4 text-default-400" />
              {detail.location || '—'}
            </span>
            <span className="flex items-center gap-1.5 text-default-600">
              <Users className="h-4 w-4 text-default-400" />
              Ages {formatAgeRange(detail.ageGroups)}
            </span>
            <span className="flex items-center gap-1.5 text-default-600">
              <Tag className="h-4 w-4 text-default-400" />
              {detail.type === 'day'
                ? 'Day Camp'
                : detail.type === 'residential'
                  ? 'Residential'
                  : '—'}
            </span>
            <span className="flex items-center gap-1.5 text-default-600">
              <DollarSign className="h-4 w-4 text-default-400" />
              {detail.priceMin !== null && detail.priceMax !== null
                ? `${formatCurrency(detail.priceMin)} – ${formatCurrency(detail.priceMax)}`
                : '—'}
            </span>
          </div>

          {/* Right: key stats */}
          <div className="flex gap-6 text-center text-sm">
            <div>
              <div className="text-lg font-bold text-foreground">{detail.sessionsCount}</div>
              <div className="text-xs text-default-500">Sessions</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">{detail.totalBookings}</div>
              <div className="text-xs text-default-500">Bookings</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {detail.averageRating !== null ? detail.averageRating.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-default-500">Rating</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {formatCurrency(detail.totalRevenue)}
              </div>
              <div className="text-xs text-default-500">Revenue</div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function OverviewTab({
  detail,
  router,
}: {
  detail: CampDetail
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        <StatsGridCard detail={detail} />
        <CampSummaryCard detail={detail} />
        <UpcomingSessionsCard sessions={detail.upcomingSessions} />
      </div>

      {/* Right column — 1/3 */}
      <div className="space-y-6">
        <QuickActionsCard detail={detail} router={router} />
        <ProviderInfoCard detail={detail} router={router} />
        <RatingSummaryCard detail={detail} />
      </div>
    </div>
  )
}

function StatsGridCard({ detail }: { detail: CampDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card shadow="none" className="border border-default-200">
        <CardBody className="p-4">
          <div className="text-xs text-default-500">Total Bookings</div>
          <div className="text-2xl font-bold text-foreground">{detail.totalBookings}</div>
        </CardBody>
      </Card>
      <Card shadow="none" className="border border-default-200">
        <CardBody className="p-4">
          <div className="text-xs text-default-500">Total Revenue</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(detail.totalRevenue)}
          </div>
        </CardBody>
      </Card>
      <Card shadow="none" className="border border-default-200">
        <CardBody className="p-4">
          <div className="text-xs text-default-500">Avg Occupancy</div>
          <div className="text-2xl font-bold text-foreground">
            {detail.avgOccupancy !== null ? `${detail.avgOccupancy}%` : '—'}
          </div>
        </CardBody>
      </Card>
      <Card shadow="none" className="border border-default-200">
        <CardBody className="p-4">
          <div className="text-xs text-default-500">Avg Rating</div>
          <div className="text-2xl font-bold text-foreground">
            {detail.averageRating !== null ? detail.averageRating.toFixed(1) : '—'}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function CampSummaryCard({ detail }: { detail: CampDetail }) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-4">
        <h3 className="font-semibold text-foreground">Camp Summary</h3>
        {detail.description && (
          <p className="text-sm text-default-600 leading-relaxed">{detail.description}</p>
        )}
        {detail.primaryFocus.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-default-500">Primary Focus</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.primaryFocus.map(f => (
                <Chip key={f} size="sm" color="primary" variant="flat">
                  {f}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {detail.keyActivities.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-default-500">Key Activities</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.keyActivities.map(a => (
                <Chip key={a} size="sm" variant="flat">
                  {a}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function UpcomingSessionsCard({ sessions }: { sessions: CampUpcomingSession[] }) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Upcoming Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-default-400">No upcoming sessions.</p>
        ) : (
          <Table
            aria-label="Upcoming sessions"
            classNames={{ wrapper: 'shadow-none p-0' }}
            removeWrapper
          >
            <TableHeader>
              <TableColumn className="text-xs font-semibold uppercase text-default-500">
                Session
              </TableColumn>
              <TableColumn className="text-xs font-semibold uppercase text-default-500">
                Dates
              </TableColumn>
              <TableColumn className="text-xs font-semibold uppercase text-default-500">
                Capacity
              </TableColumn>
              <TableColumn className="text-xs font-semibold uppercase text-default-500">
                Status
              </TableColumn>
            </TableHeader>
            <TableBody items={sessions}>
              {session => (
                <TableRow key={session.id}>
                  <TableCell>
                    <span className="text-sm font-medium">{session.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-default-500">
                      {formatDate(session.startDate)} – {formatDate(session.endDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CapacityBar session={session} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      color={getSessionStatusColor(session.status)}
                      variant="flat"
                      className="capitalize"
                    >
                      {session.status}
                    </Chip>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  )
}

function CapacityBar({ session }: { session: CampUpcomingSession }) {
  const pct = session.capacity > 0 ? (session.enrolled / session.capacity) * 100 : 0
  const colorClass =
    session.enrolled >= session.capacity ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-success'

  return (
    <div className="min-w-28 space-y-1">
      <div className="flex justify-between text-xs text-default-500">
        <span>
          {session.enrolled}/{session.capacity}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-default-200">
        <div
          className={`h-1.5 rounded-full ${colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function QuickActionsCard({
  detail,
  router,
}: {
  detail: CampDetail
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground">Quick Actions</h3>
        <Button
          variant="flat"
          className="w-full justify-start"
          startContent={<ExternalLink className="h-4 w-4" />}
        >
          View Public Page
        </Button>
        <Button
          variant="flat"
          className="w-full justify-start"
          startContent={<Mail className="h-4 w-4" />}
          onPress={() => router.push(`/providers/${detail.providerId}`)}
        >
          Contact Provider
        </Button>
        <Button
          variant="flat"
          color="warning"
          className="w-full justify-start"
          startContent={<Flag className="h-4 w-4" />}
        >
          Flag for Review
        </Button>
      </CardBody>
    </Card>
  )
}

function ProviderInfoCard({
  detail,
  router,
}: {
  detail: CampDetail
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Provider</h3>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            {getInitials(detail.providerName)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{detail.providerName}</div>
            <div className="text-xs text-default-400">
              Member since {formatDate(detail.providerMemberSince)}
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-center text-sm">
          <div className="flex-1 rounded-lg bg-default-100 p-2">
            <div className="font-semibold text-foreground">{detail.providerCampsCount}</div>
            <div className="text-xs text-default-500">Camps</div>
          </div>
          {detail.providerAvgRating !== null && (
            <div className="flex-1 rounded-lg bg-default-100 p-2">
              <div className="font-semibold text-foreground">
                {detail.providerAvgRating.toFixed(1)}★
              </div>
              <div className="text-xs text-default-500">Avg Rating</div>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="flat"
          color="primary"
          className="w-full"
          onPress={() => router.push(`/providers/${detail.providerId}`)}
        >
          View Provider
        </Button>
      </CardBody>
    </Card>
  )
}

function RatingSummaryCard({ detail }: { detail: CampDetail }) {
  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Rating Summary</h3>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-foreground">
            {detail.averageRating !== null ? detail.averageRating.toFixed(1) : '—'}
          </span>
          <div>
            {detail.averageRating !== null && (
              <StarRating
                rating={detail.averageRating}
                color="yellow"
                showRating={false}
                size={14}
              />
            )}
            <span className="text-xs text-default-400">{detail.totalReviews} reviews</span>
          </div>
        </div>
        {/* Distribution bars */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map(stars => {
            const entry = detail.ratingsDistribution.find(r => r.stars === stars)
            const count = entry?.count ?? 0
            const pct =
              detail.totalReviews > 0 ? Math.round((count / detail.totalReviews) * 100) : 0
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-2 shrink-0 text-default-500">{stars}</span>
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                <div className="h-1.5 flex-1 rounded-full bg-default-200">
                  <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-5 shrink-0 text-right text-default-400">{count}</span>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

function CampDetailsTab({ detail }: { detail: CampDetail }) {
  return (
    <div className="space-y-3">
      <CollapsibleSection title="Basic Information" defaultOpen>
        <div className="space-y-2 text-sm">
          <InfoRow label="Camp Name">{detail.name}</InfoRow>
          <InfoRow label="Type">
            {detail.type === 'day'
              ? 'Day Camp'
              : detail.type === 'residential'
                ? 'Residential'
                : '—'}
          </InfoRow>
          <InfoRow label="Gender">
            {detail.gender === 'coed'
              ? 'Co-ed'
              : detail.gender === 'boys'
                ? 'Boys'
                : detail.gender === 'girls'
                  ? 'Girls'
                  : '—'}
          </InfoRow>
          <InfoRow label="Location">{detail.location || '—'}</InfoRow>
          <InfoRow label="Ages">{formatAgeRange(detail.ageGroups)}</InfoRow>
          <InfoRow label="Price Range">
            {detail.priceMin !== null && detail.priceMax !== null
              ? `${formatCurrency(detail.priceMin)} – ${formatCurrency(detail.priceMax)}`
              : '—'}
          </InfoRow>
          <InfoRow label="Status">
            <Chip size="sm" color={getCampStatusColor(detail.status)} variant="flat">
              {getCampStatusLabel(detail.status)}
            </Chip>
          </InfoRow>
          <InfoRow label="Listed">{formatDate(detail.createdAt)}</InfoRow>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Focus & Philosophy">
        <div className="space-y-3">
          {detail.primaryFocus.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-default-500">Primary Focus</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.primaryFocus.map(f => (
                  <Chip key={f} size="sm" color="primary" variant="flat">
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {detail.description && (
            <p className="text-sm text-default-600 leading-relaxed">{detail.description}</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="What's Included">
        {detail.keyActivities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {detail.keyActivities.map(a => (
              <Chip key={a} size="sm" variant="flat">
                {a}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-default-400">No activities listed.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Accommodation">
        <p className="text-sm text-default-400">Accommodation details coming soon.</p>
      </CollapsibleSection>

      <CollapsibleSection title="Meals">
        <p className="text-sm text-default-400">Meals details coming soon.</p>
      </CollapsibleSection>
    </div>
  )
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────

const SESSION_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
]

function SessionsTab({ campId }: { campId: string }) {
  const [data, setData] = useState<PaginatedCampSubResponse<CampSessionItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setIsLoading(true)
    campsService
      .getCampSessions(campId, {
        page,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [campId, page, statusFilter])

  const handleFilterChange = (key: string) => {
    setStatusFilter(key)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2">
        {SESSION_STATUS_FILTERS.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={statusFilter === f.key ? 'solid' : 'flat'}
            color={statusFilter === f.key ? 'primary' : 'default'}
            onPress={() => handleFilterChange(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table aria-label="Camp sessions" removeWrapper>
              <TableHeader>
                <TableColumn>SESSION</TableColumn>
                <TableColumn>DATES</TableColumn>
                <TableColumn>PRICE</TableColumn>
                <TableColumn>CAPACITY</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody items={data?.data ?? []} emptyContent="No sessions found">
                {session => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{session.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-500">
                        {formatDate(session.startDate)} – {formatDate(session.endDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {session.pricingType === 'free' ? 'Free' : formatCurrency(session.price)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CapacityBar
                        session={{
                          id: session.id,
                          name: session.name,
                          startDate: session.startDate,
                          endDate: session.endDate,
                          capacity: session.totalSpots,
                          enrolled: session.enrolledCount,
                          status: 'upcoming',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={session.status === 'published' ? 'success' : 'default'}
                        variant="flat"
                        className="capitalize"
                      >
                        {session.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination showControls total={data.totalPages} page={page} onChange={setPage} />
            </div>
          )}
          {data && (
            <p className="text-center text-xs text-default-400">
              {data.total} session{data.total !== 1 ? 's' : ''} total
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────

const BOOKING_STATUS_COLOR_MAP: Record<string, ChipProps['color']> = {
  request: 'warning',
  accepted: 'primary',
  deposit_paid: 'primary',
  fully_paid: 'primary',
  at_camp: 'success',
  completed: 'success',
  declined: 'danger',
  expired: 'default',
  cancelled: 'danger',
}

const BOOKING_STATUS_LABEL_MAP: Record<string, string> = {
  request: 'Requested',
  accepted: 'Accepted',
  deposit_paid: 'Deposit Paid',
  fully_paid: 'Fully Paid',
  at_camp: 'At Camp',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

const BOOKING_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'request', label: 'Requests' },
  { key: 'deposit_paid', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

function BookingsTab({ campId }: { campId: string }) {
  const [data, setData] = useState<PaginatedCampSubResponse<CampBookingItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setIsLoading(true)
    campsService
      .getCampBookings(campId, {
        page,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [campId, page, statusFilter])

  const handleFilterChange = (key: string) => {
    setStatusFilter(key)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {BOOKING_STATUS_FILTERS.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={statusFilter === f.key ? 'solid' : 'flat'}
            color={statusFilter === f.key ? 'primary' : 'default'}
            onPress={() => handleFilterChange(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table aria-label="Camp bookings" removeWrapper>
              <TableHeader>
                <TableColumn>BOOKING #</TableColumn>
                <TableColumn>SESSION</TableColumn>
                <TableColumn>PARENT</TableColumn>
                <TableColumn>CHILDREN</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>DATE</TableColumn>
              </TableHeader>
              <TableBody items={data?.data ?? []} emptyContent="No bookings found">
                {booking => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium text-foreground">
                        {booking.bookingGroupNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {booking.sessionName}
                        </div>
                        <div className="text-xs text-default-400">
                          {formatDate(booking.sessionStartDate)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{booking.parentName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {booking.childrenCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(booking.totalAmount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={BOOKING_STATUS_COLOR_MAP[booking.status] ?? 'default'}
                        variant="flat"
                      >
                        {BOOKING_STATUS_LABEL_MAP[booking.status] ?? booking.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-500">
                        {formatDate(booking.requestedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination showControls total={data.totalPages} page={page} onChange={setPage} />
            </div>
          )}
          {data && (
            <p className="text-center text-xs text-default-400">
              {data.total} booking{data.total !== 1 ? 's' : ''} total
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────

const RETURN_CHOICE_COLOR: Record<string, ChipProps['color']> = {
  yes: 'success',
  yes_definitely: 'success',
  would_return: 'success',
  maybe: 'warning',
  no: 'danger',
}

const RETURN_CHOICE_LABEL: Record<string, string> = {
  yes: 'Would Return',
  yes_definitely: 'Would Return',
  would_return: 'Would Return',
  maybe: 'Maybe',
  no: "Wouldn't Return",
}

const REVIEW_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
]

const REVIEW_STATUS_COLOR: Record<string, ChipProps['color']> = {
  published: 'success',
  pending: 'warning',
  draft: 'default',
  rejected: 'danger',
}

function ReviewsTab({ campId, detail }: { campId: string; detail: CampDetail }) {
  const [data, setData] = useState<PaginatedCampSubResponse<CampReviewItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setIsLoading(true)
    campsService
      .getCampReviews(campId, {
        page,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [campId, page, statusFilter])

  const handleFilterChange = (key: string) => {
    setStatusFilter(key)
    setPage(1)
  }

  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  return (
    <div className="space-y-6">
      {/* Rating summary */}
      {detail.totalReviews > 0 && (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-default-200 p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-foreground">
              {detail.averageRating !== null ? detail.averageRating.toFixed(1) : '—'}
            </span>
            <div>
              {detail.averageRating !== null && (
                <StarRating
                  rating={detail.averageRating}
                  color="yellow"
                  showRating={false}
                  size={14}
                />
              )}
              <span className="text-xs text-default-400">{detail.totalReviews} reviews</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1 min-w-40">
            {[5, 4, 3, 2, 1].map(stars => {
              const entry = detail.ratingsDistribution.find(r => r.stars === stars)
              const count = entry?.count ?? 0
              const pct =
                detail.totalReviews > 0 ? Math.round((count / detail.totalReviews) * 100) : 0
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-2 shrink-0 text-default-500">{stars}</span>
                  <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  <div className="h-1.5 flex-1 rounded-full bg-default-200">
                    <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-5 shrink-0 text-right text-default-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_STATUS_FILTERS.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={statusFilter === f.key ? 'solid' : 'flat'}
            color={statusFilter === f.key ? 'primary' : 'default'}
            onPress={() => handleFilterChange(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      ) : data?.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-default-400">No reviews found.</p>
      ) : (
        <>
          <div className="space-y-3">
            {(data?.data ?? []).map(review => (
              <Card key={review.id} shadow="none" className="border border-default-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white">
                      {getInitials(review.parentName)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{review.parentName}</span>
                        {review.happinessRating !== null && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < (review.happinessRating ?? 0)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-default-300'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <Chip
                          size="sm"
                          color={REVIEW_STATUS_COLOR[review.status] ?? 'default'}
                          variant="flat"
                          className="capitalize"
                        >
                          {review.status}
                        </Chip>
                        {review.returnChoice && RETURN_CHOICE_LABEL[review.returnChoice] && (
                          <Chip
                            size="sm"
                            color={RETURN_CHOICE_COLOR[review.returnChoice] ?? 'default'}
                            variant="flat"
                          >
                            {RETURN_CHOICE_LABEL[review.returnChoice]}
                          </Chip>
                        )}
                      </div>

                      {/* Visit info */}
                      {(review.visitMonth || review.visitYear) && (
                        <p className="text-xs text-default-400">
                          Visited {review.visitMonth ? MONTH_NAMES[review.visitMonth - 1] : ''}{' '}
                          {review.visitYear ?? ''}
                          {review.kidCount > 0
                            ? ` · ${review.kidCount} child${review.kidCount !== 1 ? 'ren' : ''}`
                            : ''}
                        </p>
                      )}

                      {/* Review text */}
                      {review.reviewText && (
                        <p className="text-sm leading-relaxed text-default-600">
                          {review.reviewText}
                        </p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination showControls total={data.totalPages} page={page} onChange={setPage} />
            </div>
          )}
          {data && (
            <p className="text-center text-xs text-default-400">
              {data.total} review{data.total !== 1 ? 's' : ''} total
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────

function ActivityLogTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-default-100">
        <Clock className="h-7 w-7 text-default-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Activity Log</h3>
      <p className="mt-1 max-w-xs text-sm text-default-400">
        Audit events will appear here once activity logging is enabled.
      </p>
    </div>
  )
}

// ─── Shared helper ─────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-default-500">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  )
}
