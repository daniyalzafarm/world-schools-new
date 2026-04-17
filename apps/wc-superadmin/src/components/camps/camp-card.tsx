'use client'

import { addToast, Button, Card, CardBody, Chip, type ChipProps } from '@heroui/react'
import { Eye, MapPin, Tent } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { campsService } from '@/services/camps.services'
import config from '@/config/config'
import type { AdminCampStatus, CampSummary } from '@/types/camps'

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

interface CampCardProps {
  camp: CampSummary
}

export function CampCard({ camp }: CampCardProps) {
  const router = useRouter()

  const handleView = () => router.push(`/camps/${camp.id}`)

  const handleViewOnBookingApp = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
    <div className="cursor-pointer" onClick={handleView} role="article">
      <Card
        className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        shadow="sm"
      >
        <CardBody className="p-0">
          {/* Hero image / gradient */}
          <div className="relative h-40 w-full overflow-hidden">
            {camp.coverImageUrl ? (
              <img
                src={camp.coverImageUrl}
                alt={camp.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/30 to-secondary/60">
                <Tent className="h-12 w-12 text-white/50" />
              </div>
            )}
            {/* Status badge */}
            <div className="absolute right-2 top-2">
              <Chip size="sm" color={getCampStatusColor(camp.status)}>
                {getCampStatusLabel(camp.status)}
              </Chip>
            </div>
          </div>

          {/* Card content */}
          <div className="space-y-2 p-4">
            <p className="truncate text-xs text-default-500">{camp.providerName}</p>
            <h3
              className="truncate font-semibold text-foreground hover:text-foreground-600 cursor-pointer underline"
              onClick={handleViewOnBookingApp}
            >
              {camp.name}
            </h3>
            {camp.location && (
              <div className="flex items-center gap-1 text-xs text-default-400">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{camp.location}</span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex gap-4 border-t border-default-100 pt-2 text-center text-sm">
              <div className="flex-1">
                <div className="font-semibold text-foreground">
                  {camp.averageRating !== null ? camp.averageRating.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-default-400">Rating</div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{camp.totalBookings}</div>
                <div className="text-xs text-default-400">Bookings</div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{camp.sessionsCount}</div>
                <div className="text-xs text-default-400">Sessions</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="flat"
                className="flex-1"
                startContent={<Eye className="h-3.5 w-3.5" />}
                onPress={handleView}
              >
                View
              </Button>
              {camp.status === 'pending_review' && (
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  className="flex-1"
                  onPress={handleView}
                >
                  Review
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
