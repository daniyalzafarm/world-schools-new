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
import type { FixedSession } from '@/types/sessions'
import { SessionStatusBadge } from '../shared/SessionStatusBadge'
import { SessionCapacityIndicator } from '../shared/SessionCapacityIndicator'
import { SessionPricingDisplay } from '../shared/SessionPricingDisplay'
import { formatDateRange } from '@/utils/sessionFormatters'
import { calculateCapacityPercentage } from '@/utils/sessionCalculations'

interface FixedSessionCardProps {
  session: FixedSession
  onEdit: (session: FixedSession) => void
  onDelete: (session: FixedSession) => void
  onDuplicate: (session: FixedSession) => void
  onToggleStatus: (session: FixedSession) => void
}

/**
 * Fixed Session Card Component
 * Displays a single fixed session with actions
 * Reference: Design fixed-session-1.2.png
 */
export function FixedSessionCard({
  session,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
}: FixedSessionCardProps) {
  const capacityPercentage = calculateCapacityPercentage(session.capacity, session.bookedCount)
  const isFull = session.capacity !== undefined && (session.bookedCount ?? 0) >= session.capacity

  return (
    <Card className="border border-default-200 hover:border-default-300 transition-colors">
      <CardBody className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-[18px] font-bold text-default-900 truncate">{session.name}</h3>
                <SessionStatusBadge isActive={session.isActive} />
              </div>
              <div className="flex items-center gap-2 text-default-600">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-[14px]">
                  {formatDateRange(session.sessionStartDate, session.sessionEndDate)}
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
                  {session.isActive ? 'Deactivate' : 'Activate'}
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
            <SessionPricingDisplay price={session.price} variant="compact" />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-default-600">Capacity</span>
              <SessionCapacityIndicator
                capacity={session.capacity}
                booked={session.bookedCount}
                showBooked
              />
            </div>
            {session.capacity !== undefined && (
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
