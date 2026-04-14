'use client'

import { Button, Chip, type ChipProps, TableCell, TableRow } from '@heroui/react'
import { Eye, MapPin, Star, Tent } from 'lucide-react'
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

interface CampListItemProps {
  camp: CampSummary
  onView: (id: string) => void
}

export function CampListItem({ camp, onView }: CampListItemProps) {
  return (
    <TableRow key={camp.id} className="cursor-pointer" onClick={() => onView(camp.id)}>
      {/* Camp name + provider */}
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
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-secondary/60">
                <Tent className="h-4 w-4 text-white/60" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{camp.name}</div>
            <div className="truncate text-xs text-default-400">{camp.providerName}</div>
          </div>
        </div>
      </TableCell>

      {/* Location */}
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

      {/* Status */}
      <TableCell>
        <Chip size="sm" color={getCampStatusColor(camp.status)} variant="flat">
          {getCampStatusLabel(camp.status)}
        </Chip>
      </TableCell>

      {/* Rating */}
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

      {/* Bookings */}
      <TableCell>
        <span className="text-sm font-medium text-foreground">{camp.totalBookings}</span>
      </TableCell>

      {/* Sessions */}
      <TableCell>
        <span className="text-sm font-medium text-foreground">{camp.sessionsCount}</span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          onPress={() => onView(camp.id)}
          aria-label={`View ${camp.name}`}
          onClick={e => e.stopPropagation()}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
