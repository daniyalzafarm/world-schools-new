'use client'

import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Progress,
} from '@heroui/react'
import { Ban, Calendar, Copy, Edit, MoreVertical, Trash2 } from 'lucide-react'
import type { Session } from '@/types/sessions'
import { SessionStatusBadge } from './shared/SessionStatusBadge'
import { SessionCapacityIndicator } from './shared/SessionCapacityIndicator'
import { SessionPricingDisplay } from './shared/SessionPricingDisplay'
import { formatDateRange } from '@/utils/sessionFormatters'
import { calculateCapacityPercentage } from '@/utils/sessionCalculations'

interface SessionCardProps {
  session: Session
  /** Camp's settlement currency (ISO 4217). Required. */
  currency: string
  onEdit: (session: Session) => void
  onDelete: (session: Session) => void
  onDuplicate: (session: Session) => void
  onToggleStatus: (session: Session) => void
}

/**
 * Session Card Component
 * Displays a single session with actions
 */
export function SessionCard({
  session,
  currency,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
}: SessionCardProps) {
  const capacityPercentage = calculateCapacityPercentage(session.totalSpots, session.bookedCount)
  const isFull =
    session.totalSpots !== undefined && (session.bookedCount ?? 0) >= session.totalSpots

  return (
    <Card className="border border-default-200 hover:border-default-300 transition-colors">
      <CardBody className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-bold text-default-900 truncate">{session.name}</h3>
                <SessionStatusBadge status={session.status} />
              </div>
              <div className="flex items-center gap-2 text-default-600">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-sm">
                  {formatDateRange(session.startDate, session.endDate)}
                </span>
              </div>
            </div>

            {/* Actions Menu */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="text-default-500 hover:text-default-700"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Session actions">
                <DropdownItem
                  key="edit"
                  startContent={<Edit className="w-4 h-4" />}
                  onPress={() => onEdit(session)}
                >
                  Edit Session
                </DropdownItem>
                <DropdownItem
                  key="duplicate"
                  startContent={<Copy className="w-4 h-4" />}
                  onPress={() => onDuplicate(session)}
                >
                  Duplicate Session
                </DropdownItem>
                <DropdownItem
                  key="toggle"
                  startContent={<Ban className="w-4 h-4" />}
                  onPress={() => onToggleStatus(session)}
                >
                  {session.status === 'published' ? 'Set to Draft' : 'Publish'}
                </DropdownItem>
                <DropdownItem
                  key="delete"
                  className="text-danger"
                  color="danger"
                  startContent={<Trash2 className="w-4 h-4" />}
                  onPress={() => onDelete(session)}
                >
                  Delete Session
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          {/* Pricing */}
          <div className="flex items-center justify-between">
            <SessionPricingDisplay
              pricingType={session.pricingType}
              price={session.price}
              ageGroupPrices={session.ageGroupPrices}
              currency={currency}
              variant="compact"
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-default-600">Capacity</span>
              <SessionCapacityIndicator
                availabilityType={session.availabilityType}
                totalSpots={session.totalSpots}
                ageGroupSpots={session.ageGroupSpots}
                booked={session.bookedCount}
                showBooked
              />
            </div>
            {session.totalSpots !== undefined && (
              <Progress
                value={capacityPercentage ?? 0}
                color={
                  isFull
                    ? 'danger'
                    : capacityPercentage && capacityPercentage >= 80
                      ? 'warning'
                      : 'success'
                }
                size="sm"
                className="max-w-full"
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-default-200 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="flat"
              color="default"
              onPress={() => onDuplicate(session)}
              startContent={<Copy className="w-4 h-4" />}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={() => onEdit(session)}
              startContent={<Edit className="w-4 h-4" />}
            >
              Edit
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
