'use client'

import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/react'
import { Ban, Calendar, Edit, MoreVertical, Trash2 } from 'lucide-react'
import type { FlexibleSession } from '@/types/sessions'
import { SessionStatusBadge } from '../shared/SessionStatusBadge'
import { SessionPricingDisplay } from '../shared/SessionPricingDisplay'
import { formatDateRange } from '@/utils/sessionFormatters'

interface FlexibleSessionCardProps {
  session: FlexibleSession
  onEdit: (session: FlexibleSession) => void
  onDelete: (session: FlexibleSession) => void
  onToggleStatus: (session: FlexibleSession) => void
}

/**
 * Flexible Session Card Component
 * Displays a single flexible session with actions
 * Reference: Design flex-session-3.1.png
 */
export function FlexibleSessionCard({
  session,
  onEdit,
  onDelete,
  onToggleStatus,
}: FlexibleSessionCardProps) {
  const hasBlackoutDates = session.blackoutDates && session.blackoutDates.length > 0

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
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-[14px]">
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

          {/* Blackout Dates */}
          {hasBlackoutDates && (
            <div>
              <p className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-2">
                Blackout Dates
              </p>
              <div className="flex items-center gap-2 text-default-600">
                <Ban className="w-4 h-4 shrink-0" />
                <span className="text-[13px]">
                  {session.blackoutDates!.length}{' '}
                  {session.blackoutDates!.length === 1 ? 'period' : 'periods'} blocked
                </span>
              </div>
            </div>
          )}

          {/* Footer Stats */}
          <div className="pt-4 border-t border-default-200 flex items-center justify-between">
            <div className="text-[13px] text-default-600">
              {session.capacity ? (
                <>
                  <span className="font-semibold text-default-900">Capacity:</span>{' '}
                  {session.capacity}
                </>
              ) : (
                <span className="text-default-500">Unlimited capacity</span>
              )}
            </div>
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
