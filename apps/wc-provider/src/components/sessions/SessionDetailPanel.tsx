'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import { Input, useConfirmDialog } from '@world-schools/ui-web'
import { CheckCircle, Copy, Edit, Trash2, X } from 'lucide-react'
import type { Session } from '@/types/sessions'
import type { AgeGroup } from '@/types/camps'
import { formatDateRange } from '@/utils/sessionFormatters'

interface SessionDetailPanelProps {
  session: Session | null
  ageGroups?: AgeGroup[]
  onClose: () => void
  onEdit: (session: Session) => void
  onDuplicate: (session: Session) => void
  onDelete: (session: Session) => void
  onPublish: (session: Session) => void
  onUpdateSpots: (sessionId: string, spots: number | Record<string, number>) => Promise<void>
}

/**
 * Session Detail Panel Component
 * Displays detailed information about a selected session in a side panel
 */
export function SessionDetailPanel({
  session,
  ageGroups = [],
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onPublish,
  onUpdateSpots,
}: SessionDetailPanelProps) {
  const { confirm } = useConfirmDialog()
  const [isEditingSpots, setIsEditingSpots] = useState(false)
  const [spotsValue, setSpotsValue] = useState<number>(session?.totalSpots ?? 0)
  const [ageGroupSpotsValues, setAgeGroupSpotsValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    session?.ageGroupSpots?.forEach(ags => {
      initial[ags.ageGroupId] = ags.spots
    })
    return initial
  })

  if (!session) {
    return null
  }

  const hasBookings = (session.bookedCount ?? 0) > 0
  const spotsLeft =
    session.availabilityType === 'single'
      ? (session.totalSpots ?? 0) - (session.bookedCount ?? 0)
      : (session.ageGroupSpots?.reduce((sum, ags) => sum + ags.spots, 0) ??
        0 - (session.bookedCount ?? 0))

  // Calculate status
  const getStatus = () => {
    if (session.status === 'draft') return 'draft'
    if (spotsLeft === 0) return 'full'
    if (spotsLeft <= 5) return 'almost-full'
    return 'available'
  }

  const status = getStatus()

  const statusConfig = {
    available: {
      bg: 'bg-success-50',
      text: 'text-success-700',
      label: '🟢 Available',
      detail: `${spotsLeft} spots left`,
    },
    'almost-full': {
      bg: 'bg-warning-50',
      text: 'text-warning-700',
      label: '🟠 Almost Full',
      detail: `Only ${spotsLeft} spots left!`,
    },
    full: {
      bg: 'bg-danger-50',
      text: 'text-danger-700',
      label: '🔴 Fully Booked',
      detail: 'No spots available',
    },
    draft: {
      bg: 'bg-default-100',
      text: 'text-default-600',
      label: 'Draft',
      detail: 'Not published yet',
    },
  }

  const currentStatus = statusConfig[status]

  const handleSaveSpots = async () => {
    if (session.availabilityType === 'single') {
      await onUpdateSpots(session.id, spotsValue)
    } else {
      await onUpdateSpots(session.id, ageGroupSpotsValues)
    }
    setIsEditingSpots(false)
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Session?',
      message: `Are you sure you want to delete "${session.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      onDelete(session)
    }
  }

  const handleDuplicate = async () => {
    const confirmed = await confirm({
      title: 'Duplicate Session?',
      message: `Create a copy of "${session.name}"?`,
      confirmText: 'Duplicate',
      cancelText: 'Cancel',
      variant: 'info',
    })

    if (confirmed) {
      onDuplicate(session)
    }
  }

  const handlePublish = async () => {
    const confirmed = await confirm({
      title: 'Publish Session?',
      message:
        'This will make the session live and bookable by parents. Published sessions can still be edited.',
      confirmText: 'Publish',
      cancelText: 'Cancel',
      variant: 'info',
    })

    if (confirmed) {
      onPublish(session)
    }
  }

  const getAgeGroupLabel = (ageGroupId: string) => {
    const [min, max] = ageGroupId.split('-').map(Number)
    return `Ages ${min}-${max}`
  }

  const totalAgeGroupSpots = Object.values(ageGroupSpotsValues).reduce((sum, val) => sum + val, 0)

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-default-200">
        <h3 className="text-lg font-semibold text-default-900">Session Details</h3>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={onClose}
          className="text-default-500 hover:text-default-700"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Session Name */}
        <h2 className="text-xl font-semibold text-default-900">{session.name}</h2>

        {/* Status Indicator */}
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold ${currentStatus.bg} ${currentStatus.text}`}
        >
          <span>{currentStatus.label}</span>
          <span className="text-sm">- {currentStatus.detail}</span>
        </div>

        {/* Session Details */}
        <div className="space-y-3 pb-6 border-b border-default-200">
          <div className="flex justify-between text-sm">
            <span className="text-default-600">Dates</span>
            <span className="font-semibold text-default-900">
              {formatDateRange(session.startDate, session.endDate)}
            </span>
          </div>

          {session.sessionDayType === 'half_day' && (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Type</span>
              <span className="font-semibold text-default-900">
                Half-day ({session.arrivalTime} - {session.departureTime})
              </span>
            </div>
          )}

          {/* Price Display */}
          {session.pricingType === 'single' && session.price !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Price</span>
              <span className="font-semibold text-default-900">${session.price}</span>
            </div>
          )}

          {session.pricingType === 'age_group' && session.ageGroupPrices && (
            <>
              {session.ageGroupPrices.map((agp, index) => (
                <div key={agp.ageGroupId} className="flex justify-between text-sm">
                  <span className="text-default-600">{index === 0 ? 'Price' : ''}</span>
                  <span className="font-semibold text-default-900">
                    {getAgeGroupLabel(agp.ageGroupId)}: ${agp.price}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Spots Available Section */}
        <div className="space-y-3 pb-6 border-b border-default-200">
          <h4 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
            Spots Available
          </h4>

          {session.availabilityType === 'single' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={spotsValue.toString()}
                  onChange={e => setSpotsValue(parseInt(e.target.value) || 0)}
                  min={0}
                  className="max-w-[120px]"
                  classNames={{
                    input: 'text-center text-xl font-semibold',
                  }}
                  disabled={!isEditingSpots}
                />
                {!isEditingSpots ? (
                  <Button color="secondary" onPress={() => setIsEditingSpots(true)}>
                    Edit
                  </Button>
                ) : (
                  <Button color="primary" onPress={handleSaveSpots}>
                    Save
                  </Button>
                )}
              </div>
              <p className="text-xs text-default-500">Parents will see this on your camp profile</p>
            </div>
          ) : (
            <div className="space-y-3">
              {session.ageGroupSpots?.map(ags => (
                <div key={ags.ageGroupId} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-default-700 min-w-[100px]">
                    {getAgeGroupLabel(ags.ageGroupId)}
                  </span>
                  <Input
                    type="number"
                    value={ageGroupSpotsValues[ags.ageGroupId]?.toString() || '0'}
                    onChange={e =>
                      setAgeGroupSpotsValues(prev => ({
                        ...prev,
                        [ags.ageGroupId]: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    className="max-w-20"
                    classNames={{
                      input: 'text-center font-semibold',
                    }}
                    disabled={!isEditingSpots}
                  />
                </div>
              ))}
              {!isEditingSpots ? (
                <Button
                  color="secondary"
                  onPress={() => setIsEditingSpots(true)}
                  className="w-full"
                >
                  Edit
                </Button>
              ) : (
                <Button color="primary" onPress={handleSaveSpots} className="w-full">
                  Save
                </Button>
              )}
              <p className="text-sm text-default-500 text-right">Total: {totalAgeGroupSpots}</p>
            </div>
          )}
        </div>

        {/* Bookings Section */}
        <div className="space-y-3 pb-6 border-b border-default-200">
          <div className="bg-default-100 rounded-lg p-4">
            <div className="text-sm text-default-600 mb-1">Bookings</div>
            <div className="text-2xl font-bold text-default-900">
              {hasBookings
                ? `${session.bookedCount} booking${session.bookedCount! > 1 ? 's' : ''}`
                : 'No bookings yet'}
            </div>
            {hasBookings && (
              <button className="text-sm font-semibold text-default-900 underline decoration-dotted underline-offset-2 hover:text-primary-600 mt-2">
                See all
              </button>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <h4 className="text-sm mb-2 font-semibold text-default-600 uppercase tracking-wide">
          Actions
        </h4>
        <div className="space-y-3">
          {session.status === 'draft' && (
            <Button
              color="primary"
              startContent={<CheckCircle className="w-4 h-4" />}
              onPress={handlePublish}
              className="w-full justify-start py-5"
            >
              Publish Session
            </Button>
          )}
          <Button
            variant="bordered"
            color="success"
            startContent={<Edit className="w-4 h-4" />}
            onPress={() => onEdit(session)}
            className="w-full justify-start py-5"
          >
            Edit Session
          </Button>
          <Button
            variant="bordered"
            color="default"
            startContent={<Copy className="w-4 h-4" />}
            onPress={handleDuplicate}
            className="w-full justify-start py-5"
          >
            Duplicate Session
          </Button>
          {!hasBookings && (
            <Button
              variant="bordered"
              color="danger"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={handleDelete}
              className="w-full justify-start py-5"
            >
              Delete Session
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
