'use client'

import { Button, Card, CardBody } from '@heroui/react'
import { Ban, Calendar, Clock, DollarSign, Plus } from 'lucide-react'

interface FlexibleSessionsEmptyStateProps {
  onCreateSession: () => void
  canChangeType?: boolean
  onChangeSessionType?: () => void
}

/**
 * Flexible Sessions Empty State Component
 * Shown when no flexible sessions exist yet
 * Reference: Design flex-session-2.png
 */
export function FlexibleSessionsEmptyState({
  onCreateSession,
  canChangeType = false,
  onChangeSessionType,
}: FlexibleSessionsEmptyStateProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-2 border-dashed border-default-300">
        <CardBody className="p-8">
          <div className="text-center flex flex-col gap-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-primary-600 dark:text-primary-400" />
              </div>
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <h2 className="text-[24px] font-bold text-default-900">
                Create Your First Flexible Session
              </h2>
              <p className="text-[16px] text-default-600 max-w-xl mx-auto leading-relaxed">
                Flexible sessions let parents choose their own start date and duration. Perfect for
                camps that run continuously throughout the year.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Flexible Start Dates
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Parents pick any date within your session range
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Multiple Durations
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Offer 1-12 week options with different pricing
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Flexible Pricing
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Set different prices for each duration option
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-danger-100 dark:bg-danger-900 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Blackout Dates
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Block specific dates when camp is closed
                  </p>
                </div>
              </div>
            </div>

            {/* Example */}
            <div className="bg-default-100 dark:bg-default-800 rounded-xl p-6 w-full max-w-xl mx-auto">
              <p className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-3">
                Example
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Session Range:</span>
                  <span className="text-[13px] font-semibold text-default-900">
                    Jan 1 - Dec 31, 2024
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Duration Options:</span>
                  <span className="text-[13px] font-semibold text-default-900">
                    2, 4, 8, 12 weeks
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Pricing:</span>
                  <span className="text-[13px] font-semibold text-default-900">$800 - $3,200</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              {canChangeType && onChangeSessionType && (
                <Button
                  variant="bordered"
                  size="lg"
                  onPress={onChangeSessionType}
                  className="font-semibold"
                >
                  Change Session Type
                </Button>
              )}
              <Button
                color="primary"
                size="lg"
                startContent={<Plus className="w-5 h-5" />}
                onPress={onCreateSession}
                className="font-semibold"
              >
                Create Flexible Session
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
